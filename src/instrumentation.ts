/**
 * Next.js Instrumentation — attaches socket.io to the Next.js server.
 *
 * This runs ONCE when `next start` boots the server. We monkey-patch
 * http.createServer to intercept the HTTP server Next.js creates, then
 * attach our socket.io service to it.
 *
 * This is the ONLY way to add socket.io to `next start` without a custom
 * server.js — which is critical for hosts like Hostinger that force `next start`.
 */

export async function register() {
  // Only on the server (nodejs runtime), not during build or edge runtime
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // Avoid double-attach in dev
  const g = globalThis as unknown as { __callSocketAttached?: boolean }
  if (g.__callSocketAttached) return
  g.__callSocketAttached = true

  try {
    // Use require directly — instrumentation runs in Node, not Edge
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs')

    // Find the socket-service-bundle.cjs
    const candidates = [
      path.join(process.cwd(), 'deploy', 'socket-service-bundle.cjs'),
      path.join(process.cwd(), 'socket-service-bundle.cjs'),
    ]
    let bundlePath: string | null = null
    for (const p of candidates) {
      try { if (fs.existsSync(p)) { bundlePath = p; break } } catch {}
    }
    if (!bundlePath) {
      console.warn('[call] socket-service-bundle.cjs not found — realtime disabled')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCallService } = require(bundlePath)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const http = require('node:http')

    // Monkey-patch http.createServer to intercept the server Next.js creates.
    // When Next.js creates its HTTP server, we attach socket.io to it.
    const originalCreate = http.createServer
    let attached = false
    http.createServer = function (...args: unknown[]) {
      const server = originalCreate.apply(this, args as never)
      if (!attached) {
        attached = true
        try {
          createCallService({
            httpServer: server,
            socketPath: '/socket.io/',
            relayPort: null,
          })
          process.env.CALL_REALTIME_ATTACHED = '1'
          console.log('[call] socket.io attached to Next.js server')
        } catch (e) {
          console.error('[call] failed to attach socket.io:', e)
        }
      }
      return server
    }
  } catch (e) {
    console.error('[call] instrumentation failed:', e)
  }
}
