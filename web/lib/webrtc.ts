const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null

  // ICE candidates queued before remote description is set
  private pendingCandidates: RTCIceCandidateInit[] = []
  private hasRemoteDescription = false

  async startLocalStream(videoEl: HTMLVideoElement): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    })
    videoEl.srcObject = this.localStream
    return this.localStream
  }

  async startLocalStreamWithDevices(
    videoEl: HTMLVideoElement,
    videoDeviceId?: string,
    audioDeviceId?: string,
  ): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoDeviceId
          ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      })
    } catch {
      // Saved device unavailable — fall back to default
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
    }
    videoEl.srcObject = this.localStream
    return this.localStream
  }

  async switchCamera(videoEl: HTMLVideoElement, deviceId: string): Promise<void> {
    const s = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    const newTrack = s.getVideoTracks()[0]
    const oldTrack = this.localStream?.getVideoTracks()[0]
    if (oldTrack) newTrack.enabled = oldTrack.enabled
    if (this.pc) {
      const sender = this.pc.getSenders().find(s => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)
    }
    if (this.localStream && oldTrack) {
      this.localStream.removeTrack(oldTrack)
      oldTrack.stop()
    }
    this.localStream?.addTrack(newTrack)
    videoEl.srcObject = this.localStream
  }

  async switchMicrophone(deviceId: string): Promise<void> {
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false,
    })
    const newTrack = s.getAudioTracks()[0]
    const oldTrack = this.localStream?.getAudioTracks()[0]
    if (oldTrack) newTrack.enabled = oldTrack.enabled
    if (this.pc) {
      const sender = this.pc.getSenders().find(s => s.track?.kind === 'audio')
      if (sender) await sender.replaceTrack(newTrack)
    }
    if (this.localStream && oldTrack) {
      this.localStream.removeTrack(oldTrack)
      oldTrack.stop()
    }
    this.localStream?.addTrack(newTrack)
  }

  getCurrentVideoDeviceId(): string | undefined {
    return this.localStream?.getVideoTracks()[0]?.getSettings().deviceId
  }

  getCurrentAudioDeviceId(): string | undefined {
    return this.localStream?.getAudioTracks()[0]?.getSettings().deviceId
  }

  createPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionFailed: () => void,
  ): RTCPeerConnection {
    // Close any existing connection before creating a new one
    if (this.pc) {
      this.pc.oniceconnectionstatechange = null
      this.pc.ontrack = null
      this.pc.onicecandidate = null
      this.pc.close()
    }
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pendingCandidates = []
    this.hasRemoteDescription = false

    // Add local tracks
    this.localStream?.getTracks().forEach(track => {
      this.pc!.addTrack(track, this.localStream!)
    })

    // Remote stream
    this.pc.ontrack = (event) => {
      onRemoteStream(event.streams[0])
    }

    // ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) onIceCandidate(event.candidate)
    }

    // Detect failed/disconnected ICE → caller will rejoin queue
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState
      if (state === 'failed' || state === 'closed') {
        onConnectionFailed()
      }
    }

    return this.pc
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
    for (const c of this.pendingCandidates) {
      try {
        await this.pc!.addIceCandidate(new RTCIceCandidate(c))
      } catch {
        // ignore
      }
    }
    this.pendingCandidates = []
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
    this.pc?.close()
    this.pc = null
    this.pendingCandidates = []
    this.hasRemoteDescription = false
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
