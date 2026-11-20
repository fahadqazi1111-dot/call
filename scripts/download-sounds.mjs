/**
 * Downloads real, free-to-use sound effects + call ringtones for CALL
 * from mixkit.co (free license, direct CDN).
 * Run: bun run scripts/download-sounds.mjs
 */
import fs from 'fs'
import { execSync } from 'child_process'

const SFX_OUT = 'public/sounds/gifts'
const RING_OUT = 'public/sounds/ringtones'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

// Hand-picked from mixkit category pages (id -> title verified 2025-11)
const SFX = [
  { kind: 'lion', id: '6', title: 'Wild lion animal roar' },
  { kind: 'dragon', id: '309', title: 'Angry dragon growl' },
  { kind: 'car', id: '1538', title: 'Fast car drive by' },
  { kind: 'rocket', id: '1714', title: 'Fast rocket whoosh' },
  { kind: 'fireworks', id: '1689', title: 'Multiple fireworks explosions' },
  { kind: 'crown', id: '3062', title: 'Magic wand sparkle' },
  { kind: 'castle', id: '2583', title: 'Magical light transition' },
  { kind: 'heart', id: '493', title: 'Fast Heartbeat' },
  { kind: 'rose', id: '1496', title: 'Magical swish' },
  { kind: 'generic', id: '871', title: 'Fairy magic sparkle' },
]

// Ringtones scraped live from mixkit ringtone/phone pages
const RING_PAGES = ['ringtone', 'phone']
const RING_LIMIT = 6

function curl(url, out) {
  execSync(`curl -sL --max-time 60 -H "User-Agent: ${UA}" -o "${out}" "${url}"`)
  return fs.existsSync(out) ? fs.statSync(out).size : 0
}

function scrapeMixkit(pages) {
  const found = []
  for (const page of pages) {
    try {
      const html = execSync(
        `curl -sL --max-time 40 -H "User-Agent: ${UA}" "https://mixkit.co/free-sound-effects/${page}/"`,
        { encoding: 'utf8' },
      )
      const ids = []
      const idRe = /active_storage\/sfx\/(\d+)\/\1-preview\.mp3/g
      let m
      while ((m = idRe.exec(html)) && !ids.includes(m[1])) ids.push(m[1])
      const titles = []
      const titleRe = /item-grid-card__title">\s*([^<]+?)\s*</g
      while ((m = titleRe.exec(html))) titles.push(m[1])
      ids.forEach((id, i) => {
        const title = titles[i] || `${page} ${id}`
        if (!found.find((f) => f.id === id)) found.push({ id, title, page })
      })
    } catch (e) {
      console.log(`mixkit scrape fail ${page}: ${e.message}`)
    }
  }
  return found
}

async function main() {
  fs.mkdirSync(SFX_OUT, { recursive: true })
  fs.mkdirSync(RING_OUT, { recursive: true })

  // ---------- gift SFX ----------
  const sfxManifest = {}
  for (const s of SFX) {
    const out = `${SFX_OUT}/${s.kind}.mp3`
    if (fs.existsSync(out) && fs.statSync(out).size > 5000) {
      sfxManifest[s.kind] = { file: `/sounds/gifts/${s.kind}.mp3`, source: `mixkit.co sfx ${s.id}`, title: s.title, bytes: fs.statSync(out).size }
      console.log(`skip sfx ${s.kind} (exists)`)
      continue
    }
    const url = `https://assets.mixkit.co/active_storage/sfx/${s.id}/${s.id}-preview.mp3`
    const size = curl(url, out)
    if (size > 5000) {
      sfxManifest[s.kind] = { file: `/sounds/gifts/${s.kind}.mp3`, source: `mixkit.co sfx ${s.id}`, title: s.title, bytes: size }
      console.log(`sfx ${s.kind}: ${s.title} (${size}b)`)
    } else {
      console.log(`!! failed sfx ${s.kind}`)
    }
  }
  fs.writeFileSync(`${SFX_OUT}/manifest.json`, JSON.stringify(sfxManifest, null, 2))

  // ---------- ringtones ----------
  const kits = scrapeMixkit(RING_PAGES)
  const wanted = kits.filter((k) => /ring|bell|marimba|tone|telephone|chime/i.test(k.title))
  const ringManifest = {}
  let n = 0
  for (const k of wanted) {
    if (n >= RING_LIMIT) break
    const slug = k.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const out = `${RING_OUT}/${slug}.mp3`
    if (fs.existsSync(out) && fs.statSync(out).size > 5000) {
      ringManifest[slug] = { file: `/sounds/ringtones/${slug}.mp3`, title: k.title, source: `mixkit.co ${k.page}`, bytes: fs.statSync(out).size }
      n++
      continue
    }
    const size = curl(`https://assets.mixkit.co/active_storage/sfx/${k.id}/${k.id}-preview.mp3`, out)
    if (size > 5000) {
      ringManifest[slug] = { file: `/sounds/ringtones/${slug}.mp3`, title: k.title, source: `mixkit.co ${k.page}`, bytes: size }
      console.log(`ringtone: ${k.title} (${size}b)`)
      n++
    }
  }
  fs.writeFileSync(`${RING_OUT}/manifest.json`, JSON.stringify(ringManifest, null, 2))
  console.log('FINISHED sfx=' + Object.keys(sfxManifest).length + ' ringtones=' + Object.keys(ringManifest).length)
}

main().catch((e) => {
  console.error('fatal', e)
  process.exit(1)
})
