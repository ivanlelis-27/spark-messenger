'use client'

import { usePathname } from 'next/navigation'
import type { Database } from '@/lib/supabase/types'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { cn } from '@/lib/utils'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AppShellProps {
  children: React.ReactNode
  currentUser: Profile
}

export function AppShell({ children, currentUser }: AppShellProps) {
  const pathname = usePathname()
  
  // On mobile, the Sidebar is essentially the "home" view.
  // Any inner navigation (chat, contacts, settings) takes up the full screen.
  const isMobileHome = pathname === '/'

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex-shrink-0 border-r border-border bg-card transition-all duration-300',
          'h-full overflow-hidden',
          // Show on desktop always. On mobile, show only if on home route.
          isMobileHome ? 'flex w-full' : 'hidden md:flex w-full md:w-[var(--sidebar-width)]',
        )}
        style={{ '--sidebar-width': '340px' } as React.CSSProperties}
      >
        <Sidebar currentUser={currentUser} />
      </aside>

      {/* Main content area */}
      <main
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          // Show on desktop always. On mobile, hide if showing sidebar home.
          isMobileHome ? 'hidden md:flex' : 'flex w-full',
        )}
      >
        {children}
      </main>
    </div>
  )
}
