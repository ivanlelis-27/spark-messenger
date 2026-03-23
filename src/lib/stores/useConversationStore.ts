import { create } from 'zustand'
import type { Database } from '@/lib/supabase/types'

type Profile = Database['public']['Tables']['profiles']['Row']
type Conversation = Database['public']['Tables']['conversations']['Row']
type Participant = Database['public']['Tables']['participants']['Row']

export type ConversationWithDetails = Conversation & {
  participants: (Participant & { profile: Profile })[]
  last_message?: {
    content: string | null
    type: string
    created_at: string
    sender_id: string
  } | null
  unread_count?: number
}

interface ConversationState {
  conversations: ConversationWithDetails[]
  activeConversation: ConversationWithDetails | null
  isLoading: boolean
  setConversations: (conversations: ConversationWithDetails[]) => void
  setActiveConversation: (conversation: ConversationWithDetails | null) => void
  updateConversation: (id: string, updates: Partial<ConversationWithDetails>) => void
  updateParticipant: (conversationId: string, participant: Participant) => void
  setIsLoading: (loading: boolean) => void
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeConversation: null,
  isLoading: false,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (conversation) => set({ activeConversation: conversation }),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  updateParticipant: (conversationId, participant) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.id === participant.id ? { ...p, ...participant } : p
          ),
        }
      }),
    })),
  setIsLoading: (loading) => set({ isLoading: loading }),
}))
