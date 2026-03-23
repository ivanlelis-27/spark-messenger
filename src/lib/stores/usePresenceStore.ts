import { create } from 'zustand'

interface TypingUser {
  userId: string
  username: string
}

interface PresenceState {
  typingByConversation: Record<string, TypingUser[]>
  onlineUsers: Set<string>
  setTyping: (conversationId: string, users: TypingUser[]) => void
  setOnlineUsers: (userIds: string[]) => void
  addOnlineUser: (userId: string) => void
  removeOnlineUser: (userId: string) => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  typingByConversation: {},
  onlineUsers: new Set(),
  setTyping: (conversationId, users) =>
    set((state) => ({
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: users,
      },
    })),
  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),
  addOnlineUser: (userId) =>
    set((state) => ({ onlineUsers: new Set([...state.onlineUsers, userId]) })),
  removeOnlineUser: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers)
      next.delete(userId)
      return { onlineUsers: next }
    }),
}))
