'use client'

import { useState } from 'react'
import type { MessageWithDetails } from '@/lib/stores/useMessageStore'
import { useMessageStore } from '@/lib/stores/useMessageStore'
import { useConversationStore } from '@/lib/stores/useConversationStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'
import { format } from 'date-fns'
import { Check, CheckCheck, SmilePlus } from 'lucide-react'
import { LinkPreview } from './LinkPreview'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { buttonVariants } from '@/components/ui/button'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'

interface MessageBubbleProps {
  message: MessageWithDetails
  isOwn: boolean
  showAvatar: boolean
  isRead?: boolean
  currentUserId: string
}

export function MessageBubble({ message, isOwn, showAvatar, isRead, currentUserId }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), 'h:mm a')
  const { resolvedTheme } = useTheme()
  const supabase = createClient()
  const [showPicker, setShowPicker] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const { addReaction, removeReaction } = useMessageStore()
  const { activeConversation } = useConversationStore()
  const conversationId = activeConversation?.id || ''

  const isSecret = (message as any).is_secret === true

  const reactionGroups = (message.reactions || []).reduce((acc, curr) => {
    if (!acc[curr.emoji]) acc[curr.emoji] = []
    acc[curr.emoji].push(curr)
    return acc
  }, {} as Record<string, NonNullable<typeof message.reactions>>)

  async function handleEmojiSelect(emojiData: any) {
    setShowPicker(false)
    const emojiStr = emojiData.native
    const existing = message.reactions?.find(r => r.emoji === emojiStr && r.user_id === currentUserId)
    if (existing) {
      // Optimistic remove
      removeReaction(conversationId, existing.id)
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      // Optimistic add — create a temp reaction immediately
      const tempReaction = {
        id: `temp-${Date.now()}`,
        message_id: message.id,
        user_id: currentUserId,
        emoji: emojiStr,
        created_at: new Date().toISOString(),
        profile: null as any,
      }
      addReaction(conversationId, message.id, tempReaction)
      const { data: inserted } = await supabase
        .from('reactions')
        .insert({ message_id: message.id, user_id: currentUserId, emoji: emojiStr })
        .select('*, profile:profiles(*)')
        .single()
      // Replace temp with real record
      if (inserted) {
        removeReaction(conversationId, tempReaction.id)
        addReaction(conversationId, message.id, inserted as any)
      }
    }
  }

  async function toggleReaction(emojiStr: string) {
    const existing = message.reactions?.find(r => r.emoji === emojiStr && r.user_id === currentUserId)
    if (existing) {
      removeReaction(conversationId, existing.id)
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      const tempReaction = {
        id: `temp-${Date.now()}`,
        message_id: message.id,
        user_id: currentUserId,
        emoji: emojiStr,
        created_at: new Date().toISOString(),
        profile: null as any,
      }
      addReaction(conversationId, message.id, tempReaction)
      const { data: inserted } = await supabase
        .from('reactions')
        .insert({ message_id: message.id, user_id: currentUserId, emoji: emojiStr })
        .select('*, profile:profiles(*)')
        .single()
      if (inserted) {
        removeReaction(conversationId, tempReaction.id)
        addReaction(conversationId, message.id, inserted as any)
      }
    }
  }

  return (
    <div
      className={cn(
        'group flex gap-2 max-w-[85%] md:max-w-[70%]',
        isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto',
        !showAvatar && !isOwn && 'ml-10'
      )}
    >
      {/* Avatar (other people only) */}
      {!isOwn && showAvatar && (
        <Avatar className="h-8 w-8 mt-1 shrink-0">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
            {getInitials(message.sender?.display_name || message.sender?.username || '?')}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name */}
        {!isOwn && showAvatar && (
          <span className="text-[11px] text-muted-foreground mb-0.5 ml-1">
            {message.sender?.display_name || message.sender?.username}
          </span>
        )}

        <div className={cn('relative flex items-center', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          {/* Bubble */}
          <div
            className={cn(
              'px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed break-words relative shadow-sm',
              isOwn
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-card border border-border text-foreground rounded-bl-sm',
              isSecret && !revealed && 'min-w-[140px] min-h-[64px] select-none'
            )}
          >
            {/* Love Note — hide content until tapped */}
            {isSecret && !revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-1 bg-pink-500/15 hover:bg-pink-500/25 transition-colors cursor-pointer z-10 backdrop-blur-sm"
              >
                <span className="text-xl leading-none">💌</span>
                <span className="text-[11px] font-semibold text-pink-400 mt-0.5">
                  {isOwn ? 'Love Note' : 'Tap to reveal'}
                </span>
              </button>
            ) : (
              <>
                {message.type === 'image' && message.media_url && (
                  <img
                    src={message.media_url}
                    alt="Shared image"
                    className="rounded-lg max-w-[280px] w-full mb-1"
                    loading="lazy"
                  />
                )}
                {message.type === 'audio' && message.media_url && (
                  <audio controls className="max-w-[240px]" preload="metadata">
                    <source src={message.media_url} />
                  </audio>
                )}
                {message.content && (
                  <div className="whitespace-pre-wrap">
                    {message.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
                      if (part.match(/^https?:\/\//)) {
                        return <LinkPreview key={i} url={part} />
                      }
                      return <span key={i}>{part}</span>
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Add Reaction Button (appears on hover) */}
          <div className={cn('absolute opacity-0 group-hover:opacity-100 transition-opacity px-2 hidden md:block', isOwn ? '-left-10' : '-right-10')}>
            <Popover open={showPicker} onOpenChange={setShowPicker}>
              <PopoverTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-7 w-7 rounded-full bg-background border shadow-sm text-muted-foreground hover:text-foreground')}>
                <SmilePlus className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent side="top" align={isOwn ? 'end' : 'start'} className="w-auto p-0 border-none shadow-none bg-transparent">
                <Picker 
                  data={data} 
                  onEmojiSelect={handleEmojiSelect} 
                  theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Reaction Pills */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={cn('flex flex-wrap gap-1 mt-1 -mb-1 z-10 relative', isOwn ? 'justify-end' : 'justify-start')}>
            {Object.entries(reactionGroups).map(([emoji, reactions]) => {
              const hasReacted = reactions.some(r => r.user_id === currentUserId)
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-colors shadow-sm',
                    hasReacted 
                      ? 'bg-primary/10 border-primary/30 text-primary' 
                      : 'bg-card border-border text-muted-foreground hover:bg-secondary'
                  )}
                >
                  <span className="text-sm">{emoji}</span>
                  <span className="text-[11px]">{reactions.length}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Time & Read Receipt */}
        <div className="flex items-center gap-1 mt-1.5 mx-1">
          <span className="text-[10px] text-muted-foreground">{time}</span>
          {isOwn && (
            isRead ? (
              <CheckCheck className="h-3 w-3 text-blue-500" />
            ) : (
              <Check className="h-3 w-3 text-muted-foreground" />
            )
          )}
        </div>
      </div>
    </div>
  )
}
