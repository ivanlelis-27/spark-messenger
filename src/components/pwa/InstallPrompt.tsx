'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Share, PlusSquare, Download } from 'lucide-react'

export function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true) // default true to prevent flash
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if we are already installed/running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone)
    setIsStandalone(!!isStandaloneMode)

    if (isStandaloneMode) return

    // iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIOSDevice)

    if (isIOSDevice) {
      // Show iOS prompt if not dismissed in session
      const dismissed = sessionStorage.getItem('install-prompt-dismissed')
      if (!dismissed) {
        // Small delay so it doesn't instantly violently pop up
        setTimeout(() => setShowPrompt(true), 2000)
      }
    } else {
      // Android / Chrome desktop detection via beforeinstallprompt event
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e)
        
        const dismissed = sessionStorage.getItem('install-prompt-dismissed')
        if (!dismissed) {
          setTimeout(() => setShowPrompt(true), 2000)
        }
      }
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem('install-prompt-dismissed', 'true')
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-0 inset-x-0 p-4 z-50 animate-in slide-in-from-bottom-10 pb-safe">
      <div className="bg-card border border-border shadow-lg rounded-2xl p-4 flex items-start gap-4 mx-auto max-w-md">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground mb-1">
            Install Spark Messenger
          </h3>
          {isIOS ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Install this app on your device for the best full-screen experience and push notifications. Tap <Share className="inline h-3 w-3 mx-0.5" /> and then <strong>Add to Home Screen</strong> <PlusSquare className="inline h-3 w-3 mx-0.5" />.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Install this app on your home screen for quick access and a better experience.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0 items-end">
          <Button variant="ghost" size="icon" className="h-6 w-6 -mt-2 -mr-2 text-muted-foreground" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
          {!isIOS && (
            <Button size="sm" onClick={handleInstallClick} className="h-8 text-xs px-3">
              <Download className="h-3 w-3 mr-1.5" />
              Install
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
