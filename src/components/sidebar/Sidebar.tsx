'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/useAuthStore'
import { useConversationStore, type ConversationWithDetails } from '@/lib/stores/useConversationStore'
import type { Database } from '@/lib/supabase/types'
import { cn, formatMessageTime, getInitials } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, SquarePen, Settings, MessageSquare, Users } from 'lucide-react'
import Link from 'next/link'
import { NewConversationDialog } from '@/components/sidebar/NewConversationDialog'
import { EnableNotificationsButton } from '@/components/pwa/PushManager'

type Profile = Database['public']['Tables']['profiles']['Row']

interface SidebarProps {
  currentUser: Profile
  onMobileNavToChat?: () => void
}

export function Sidebar({ currentUser, onMobileNavToChat }: SidebarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { setUser } = useAuthStore()
  const { conversations, setConversations, activeConversation, setIsLoading, isLoading } = useConversationStore()
  const [search, setSearch] = useState('')
  const [newChatOpen, setNewChatOpen] = useState(false)

  useEffect(() => {
    setUser(currentUser)
    loadConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    const { data: participantRows } = (await supabase
      .from('participants')
      .select('conversation_id')
      .eq('user_id', currentUser.id)) as unknown as { data: { conversation_id: string }[] }

    if (!participantRows?.length) {
      setConversations([])
      setIsLoading(false)
      return
    }

    const conversationIds = participantRows.map((p) => p.conversation_id)

    const { data: convoData } = (await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('created_at', { ascending: false })) as unknown as { data: Database['public']['Tables']['conversations']['Row'][] }

    if (!convoData) {
      setConversations([])
      setIsLoading(false)
      return
    }

    // Fetch participants with profiles for each conversation
    const enriched: ConversationWithDetails[] = await Promise.all(
      convoData.map(async (convo) => {
        const { data: parts } = await supabase
          .from('participants')
          .select('*, profile:profiles(*)')
          .eq('conversation_id', convo.id)

        const { data: lastMsg } = (await supabase
          .from('messages')
          .select('content, type, created_at, sender_id, is_secret')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()) as unknown as { data: { content: string | null, type: string, created_at: string, sender_id: string, is_secret: boolean } | null }

        return {
          ...convo,
          participants: (parts || []) as ConversationWithDetails['participants'],
          last_message: lastMsg || null,
        }
      })
    )

    // Sort by last message time
    enriched.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at
      const bTime = b.last_message?.created_at || b.created_at
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    setConversations(enriched)
    setIsLoading(false)
  }, [supabase, currentUser.id, setConversations, setIsLoading])

  // Real-time subscription for new messages (to update sidebar order/previews)
  useEffect(() => {
    const channel = supabase
      .channel('sidebar-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadConversations])

  function getConversationName(convo: ConversationWithDetails): string {
    if (convo.type === 'group' && convo.name) return convo.name
    const other = convo.participants.find((p) => p.user_id !== currentUser.id)
    return other?.profile?.display_name || other?.profile?.username || 'Unknown'
  }

  function getConversationAvatar(convo: ConversationWithDetails): string | null {
    if (convo.type === 'group') return convo.avatar_url
    const other = convo.participants.find((p) => p.user_id !== currentUser.id)
    return other?.profile?.avatar_url || null
  }

  function getLastMessagePreview(convo: ConversationWithDetails): string {
    if (!convo.last_message) return 'No messages yet'
    if ((convo.last_message as any).is_secret) return '💌 Love Note'
    if (convo.last_message.type === 'image') return '📷 Image'
    if (convo.last_message.type === 'audio') return '🎤 Voice message'
    return convo.last_message.content || ''
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const filtered = conversations.filter((c) =>
    getConversationName(c).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border safe-area-inset-top">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${currentUser.id}`}>
            <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarImage src={currentUser.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                {getInitials(currentUser.display_name || currentUser.username)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-none">Chats</h1>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Link href="/search" className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground' })}>
            <Search className="h-5 w-5" />
          </Link>
          <Link href="/contacts" className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground' })}>
            <Users className="h-5 w-5" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setNewChatOpen(true)}
          >
            <SquarePen className="h-5 w-5" />
          </Button>
          <EnableNotificationsButton />
          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-0 h-9 text-sm"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-11 w-11 rounded-full shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-[60%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          filtered.map((convo) => {
            const isActive = activeConversation?.id === convo.id
            return (
              <button
                key={convo.id}
                onClick={() => {
                  router.push(`/c/${convo.id}`)
                  onMobileNavToChat?.()
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  'hover:bg-secondary/60',
                  isActive && 'bg-secondary'
                )}
              >
                <Avatar className="h-11 w-11 flex-shrink-0">
                  <AvatarImage src={getConversationAvatar(convo) || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(getConversationName(convo))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {getConversationName(convo)}
                    </span>
                    {convo.last_message && (
                      <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">
                        {formatMessageTime(convo.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {getLastMessagePreview(convo)}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>

      <NewConversationDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        currentUserId={currentUser.id}
      />
    </div>
  )
}
