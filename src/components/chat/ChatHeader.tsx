'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import type { ConversationWithDetails } from '@/lib/stores/useConversationStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { getInitials } from '@/lib/utils'
import { ArrowLeft, Phone, Image as ImageIcon, Info, Heart, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ChatHeaderProps {
  conversation: ConversationWithDetails
  currentUserId: string
  onOpenTodos: () => void
}

export function ChatHeader({ conversation, currentUserId, onOpenTodos }: ChatHeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [nudgeCooldown, setNudgeCooldown] = useState(false)

  const otherParticipant = conversation.participants.find((p) => p.user_id !== currentUserId)
  const name =
    conversation.type === 'group' && conversation.name
      ? conversation.name
      : otherParticipant?.profile?.display_name || otherParticipant?.profile?.username || 'Unknown'
  const avatarUrl =
    conversation.type === 'group'
      ? conversation.avatar_url
      : otherParticipant?.profile?.avatar_url || null
  const memberCount = conversation.participants.length

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground shrink-0"
        onClick={() => router.push('/')}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-foreground truncate">{name}</h2>
        <p className="text-[11px] text-muted-foreground">
          {conversation.type === 'group' ? `${memberCount} members` : 'Online'}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Miss You button */}
        <button
          title="Send a Miss You 💕"
          disabled={nudgeCooldown}
          onClick={async () => {
            if (nudgeCooldown) return
            setNudgeCooldown(true)
            await supabase.channel(`nudge:${conversation.id}`).send({
              type: 'broadcast',
              event: 'nudge',
              payload: { from: currentUserId },
            })
            toast('💕 Miss You sent!')
            setTimeout(() => setNudgeCooldown(false), 5000)
          }}
          className={`p-2 rounded-full transition-all ${
            nudgeCooldown
              ? 'text-pink-300 opacity-50 cursor-not-allowed'
              : 'text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 active:scale-90'
          }`}
        >
          <Heart className="h-4 w-4" fill={nudgeCooldown ? 'currentColor' : 'none'} />
        </button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Phone className="h-4 w-4" />
        </Button>
        <Link href={`/c/${conversation.id}/media`} className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground text-primary/80 hover:text-primary' })}>
          <ImageIcon className="h-4 w-4" />
        </Link>
        <button
          title="Our List"
          onClick={onOpenTodos}
          className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-90"
        >
          <ClipboardList className="h-4 w-4" />
        </button>
        <Link href={`/c/${conversation.id}/settings`} className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground' })}>
          <Info className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
