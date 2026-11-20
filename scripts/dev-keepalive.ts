/**
 * Sandbox keepalive — guards the dev server against the sandbox process
 * reaper (which kills the memory-heavy next-server between shell sessions).
 *
 * Probes port 3000 every 15s; when the server is down it respawns
 * `bun run dev` fully detached. Tiny footprint so it survives reaping.
 *
 * Run:  setsid nohup bun run scripts/dev-keepalive.ts > /dev/null 2>&1 < /dev/null & disown
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import { appendFileSync, statSync, unlinkSync } from 'node:fs'

const LOG = 'keepalive.log'

function log(line: string) {
  try {
    if (statSync(LOG).size > 1_000_000) unlinkSync(LOG) // keep it tiny
  } catch {}
  try {
    appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {}
}

function probe(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1')
    const done = (ok: boolean) => {
      s.destroy()
      resolve(ok)
    }
    s.once('connect', () => done(true))
    s.once('error', () => done(false))
    setTimeout(() => done(false), 2000).unref()
  })
}

let restarting = false

async function tick() {
  if (restarting) return
  const up = await probe(3000)
  if (up) return
  restarting = true
  log('dev server down — restarting')
  try {
    const child = spawn('bun', ['run', 'dev'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    })
    child.on('error', (e) => log('spawn failed: ' + e.message))
    child.unref()
  } catch (e) {
    log('spawn threw: ' + (e as Error).message)
  }
  setTimeout(async () => {
    log('recheck: ' + ((await probe(3000)) ? 'UP' : 'still down'))
    restarting = false
  }, 20000)
}

log('keepalive started')
setInterval(() => void tick(), 15000)
void tick()
