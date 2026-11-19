/**
 * Generates TikTok-style AI videos for the CALL gift catalog.
 * Each clip is produced on a pure black background so the client can
 * composite it over the dark live/room video (mix-blend-mode: screen).
 * Audio is requested too (roars, engines...) as a bonus layer; the app
 * plays its own SFX on top for reliability (autoplay policies).
 * Run: bun run scripts/gen-gift-videos.mjs
 */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import { execSync } from 'child_process'

const OUT = 'public/gifts/videos'

const clips = [
  {
    kind: 'lion',
    prompt:
      'Photorealistic majestic male lion with huge golden mane standing on a dark stage, looks straight into camera and ROARS powerfully with wide open mouth, dramatic warm rim lighting, golden dust particles floating, cinematic TikTok live gift animation, epic slow push-in camera, isolated on pure solid black background, centered composition, no text, no watermark',
  },
  {
    kind: 'superlion',
    prompt:
      'Epic cosmic golden lion head roaring with a swirling purple galaxy mane, energy shockwave rings burst outward when it roars, stars exploding, cinematic TikTok live gift animation, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    kind: 'car',
    prompt:
      'Luxury golden sports race car speeding from left to right across the screen with motion blur, glowing headlights, sparks flying from wheels, dramatic engine scene, cinematic TikTok live gift animation, isolated on pure solid black background, side view, centered, no text, no watermark',
  },
  {
    kind: 'dragon',
    prompt:
      'Majestic golden Chinese fire dragon flying from left to right breathing glowing fire, scales shining, ember particles trailing behind, cinematic TikTok live gift animation, isolated on pure solid black background, centered composition, no text, no watermark',
  },
  {
    kind: 'rocket',
    prompt:
      'Sleek golden rocket launching upward with bright flame exhaust, billowing smoke clouds, rising fast with camera following, glowing highlights, cinematic TikTok live gift animation, isolated on pure solid black background, vertical composition, no text, no watermark',
  },
  {
    kind: 'fireworks',
    prompt:
      'Spectacular colorful golden fireworks bursting one after another in the night sky, glitter sparks raining down, bokeh lights, cinematic TikTok live gift animation, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    kind: 'crown',
    prompt:
      'Royal golden king crown floating in the air and slowly rotating, jeweled rubies sparkling, divine light rays and magical glitter swirling around it, cinematic TikTok live gift animation, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    kind: 'castle',
    prompt:
      'Magical fairytale castle glowing with warm window lights, purple magic swirls and fireworks appearing behind it, dreamy sparkle particles, cinematic TikTok live gift animation, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    kind: 'heart',
    prompt:
      'Giant glossy 3D ruby red heart pulsing and beating, radiating golden light rays, tiny glowing hearts floating upward around it, romantic sparkles, cinematic TikTok live gift animation, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    kind: 'rose',
    prompt:
      'Beautiful glowing red rose blooming in slow motion from a bud to full flower, golden ribbon wrapping around it, petals and sparkles drifting, cinematic TikTok live gift animation, isolated on pure solid black background, centered, no text, no watermark',
  },
]

const TASKS_FILE = '/tmp/gift-video-tasks.json'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function submitWithRetry(zai, body, label, attempts = 8) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await zai.video.generations.create(body)
      if (!res?.id) throw new Error('no task id: ' + JSON.stringify(res))
      return res.id
    } catch (e) {
      const msg = String(e?.message || e)
      const isRate = msg.includes('429') || msg.toLowerCase().includes('too many')
      console.log(`submit ${label} attempt ${i} failed: ${msg}`)
      if (!isRate && i >= 2) throw e
      await sleep(isRate ? 45000 : 8000)
    }
  }
  throw new Error(`gave up submitting ${label}`)
}

async function download(url, out) {
  execSync(`curl -sL --max-time 120 -o "${out}" "${url}"`)
  const size = fs.existsSync(out) ? fs.statSync(out).size : 0
  if (size < 10000) throw new Error(`download too small (${size} bytes)`)
  return size
}

async function main() {
  const zai = await ZAI.create()
  fs.mkdirSync(OUT, { recursive: true })

  const manifest = {}
  if (fs.existsSync(`${OUT}/manifest.json`)) {
    Object.assign(manifest, JSON.parse(fs.readFileSync(`${OUT}/manifest.json`, 'utf8')))
  }

  // persisted task registry so re-runs resume polling instead of duplicating
  const tasks = fs.existsSync(TASKS_FILE) ? JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) : []

  // 1) Submit missing tasks (throttled: the API rate-limits bursts)
  for (const c of clips) {
    if (manifest[c.kind]?.url || fs.existsSync(`${OUT}/${c.kind}.mp4`)) {
      console.log(`skip ${c.kind} (already done)`)
      continue
    }
    if (tasks.find((t) => t.kind === c.kind)) {
      console.log(`resume poll ${c.kind} (task ${tasks.find((t) => t.kind === c.kind).id})`)
      continue
    }
    let done = false
    for (const size of ['720x1280', undefined]) {
      try {
        const body = {
          prompt: c.prompt,
          quality: 'speed',
          with_audio: true,
          watermark_enabled: false,
          duration: 5,
        }
        if (size) body.size = size
        const id = await submitWithRetry(zai, body, c.kind)
        tasks.push({ kind: c.kind, id })
        fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2))
        console.log(`submitted ${c.kind} -> task ${id}`)
        done = true
        break
      } catch (e) {
        console.log(`submit failed ${c.kind} (size=${size}):`, e.message)
      }
    }
    if (!done) console.log(`GIVE UP submit ${c.kind}`)
    await sleep(8000)
  }

  // 2) Poll all tasks
  const pending = new Map(tasks.map((t) => [t.id, t.kind]))
  const deadline = Date.now() + 12 * 60 * 1000
  while (pending.size > 0 && Date.now() < deadline) {
    await sleep(15000)
    for (const [id, kind] of [...pending.entries()]) {
      try {
        const r = await zai.async.result.query(id)
        const status = r?.task_status
        const url = r?.video_result?.[0]?.url || r?.video_url || r?.url || r?.video
        if (status === 'SUCCESS' && url) {
          const out = `${OUT}/${kind}.mp4`
          const size = await download(url, out)
          manifest[kind] = { url, bytes: size, taskId: id, generatedAt: new Date().toISOString() }
          fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2))
          console.log(`DONE ${kind} (${size} bytes) -> ${out}`)
          pending.delete(id)
        } else if (status === 'FAIL') {
          console.log(`FAIL ${kind} task ${id}`)
          pending.delete(id)
        } else {
          console.log(`... ${kind} ${status || 'unknown'}`)
        }
      } catch (e) {
        console.log(`poll error ${kind}: ${e.message}`)
      }
    }
  }
  console.log('FINISHED. got:', Object.keys(manifest).join(', '))
}

main().catch((e) => {
  console.error('fatal', e)
  process.exit(1)
})
