'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex-1 min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <div className="bg-card border border-destructive/20 shadow-xl rounded-3xl p-6 md:p-8 max-w-md w-full text-center animate-in zoom-in-95">
        <div className="h-16 w-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Something went wrong!</h2>
        <p className="text-muted-foreground text-sm mb-6">
          An unexpected error occurred while rendering this page. We've logged the issue.
        </p>
        <Button 
          onClick={() => reset()} 
          className="w-full h-12 rounded-xl text-base font-semibold"
          variant="default"
        >
          Try again
        </Button>
      </div>
    </div>
  )
}
