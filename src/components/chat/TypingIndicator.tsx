'use client'

import { usePresenceStore } from '@/lib/stores/usePresenceStore'

interface TypingIndicatorProps {
  conversationId: string
  currentUserId: string
}

export function TypingIndicator({ conversationId, currentUserId }: TypingIndicatorProps) {
  const typingRecord = usePresenceStore((s) => s.typingByConversation[conversationId])
  const typingUsers = (typingRecord || []).filter((u) => u.userId !== currentUserId)

  if (typingUsers.length === 0) return null

  const names = typingUsers.map((u) => u.username).join(', ')

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-[11px] text-muted-foreground">
        {names} {typingUsers.length === 1 ? 'is' : 'are'} typing...
      </span>
    </div>
  )
}
