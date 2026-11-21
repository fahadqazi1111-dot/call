/* eslint-disable @typescript-eslint/no-require-imports -- plain-Node CJS production entry: require is the point */
/**
 * CALL production entry — Next.js + CALL realtime (socket.io) in one process.
 *
 * This file is copied over .next/standalone/server.js by the build script,
 * so when Hostinger detects "Next.js standalone" and runs `node server.js`,
 * it gets socket.io attached.
 *
 * GRACEFUL DEGRADATION: if socket-service-bundle.cjs cannot be found (some
 * hosts copy only standard Next.js standalone files and miss our extra
 * bundle), the server still starts — just without realtime. The /api/health
 * endpoint reports socketio:false so the admin knows to fix the deploy.
 * This prevents 503 crashes on hosts that strip non-standard files.
 */
process.env.NODE_ENV = 'production'
process.env.CALL_SKIP_MINI_SERVICE = '1'

var http = require('http')
var path = require('path')
var fs = require('fs')

// Try to find the working directory — Hostinger may run server.js from
// a different deploy dir than __dirname. Use __dirname (the standalone dir).
try { process.chdir(__dirname) } catch (e) {}

// ---- Load the socket.io bundle (graceful: don't crash if missing) ----
var createCallService = null
var bundleSearchPaths = [
  path.join(__dirname, 'socket-service-bundle.cjs'),
  path.join(process.cwd(), 'socket-service-bundle.cjs'),
  path.join(__dirname, 'deploy', 'socket-service-bundle.cjs'),
  path.join(process.cwd(), 'deploy', 'socket-service-bundle.cjs'),
]
var bundleFound = null
for (var i = 0; i < bundleSearchPaths.length; i++) {
  try {
    if (fs.existsSync(bundleSearchPaths[i])) {
      bundleFound = bundleSearchPaths[i]
      break
    }
  } catch (e) {}
}
if (bundleFound) {
  try {
    var bundle = require(bundleFound)
    createCallService = bundle.createCallService || bundle.default || bundle
    console.log('[CALL] socket.io bundle loaded from:', bundleFound)
  } catch (e) {
    console.warn('[CALL] socket.io bundle found but failed to load:', e.message)
  }
} else {
  console.warn('[CALL] socket-service-bundle.cjs not found — starting WITHOUT realtime.')
  console.warn('[CALL] Calls/live/rooms will not work until the bundle is deployed.')
  console.warn('[CALL] Searched paths:', bundleSearchPaths.join(', '))
}

var port = parseInt(process.env.PORT || '3000', 10)
var hostname = process.env.HOSTNAME || '0.0.0.0'

// The realtime service verifies roles/host state against the Next backend.
process.env.CALL_APP_URL = process.env.CALL_APP_URL || ('http://127.0.0.1:' + port)
process.env.CALL_RELAY_URL = process.env.CALL_RELAY_URL || ('http://127.0.0.1:' + port + '/internal/relay')

// ---- Start Next.js ----
var next = require('next')
var app = next({ dev: false, dir: __dirname })
var handle = app.getRequestHandler()

app.prepare().then(function () {
  var server = http.createServer(function (req, res) {
    handle(req, res)
  })

  // Attach socket.io IF the bundle was loaded
  if (createCallService) {
    try {
      createCallService({
        httpServer: server,
        socketPath: '/socket.io/',
        relayPort: null,
      })
      process.env.CALL_REALTIME_ATTACHED = '1'
      console.log('[CALL] socket.io attached to HTTP server')
    } catch (e) {
      console.error('[CALL] Failed to attach socket.io:', e.message)
    }
  }

  server.listen(port, hostname, function () {
    var rt = createCallService ? 'Next.js + realtime' : 'Next.js (no realtime)'
    console.log('[CALL] Ready on http://' + hostname + ':' + port + ' — ' + rt)
  })
}).catch(function (err) {
  console.error('[CALL] Failed to start:', err)
  process.exit(1)
})
