'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Loader2, MessageSquareText, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { getInitials } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']

interface MessageSearchResult {
  id: string
  content: string
  created_at: string
  conversation_id: string
  sender: Profile | null
  conversation: Conversation | null
}

export default function SearchPage() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MessageSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      
      const { data } = await supabase
        .from('messages')
        .select('id, content, created_at, conversation_id, sender:sender_id(*), conversation:conversation_id(*)')
        .eq('type', 'text')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(30)

      setResults((data || []) as unknown as MessageSearchResult[])
      setSearching(false)
    }, 400)

    return () => clearTimeout(timer)
  }, [query, supabase])

  function getConversationName(convo: Conversation | null, sender: Profile | null) {
    if (!convo) return 'Unknown Chat'
    if (convo.type === 'group' && convo.name) return convo.name
    // For DMs, show the sender's name if we haven't fetched the full participant list
    return sender?.display_name || sender?.username || 'Direct Message'
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 safe-area-inset-top">
        <button
          onClick={() => router.back()}
          className="md:hidden p-2 -ml-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="hidden md:flex h-10 w-10 rounded-full bg-primary/20 items-center justify-center text-primary shrink-0">
          <Search className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Message Search</h1>
          <p className="text-sm text-muted-foreground">Find words across all chats</p>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search for messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-12 bg-secondary border-0 text-base shadow-sm"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
          {searching && results.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!searching && results.length === 0 && query.length >= 2 && (
            <div className="text-center py-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
                <MessageSquareText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No messages found matching "{query}"</p>
            </div>
          )}

          {results.map((msg) => (
            <Link
              key={msg.id}
              href={`/c/${msg.conversation_id}`}
              className="block p-4 rounded-xl bg-card border border-border hover:bg-secondary/80 transition-colors group"
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 border border-border/50 shrink-0 mt-1">
                  <AvatarImage src={msg.sender?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(msg.sender?.display_name || msg.sender?.username || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-sm font-semibold text-foreground">
                        {msg.sender?.display_name || msg.sender?.username}
                      </span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded-md bg-secondary border border-border">
                        in {getConversationName(msg.conversation, msg.sender)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 line-clamp-2">
                    {msg.content}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
