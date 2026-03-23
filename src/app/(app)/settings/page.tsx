'use client'

import { useAuthStore } from '@/lib/stores/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor, User, LogOut, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const supabase = createClient()

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Failed to sign out')
      return
    }
    setUser(null)
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto w-full">
      {/* Header */}
      <div className="h-16 border-b border-border flex items-center px-4 shrink-0 bg-card/50 backdrop-blur-sm sticky top-0 z-10 safe-area-inset-top">
        <div className="md:hidden mr-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6 animate-in fade-in pb-12">
        {/* Account Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{user.display_name || user.username}</p>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
              <Link href={`/profile/${user.id}`}>
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h2>
          <div className="bg-card border border-border rounded-2xl overflow-hidden p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Theme</p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                className="w-full justify-start font-normal h-10"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-2" /> Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                className="w-full justify-start font-normal h-10"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-2" /> Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                className="w-full justify-start font-normal h-10"
                onClick={() => setTheme('system')}
              >
                <Monitor className="h-4 w-4 mr-2" /> System
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 pt-4">
          <Button variant="destructive" className="w-full h-12 rounded-xl font-semibold" onClick={handleSignOut}>
            <LogOut className="h-5 w-5 mr-2" />
            Sign Out
          </Button>
        </section>
      </div>
    </div>
  )
}
