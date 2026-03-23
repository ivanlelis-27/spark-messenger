'use client'

import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'

export function LinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<any>(null)
  
  useEffect(() => {
    fetch(`/api/og?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => { if (!data.error) setPreview(data) })
      .catch(() => {})
  }, [url])

  if (!preview) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">
        {url}
      </a>
    )
  }

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="block mt-2 mb-1 border border-border rounded-lg overflow-hidden bg-background/50 hover:bg-background/80 transition-colors max-w-sm text-foreground no-underline"
    >
      {preview.image && (
        <div className="w-full h-32 bg-muted relative">
          <img src={preview.image} alt={preview.title} className="object-cover w-full h-full" />
        </div>
      )}
      <div className="p-3">
        <h4 className="text-sm font-semibold line-clamp-1 flex items-center gap-1">
          {preview.title}
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </h4>
        {preview.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{preview.description}</p>}
        <span className="text-[10px] text-muted-foreground mt-2 block truncate">{new URL(url).hostname}</span>
      </div>
    </a>
  )
}
