'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/useAuthStore'
import { Button, buttonVariants } from '@/components/ui/button'
import { Send, Image as ImageIcon, Smile, Mic, Square, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { useTheme } from 'next-themes'

interface MessageInputProps {
  conversationId: string
  senderId: string
  onTyping: () => void
}

export function MessageInput({ conversationId, senderId, onTyping }: MessageInputProps) {
  const supabase = createClient()
  const { user: currentUser } = useAuthStore()
  const { resolvedTheme } = useTheme()

  function notifyPush(content: string) {
    if (!currentUser) return
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: content,
        sender_name: currentUser.display_name || currentUser.username,
        sender_id: currentUser.id,
      })
    }).catch(console.error)
  }
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelRecordingRef = useRef(false)

  const handleInput = useCallback(
    (value: string) => {
      setText(value)
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
      }
      // Typing indicator (debounced)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => onTyping(), 300)
    },
    [onTyping]
  )

  function handleEmojiSelect(emoji: any) {
    const cursor = textareaRef.current?.selectionStart || text.length
    const newText = text.slice(0, cursor) + emoji.native + text.slice(textareaRef.current?.selectionEnd || text.length)
    handleInput(newText)
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed,
      type: 'text',
    })

    if (error) {
      toast.error('Failed to send message')
    } else {
      notifyPush(trimmed)
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }
    setSending(false)
    textareaRef.current?.focus()
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB')
      return
    }

    setSending(true)
    const ext = file.name.split('.').pop()
    const path = `${conversationId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('message-media')
      .upload(path, file)

    if (uploadError) {
      toast.error('Failed to upload image')
      setSending(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('message-media')
      .getPublicUrl(path)

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: null,
      type: 'image',
      media_url: urlData.publicUrl,
    })
    if (!insertError) notifyPush('📷 Sent an image')

    setSending(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        
        if (audioBlob.size > 0 && !cancelRecordingRef.current) {
          await uploadAndSendAudio(audioBlob)
        }
        setIsRecording(false)
        setRecordingTime(0)
      }

      mediaRecorder.start()
      setIsRecording(true)
      cancelRecordingRef.current = false
      setRecordingTime(0)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      console.error(err)
      toast.error('Could not access microphone')
    }
  }

  function stopRecording(cancel = false) {
    cancelRecordingRef.current = cancel
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  async function uploadAndSendAudio(blob: Blob) {
    setSending(true)
    const path = `${conversationId}/${Date.now()}.webm`

    const { error: uploadError } = await supabase.storage
      .from('message-media')
      .upload(path, blob)

    if (uploadError) {
      toast.error('Failed to upload voice note')
      setSending(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('message-media')
      .getPublicUrl(path)

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: null,
      type: 'audio',
      media_url: urlData.publicUrl,
    })
    if (!insertError) notifyPush('🎤 Sent a voice note')

    setSending(false)
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="border-t border-border bg-card/50 backdrop-blur-sm px-4 py-3 safe-area-inset-bottom">
      <div className="flex items-end gap-2 relative">
        {!isRecording && (
          <>
            {/* Image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={sending}
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground shrink-0 mb-0.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>

            {/* Emoji Popover */}
            <Popover>
              <PopoverTrigger 
                className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground shrink-0 mb-0.5' })}
                disabled={sending}
              >
                <Smile className="h-5 w-5" />
              </PopoverTrigger>
              <PopoverContent 
                side="top" 
                align="start" 
                className="w-auto p-0 border-none shadow-none bg-transparent"
                sideOffset={10}
              >
                <Picker 
                  data={data} 
                  onEmojiSelect={handleEmojiSelect} 
                  theme={resolvedTheme === 'dark' ? 'dark' : 'light'} 
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </PopoverContent>
            </Popover>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => handleInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                disabled={sending}
                className="w-full resize-none bg-secondary rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-[120px] scrollbar-thin disabled:opacity-50"
              />
            </div>
          </>
        )}

        {isRecording && (
          <div className="flex-1 flex items-center justify-between bg-destructive/10 text-destructive rounded-2xl px-4 py-2 h-[44px] mb-0.5">
            <div className="flex items-center gap-2 animate-in fade-in">
              <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium tabular-nums">{formatTime(recordingTime)}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-destructive hover:bg-destructive/20 hover:text-destructive" 
              onClick={() => stopRecording(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Action Button: Send or Mic */}
        <Button
          size="icon"
          className={cn(
            "rounded-full shrink-0 mb-0.5 h-10 w-10 transition-colors shadow-sm",
            isRecording || text.trim() 
              ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
              : "bg-secondary text-foreground hover:bg-secondary/80"
          )}
          onClick={() => {
            if (isRecording) {
              stopRecording(false)
            } else if (text.trim()) {
              handleSend()
            } else {
              startRecording()
            }
          }}
          disabled={sending}
        >
          {isRecording ? (
            <Square className="h-4 w-4 fill-current" />
          ) : text.trim() ? (
            <Send className="h-4 w-4" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  )
}
