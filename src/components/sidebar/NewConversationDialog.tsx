'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { Search, Loader2, Users, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
}

export function NewConversationDialog({
  open,
  onOpenChange,
  currentUserId,
}: NewConversationDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [creating, setCreating] = useState(false)

  // Group states
  const [isGroupMode, setIsGroupMode] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setIsGroupMode(false)
      setGroupName('')
      setSelectedUsers([])
      setSearching(false)
      setCreating(false)
    }
  }, [open])

  async function handleSearch(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const { data } = (await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${value}%,display_name.ilike.%${value}%`)
      .neq('id', currentUserId)
      .limit(10)) as unknown as { data: Profile[] }
    setResults(data || [])
    setSearching(false)
  }

  function toggleUserSelection(user: Profile) {
    if (selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id))
    } else {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  async function handleUserClick(user: Profile) {
    if (isGroupMode) {
      toggleUserSelection(user)
    } else {
      await startConversation(user)
    }
  }

  async function createGroup() {
    if (!groupName.trim() || selectedUsers.length === 0) return
    setCreating(true)

    const { data: newConvo } = (await supabase
      .from('conversations')
      .insert({ type: 'group', name: groupName.trim(), created_by: currentUserId })
      .select()
      .single()) as unknown as { data: { id: string } }

    if (newConvo) {
      const participants = [
        { conversation_id: newConvo.id, user_id: currentUserId },
        ...selectedUsers.map((u) => ({ conversation_id: newConvo.id, user_id: u.id })),
      ]
      await supabase.from('participants').insert(participants)
      router.push(`/c/${newConvo.id}`)
      onOpenChange(false)
    }
    setCreating(false)
  }

  async function startConversation(otherUser: Profile) {
    setCreating(true)

    // Check if DM already exists between these two users
    const { data: myParticipations } = await supabase
      .from('participants')
      .select('conversation_id')
      .eq('user_id', currentUserId)

    if (myParticipations?.length) {
      const convoIds = myParticipations.map((p) => p.conversation_id)

      const { data: existingDM } = (await supabase
        .from('conversations')
        .select('id')
        .in('id', convoIds)
        .eq('type', 'dm')) as unknown as { data: { id: string }[] }

      if (existingDM?.length) {
        for (const convo of existingDM) {
          const { data: otherPart } = await supabase
            .from('participants')
            .select('user_id')
            .eq('conversation_id', convo.id)
            .eq('user_id', otherUser.id)
            .single()
          if (otherPart) {
            // DM already exists, navigate to it
            router.push(`/c/${convo.id}`)
            onOpenChange(false)
            setCreating(false)
            return
          }
        }
      }
    }

    // Create new DM conversation
    const { data: newConvoRaw, error: convoError } = await supabase
      .from('conversations')
      .insert({ type: 'dm', created_by: currentUserId })
      .select()
      .single()
    const newConvo = newConvoRaw as { id: string } | null

    if (convoError) {
      console.error('Conversation insert error:', convoError)
      toast.error('Failed to create conversation: ' + convoError.message)
      setCreating(false)
      return
    }

    if (newConvo) {
      // Add both participants
      const { error: partError } = await supabase.from('participants').insert([
        { conversation_id: newConvo.id, user_id: currentUserId },
        { conversation_id: newConvo.id, user_id: otherUser.id },
      ])
      
      if (partError) {
        console.error('Participant insert error:', partError)
        toast.error('Failed to add participants: ' + partError.message)
        setCreating(false)
        return
      }
      
      router.push(`/c/${newConvo.id}`)
      onOpenChange(false)
    }
    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isGroupMode ? 'New Group' : 'New Message'}
          </DialogTitle>
        </DialogHeader>

        {!isGroupMode && (
          <Button
            variant="outline"
            className="w-full mt-2 justify-start items-center gap-2"
            onClick={() => setIsGroupMode(true)}
          >
            <Users className="h-4 w-4" />
            Create a New Group
          </Button>
        )}

        {isGroupMode && (
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Group Subject (required)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-secondary border-0"
              maxLength={50}
            />
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-xs animate-in zoom-in cursor-pointer hover:bg-secondary/80 border border-border"
                    onClick={() => toggleUserSelection(u)}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(u.display_name || u.username)}
                      </AvatarFallback>
                    </Avatar>
                    {u.display_name || u.username}
                    <X className="h-3 w-3 ml-1" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or username..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-secondary border-0"
            autoFocus={!isGroupMode}
          />
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
          {searching && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && results.length === 0 && query.length >= 2 && (
            <p className="text-center py-6 text-sm text-muted-foreground">No users found</p>
          )}
          {!searching &&
            results.map((user) => {
              const isSelected = selectedUsers.some((u) => u.id === user.id)
              return (
                <button
                  key={user.id}
                  onClick={() => handleUserClick(user)}
                  disabled={creating}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {getInitials(user.display_name || user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  {isGroupMode && (
                    <div
                      className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'bg-primary border-primary' : 'border-input'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  )}
                </button>
              )
            })}
        </div>
        
        {isGroupMode && (
          <Button
            className="w-full mt-4"
            disabled={creating || !groupName.trim() || selectedUsers.length === 0}
            onClick={createGroup}
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Group
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
