'use client'

/** Tiny WebAudio ringtones/UX sounds - free, no assets needed. */
class SoundKit {
  private ctx: AudioContext | null = null
  private timers: number[] = []

  private ac(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private beep(freq: number, durMs: number, gain = 0.06, delayMs = 0) {
    const ctx = this.ac()
    if (!ctx) return
    const t0 = ctx.currentTime + delayMs / 1000
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02)
    g.gain.setValueAtTime(gain, t0 + durMs / 1000 - 0.03)
    g.gain.linearRampToValueAtTime(0, t0 + durMs / 1000)
    osc.connect(g).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + durMs / 1000 + 0.05)
  }

  /** Outgoing call ringback tone, loops until stopRing. */
  startRingback() {
    this.stopRing()
    const loop = () => {
      this.beep(425, 900, 0.05)
    }
    loop()
    this.timers.push(window.setInterval(loop, 3000))
  }

  /** Incoming call ringtone (double chirp), loops until stopRing. */
  startRingtone() {
    this.stopRing()
    const loop = () => {
      this.beep(880, 380, 0.09)
      this.beep(700, 380, 0.09, 460)
    }
    loop()
    this.timers.push(window.setInterval(loop, 2200))
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.([400, 300, 400, 300, 800])
      } catch {}
    }
  }

  stopRing() {
    this.timers.forEach((t) => window.clearInterval(t))
    this.timers = []
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(0)
      } catch {}
    }
  }

  /** Subtle pop for sent/received messages. */
  pop(send = true) {
    this.beep(send ? 660 : 520, 90, 0.03)
  }

  callEnded() {
    this.beep(340, 250, 0.06)
    this.beep(260, 320, 0.06, 240)
  }

  /** Gift whoosh+chime, sized by gift tier. */
  gift(tier = 0) {
    const base = 500 + tier * 60
    this.beep(base, 120, 0.05)
    this.beep(base * 1.25, 140, 0.05, 110)
    this.beep(base * 1.5, 180, 0.06, 230)
    if (tier >= 2) {
      this.beep(base * 2, 260, 0.07, 420)
      this.beep(base * 2.5, 320, 0.08, 620)
    }
  }

  /** Rising countdown tick for battle starts. */
  countdownTick(n = 0) {
    this.beep(440 + n * 110, 120, 0.07)
  }

  /** Winner fanfare. */
  fanfare() {
    this.beep(523, 160, 0.07)
    this.beep(659, 160, 0.07, 150)
    this.beep(784, 160, 0.07, 300)
    this.beep(1047, 420, 0.09, 450)
  }
}

export const soundKit = new SoundKit()
