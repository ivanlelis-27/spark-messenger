'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/useAuthStore'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Loader2, MessageSquare, Users } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function ContactsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user: currentUser } = useAuthStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [startingChat, setStartingChat] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      // Load some recent or all users if no query
      const fetchInitialInfo = async () => {
         setSearching(true)
         const { data } = await supabase
           .from('profiles')
           .select('*')
           .neq('id', currentUser?.id || '')
           .limit(20)
         setResults((data || []) as Profile[])
         setSearching(false)
      }
      if (currentUser?.id) fetchInitialInfo()
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', currentUser?.id || '')
        .limit(30)

      setResults((data || []) as Profile[])
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, currentUser?.id, supabase])

  async function handleStartChat(otherUser: Profile) {
    if (!currentUser || startingChat) return
    setStartingChat(otherUser.id)

    // Check if DM exists
    const { data: myParticipations } = await supabase
      .from('participants')
      .select('conversation_id')
      .eq('user_id', currentUser.id)

    let existingConvoId = null
    if (myParticipations?.length) {
      const convoIds = myParticipations.map((p) => p.conversation_id)
      const { data: existingDM } = await supabase
        .from('conversations')
        .select('id')
        .in('id', convoIds)
        .eq('type', 'dm')

      if (existingDM?.length) {
        for (const convo of existingDM) {
          const { data: otherPart } = await supabase
            .from('participants')
            .select('user_id')
            .eq('conversation_id', convo.id)
            .eq('user_id', otherUser.id)
            .single()
          if (otherPart) {
            existingConvoId = convo.id
            break
          }
        }
      }
    }

    if (existingConvoId) {
      router.push(`/c/${existingConvoId}`)
      setStartingChat(null)
      return
    }

    // Create new DM
    const { data: newConvoRaw, error: convoError } = await supabase
      .from('conversations')
      .insert({ type: 'dm', created_by: currentUser.id })
      .select()
      .single()
    const newConvo = newConvoRaw as { id: string } | null

    if (convoError) {
      console.error('Conversation insert error:', convoError)
      toast.error('Failed to create conversation: ' + convoError.message)
      setStartingChat(null)
      return
    }

    if (newConvo) {
      const { error: partError } = await supabase.from('participants').insert([
        { conversation_id: newConvo.id, user_id: currentUser.id },
        { conversation_id: newConvo.id, user_id: otherUser.id },
      ])
      
      if (partError) {
        console.error('Participant insert error:', partError)
        toast.error('Failed to add participants: ' + partError.message)
        setStartingChat(null)
        return
      }
      
      router.push(`/c/${newConvo.id}`)
    }
    setStartingChat(null)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Contacts & Search</h1>
          <p className="text-sm text-muted-foreground">Find anyone on the network</p>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search users by name or username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-12 bg-secondary border-0 text-base shadow-sm"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
          {searching && results.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!searching && results.length === 0 && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No users found matching "{query}"</p>
            </div>
          )}

          {results.map((user) => (
            <div
              key={user.id}
              onClick={() => handleStartChat(user)}
              className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:bg-secondary/80 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border border-border/50 shadow-sm">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                    {getInitials(user.display_name || user.username)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {user.display_name || user.username}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                {startingChat === user.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <MessageSquare className="h-5 w-5 fill-current" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
