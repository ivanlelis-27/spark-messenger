import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex-1 min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background text-foreground">
      <div className="bg-card border border-border shadow-xl rounded-3xl p-6 md:p-8 max-w-md w-full text-center animate-in zoom-in-95">
        <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          We couldn't find the page you were looking for. The link might be broken, or the page may have been removed.
        </p>
        <Link href="/">
          <Button className="w-full h-12 rounded-xl text-base font-semibold">
            Return to App
          </Button>
        </Link>
      </div>
    </div>
  )
}
