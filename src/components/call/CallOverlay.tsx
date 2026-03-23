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
    if (err.name === 'NotReadableError' || err.name === 'NotAllowedError' || err.name === 'OverconstrainedError') {
      toast.warning('Camera unavailable or locked. Joining with audio only.')
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
  
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && store.localStream) {
      localVideoRef.current.srcObject = store.localStream
      localVideoRef.current.play().catch(err => console.error('Local video play failed:', err))
    }
  }, [store.localStream, store.callState])

  useEffect(() => {
    if (remoteVideoRef.current && store.remoteStream) {
      remoteVideoRef.current.srcObject = store.remoteStream
      remoteVideoRef.current.play().catch(err => console.error('Remote video play failed:', err))
    }
  }, [store.remoteStream, store.callState])

  // Setup Global Signaling Listener
  useEffect(() => {
    if (!user) return

    const channel = supabase.channel(`call:${user.id}`)

    channel.on('broadcast', { event: 'call-offer' }, async ({ payload }) => {
      if (store.callState !== 'idle') {
        // Busy
        supabase.channel(`call:${payload.callerId}`).send({
          type: 'broadcast',
          event: 'call-busy',
          payload: { responderId: user.id }
        })
        return
      }
      
      store.setRemoteUser(payload.callerId, payload.callerName, payload.callerAvatar, payload.conversationId, true)
      store.setCallState('ringing')

      // Save the offer so we can answer it if user accepts
      ;(window as any)._pendingOffer = payload.sdp
    })

    channel.on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
      if (store.peerConnection) {
        await store.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp))
      }
    })

    channel.on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
      if (store.peerConnection) {
        try {
          await store.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch (e) {
          console.error('Error adding received ice candidate', e)
        }
      }
    })

    channel.on('broadcast', { event: 'call-ended' }, () => {
      store.endCall()
    })

    channel.on('broadcast', { event: 'call-busy' }, () => {
      alert('User is busy on another call')
      store.endCall()
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, store.callState])

  const acceptCall = async () => {
    try {
      const stream = await getMediaStreamWithFallback()
      store.setLocalStream(stream)

      const pc = new RTCPeerConnection(ICE_SERVERS)
      store.setPeerConnection(pc)

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          store.setRemoteStream(event.streams[0])
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && store.remoteUserId) {
          supabase.channel(`call:${store.remoteUserId}`).send({
            type: 'broadcast',
            event: 'call-ice',
            payload: { candidate: event.candidate, senderId: user?.id }
          })
        }
      }

      const offer = (window as any)._pendingOffer
      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        supabase.channel(`call:${store.remoteUserId}`).send({
          type: 'broadcast',
          event: 'call-answer',
          payload: { sdp: answer, responderId: user?.id }
        })
      }
      
      store.setCallState('connected')
    } catch (err) {
      console.error('Failed to accept call', err)
      store.endCall()
    }
  }

  const declineCall = () => {
    if (store.remoteUserId) {
      supabase.channel(`call:${store.remoteUserId}`).send({
        type: 'broadcast',
        event: 'call-ended',
        payload: { enderId: user?.id }
      })
    }
    store.endCall()
  }

  const toggleMute = () => {
    if (store.localStream) {
      store.localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled)
      setIsMuted(!isMuted)
    }
  }

  const toggleVideo = () => {
    if (store.localStream) {
      store.localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled)
      setIsVideoOff(!isVideoOff)
    }
  }

  if (store.callState === 'idle') return null

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
      
      {store.callState === 'ringing' && store.isIncoming && (
        <div className="flex flex-col items-center space-y-8 animate-in slide-in-from-bottom-10">
          <Avatar className="h-32 w-32 border-4 border-primary/20 animate-pulse">
            <AvatarImage src={store.remoteUserAvatar || undefined} />
            <AvatarFallback className="text-4xl">{getInitials(store.remoteUserName || 'Unknown')}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{store.remoteUserName}</h2>
            <p className="text-primary mt-2 animate-pulse">Incoming Call...</p>
          </div>
          <div className="flex gap-12 mt-12">
            <button onClick={declineCall} className="h-16 w-16 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:opacity-90 transition-transform active:scale-90 shadow-lg">
              <PhoneOff className="h-8 w-8" />
            </button>
            <button onClick={acceptCall} className="h-16 w-16 bg-green-500 text-white rounded-full flex items-center justify-center hover:opacity-90 transition-transform active:scale-90 shadow-lg animate-bounce">
              <Phone className="h-8 w-8 fill-current" />
            </button>
          </div>
        </div>
      )}

      {store.callState === 'ringing' && !store.isIncoming && (
        <div className="flex flex-col items-center space-y-8">
          <Avatar className="h-32 w-32 border-4 border-border">
            <AvatarImage src={store.remoteUserAvatar || undefined} />
            <AvatarFallback className="text-4xl">{getInitials(store.remoteUserName || 'Unknown')}</AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{store.remoteUserName}</h2>
            <p className="text-muted-foreground mt-2">Calling...</p>
          </div>
          <div className="mt-12">
            <button onClick={declineCall} className="h-16 w-16 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:opacity-90 transition-transform active:scale-90 shadow-lg">
              <PhoneOff className="h-8 w-8" />
            </button>
          </div>
        </div>
      )}

      {store.callState === 'connected' && (
        <div className="w-full h-full relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-border/50">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Local Video PIP */}
          <div className="absolute top-6 right-6 w-24 h-36 md:w-32 md:h-48 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-10 transition-all hover:scale-105 cursor-pointer">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          <div className="absolute top-6 left-6 z-10 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
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
