export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    PostgrestVersion: "12"
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          last_seen: string
          created_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          last_seen?: string
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          last_seen?: string
          created_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          type: 'dm' | 'group'
          name: string | null
          avatar_url: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type?: 'dm' | 'group'
          name?: string | null
          avatar_url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: 'dm' | 'group'
          name?: string | null
          avatar_url?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          joined_at: string
          last_read_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          joined_at?: string
          last_read_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          joined_at?: string
          last_read_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string | null
          type: 'text' | 'image' | 'audio' | 'emoji'
          media_url: string | null
          reply_to: string | null
          created_at: string
          edited_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content?: string | null
          type?: 'text' | 'image' | 'audio' | 'emoji'
          media_url?: string | null
          reply_to?: string | null
          created_at?: string
          edited_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string | null
          type?: 'text' | 'image' | 'audio' | 'emoji'
          media_url?: string | null
          reply_to?: string | null
          created_at?: string
          edited_at?: string | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          subscription: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
