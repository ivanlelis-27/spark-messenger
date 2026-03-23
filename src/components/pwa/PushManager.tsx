'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/useAuthStore'
import { toast } from 'sonner'

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function EnableNotificationsButton() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      checkSubscription()
    }
  }, [])

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  async function subscribeToPush() {
    if (!user) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
       toast.error('Push notifications are not configured in this environment.')
       return
    }

    setLoading(true)
    try {
      // Don't wait forever if SW is broken
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 5000))
      ])
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.trim())
      })

      // Save to Supabase
      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        subscription: JSON.parse(JSON.stringify(subscription))
      })

      if (error) throw error

      setIsSubscribed(true)
      toast.success('Notifications enabled!')
    } catch (error: any) {
      console.error('Push subscription failed:', error)
      if (Notification.permission === 'denied') {
        toast.error('Notifications are blocked in your browser settings.')
      } else {
        toast.error('Failed to enable notifications.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isSupported) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground"
      onClick={isSubscribed ? () => toast.info('Notifications are already enabled.') : subscribeToPush}
      disabled={loading}
      title={isSubscribed ? 'Notifications enabled' : 'Enable notifications'}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-5 w-5 text-primary" />
      ) : (
        <BellOff className="h-5 w-5" />
      )}
    </Button>
  )
}
