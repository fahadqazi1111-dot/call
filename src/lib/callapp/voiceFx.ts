'use client'

/**
 * CALL Voice FX — real-time voice changer engine.
 *
 * Built on Web Audio: an AudioWorklet granular pitch shifter (loaded from a
 * Blob URL so no external file is needed) plus oscillator/waveshaper/filter
 * nodes for robot, alien, radio, echo, etc.
 *
 * Used by:
 *  - voice message recorder (record the processed stream)
 *  - 1:1 voice/video calls (replaceTrack with the processed audio)
 *  - voice rooms (mic goes through the chain before the peer connection)
 */

export type VoiceEffect =
  | 'original'
  | 'robot'
  | 'female'
  | 'male'
  | 'alien'
  | 'monster'
  | 'cartoon'
  | 'chipmunk'
  | 'deep'
  | 'echo'
  | 'radio'

export interface VoiceFxPreset {
  id: VoiceEffect
  name: string
  emoji: string
  desc: string
}

export const VOICE_FX: VoiceFxPreset[] = [
  { id: 'original', name: 'Original', emoji: '🎙️', desc: 'Your natural voice' },
  { id: 'robot', name: 'Robot', emoji: '🤖', desc: 'Metallic machine talk' },
  { id: 'female', name: 'Female', emoji: '👩', desc: 'Higher, softer tone' },
  { id: 'male', name: 'Male', emoji: '👨', desc: 'Lower, fuller tone' },
  { id: 'alien', name: 'Alien', emoji: '👽', desc: 'Out of this world' },
  { id: 'monster', name: 'Monster', emoji: '👹', desc: 'Deep and scary' },
  { id: 'cartoon', name: 'Cartoon', emoji: '🎩', desc: 'Wobbly and funny' },
  { id: 'chipmunk', name: 'Chipmunk', emoji: '🐿️', desc: 'Super high pitched' },
  { id: 'deep', name: 'Deep', emoji: '🗣️', desc: 'Dark movie-trailer voice' },
  { id: 'echo', name: 'Echo', emoji: '🔊', desc: 'Canyon reverb' },
  { id: 'radio', name: 'Radio', emoji: '📻', desc: 'Old broadcast filter' },
]

/* ---------------- pitch shifter worklet (granular, crossfaded) ---------------- */

const WORKLET_CODE = `
class PitchShifter extends AudioWorkletProcessor {
  constructor() {
    super()
    this.N = 4096
    this.buf = []
    this.w = 0
    this.r1 = 0
    this.r2 = this.N / 2
  }
  static get parameterDescriptors() {
    return [{ name: 'rate', defaultValue: 1, minValue: 0.5, maxValue: 2.2, automationRate: 'k-rate' }]
  }
  ensureBuf(ch) {
    while (this.buf.length <= ch) this.buf.push(new Float32Array(this.N))
    return this.buf[ch]
  }
  process(inputs, outputs, params) {
    const input = inputs[0]
    const output = outputs[0]
    if (!output || output.length === 0) return true
    const rate = params.rate[0] || 1
    const inCh = input && input.length ? input[0] : null
    for (let ch = 0; ch < output.length; ch++) {
      const b = this.ensureBuf(ch)
      const src = inCh && input[Math.min(ch, input.length - 1)] ? input[Math.min(ch, input.length - 1)] : null
      for (let i = 0; i < output[ch].length; i++) {
        // write incoming sample
        b[this.w] = src ? src[i] : 0
        // advance read heads
        this.r1 += rate
        this.r2 += rate
        if (this.r1 >= this.N) this.r1 -= this.N
        if (this.r2 >= this.N) this.r2 -= this.N
        // crossfade windows based on distance from write head
        const d1 = ((this.w - this.r1) + this.N) % this.N
        const d2 = ((this.w - this.r2) + this.N) % this.N
        const w1 = Math.sin((d1 / this.N) * Math.PI)
        const w2 = Math.sin((d2 / this.N) * Math.PI)
        const i1 = Math.floor(this.r1) % this.N
        const i2 = Math.floor(this.r2) % this.N
        output[ch][i] = b[i1] * w1 + b[i2] * w2
        this.w = (this.w + 1) % this.N
      }
    }
    return true
  }
}
registerProcessor('pitch-shifter', PitchShifter)
`

let moduleUrl: string | null = null
async function ensureWorklet(ctx: AudioContext) {
  if (!moduleUrl) {
    moduleUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }))
  }
  try {
    await ctx.audioWorklet.addModule(moduleUrl)
  } catch {
    // may already be added on this context
  }
}

/* ---------------- effect chain definition ---------------- */

interface ChainConfig {
  pitchSemitones: number
  ringModHz?: number // oscillator multiplier (robot/alien)
  vibratoHz?: number
  vibratoDepth?: number // in cents→rate modulation approximated on rate param
  distortion?: number // 0..1
  bandpass?: [number, number] // low/high freq (radio)
  echoSec?: number
  echoFeedback?: number
}

function chainFor(effect: VoiceEffect): ChainConfig {
  switch (effect) {
    case 'robot':
      return { pitchSemitones: -2, ringModHz: 55, distortion: 0.25 }
    case 'female':
      return { pitchSemitones: 4 }
    case 'male':
      return { pitchSemitones: -3 }
    case 'alien':
      return { pitchSemitones: 3, ringModHz: 120, vibratoHz: 6, vibratoDepth: 0.03 }
    case 'monster':
      return { pitchSemitones: -5, distortion: 0.5 }
    case 'cartoon':
      return { pitchSemitones: 2, vibratoHz: 8, vibratoDepth: 0.06 }
    case 'chipmunk':
      return { pitchSemitones: 7 }
    case 'deep':
      return { pitchSemitones: -7 }
    case 'echo':
      return { pitchSemitones: 0, echoSec: 0.32, echoFeedback: 0.45 }
    case 'radio':
      return { pitchSemitones: -1, bandpass: [700, 2800], distortion: 0.3 }
    default:
      return { pitchSemitones: 0 }
  }
}

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(n)
  const k = amount * 60
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x))
  }
  return curve
}

export interface FxHandle {
  stream: MediaStream
  ctx: AudioContext
  setEffect(effect: VoiceEffect): Promise<void>
  stop(): void
}

/**
 * Route a mic stream through the effect chain. Returns a NEW stream carrying
 * the processed audio; stop() closes the context and restores silence safety.
 * The effect can be switched live via setEffect().
 */
export async function createFxStream(
  source: MediaStream,
  initial: VoiceEffect = 'original'
): Promise<FxHandle> {
  const Ctx: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx({ latencyHint: 'interactive' })
  await ensureWorklet(ctx)
  await ctx.resume()

  const src = ctx.createMediaStreamSource(source)
  const dest = ctx.createMediaStreamDestination()
  const worklet = new AudioWorkletNode(ctx, 'pitch-shifter', { numberOfOutputs: 1, outputChannelCount: [1] })
  const dryGain = ctx.createGain()
  const wetGain = ctx.createGain()
  wetGain.gain.value = 1

  // ring-mod oscillator
  const ringGain = ctx.createGain()
  ringGain.gain.value = 0
  const osc = ctx.createOscillator()
  osc.frequency.value = 55
  osc.start()
  // vibrato LFO modulating the pitch rate
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 6
  lfoGain.gain.value = 0
  lfo.connect(lfoGain).connect(worklet.parameters.get('rate') as AudioParam)
  lfo.start()
  // echo
  const delay = ctx.createDelay(1.0)
  const fb = ctx.createGain()
  delay.delayTime.value = 0.32
  fb.gain.value = 0
  // bandpass pair (radio)
  const bpLow = ctx.createBiquadFilter()
  bpLow.type = 'highpass'
  bpLow.frequency.value = 20
  const bpHigh = ctx.createBiquadFilter()
  bpHigh.type = 'lowpass'
  bpHigh.frequency.value = 20000
  // waveshaper
  const shaper = ctx.createWaveShaper()
  shaper.curve = distortionCurve(0)

  let current: VoiceEffect = 'original'

  async function setEffect(effect: VoiceEffect) {
    current = effect
    const cfg = chainFor(effect)
    // pitch
    const rate = Math.pow(2, cfg.pitchSemitones / 12)
    worklet.parameters.get('rate')!.value = rate
    // dry/wet
    dryGain.gain.value = effect === 'original' ? 1 : 0
    wetGain.gain.value = effect === 'original' ? 0 : 1
    // ring mod
    osc.frequency.value = cfg.ringModHz ?? 55
    ringGain.gain.value = cfg.ringModHz ? 0.9 : 0
    // vibrato
    lfo.frequency.value = cfg.vibratoHz ?? 6
    lfoGain.gain.value = cfg.vibratoDepth ?? 0
    // distortion
    shaper.curve = distortionCurve(cfg.distortion ?? 0)
    // bandpass
    bpLow.frequency.value = cfg.bandpass ? cfg.bandpass[0] : 20
    bpHigh.frequency.value = cfg.bandpass ? cfg.bandpass[1] : 20000
    // echo
    delay.delayTime.value = cfg.echoSec ?? 0.32
    fb.gain.value = cfg.echoFeedback ?? 0
  }

  // graph: src → shaper → bpLow → bpHigh → worklet(ring+vibrato) → [dry|wet] → (+echo) → dest
  src.connect(shaper)
  shaper.connect(bpLow)
  bpLow.connect(bpHigh)
  bpHigh.connect(worklet)
  // ring modulation: multiply worklet output by oscillator via gain
  worklet.connect(ringGain)
  osc.connect(ringGain.gain)
  ringGain.connect(delay)
  delay.connect(fb)
  fb.connect(delay)
  ringGain.connect(wetGain)
  bpHigh.connect(dryGain)
  wetGain.connect(dest)
  dryGain.connect(dest)

  await setEffect(initial)

  return {
    stream: dest.stream,
    ctx,
    setEffect,
    stop() {
      try {
        src.disconnect()
        dryGain.disconnect()
        wetGain.disconnect()
        ringGain.disconnect()
        delay.disconnect()
        fb.disconnect()
        osc.stop()
        lfo.stop()
        void ctx.close()
      } catch {}
    },
  }
}

/** Preview how a recorded blob sounds with an effect (plays through speakers). */
export async function previewFxOnBlob(blob: Blob, effect: VoiceEffect): Promise<() => void> {
  const Ctx: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  await ensureWorklet(ctx)
  const handle = await createFxStreamFromBlob(ctx, blob, effect)
  const audio = new Audio()
  audio.srcObject = handle.stream
  await audio.play().catch(() => {})
  return () => {
    try {
      audio.pause()
      audio.srcObject = null
      handle.stop()
      void ctx.close()
    } catch {}
  }
}

async function createFxStreamFromBlob(ctx: AudioContext, blob: Blob, effect: VoiceEffect) {
  await ensureWorklet(ctx)
  const el = document.createElement('audio')
  el.src = URL.createObjectURL(blob)
  el.loop = true
  const src = ctx.createMediaElementSource(el)
  const dest = ctx.createMediaStreamDestination()
  const cfg = chainFor(effect)
  const worklet = new AudioWorkletNode(ctx, 'pitch-shifter', { numberOfOutputs: 1, outputChannelCount: [1] })
  worklet.parameters.get('rate')!.value = Math.pow(2, cfg.pitchSemitones / 12)
  src.connect(worklet)
  worklet.connect(dest)
  await el.play().catch(() => {})
  return { stream: dest.stream, stop: () => el.pause() }
}
