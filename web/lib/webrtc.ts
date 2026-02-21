const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null

  async startLocalStream(videoEl: HTMLVideoElement): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    })
    videoEl.srcObject = this.localStream
    return this.localStream
  }

  createPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  ): RTCPeerConnection {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

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

    // Connection state
    if (onConnectionStateChange) {
      this.pc.onconnectionstatechange = () => {
        onConnectionStateChange(this.pc!.connectionState)
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
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) throw new Error('PeerConnection not initialized')
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch {
      // ignore stale candidates
    }
  }

  toggleMute(): boolean {
    const audioTrack = this.localStream?.getAudioTracks()[0]
    if (!audioTrack) return false
    audioTrack.enabled = !audioTrack.enabled
    return !audioTrack.enabled // returns isMuted
  }

  toggleCamera(): boolean {
    const videoTrack = this.localStream?.getVideoTracks()[0]
    if (!videoTrack) return false
    videoTrack.enabled = !videoTrack.enabled
    return !videoTrack.enabled // returns isCameraOff
  }

  closePeerConnection() {
    this.pc?.close()
    this.pc = null
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
