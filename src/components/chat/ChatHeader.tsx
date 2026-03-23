'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ConversationWithDetails } from '@/lib/stores/useConversationStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { getInitials } from '@/lib/utils'
import { ArrowLeft, Phone, Image as ImageIcon, Info } from 'lucide-react'

interface ChatHeaderProps {
  conversation: ConversationWithDetails
  currentUserId: string
}

export function ChatHeader({ conversation, currentUserId }: ChatHeaderProps) {
  const router = useRouter()

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
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Phone className="h-4 w-4" />
        </Button>
        <Link href={`/c/${conversation.id}/media`} className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground text-primary/80 hover:text-primary' })}>
          <ImageIcon className="h-4 w-4" />
        </Link>
        <Link href={`/c/${conversation.id}/settings`} className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground' })}>
          <Info className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
