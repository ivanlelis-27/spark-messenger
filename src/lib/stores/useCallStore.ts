import { create } from 'zustand'

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected'

export interface PendingCall {
  targetUserId: string
  targetName: string
  targetAvatar: string | null
  conversationId: string
}

interface CallStore {
  callState: CallState
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  peerConnection: RTCPeerConnection | null
  remoteUserId: string | null
  remoteUserName: string | null
  remoteUserAvatar: string | null
  conversationId: string | null
  isIncoming: boolean
  pendingCall: PendingCall | null

  setCallState: (state: CallState) => void
  setLocalStream: (stream: MediaStream | null) => void
  setRemoteStream: (stream: MediaStream | null) => void
  setPeerConnection: (pc: RTCPeerConnection | null) => void
  setRemoteUser: (id: string, name: string, avatar: string | null, convId: string, isIncoming: boolean) => void
  setPendingCall: (call: PendingCall | null) => void
  endCall: () => void
}

export const useCallStore = create<CallStore>((set, get) => ({
  callState: 'idle',
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  remoteUserId: null,
  remoteUserName: null,
  remoteUserAvatar: null,
  conversationId: null,
  isIncoming: false,
  pendingCall: null,

  setCallState: (state) => set({ callState: state }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  setRemoteUser: (id, name, avatar, convId, isIncoming) => set({
    remoteUserId: id,
    remoteUserName: name,
    remoteUserAvatar: avatar,
    conversationId: convId,
    isIncoming
  }),
  setPendingCall: (call) => set({ pendingCall: call }),
  endCall: () => {
    const { localStream, peerConnection } = get()
    if (localStream) localStream.getTracks().forEach(track => track.stop())
    if (peerConnection) peerConnection.close()
    set({
      callState: 'idle',
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      remoteUserId: null,
      remoteUserName: null,
      remoteUserAvatar: null,
      conversationId: null,
      isIncoming: false,
      pendingCall: null,
    })
  }
}))
