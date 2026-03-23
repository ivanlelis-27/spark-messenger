'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/stores/useAuthStore'
import { useCallStore } from '@/lib/stores/useCallStore'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'
import { toast } from 'sonner'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
}

const RING_TIMEOUT_MS = 30_000 // 30 seconds

export async function getMediaStreamWithFallback() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
    })
  } catch (err: any) {
    if (['NotReadableError', 'NotAllowedError', 'OverconstrainedError'].includes(err.name)) {
      toast.warning('Camera unavailable. Joining audio-only.')
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }
    throw err
  }
}

/* ─── Calm ringtone using Web Audio API ──────────────────────── */
function createRingtone(): { start: () => void; stop: () => void } {
  let ctx: AudioContext | null = null
  let interval: ReturnType<typeof setInterval> | null = null
  let stopped = false

  const playNote = (frequency: number, startTime: number, duration: number) => {
    if (!ctx || stopped) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05)
    gain.gain.setValueAtTime(0.15, startTime + duration - 0.1)
    gain.gain.linearRampToValueAtTime(0, startTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration)
  }

  const playChime = () => {
    if (!ctx || stopped) return
    const now = ctx.currentTime
    // Gentle ascending three-note chime: C5 → E5 → G5
    playNote(523.25, now, 0.3)         // C5
    playNote(659.25, now + 0.35, 0.3)  // E5
    playNote(783.99, now + 0.7, 0.4)   // G5
  }

  return {
    start: () => {
      try {
        ctx = new AudioContext()
        stopped = false
        playChime()
        interval = setInterval(playChime, 3000) // repeat every 3s
      } catch (_) {}
    },
    stop: () => {
      stopped = true
      if (interval) clearInterval(interval)
      interval = null
      if (ctx) { ctx.close().catch(() => {}); ctx = null }
    }
  }
}

/* ─── Format seconds into "Xm Ys" ───────────────────────────── */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function CallOverlay() {
  const { user } = useAuthStore()
  const store = useCallStore()
  const supabase = createClient()

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([])
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null)
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callStartRef = useRef<number | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  /* ─── Attach local stream ────────────────────────────────────── */
  useEffect(() => {
    const el = localVideoRef.current
    if (el && store.localStream) {
      el.srcObject = store.localStream
      el.play().catch(() => {})
    }
  }, [store.localStream, store.callState])

  /* ─── Attach remote stream ──────────────────────────────────── */
  useEffect(() => {
    const el = remoteVideoRef.current
    if (el && store.remoteStream) {
      el.srcObject = store.remoteStream
      el.play().catch(() => {})
    }
  }, [store.remoteStream, store.callState])

  /* ─── Call duration timer ────────────────────────────────────── */
  useEffect(() => {
    if (store.callState === 'connected' && !callStartRef.current) {
      callStartRef.current = Date.now()
      setCallDuration(0)
      durationIntervalRef.current = setInterval(() => {
        if (callStartRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000))
        }
      }, 1000)
    }
    if (store.callState === 'idle') {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }, [store.callState])

  /* ─── Helpers ────────────────────────────────────────────────── */
  const drainIce = async (pc: RTCPeerConnection) => {
    for (const c of iceQueueRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
    }
    iceQueueRef.current = []
  }

  const buildPc = (targetId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = (ev) => {
      if (ev.streams?.[0]) useCallStore.getState().setRemoteStream(ev.streams[0])
    }

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        supabase.channel(`call:${targetId}`).send({
          type: 'broadcast', event: 'call-ice',
          payload: { candidate: ev.candidate.toJSON() }
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        toast.error('Call connection dropped')
        doEndCall('Call failed')
      }
    }

    return pc
  }

  const stopRinging = () => {
    ringtoneRef.current?.stop()
    ringtoneRef.current = null
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null }
  }

  const logCall = async (content: string) => {
    const s = useCallStore.getState()
    const convId = s.conversationId
    if (!convId || !user) return
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      content,
      type: 'call' as any,
    })
  }

  const doEndCall = async (reason?: string) => {
    stopRinging()
    const s = useCallStore.getState()
    const rid = s.remoteUserId

    // Log the call
    if (s.callState === 'connected' && callStartRef.current) {
      const dur = Math.floor((Date.now() - callStartRef.current) / 1000)
      await logCall(`Call ended · ${formatDuration(dur)}`)
    } else if (reason === 'missed') {
      await logCall('Missed call')
    } else if (reason === 'declined') {
      await logCall('Call declined')
    } else if (reason === 'timeout') {
      await logCall('Missed call')
    }

    // Notify remote
    if (rid) {
      supabase.channel(`call:${rid}`).send({
        type: 'broadcast', event: 'call-ended', payload: { reason: reason || 'ended' }
      }).catch(() => {})
    }

    pcRef.current?.close()
    pcRef.current = null
    iceQueueRef.current = []
    callStartRef.current = null
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    durationIntervalRef.current = null
    setCallDuration(0)
    s.endCall()
  }

  /* ─── Outgoing call (triggered by pendingCall) ──────────────── */
  useEffect(() => {
    const { pendingCall } = store
    if (!pendingCall || !user) return

    ;(async () => {
      try {
        const stream = await getMediaStreamWithFallback()
        const s = useCallStore.getState()
        s.setLocalStream(stream)
        s.setRemoteUser(pendingCall.targetUserId, pendingCall.targetName, pendingCall.targetAvatar, pendingCall.conversationId, false)
        useCallStore.setState({ callState: 'connected', pendingCall: null })

        // Start ringtone for the caller's feedback
        const ring = createRingtone()
        ringtoneRef.current = ring
        ring.start()

        // Auto-timeout after 30s
        ringTimeoutRef.current = setTimeout(async () => {
          stopRinging()
          const currentState = useCallStore.getState()
          if (!currentState.remoteStream) {
            // No one answered
            await doEndCall('timeout')
          }
        }, RING_TIMEOUT_MS)

        const pc = buildPc(pendingCall.targetUserId)
        s.setPeerConnection(pc)
        stream.getTracks().forEach(t => pc.addTrack(t, stream))

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const { data: profile } = await supabase
          .from('profiles').select('display_name,username,avatar_url')
          .eq('id', user.id).single()

        await supabase.channel(`call:${pendingCall.targetUserId}`).send({
          type: 'broadcast',
          event: 'call-offer',
          payload: {
            sdp: pc.localDescription,
            callerId: user.id,
            callerName: profile?.display_name || profile?.username || 'Unknown',
            callerAvatar: profile?.avatar_url,
            conversationId: pendingCall.conversationId
          }
        })
      } catch (err: any) {
        toast.error(err?.message || 'Could not start call')
        useCallStore.setState({ pendingCall: null })
        useCallStore.getState().endCall()
      }
    })()
  }, [store.pendingCall])

  /* ─── Global signaling listener ─────────────────────────────── */
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel(`call:${user.id}`)

    channel.on('broadcast', { event: 'call-offer' }, ({ payload }) => {
      if (useCallStore.getState().callState !== 'idle') {
        supabase.channel(`call:${payload.callerId}`).send({
          type: 'broadcast', event: 'call-busy', payload: {}
        })
        return
      }
      store.setRemoteUser(payload.callerId, payload.callerName, payload.callerAvatar, payload.conversationId, true)
      store.setCallState('ringing')
      ;(window as any)._pendingOffer = payload.sdp

      // Start ringtone for callee
      const ring = createRingtone()
      ringtoneRef.current = ring
      ring.start()

      // Auto-miss after 30s
      ringTimeoutRef.current = setTimeout(async () => {
        stopRinging()
        if (useCallStore.getState().callState === 'ringing') {
          await logCall('Missed call')
          useCallStore.getState().endCall()
        }
      }, RING_TIMEOUT_MS)
    })

    channel.on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
      stopRinging() // Caller stops ringing when callee answers
      const pc = pcRef.current
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        await drainIce(pc)
      } catch (e) { console.error('answer failed', e) }
    })

    channel.on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
      const pc = pcRef.current
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)) } catch (_) {}
      } else {
        iceQueueRef.current.push(payload.candidate)
      }
    })

    channel.on('broadcast', { event: 'call-ended' }, async ({ payload }) => {
      stopRinging()
      const s = useCallStore.getState()
      // If we were ringing and the caller cancelled, log as missed
      if (s.callState === 'ringing' && s.isIncoming) {
        await logCall('Missed call')
      }
      pcRef.current?.close()
      pcRef.current = null
      iceQueueRef.current = []
      callStartRef.current = null
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
      setCallDuration(0)
      s.endCall()
    })

    channel.on('broadcast', { event: 'call-busy' }, () => {
      stopRinging()
      toast.error('User is busy')
      pcRef.current?.close()
      pcRef.current = null
      useCallStore.getState().endCall()
    })

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  /* ─── Accept incoming call ───────────────────────────────────── */
  const acceptCall = async () => {
    stopRinging()
    const remoteId = store.remoteUserId!
    try {
      const stream = await getMediaStreamWithFallback()
      useCallStore.getState().setLocalStream(stream)
      useCallStore.setState({ callState: 'connected' })

      const pc = buildPc(remoteId)
      useCallStore.getState().setPeerConnection(pc)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      const offer = (window as any)._pendingOffer
      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        await drainIce(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await supabase.channel(`call:${remoteId}`).send({
          type: 'broadcast',
          event: 'call-answer',
          payload: { sdp: pc.localDescription }
        })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not start call')
      doEndCall()
    }
  }

  const toggleMute = () => {
    store.localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }
  const toggleVideo = () => {
    store.localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsVideoOff(v => !v)
  }

  if (store.callState === 'idle') return null

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">

      {/* INCOMING RING */}
      {store.callState === 'ringing' && store.isIncoming && (
        <div className="flex flex-col items-center space-y-8 animate-in slide-in-from-bottom-10">
          <Avatar className="h-32 w-32 border-4 border-primary/20 animate-pulse">
            <AvatarImage src={store.remoteUserAvatar || undefined} />
            <AvatarFallback className="text-4xl">{getInitials(store.remoteUserName || '?')}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-bold">{store.remoteUserName}</h2>
            <p className="text-primary mt-2 animate-pulse">Incoming Call...</p>
          </div>
          <div className="flex gap-12 mt-12">
            <button onClick={() => doEndCall('declined')} className="h-16 w-16 bg-destructive text-white rounded-full flex items-center justify-center active:scale-90 shadow-lg">
              <PhoneOff className="h-8 w-8" />
            </button>
            <button onClick={acceptCall} className="h-16 w-16 bg-green-500 text-white rounded-full flex items-center justify-center active:scale-90 shadow-lg animate-bounce">
              <Phone className="h-8 w-8 fill-current" />
            </button>
          </div>
        </div>
      )}

      {/* OUTGOING CALLING */}
      {store.callState === 'calling' && (
        <div className="flex flex-col items-center space-y-8">
          <Avatar className="h-32 w-32 border-4 border-border animate-pulse">
            <AvatarImage src={store.remoteUserAvatar || undefined} />
            <AvatarFallback className="text-4xl">{getInitials(store.remoteUserName || '?')}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-bold">{store.remoteUserName}</h2>
            <p className="text-muted-foreground mt-2 animate-pulse">Calling...</p>
          </div>
          <button onClick={() => doEndCall()} className="mt-12 h-16 w-16 bg-destructive text-white rounded-full flex items-center justify-center active:scale-90 shadow-lg">
            <PhoneOff className="h-8 w-8" />
          </button>
        </div>
      )}

      {/* CONNECTED */}
      {store.callState === 'connected' && (
        <div className="w-full h-full relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">

          {/* Remote video or avatar placeholder */}
          {store.remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-28 w-28">
                  <AvatarImage src={store.remoteUserAvatar || undefined} />
                  <AvatarFallback className="text-4xl">{getInitials(store.remoteUserName || '?')}</AvatarFallback>
                </Avatar>
                <p className="text-white/60 text-sm animate-pulse">Waiting for {store.remoteUserName}…</p>
              </div>
            </div>
          )}

          {/* Local camera PIP */}
          <div className="absolute top-6 right-6 w-28 h-40 md:w-36 md:h-52 bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/20 z-10 shadow-2xl">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>

          {/* Name + duration */}
          <div className="absolute top-6 left-6 z-10 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
            <span className="text-white text-sm font-medium">{store.remoteUserName}</span>
            {callDuration > 0 && (
              <span className="text-white/60 text-xs">· {formatDuration(callDuration)}</span>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 shadow-2xl">
            <button onClick={toggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <button onClick={() => doEndCall()} className="p-5 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-all hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
              <PhoneOff className="h-7 w-7" />
            </button>
            <button onClick={toggleVideo} className={`p-4 rounded-full transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
