import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatView } from '@/components/chat/ChatView'
import type { ConversationWithDetails } from '@/lib/stores/useConversationStore'
import type { Database } from '@/lib/supabase/types'

type Participant = Database['public']['Tables']['participants']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

interface ConversationPageProps {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify user is a participant
  const { data: participant } = await supabase
    .from('participants')
    .select('id')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .single()

  if (!participant) redirect('/')

  // Fetch conversation details
  const { data: conversation } = (await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()) as unknown as { data: Database['public']['Tables']['conversations']['Row'] }

  if (!conversation) redirect('/')

  // Fetch current user profile
  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as unknown as { data: Profile }

  if (!profile) redirect('/login')

  // Fetch participants with profiles
  const { data: participants } = await supabase
    .from('participants')
    .select('*, profile:profiles(*)')
    .eq('conversation_id', id)

  const conversationWithDetails: ConversationWithDetails = {
    ...conversation,
    participants: (participants || []) as (Participant & { profile: Profile })[],
  }

  return <ChatView conversation={conversationWithDetails} currentUser={profile} />
}
