import { Skeleton } from '@/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 safe-area-inset-top shrink-0">
        <Skeleton className="h-5 w-5 rounded-md md:hidden shrink-0" />
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Messages Skeleton */}
      <div className="flex-1 p-4 space-y-6 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-end gap-2 max-w-[80%] ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className={`h-12 rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Input Skeleton */}
      <div className="px-4 py-3 border-t border-border bg-card/50 safe-area-inset-bottom shrink-0">
        <div className="flex items-end gap-2">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <Skeleton className="h-10 flex-1 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
