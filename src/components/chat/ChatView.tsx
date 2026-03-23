'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMessageStore, type MessageWithDetails } from '@/lib/stores/useMessageStore'
import { usePresenceStore } from '@/lib/stores/usePresenceStore'
import { useConversationStore, type ConversationWithDetails } from '@/lib/stores/useConversationStore'
import type { Database } from '@/lib/supabase/types'
import { ChatHeader } from './ChatHeader'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type Profile = Database['public']['Tables']['profiles']['Row']
type Participant = Database['public']['Tables']['participants']['Row']

interface ChatViewProps {
  conversation: ConversationWithDetails
  currentUser: Profile
}

export function ChatView({ conversation, currentUser }: ChatViewProps) {
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messagesByConversation, setMessages, addMessage, isLoadingMessages, setIsLoadingMessages, addReaction, removeReaction } = useMessageStore()
  const { setActiveConversation, updateParticipant } = useConversationStore()
  const { setTyping } = usePresenceStore()
  const [initialLoadDone, setInitialLoadDone] = useState(false)

  const messages = messagesByConversation[conversation.id] || []

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: initialLoadDone ? 'smooth' : 'auto' })
  }, [initialLoadDone])

  async function markConversationAsRead() {
    await supabase
      .from('participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .eq('user_id', currentUser.id)
  }

  // Load messages
  useEffect(() => {
    setActiveConversation(conversation)
    loadMessages()
    markConversationAsRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id])

  async function loadMessages() {
    setIsLoadingMessages(true)
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(*), reactions(*, profile:profiles(*))')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      setMessages(conversation.id, data as MessageWithDetails[])
    }
    setIsLoadingMessages(false)
    setInitialLoadDone(true)
  }

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom()
    if (initialLoadDone && messages.length > 0) {
      markConversationAsRead()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, scrollToBottom, initialLoadDone])

  // Real-time message subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Database['public']['Tables']['messages']['Row']
          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single()

          if (sender) {
            addMessage(conversation.id, { ...newMsg, sender } as MessageWithDetails)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversation.id, addMessage])

  // Real-time reactions subscription
  useEffect(() => {
    const channel = supabase
      .channel(`reactions:${conversation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as Database['public']['Tables']['reactions']['Row']
            const { data: profile } = (await supabase.from('profiles').select('*').eq('id', newReaction.user_id).single()) as unknown as { data: Profile }
            if (profile) {
              addReaction(conversation.id, newReaction.message_id, { ...newReaction, profile })
            }
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as { id: string }
            removeReaction(conversation.id, oldReaction.id)
          }
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversation.id, addReaction, removeReaction])

  // Real-time participant subscription for read receipts
  useEffect(() => {
    const channel = supabase
      .channel(`participants:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          updateParticipant(conversation.id, payload.new as Participant)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversation.id, updateParticipant])

  // Typing indicator broadcast channel
  useEffect(() => {
    const channel = supabase.channel(`typing:${conversation.id}`)

    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== currentUser.id) {
          setTyping(conversation.id, [{ userId: payload.userId, username: payload.username }])
          // Clear typing after 3 seconds
          setTimeout(() => setTyping(conversation.id, []), 3000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, conversation.id, currentUser.id, setTyping])

  function handleTyping() {
    supabase.channel(`typing:${conversation.id}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUser.id, username: currentUser.display_name || currentUser.username },
    })
  }

  // Group messages by date
  function getDateLabel(dateStr: string): string {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader conversation={conversation} currentUserId={currentUser.id} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoadingMessages ? (
          <div className="flex flex-col gap-6 py-8 md:px-2 w-full mx-auto">
            <div className="flex items-end gap-2 w-[85%] sm:w-3/4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-16 w-full rounded-2xl rounded-bl-sm" />
                <Skeleton className="h-3 w-12 ml-1" />
              </div>
            </div>
            <div className="flex items-end gap-2 w-[85%] sm:w-3/4 self-end flex-row-reverse">
              <div className="space-y-2 flex-1 flex flex-col items-end">
                <Skeleton className="h-12 w-[80%] rounded-2xl rounded-br-sm bg-primary/20" />
                <Skeleton className="h-3 w-12 mr-1" />
              </div>
            </div>
            <div className="flex items-end gap-2 w-[85%] sm:w-3/4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-12 w-[60%] rounded-2xl rounded-bl-sm" />
                <Skeleton className="h-3 w-12 ml-1" />
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">Send a message to start the conversation ✨</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null
              const showDateLabel =
                !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at)
              const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id
              const isRead = conversation.participants?.some(
                (p) => p.user_id !== currentUser.id && p.last_read_at && new Date(p.last_read_at) >= new Date(msg.created_at)
              )

              return (
                <div key={msg.id}>
                  {showDateLabel && (
                    <div className="flex items-center justify-center py-4">
                      <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                        {getDateLabel(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.sender_id === currentUser.id}
                    showAvatar={showAvatar}
                    isRead={isRead}
                    currentUserId={currentUser.id}
                  />
                </div>
              )
            })}
          </>
        )}
        <TypingIndicator conversationId={conversation.id} currentUserId={currentUser.id} />
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        conversationId={conversation.id}
        senderId={currentUser.id}
        onTyping={handleTyping}
      />
    </div>
  )
}
