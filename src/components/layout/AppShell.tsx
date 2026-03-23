'use client'

import { useState } from 'react'
import type { Database } from '@/lib/supabase/types'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { cn } from '@/lib/utils'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AppShellProps {
  children: React.ReactNode
  currentUser: Profile
}

export function AppShell({ children, currentUser }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex-shrink-0 border-r border-border bg-card transition-all duration-300',
          'h-full overflow-hidden',
          // Mobile: full width when sidebar open, hidden when viewing chat
          'w-full md:w-[var(--sidebar-width)]',
        )}
        style={{ '--sidebar-width': '340px' } as React.CSSProperties}
      >
        <Sidebar currentUser={currentUser} onMobileNavToChat={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          // On mobile, show main only when sidebar is closed
          'hidden md:flex',
        )}
      >
        {children}
      </main>
    </div>
  )
}
