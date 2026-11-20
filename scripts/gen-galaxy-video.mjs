/**
 * One-off: generates the dedicated GALAXY gift clip (the DB row used to point
 * at 'superlion', so the 2nd most expensive gift played the Lion's animation
 * and roar — wrong assets). Same pipeline as gen-gift-videos.mjs but only for
 * the 'galaxy' kind. Run: bun run scripts/gen-galaxy-video.mjs
 */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import { execSync } from 'child_process'

const OUT = 'public/gifts/videos'
const TASKS_FILE = '/tmp/galaxy-video-tasks.json'

const CLIP = {
  kind: 'galaxy',
  prompt:
    'Breathtaking purple and blue spiral galaxy swirling in space, glowing cosmic nebula clouds expanding outward like an exploding portal, shooting stars and sparkling stardust bursting from the center, vibrant violet and magenta energy rings, cinematic TikTok live gift animation, isolated on pure solid black background, centered composition, no text, no watermark',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function submitWithRetry(zai, body, attempts = 6) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await zai.video.generations.create(body)
      if (!res?.id) throw new Error('no task id: ' + JSON.stringify(res))
      return res.id
    } catch (e) {
      const msg = String(e?.message || e)
      const isRate = msg.includes('429') || msg.toLowerCase().includes('too many')
      console.log(`submit attempt ${i} failed: ${msg}`)
      if (!isRate && i >= 2) throw e
      await sleep(isRate ? 45000 : 8000)
    }
  }
  throw new Error('gave up submitting galaxy clip')
}

async function download(url, out) {
  execSync(`curl -sL --max-time 180 -o "${out}" "${url}"`)
  const size = fs.existsSync(out) ? fs.statSync(out).size : 0
  if (size < 10000) throw new Error(`download too small (${size} bytes)`)
  return size
}

async function main() {
  const zai = await ZAI.create()
  fs.mkdirSync(OUT, { recursive: true })

  const out = `${OUT}/galaxy.mp4`
  if (fs.existsSync(out)) {
    console.log('galaxy.mp4 already exists — nothing to do')
    return
  }

  let taskId = null
  const tasks = fs.existsSync(TASKS_FILE) ? JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) : []
  const prev = tasks.find((t) => t.kind === CLIP.kind)
  if (prev) {
    taskId = prev.id
    console.log(`resuming poll for task ${taskId}`)
  } else {
    taskId = await submitWithRetry(zai, {
      prompt: CLIP.prompt,
      quality: 'speed',
      with_audio: true,
      watermark_enabled: false,
      duration: 5,
      size: '720x1280',
    })
    tasks.push({ kind: CLIP.kind, id: taskId })
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2))
    console.log(`submitted galaxy -> task ${taskId}`)
  }

  const deadline = Date.now() + 30 * 60 * 1000
  while (Date.now() < deadline) {
    await sleep(15000)
    try {
      const r = await zai.async.result.query(taskId)
      const status = r?.task_status
      const url = r?.video_result?.[0]?.url || r?.video_url || r?.url || r?.video
      if (status === 'SUCCESS' && url) {
        const size = await download(url, out)
        const manifestPath = `${OUT}/manifest.json`
        const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {}
        manifest.galaxy = { url, bytes: size, taskId, generatedAt: new Date().toISOString() }
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
        console.log(`DONE galaxy (${size} bytes) -> ${out}`)
        return
      }
      if (status === 'FAIL') {
        console.log('FAIL galaxy task — remove /tmp/galaxy-video-tasks.json and retry')
        process.exit(2)
      }
      console.log(`... galaxy ${status || 'unknown'}`)
    } catch (e) {
      console.log(`poll error: ${e.message}`)
    }
  }
  console.log('TIMEOUT waiting for galaxy clip — resume by re-running this script')
  process.exit(3)
}

main().catch((e) => {
  console.error('fatal', e)
  process.exit(1)
})
