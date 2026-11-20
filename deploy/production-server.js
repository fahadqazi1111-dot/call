/* eslint-disable @typescript-eslint/no-require-imports -- plain-Node CJS production entry: require is the point */
/**
 * CALL production entry — Next.js (standalone build) + CALL realtime service
 * (socket.io) hosted in ONE Node process on ONE port.
 *
 * Works on any Node-only host (shared "supports Next.js" panels, VPS, PaaS):
 *   PORT=3000 node .next/standalone/production-server.js
 *
 * What runs where (production):
 *   - Next.js pages/API          -> same http server (every path except /socket.io/)
 *   - socket.io realtime layer   -> /socket.io/ on the SAME server/port
 *   - internal relay (3004)      -> 127.0.0.1 only, never exposed
 *
 * The realtime logic is the exact same code that runs in dev
 * (mini-services/call-service/service.ts), bundled to socket-service-bundle.cjs
 * by scripts/copy-production-runtime.js during `npm run build`.
 */
process.env.NODE_ENV = 'production'
process.env.CALL_SKIP_MINI_SERVICE = '1' // integrated mode: no watchdog needed
process.chdir(__dirname)

const http = require('http')
const next = require('next')
const { createCallService } = require('./socket-service-bundle.cjs')

const port = parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOSTNAME || '0.0.0.0'

// The realtime service verifies roles/host state against the Next backend —
// default it to THIS process's own loopback URL so it works on any assigned port.
process.env.CALL_APP_URL = process.env.CALL_APP_URL || `http://127.0.0.1:${port}`
// Internal relay used by Next API routes to push realtime events (gifts,
// broadcasts, ghost-live cleanup). The relay binds 127.0.0.1:3004.
process.env.CALL_RELAY_URL =
  process.env.CALL_RELAY_URL || `http://127.0.0.1:${process.env.CALL_RELAY_PORT || 3004}/internal/relay`

const app = next({ dev: false, dir: __dirname })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => handle(req, res))

    // Attach the CALL realtime service to the same http server:
    //  - socket.io at /socket.io/ (client: NEXT_PUBLIC_SOCKET_URL="/")
    //  - internal HTTP relay on 127.0.0.1:3004 (loopback only)
    createCallService({
      httpServer: server,
      socketPath: '/socket.io/',
      relayPort: process.env.CALL_RELAY_PORT ? parseInt(process.env.CALL_RELAY_PORT, 10) : 3004,
    })

    server.listen(port, hostname, () => {
      console.log(`> CALL ready on http://${hostname}:${port} — Next.js + realtime in one process`)
    })
  })
  .catch((err) => {
    console.error('Failed to start CALL:', err)
    process.exit(1)
  })
