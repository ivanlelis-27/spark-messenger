'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/useAuthStore'
import { useConversationStore } from '@/lib/stores/useConversationStore'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { ArrowLeft, Loader2, LogOut, Trash2, Camera, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

export default function GroupSettingsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const supabase = createClient()
  const { user: currentUser } = useAuthStore()
  const { conversations, updateConversation } = useConversationStore()
  
  const conversation = conversations.find(c => c.id === id)
  
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(conversation?.name || '')
  
  useEffect(() => {
    if (conversation?.name) setName(conversation.name)
  }, [conversation?.name])

  if (!conversation) return null

  const isGroup = conversation.type === 'group'
  const isCreator = conversation.created_by === currentUser?.id

  async function handleSaveName() {
    if (!name.trim() || name === conversation?.name) return
    setLoading(true)
    const { error } = await supabase
      .from('conversations')
      .update({ name: name.trim() })
      .eq('id', conversation!.id)
      
    if (error) {
      toast.error('Failed to update group name')
    } else {
      updateConversation(conversation!.id, { name: name.trim() })
      toast.success('Group name updated')
    }
    setLoading(false)
  }

  async function handleLeaveGroup() {
    if (!confirm('Are you sure you want to leave this group?')) return
    
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('conversation_id', conversation!.id)
      .eq('user_id', currentUser!.id)
      
    if (error) {
      toast.error('Failed to leave group')
    } else {
      router.push('/')
    }
  }

  async function handleDeleteGroup() {
    if (!confirm('Are you sure you want to permanently delete this group? All messages will be lost.')) return
    
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversation!.id)
      
    if (error) {
      toast.error('Failed to delete group')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <Link href={`/c/${conversation.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'shrink-0' })}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto w-full space-y-6">
        <div className="flex flex-col items-center mb-6">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarImage src={conversation.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
              {getInitials(conversation.name || 'G')}
            </AvatarFallback>
          </Avatar>
        </div>

        {isGroup && (
          <div className="space-y-4 bg-card rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Group Profile</h2>
            <div className="flex gap-2">
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)}
                placeholder="Group Name"
                className="bg-secondary border-0"
                disabled={!isCreator}
              />
              {isCreator && (
                <Button onClick={handleSaveName} disabled={loading || name === conversation.name}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              )}
            </div>
            {!isCreator && <p className="text-xs text-muted-foreground mt-1">Only the group creator can change the name.</p>}
          </div>
        )}

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {conversation.participants.length} {conversation.participants.length === 1 ? 'Member' : 'Members'}
            </h2>
          </div>
          <div className="divide-y divide-border">
            {conversation.participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(p.profile?.display_name || p.profile?.username || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {p.user_id === currentUser?.id ? 'You' : p.profile?.display_name || p.profile?.username}
                  </p>
                  <p className="text-xs text-muted-foreground">@{p.profile?.username}</p>
                </div>
                {p.user_id === conversation.created_by && (
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                    Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-2 space-y-1">
          {isGroup && (
            <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLeaveGroup}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave Group
            </Button>
          )}
          
          {isCreator && isGroup && (
            <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDeleteGroup}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Group
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
