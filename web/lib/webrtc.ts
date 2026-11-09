const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const VIDEO_CONSTRAINTS: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } }

export interface PeerCallbacks {
  onRemoteStream:     (stream: MediaStream) => void
  onIceCandidate:     (candidate: RTCIceCandidate) => void
  /** ICE + DTLS established — media can flow (even if the peer has no camera) */
  onConnected:        () => void
  onConnectionFailed: () => void
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null

  // ICE candidates queued before remote description is set
  private pendingCandidates: RTCIceCandidateInit[] = []
  private hasRemoteDescription = false

  async startLocalStreamWithDevices(
    videoEl: HTMLVideoElement,
    videoDeviceId?: string,
    audioDeviceId?: string,
  ): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoDeviceId ? { ...VIDEO_CONSTRAINTS, deviceId: { exact: videoDeviceId } } : VIDEO_CONSTRAINTS,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      })
    } catch {
      // Saved device unavailable — fall back to default
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS, audio: true })
    }
    videoEl.srcObject = this.localStream
    return this.localStream
  }

  private async switchTrack(kind: 'audio' | 'video', deviceId: string): Promise<void> {
    const s = await navigator.mediaDevices.getUserMedia(
      kind === 'video'
        ? { video: { ...VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } }, audio: false }
        : { audio: { deviceId: { exact: deviceId } }, video: false },
    )
    const newTrack = (kind === 'video' ? s.getVideoTracks() : s.getAudioTracks())[0]
    const oldTrack = (kind === 'video' ? this.localStream?.getVideoTracks() : this.localStream?.getAudioTracks())?.[0]
    if (oldTrack) newTrack.enabled = oldTrack.enabled
    if (this.pc) {
      const sender = this.pc.getSenders().find(snd => snd.track?.kind === kind)
      if (sender) await sender.replaceTrack(newTrack)
    }
    if (this.localStream && oldTrack) {
      this.localStream.removeTrack(oldTrack)
      oldTrack.stop()
    }
    this.localStream?.addTrack(newTrack)
  }

  async switchCamera(videoEl: HTMLVideoElement, deviceId: string): Promise<void> {
    await this.switchTrack('video', deviceId)
    videoEl.srcObject = this.localStream
  }

  async switchMicrophone(deviceId: string): Promise<void> {
    await this.switchTrack('audio', deviceId)
  }

  getCurrentVideoDeviceId(): string | undefined {
    return this.localStream?.getVideoTracks()[0]?.getSettings().deviceId
  }

  getCurrentAudioDeviceId(): string | undefined {
    return this.localStream?.getAudioTracks()[0]?.getSettings().deviceId
  }

  createPeerConnection(cb: PeerCallbacks): RTCPeerConnection {
    // Close any existing connection before creating a new one
    this.closePeerConnection()
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc = pc

    // Add local tracks. If camera/mic is missing, still negotiate a receive-only
    // m-line — otherwise the SDP has no media sections and nothing flows either way.
    const stream = this.localStream
    for (const kind of ['audio', 'video'] as const) {
      const track = stream?.getTracks().find(t => t.kind === kind)
      if (track && stream) pc.addTrack(track, stream)
      else pc.addTransceiver(kind, { direction: 'recvonly' })
    }

    // Remote stream
    pc.ontrack = (event) => {
      cb.onRemoteStream(event.streams[0] ?? new MediaStream([event.track]))
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) cb.onIceCandidate(event.candidate)
    }

    // Connected / failed → caller clears its timeout or rejoins the queue
    let settled = false
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc || settled) return
      if (pc.connectionState === 'connected') {
        cb.onConnected()
      } else if (pc.connectionState === 'failed') {
        settled = true
        cb.onConnectionFailed()
      }
    }
    // Older Safari: connectionState may lag — also watch ICE state
    pc.oniceconnectionstatechange = () => {
      if (this.pc !== pc || settled) return
      if (pc.iceConnectionState === 'failed') {
        settled = true
        cb.onConnectionFailed()
      }
    }

    return pc
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized')
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    return offer
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error('PeerConnection not initialized')
    if (this.pc.signalingState !== 'stable') {
      console.warn('[webrtc] Ignoring offer in state:', this.pc.signalingState)
      throw new Error('Wrong state for offer')
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer))
    await this._flushPendingCandidates()
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return
    if (this.pc.signalingState !== 'have-local-offer') {
      console.warn('[webrtc] Ignoring answer in state:', this.pc.signalingState)
      return
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer))
    await this._flushPendingCandidates()
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return
    if (!this.hasRemoteDescription) {
      // Queue until remote description is ready
      this.pendingCandidates.push(candidate)
      return
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch {
      // ignore stale candidates
    }
  }

  private async _flushPendingCandidates() {
    this.hasRemoteDescription = true
    const pc = this.pc
    const pending = this.pendingCandidates
    this.pendingCandidates = []
    for (const c of pending) {
      try {
        await pc?.addIceCandidate(new RTCIceCandidate(c))
      } catch {
        // ignore
      }
    }
  }

  toggleMute(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0]
    if (!audioTrack) return false
    audioTrack.enabled = !audioTrack.enabled
    return !audioTrack.enabled
  }

  toggleCamera(): boolean {
    const videoTrack = this.localStream?.getVideoTracks()[0]
    if (!videoTrack) return false
    videoTrack.enabled = !videoTrack.enabled
    return !videoTrack.enabled
  }

  closePeerConnection() {
    const pc = this.pc
    this.pc = null
    this.pendingCandidates = []
    this.hasRemoteDescription = false
    if (pc) {
      // Detach handlers so a closing connection can't fire callbacks into the next match
      pc.ontrack = null
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
      pc.close()
    }
  }

  destroy() {
    this.closePeerConnection()
    this.localStream?.getTracks().forEach(t => t.stop())
    this.localStream = null
  }

  get hasLocalStream() {
    return !!this.localStream
  }
}
