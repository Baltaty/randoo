let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioCtx
}

function beep(frequency: number, duration: number, startDelay = 0, gain = 0.12) {
  try {
    const ac = getCtx()
    const osc = ac.createOscillator()
    const vol = ac.createGain()
    osc.connect(vol)
    vol.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.value = frequency
    const t = ac.currentTime + startDelay
    vol.gain.setValueAtTime(0, t)
    vol.gain.linearRampToValueAtTime(gain, t + 0.01)
    vol.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.start(t)
    osc.stop(t + duration + 0.05)
  } catch {
    // AudioContext blocked or unavailable
  }
}

/** Two ascending tones — match found */
export function playMatchSound() {
  beep(440, 0.15)
  beep(660, 0.25, 0.13)
}

/** Two descending tones — peer disconnected */
export function playDisconnectSound() {
  beep(440, 0.15)
  beep(330, 0.25, 0.13)
}
