'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Camera, UserCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/lib/supabase/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function ProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { user: currentUser, setUser: setCurrentUser } = useAuthStore()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOwner = currentUser?.id === params.id

  useEffect(() => {
    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.id)
        .single()
        
      if (error) {
        toast.error('Profile not found')
        router.push('/')
        return
      }
      
      const profileData = data as Profile
      setProfile(profileData)
      setDisplayName(profileData.display_name || '')
      setBio(profileData.bio || '')
      setLoading(false)
    }
    
    loadProfile()
  }, [params.id, router, supabase])

  async function updateProfileField(field: string, value: string) {
    if (!profile) return
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', profile.id)
    if (error) throw error
    setProfile({ ...profile, [field]: value } as Profile)
    if (isOwner && currentUser) {
      setCurrentUser({ ...currentUser, [field]: value } as Profile)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !isOwner || !profile) return
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }
    
    setSaving(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/${Date.now()}.${ext}`
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file)
      
    if (uploadError) {
      console.error(uploadError)
      toast.error('Failed to upload avatar. Did you create the storage bucket in Supabase via SQL Editor?')
      setSaving(false)
      return
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)
      
    try {
      await updateProfileField('avatar_url', publicUrl)
      toast.success('Avatar updated!')
    } catch (e: any) {
      toast.error('Could not save avatar url to database')
    }
    setSaving(false)
  }

  async function handleSave() {
    if (!isOwner || !profile) return
    setSaving(true)
    
    try {
      await updateProfileField('display_name', displayName)
      await updateProfileField('bio', bio)
      toast.success('Profile updated!')
    } catch (e: any) {
      toast.error('Failed to save profile')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (!profile) return null

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto w-full">
      <div className="h-16 border-b border-border flex items-center px-4 shrink-0 bg-card/50 backdrop-blur-sm sticky top-0 z-10 safe-area-inset-top">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-10 w-10 mr-2" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      <div className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col animate-in fade-in pb-12">
        <div className="flex flex-col items-center pt-8 pb-6">
          <div className="relative group">
            <Avatar className={`h-32 w-32 shadow-xl border-4 border-background ${isOwner ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`} onClick={() => isOwner && fileInputRef.current?.click()}>
              <AvatarImage src={profile.avatar_url || ''} className="object-cover" />
              <AvatarFallback className="text-4xl font-light bg-primary/10 text-primary">
                {getInitials(profile.display_name || profile.username)}
              </AvatarFallback>
            </Avatar>
            {isOwner && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-full pointer-events-none transition-opacity">
                <Camera className="h-8 w-8" />
              </div>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            disabled={saving}
          />
          <h2 className="mt-4 text-2xl font-bold text-foreground text-center">
            {profile.display_name || profile.username}
          </h2>
          <p className="text-muted-foreground text-sm font-medium tracking-wide">
            @{profile.username}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          {isOwner ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                  Display Name
                </label>
                <Input
                  className="bg-secondary/50 border-transparent rounded-xl h-12 focus-visible:ring-primary"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                  Bio / About
                </label>
                <textarea
                  className="w-full resize-none bg-secondary/50 border-transparent rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write something about yourself..."
                />
              </div>

              <div className="pt-2">
                <Button 
                  className="w-full rounded-xl h-12 font-semibold" 
                  onClick={handleSave} 
                  disabled={saving || (displayName === profile.display_name && bio === profile.bio)}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
             <div className="space-y-4">
              <div className="bg-secondary/30 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {profile.bio || 'No bio yet...'}
                </p>
              </div>
              <Button className="w-full rounded-xl h-12 font-medium" onClick={() => router.push(`/contacts`)}>
                <UserCircle2 className="h-5 w-5 mr-2" />
                View Contacts
              </Button>
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
