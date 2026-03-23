import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  try {
    const res = await fetch(url)
    const html = await res.text()
    
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) || html.match(/<title>(.*?)<\/title>/i)
    const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i) || html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i)
    
    return NextResponse.json({
      title: titleMatch?.[1] || new URL(url).hostname,
      description: descMatch?.[1] || '',
      image: imageMatch?.[1] || '',
      url
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch OG data' }, { status: 500 })
  }
}
