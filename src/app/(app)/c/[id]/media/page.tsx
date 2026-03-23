'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, Image as ImageIcon, Mic } from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/lib/supabase/types'
import { format } from 'date-fns'
import Link from 'next/link'

type Message = Database['public']['Tables']['messages']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface MediaMessage extends Message {
  sender: Profile | null
}

export default function MediaVaultPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<MediaMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMedia() {
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(*)')
        .eq('conversation_id', params.id)
        .in('type', ['image', 'audio'])
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Failed to load media vault')
        console.error(error)
      } else {
        // Note: sender could be an array if relationship isn't mapped 1:1 perfectly by strictly named foreign keys, but normally single object
        const formatted = (data as any[]).map(msg => ({
          ...msg,
          sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender
        }))
        setMessages(formatted)
      }
      setLoading(false)
    }
    fetchMedia()
  }, [params.id, supabase])

  const images = messages.filter(m => m.type === 'image')
  const audios = messages.filter(m => m.type === 'audio')

  return (
    <div className="flex-1 flex flex-col bg-background/95 w-full h-full overflow-hidden">
      <div className="h-16 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-10 w-10" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold bg-gradient-to-br from-primary to-rose-400 bg-clip-text text-transparent">Memory Lane</h1>
        </div>
        <div className="text-xs text-muted-foreground font-medium bg-secondary/50 px-3 py-1.5 rounded-full">
          {images.length} Photos, {audios.length} Audios
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full p-4 md:p-6 space-y-8 animate-in fade-in duration-500 pb-12">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
            <div className="h-20 w-20 bg-secondary/50 rounded-full flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 opacity-50" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">No memories yet</h3>
              <p className="text-muted-foreground text-sm">Photos and voice notes sent in this chat will appear here.</p>
            </div>
            <Button variant="outline" onClick={() => router.back()}>Back to Chat</Button>
          </div>
        ) : (
          <>
            {images.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-sm font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Photo Gallery
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-4">
                  {images.map((msg) => (
                    <a key={msg.id} href={msg.media_url || '#'} target="_blank" rel="noreferrer" className="group block relative aspect-square rounded-2xl overflow-hidden bg-secondary border border-border shadow-sm hover:shadow-md transition-all cursor-zoom-in">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={msg.media_url!} alt="Shared photo" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-[10px] font-medium">{msg.sender?.display_name || msg.sender?.username}</p>
                        <p className="text-white/80 text-[9px]">{format(new Date(msg.created_at), 'MMM d, yyyy')}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {audios.length > 0 && (
              <div className="w-full h-px bg-border/50" />
            )}

            {audios.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-sm font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
                  <Mic className="h-4 w-4" /> Voice Notes
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {audios.map((msg) => (
                    <div key={msg.id} className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm flex flex-col gap-3 hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{msg.sender?.display_name || msg.sender?.username}</span>
                        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{format(new Date(msg.created_at), 'MMM d')}</span>
                      </div>
                      <audio controls src={msg.media_url || ''} className="w-full h-10 max-w-full rounded-full" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
