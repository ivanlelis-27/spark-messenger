-- ============================================
-- Spark Messenger — Supabase Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Profiles
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text check (type in ('dm', 'group')) default 'dm',
  name text,
  avatar_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 3. Participants
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id),
  joined_at timestamptz default now(),
  last_read_at timestamptz,
  unique(conversation_id, user_id)
);

-- 4. Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  content text,
  type text check (type in ('text', 'image', 'audio', 'emoji')) default 'text',
  media_url text,
  reply_to uuid references public.messages(id),
  created_at timestamptz default now(),
  edited_at timestamptz
);

-- 5. Reactions
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id),
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- 6. Push Subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz default now()
);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.push_subscriptions enable row level security;

-- ============================================
-- Security Policies
-- ============================================

-- Profiles
create policy "Profiles are viewable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Conversations
create policy "Conversations are viewable by participants" on public.conversations for select to authenticated using (
    id in (select conversation_id from public.participants where user_id = auth.uid())
);
create policy "Authenticated users can create conversations" on public.conversations for insert to authenticated with check (auth.uid() = created_by);
create policy "Conversation creator can update" on public.conversations for update to authenticated using (auth.uid() = created_by);

-- Participants
create policy "Participants are viewable by conversation members" on public.participants for select to authenticated using (
    conversation_id in (select conversation_id from public.participants where user_id = auth.uid())
);
create policy "Authenticated users can add participants" on public.participants for insert to authenticated with check (true);
create policy "Participants can remove themselves" on public.participants for delete to authenticated using (user_id = auth.uid());

-- Messages
create policy "Messages are viewable by conversation participants" on public.messages for select to authenticated using (
    conversation_id in (select conversation_id from public.participants where user_id = auth.uid())
);
create policy "Participants can send messages" on public.messages for insert to authenticated with check (
    auth.uid() = sender_id and conversation_id in (select conversation_id from public.participants where user_id = auth.uid())
);
create policy "Users can edit their own messages" on public.messages for update to authenticated using (auth.uid() = sender_id);

-- Reactions
create policy "Reactions are viewable by conversation participants" on public.reactions for select to authenticated using (
    message_id in (
      select m.id from public.messages m
      join public.participants p on p.conversation_id = m.conversation_id
      where p.user_id = auth.uid()
    )
);
create policy "Participants can add reactions" on public.reactions for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can remove their own reactions" on public.reactions for delete to authenticated using (auth.uid() = user_id);

-- Push Subscriptions
create policy "Users can manage their own push subscriptions" on public.push_subscriptions for all to authenticated using (auth.uid() = user_id);

-- ============================================
-- Publications & Indexes
-- ============================================

-- Enable Realtime on messages
drop publication if exists supabase_realtime;
create publication supabase_realtime for table public.messages;

-- Indexes for performance
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);
create index if not exists idx_participants_user_id on public.participants(user_id);
create index if not exists idx_participants_conversation_id on public.participants(conversation_id);
create index if not exists idx_profiles_username on public.profiles(username);

-- ============================================
-- Auth Triggers
-- ============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
