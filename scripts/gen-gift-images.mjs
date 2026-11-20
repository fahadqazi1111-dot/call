/**
 * Generates TikTok-style gift artwork for the CALL gift catalog.
 * Every prompt puts the subject on a PURE BLACK background — the client
 * renders these with mix-blend-mode: screen so the black disappears over
 * the dark room/live video and only the glowing subject shows.
 * Run: bun run scripts/gen-gift-images.mjs
 */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'

const OUT = 'public/gifts'

const gifts = [
  {
    file: 'lion.png',
    prompt:
      'Majestic golden lion head roaring, facing forward, glowing warm amber rim light, TikTok live gift style 3D render, ultra detailed mane, floating golden sparkles around, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    file: 'dragon.png',
    prompt:
      'Chinese golden fire dragon flying left to right, glowing scales, fire trail behind, TikTok live gift 3D render style, dramatic ember particles, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    file: 'rocket.png',
    prompt:
      'Sleek golden rocket blasting upward with bright flame exhaust and smoke clouds, TikTok live gift 3D render style, glowing highlights, isolated on pure solid black background, centered vertical composition, no text, no watermark',
  },
  {
    file: 'crown.png',
    prompt:
      'Royal golden king crown floating, jeweled rubies, glowing divine light rays behind it, sparkles, TikTok live gift 3D render style, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    file: 'castle.png',
    prompt:
      'Magical fairytale castle glowing with warm lights and purple magic swirls, fireworks behind, TikTok live gift 3D render style, dreamy, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    file: 'car.png',
    prompt:
      'Golden luxury sports race car speeding right, motion blur speed lines, glowing headlights, TikTok live gift 3D render style, isolated on pure solid black background, side view, centered, no text, no watermark',
  },
  {
    file: 'fireworks.png',
    prompt:
      'Spectacular golden fireworks bouquet bursting with colorful sparks and glitter particles, TikTok live gift style, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    file: 'rose.png',
    prompt:
      'Beautiful glowing red roses bouquet with golden ribbon and falling rose petals, romantic sparkles, TikTok live gift 3D render style, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    file: 'heart.png',
    prompt:
      'Giant glossy 3D ruby red heart glowing, radiating golden light rays and tiny floating hearts around, TikTok live gift style, isolated on pure solid black background, centered, no text, no watermark',
  },
  {
    file: 'galaxy.png',
    prompt:
      'Cosmic purple blue galaxy swirl with golden stars nebula explosion, epic glowing energy, TikTok live gift style, isolated on pure solid black background, centered, no text, no watermark',
  },
]

async function main() {
  const zai = await ZAI.create()
  fs.mkdirSync(OUT, { recursive: true })
  for (const g of gifts) {
    const out = `${OUT}/${g.file}`
    if (fs.existsSync(out)) {
      console.log(`skip ${g.file} (exists)`)
      continue
    }
    let done = false
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        const res = await zai.images.generations.create({ prompt: g.prompt, size: '1024x1024' })
        const b64 = res?.data?.[0]?.base64
        if (!b64) throw new Error('empty base64')
        fs.writeFileSync(out, Buffer.from(b64, 'base64'))
        console.log(`ok ${g.file}`)
        done = true
      } catch (e) {
        console.error(`fail ${g.file} attempt ${attempt}: ${e.message}`)
        await new Promise((r) => setTimeout(r, 1200))
      }
    }
  }
  console.log('gift image generation finished')
}

main()
