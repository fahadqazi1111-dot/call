'use client'

/** Tiny WebAudio ringtones/UX sounds - free, no assets needed. */
class SoundKit {
  private ctx: AudioContext | null = null
  private timers: number[] = []
  private unlocked = false

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

  /**
   * Autoplay-policy unlock. Browsers suspend every AudioContext until a user
   * gesture happens — without this, gift/call sounds never play for viewers
   * who haven't interacted yet. Called on the first pointer/key event.
   */
  unlock() {
    if (this.unlocked) return
    const ctx = this.ac()
    if (!ctx) return
    this.unlocked = true
    void ctx.resume().catch(() => {})
    // tiny silent blip — some engines only commit the resume after a sound
    try {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      g.gain.value = 0.0001
      osc.connect(g).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.05)
    } catch {}
  }

  /** Install one-time global gesture listeners (idempotent). */
  installUnlock() {
    if (typeof window === 'undefined' || this.unlocked) return
    const once = () => {
      this.unlock()
      window.removeEventListener('pointerdown', once)
      window.removeEventListener('touchstart', once)
      window.removeEventListener('keydown', once)
    }
    window.addEventListener('pointerdown', once, { passive: true })
    window.addEventListener('touchstart', once, { passive: true })
    window.addEventListener('keydown', once)
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

  /* ---------- gift-specific sound effects (all synthesized, no assets) ---------- */

  private noiseBuffer(seconds: number): AudioBuffer | null {
    const ctx = this.ac()
    if (!ctx) return null
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  /** Filtered noise burst — the building block for whooshes/roars/crackles. */
  private noise(durMs: number, gain: number, filterFreq: number, delayMs = 0, filterType: BiquadFilterType = 'lowpass') {
    const ctx = this.ac()
    const buf = this.noiseBuffer(durMs / 1000 + 0.05)
    if (!ctx || !buf) return
    const t0 = ctx.currentTime + delayMs / 1000
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = filterType
    filter.frequency.value = filterFreq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + durMs / 4000)
    g.gain.setValueAtTime(gain, t0 + (durMs / 1000) * 0.6)
    g.gain.linearRampToValueAtTime(0, t0 + durMs / 1000)
    src.connect(filter).connect(g).connect(ctx.destination)
    src.start(t0)
    src.stop(t0 + durMs / 1000 + 0.05)
  }

  /** Frequency-swept tone (for roars/engines/whooshes). */
  private sweep(f1: number, f2: number, durMs: number, gain: number, delayMs = 0, type: OscillatorType = 'sawtooth') {
    const ctx = this.ac()
    if (!ctx) return
    const t0 = ctx.currentTime + delayMs / 1000
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f1, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + durMs / 1000)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + durMs / 5000)
    g.gain.setValueAtTime(gain, t0 + (durMs / 1000) * 0.55)
    g.gain.linearRampToValueAtTime(0, t0 + durMs / 1000)
    osc.connect(g).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + durMs / 1000 + 0.05)
  }

  /**
   * Per-gift cinematic sound, matched to the gift's animKind.
   * Rose/flower/heart → soft plucks, Crown → bells, Car → engine rev,
   * Rocket → launch whoosh, Fireworks → crackle, Dragon → growl,
   * Lion → powerful roar, Castle → epic chimes, Galaxy → cosmic roar.
   */
  giftEffect(animKind = 'generic') {
    switch (animKind) {
      case 'rose':
      case 'flower':
        // gentle harp-like pluck
        this.beep(740, 200, 0.05)
        this.beep(880, 240, 0.045, 120)
        this.beep(1109, 300, 0.04, 260)
        break
      case 'heart':
        // heartbeat double-thump
        this.sweep(140, 90, 160, 0.16, 0, 'sine')
        this.sweep(140, 90, 160, 0.13, 260, 'sine')
        this.beep(660, 140, 0.03, 520)
        break
      case 'crown':
        // royal bells + shimmer
        this.beep(1319, 300, 0.07)
        this.beep(1568, 320, 0.06, 180)
        this.beep(2093, 420, 0.05, 360)
        this.noise(500, 0.02, 6000, 360, 'highpass')
        break
      case 'car':
        // engine rev
        this.sweep(110, 320, 500, 0.12, 0, 'sawtooth')
        this.sweep(320, 90, 420, 0.1, 520, 'sawtooth')
        this.noise(700, 0.05, 900, 0)
        break
      case 'rocket':
        // launch: rising whoosh + crackle tail
        this.noise(900, 0.1, 500, 0)
        this.sweep(120, 900, 850, 0.07, 60, 'triangle')
        this.noise(500, 0.05, 3000, 700, 'highpass')
        break
      case 'fireworks': {
        // whistle up + crackle bursts
        this.sweep(500, 1800, 500, 0.05, 0, 'sine')
        for (let i = 0; i < 5; i++) {
          this.noise(90, 0.12 - i * 0.015, 2400 + i * 400, 520 + i * 130, 'highpass')
        }
        this.beep(1047, 220, 0.04, 540)
        break
      }
      case 'dragon':
        // low growl + wing flap noise
        this.sweep(110, 65, 800, 0.14, 0, 'sawtooth')
        this.sweep(82, 55, 700, 0.1, 260, 'square')
        this.noise(650, 0.07, 400, 0)
        this.noise(280, 0.05, 1200, 480, 'bandpass')
        break
      case 'lion':
        // HEAVY TikTok-style roar: sub-bass body + growling layers + breath
        this.sweep(190, 55, 1400, 0.2, 0, 'sawtooth')
        this.sweep(150, 48, 1250, 0.16, 90, 'square')
        this.sweep(90, 34, 1500, 0.18, 60, 'sine')
        this.noise(1300, 0.11, 620, 0)
        this.noise(600, 0.08, 1600, 500, 'bandpass')
        this.noise(350, 0.06, 2400, 980, 'bandpass')
        this.beep(55, 500, 0.16, 120)
        break
      case 'castle':
        // epic chime sequence
        this.beep(523, 260, 0.07)
        this.beep(659, 260, 0.065, 170)
        this.beep(784, 260, 0.065, 340)
        this.beep(1047, 480, 0.08, 510)
        this.beep(1319, 620, 0.07, 680)
        break
      case 'superlion':
      case 'galaxy':
        // cosmic roar + shimmering sweep — even heavier
        this.sweep(170, 42, 1500, 0.2, 0, 'sawtooth')
        this.sweep(95, 30, 1600, 0.2, 40, 'sine')
        this.sweep(400, 2600, 950, 0.05, 200, 'sine')
        this.noise(1300, 0.1, 900, 0)
        this.beep(1047, 300, 0.05, 700)
        this.beep(1319, 300, 0.05, 830)
        this.beep(1568, 420, 0.06, 960)
        break
      default:
        this.gift(1)
        break
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
