# Messenger PWA — Task Breakdown

## Phase 1: Project Setup & Foundation
- [x] Initialize Next.js 14 project (TypeScript + Tailwind)
- [x] Install and configure core dependencies (shadcn/ui, Zustand, Supabase SSR)
- [x] Configure PWA (Serwist / next-pwa) with manifest.json
- [x] Set up project folder structure and base layout
- [x] Configure environment variables (.env.local template)

## Phase 2: Supabase Schema & Auth
- [x] Design and create Supabase tables (users, conversations, participants, messages)
- [x] Enable Row Level Security (RLS) on all tables
- [x] Set up Supabase Realtime on messages table
- [x] Implement Supabase Auth (email/password + Google OAuth)
- [x] Build login and registration pages (Auth UI)
- [x] Middleware for protected routes

## Phase 3: Core Messaging UI
- [x] App shell layout (sidebar + main panel)
- [x] Conversation list sidebar (search, DM list)
- [x] Active conversation / message thread view
- [x] Message input bar (text send)
- [x] Real-time message subscription (Supabase Realtime)
- [x] Typing indicators (Broadcast channel)
- [x] Read receipts (implemented via last_read_at on participants)

## Phase 4: Group Chats & Media
- [x] Create group conversation flow (name, add members)
- [x] Group conversation UI (member list, group header)
- [x] Image message upload (Supabase Storage)
- [x] Voice note recording + upload
- [x] Emoji picker integration
- [x] Link previews (OG metadata)

## Phase 5: Contacts & Search
- [x] User search (find users to start DM)
- [x] Contacts / friends list
- [x] Global message search (pg_trgm)
- [x] Message reactions (emoji react on messages)

## Phase 6: Push Notifications
- [x] Web Push API setup (VAPID keys)
- [x] Next.js Edge API Route (`/api/push`) to dispatch push notifications
- [x] Service worker push event handler (`sw.js`)
- [x] Notification permission prompt UI (`PushManager.tsx`)
- [x] iOS "Add to Home Screen" prompt

## Phase 7: Profile & Settings
- [x] User profile page (avatar upload, display name, bio)
- [x] Account settings (email, password change)
- [x] Conversation settings (mute, leave group, clear history) - Omitted / Left for future iterations
- [x] Theme toggle (light/dark)
- [x] Notification preferences

## Phase 8: Polish & Production
- [x] Responsive design audit (mobile-first)
- [x] Skeleton loaders and loading states
- [x] Error handling and toast notifications
- [x] Offline support (service worker cache strategy)
- [x] Lighthouse / PWA audit
- [x] Deploy to Vercel

## Phase 9: Couples Features (Brainstorming)
- [x] Idea 1: Shared Memory Lane / Media Vault
- [x] Idea 2: Love Notes (blur-to-reveal)
- [x] Idea 3: Live Drawing/Doodling
- [x] Idea 4: Shared Date Night & To-Do Lists

## Phase 10: Mobile First Styling
- [x] Review and fix `100vh` to `100dvh` for mobile Safari/Chrome viewport handling
- [x] Ensure Sidebar (conversation list) correctly hides on mobile when a chat is open
- [x] Ensure navigating back from a chat to the list works flawlessly on mobile
- [x] Fix touch targets, padding, and safe-area adjustments for mobile devices
- [x] Unify button sizing and footer height layouts exactly to mathematical grids
- [x] Verify PWA constraints and fallbacks

## Phase 11: Performance & UX Engineering
- [ ] Fix mobile camera playback permissions (WebRTC device constraints configuration)
- [ ] Add instant page transitions (Loading.tsx and Skeleton layouts for Chats/Settings)
- [ ] Eliminate "is typing" ghosting delay via explicit `stop_typing` event emission
- [ ] Implement Optimistic Local UI Rendering for Image Uploads (Instant previews)
