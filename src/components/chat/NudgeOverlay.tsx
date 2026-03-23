'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FloatingHeart {
  id: number
  x: number
  emoji: string
}

interface NudgeOverlayProps {
  conversationId: string
  currentUserId: string
  shake: boolean
  onShakeDone: () => void
}

const HEART_EMOJIS = ['❤️', '🧡', '💛', '💚', '💙', '💜', '🩷', '🤍', '💕', '💖', '💗', '💓']

export function NudgeOverlay({ conversationId, currentUserId, shake, onShakeDone }: NudgeOverlayProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([])

  const spawnHearts = useCallback(() => {
    const count = 8 + Math.floor(Math.random() * 6)
    const newHearts: FloatingHeart[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: 10 + Math.random() * 80, // % from left
      emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
    }))
    setHearts(prev => [...prev, ...newHearts])
    // Clean up after animation completes
    setTimeout(() => {
      setHearts(prev => prev.filter(h => !newHearts.find(n => n.id === h.id)))
    }, 2000)
  }, [])

  // Spawn hearts whenever shake triggers
  useEffect(() => {
    if (shake) {
      spawnHearts()
      const t = setTimeout(onShakeDone, 700)
      return () => clearTimeout(t)
    }
  }, [shake, spawnHearts, onShakeDone])

  if (hearts.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {hearts.map(heart => (
        <span
          key={heart.id}
          className="animate-float-heart absolute bottom-24 text-3xl select-none"
          style={{ left: `${heart.x}%`, animationDelay: `${Math.random() * 0.4}s` }}
        >
          {heart.emoji}
        </span>
      ))}
    </div>
  )
}
