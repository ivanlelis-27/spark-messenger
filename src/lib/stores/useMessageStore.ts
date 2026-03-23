import { create } from 'zustand'
import type { Database } from '@/lib/supabase/types'

type Message = Database['public']['Tables']['messages']['Row']
type Reaction = Database['public']['Tables']['reactions']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export type MessageWithDetails = Message & {
  sender: Profile
  reactions?: (Reaction & { profile: Profile })[]
  reply?: MessageWithDetails | null
}

interface MessageState {
  messagesByConversation: Record<string, MessageWithDetails[]>
  isLoadingMessages: boolean
  setMessages: (conversationId: string, messages: MessageWithDetails[]) => void
  addMessage: (conversationId: string, message: MessageWithDetails) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<MessageWithDetails>) => void
  deleteMessage: (conversationId: string, messageId: string) => void
  setIsLoadingMessages: (loading: boolean) => void
  addReaction: (conversationId: string, messageId: string, reaction: Reaction & { profile: Profile }) => void
  removeReaction: (conversationId: string, reactionId: string) => void
}

export const useMessageStore = create<MessageState>((set) => ({
  messagesByConversation: {},
  isLoadingMessages: false,
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages,
      },
    })),
  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || []
      // Avoid duplicates
      if (existing.find((m) => m.id === message.id)) return state
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existing, message],
        },
      }
    }),
  updateMessage: (conversationId, messageId, updates) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),
  deleteMessage: (conversationId, messageId) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] || []).filter(
          (m) => m.id !== messageId
        ),
      },
    })),
  setIsLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  addReaction: (conversationId, messageId, reaction) => set((state) => {
    const messages = state.messagesByConversation[conversationId] || []
    return {
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages.map(m => {
          if (m.id !== messageId) return m
          const existingReactions = m.reactions || []
          if (existingReactions.find(r => r.id === reaction.id)) return m
          return { ...m, reactions: [...existingReactions, reaction] }
        })
      }
    }
  }),
  removeReaction: (conversationId, reactionId) => set((state) => {
    const messages = state.messagesByConversation[conversationId] || []
    return {
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages.map(m => {
          const existingReactions = m.reactions || []
          return { ...m, reactions: existingReactions.filter(r => r.id !== reactionId) }
        })
      }
    }
  }),
}))
