import { NextResponse } from 'next/server'
import webPush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const privateVapidKey = process.env.VAPID_PRIVATE_KEY!
const rawSubject = process.env.VAPID_SUBJECT || 'test@example.com'
const subject = rawSubject.startsWith('mailto:') || rawSubject.startsWith('http') ? rawSubject : `mailto:${rawSubject}`

webPush.setVapidDetails(subject, publicVapidKey, privateVapidKey)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { conversation_id, message, sender_name, sender_id } = await req.json()

    const { data: participants } = await supabase
      .from('participants')
      .select('user_id')
      .eq('conversation_id', conversation_id)
      .neq('user_id', sender_id)

    if (!participants || participants.length === 0) {
      return NextResponse.json({ success: true, message: 'No other targets' })
    }

    const userIds = participants.map((p) => p.user_id)

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription, user_id')
      .in('user_id', userIds)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true, message: 'No subscriptions' })
    }

    const payload = JSON.stringify({
      title: sender_name,
      body: message,
      url: `/c/${conversation_id}`,
    })

    const sendPromises = subs.map(async (subRecord) => {
      try {
        const pushSubscription = subRecord.subscription as any
        await webPush.sendNotification(pushSubscription, payload)
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Extract endpoint manually to delete
          const pushSub = subRecord.subscription as any
          if (pushSub.endpoint) {
            // Try to cleanup invalid subscription
            await supabase.from('push_subscriptions').delete().eq('user_id', subRecord.user_id).contains('subscription', { endpoint: pushSub.endpoint })
          }
        } else {
          console.error('Push error:', err)
        }
      }
    })

    await Promise.all(sendPromises)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push Notification Error:', error)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
