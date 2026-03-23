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

export async function getMediaStreamWithFallback() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
    })
  } catch (err: any) {
    if (['NotReadableError', 'NotAllowedError', 'OverconstrainedError'].includes(err.name)) {
      toast.warning('Camera unavailable. Joining with audio only.')
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }
    throw err
  }
}

export function CallOverlay() {
  const { user } = useAuthStore()
  const store = useCallStore()
  const supabase = createClient()

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  // Central ref — always tracks the live RTCPeerConnection
  const pcRef = useRef<RTCPeerConnection | null>(null)
  // Buffer ICE candidates that arrive before the PC is ready
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([])

  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  /* ── Attach local stream ─────────────────────────────────────── */
  useEffect(() => {
    const el = localVideoRef.current
    if (el && store.localStream) {
      el.srcObject = store.localStream
      el.play().catch(() => {})
    }
  }, [store.localStream, store.callState])

  /* ── Attach remote stream ────────────────────────────────────── */
  useEffect(() => {
    const el = remoteVideoRef.current
    if (el && store.remoteStream) {
      el.srcObject = store.remoteStream
      el.play().catch(() => {})
    }
  }, [store.remoteStream, store.callState])

  /* ── Helper: drain buffered ICE candidates ───────────────────── */
  const drainIceQueue = async (pc: RTCPeerConnection) => {
    for (const c of iceCandidateQueueRef.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch (e) {}
    }
    iceCandidateQueueRef.current = []
  }

  /* ── Helper: build RTCPeerConnection with shared handlers ─────── */
  const buildPc = (targetUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        useCallStore.getState().setRemoteStream(event.streams[0])
        useCallStore.setState({ callState: 'connected' })
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        supabase.channel(`call:${targetUserId}`).send({
          type: 'broadcast',
          event: 'call-ice',
          payload: { candidate: event.candidate.toJSON(), senderId: user?.id }
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        toast.error('Call connection lost')
        cleanup(targetUserId)
      }
    }

    return pc
  }

  /* ── Helper: end call + cleanup ──────────────────────────────── */
  const cleanup = (targetUserId?: string) => {
    const rid = targetUserId || useCallStore.getState().remoteUserId
    if (rid) {
      supabase.channel(`call:${rid}`).send({
        type: 'broadcast', event: 'call-ended', payload: { enderId: user?.id }
      }).catch(() => {})
    }
    pcRef.current = null
    iceCandidateQueueRef.current = []
    useCallStore.getState().endCall()
  }

  /* ── Initiate outgoing call (triggered by pendingCall in store) ── */
  useEffect(() => {
    const { pendingCall } = store
    if (!pendingCall || !user) return

    ;(async () => {
      try {
        const stream = await getMediaStreamWithFallback()
        useCallStore.getState().setLocalStream(stream)

        const pc = buildPc(pendingCall.targetUserId)
        useCallStore.getState().setPeerConnection(pc)
        stream.getTracks().forEach(t => pc.addTrack(t, stream))

        useCallStore.getState().setRemoteUser(
          pendingCall.targetUserId,
          pendingCall.targetName,
          pendingCall.targetAvatar,
          pendingCall.conversationId,
          false
        )
        useCallStore.setState({ callState: 'calling', pendingCall: null })

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

  /* ── Global signaling listener ───────────────────────────────── */
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel(`call:${user.id}`)

    // Incoming offer
    channel.on('broadcast', { event: 'call-offer' }, ({ payload }) => {
      if (useCallStore.getState().callState !== 'idle') {
        supabase.channel(`call:${payload.callerId}`).send({
          type: 'broadcast', event: 'call-busy', payload: { responderId: user.id }
        })
        return
      }
      store.setRemoteUser(payload.callerId, payload.callerName, payload.callerAvatar, payload.conversationId, true)
      store.setCallState('ringing')
      ;(window as any)._pendingOffer = payload.sdp
    })

    // Answer from callee → caller sets remote desc + drains ICE
    channel.on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
      const pc = pcRef.current
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        await drainIceQueue(pc)
      } catch (e) { console.error('setRemoteDescription failed', e) }
    })

    // ICE candidate — buffer if PC not ready yet
    channel.on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
      const pc = pcRef.current
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)) }
        catch (e) {}
      } else {
        // Buffer it; will be applied once remote desc is set
        iceCandidateQueueRef.current.push(payload.candidate)
      }
    })

    channel.on('broadcast', { event: 'call-ended' }, () => {
      pcRef.current = null
      iceCandidateQueueRef.current = []
      store.endCall()
    })

    channel.on('broadcast', { event: 'call-busy' }, () => {
      toast.error('User is busy on another call')
      pcRef.current = null
      store.endCall()
    })

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  /* ── Accept incoming call ────────────────────────────────────── */
  const acceptCall = async () => {
    const remoteId = store.remoteUserId!
    try {
      const stream = await getMediaStreamWithFallback()
      useCallStore.getState().setLocalStream(stream)

      const pc = buildPc(remoteId)
      useCallStore.getState().setPeerConnection(pc)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      const offer = (window as any)._pendingOffer
      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        // Drain any buffered ICE candidates that arrived before accept
        await drainIceQueue(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await supabase.channel(`call:${remoteId}`).send({
          type: 'broadcast',
          event: 'call-answer',
          payload: { sdp: pc.localDescription, responderId: user?.id }
        })
      }

      useCallStore.setState({ callState: 'connected' })
    } catch (err: any) {
      toast.error(err?.message || 'Could not start call')
      cleanup(remoteId)
    }
  }

  const declineCall = () => cleanup()

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
            <button onClick={declineCall} className="h-16 w-16 bg-destructive text-white rounded-full flex items-center justify-center active:scale-90 shadow-lg">
              <PhoneOff className="h-8 w-8" />
            </button>
            <button onClick={acceptCall} className="h-16 w-16 bg-green-500 text-white rounded-full flex items-center justify-center active:scale-90 shadow-lg animate-bounce">
              <Phone className="h-8 w-8 fill-current" />
            </button>
          </div>
        </div>
      )}

      {/* OUTGOING CALLING */}
      {(store.callState === 'calling' || (store.callState === 'ringing' && !store.isIncoming)) && (
        <div className="flex flex-col items-center space-y-8">
          <Avatar className="h-32 w-32 border-4 border-border">
            <AvatarImage src={store.remoteUserAvatar || undefined} />
            <AvatarFallback className="text-4xl">{getInitials(store.remoteUserName || '?')}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-bold">{store.remoteUserName}</h2>
            <p className="text-muted-foreground mt-2 animate-pulse">Calling...</p>
          </div>
          <div className="mt-12">
            <button onClick={declineCall} className="h-16 w-16 bg-destructive text-white rounded-full flex items-center justify-center active:scale-90 shadow-lg">
              <PhoneOff className="h-8 w-8" />
            </button>
          </div>
        </div>
      )}

      {/* CONNECTED */}
      {store.callState === 'connected' && (
        <div className="w-full h-full relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
          {/* Remote video */}
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />

          {/* Avatar placeholder when remote video not yet flowing */}
          {!store.remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Avatar className="h-32 w-32">
                <AvatarImage src={store.remoteUserAvatar || undefined} />
                <AvatarFallback className="text-4xl">{getInitials(store.remoteUserName || '?')}</AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Local video PIP */}
          <div className="absolute top-6 right-6 w-24 h-36 md:w-32 md:h-48 bg-gray-900 rounded-2xl overflow-hidden border-2 border-white/10 z-10 shadow-2xl">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>

          <div className="absolute top-6 left-6 z-10 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full border border-white/10">
            <span className="text-white text-sm font-medium">{store.remoteUserName}</span>
          </div>

          {/* Controls */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 shadow-2xl">
            <button onClick={toggleMute} className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <button onClick={declineCall} className="p-5 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-all hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
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
