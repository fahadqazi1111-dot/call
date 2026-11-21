/* eslint-disable @typescript-eslint/no-require-imports -- plain-Node CJS post-build step (runs without bun) */
/**
 * Post-build step (`npm run build`): assemble the runnable standalone folder.
 *
 * 1. copies deploy/production-server.js into .next/standalone/
 * 2. provides socket-service-bundle.cjs (the bundled CALL realtime service):
 *    - refreshes it from mini-services/call-service/service.ts when bun is
 *      available (guaranteed fresh),
 *    - otherwise falls back to the committed deploy/socket-service-bundle.cjs
 *      so plain-Node hosts never need bun.
 * 3. OVERWRITES the default standalone server.js with our production-server.js
 *    so hosts that auto-detect "Next.js standalone" and run `server.js` get
 *    socket.io attached (calls/live/rooms work).
 *
 * Pure Node — no bun required on the deploy machine.
 */
const { spawnSync, execFileSync } = require('node:child_process')
const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const path = require('node:path')

const root = process.cwd()
const standalone = path.join(root, '.next', 'standalone')
if (!existsSync(standalone)) {
  console.error('copy-production-runtime: .next/standalone missing — run `next build` first')
  process.exit(1)
}
mkdirSync(path.join(standalone, '.next'), { recursive: true })

// 1. production server entry
copyFileSync(path.join(root, 'deploy', 'production-server.js'), path.join(standalone, 'production-server.js'))
console.log('copy-production-runtime: production-server.js -> .next/standalone/')

// 1b. environment file — Next standalone does NOT copy .env itself; without
// this the runtime would only see env vars injected by the hosting panel.
const envSrc = path.join(root, '.env')
if (existsSync(envSrc)) {
  copyFileSync(envSrc, path.join(standalone, '.env'))
  console.log('copy-production-runtime: .env -> .next/standalone/')
}

// 2. realtime service bundle
const serviceSrc = path.join(root, 'mini-services', 'call-service', 'service.ts')
const committed = path.join(root, 'deploy', 'socket-service-bundle.cjs')
const target = path.join(standalone, 'socket-service-bundle.cjs')

const bunCheck = spawnSync('bun', ['--version'], { timeout: 8000 })
if (bunCheck.status === 0 && existsSync(serviceSrc)) {
  try {
    execFileSync(
      'bun',
      ['build', serviceSrc, '--target=node', '--format=cjs', '--outfile', target],
      { stdio: 'pipe' }
    )
    console.log('copy-production-runtime: socket bundle rebuilt from service.ts (bun available)')
  } catch (e) {
    copyFileSync(committed, target)
    console.log('copy-production-runtime: bun build failed, used committed socket bundle')
  }
} else {
  copyFileSync(committed, target)
  console.log('copy-production-runtime: used committed socket bundle (no bun)')
}

// 3. PATCH the default standalone server.js to attach socket.io.
// We inject a monkey-patch of http.createServer BEFORE startServer() is called.
// When startServer calls http.createServer internally, our patch intercepts it,
// attaches socket.io, and returns the server as normal.
const standaloneServerJs = path.join(standalone, 'server.js')
if (existsSync(standaloneServerJs)) {
  let serverJsContent = readFileSync(standaloneServerJs, 'utf8')

  // Check if already patched
  if (serverJsContent.indexOf('CALL_REALTIME_ATTACHED') === -1) {
    // Inject our socket.io attachment code right before startServer is called
    // Find "startServer({" and inject before it
    const patchCode = `
// === CALL: attach socket.io to the HTTP server ===
try {
  var _http = require('http');
  var _origCreate = _http.createServer;
  var _attached = false;
  _http.createServer = function() {
    var srv = _origCreate.apply(this, arguments);
    if (!_attached) {
      _attached = true;
      try {
        var _bundle = require('./socket-service-bundle.cjs');
        var _createCallService = _bundle.createCallService || _bundle.default || _bundle;
        _createCallService({ httpServer: srv, socketPath: '/socket.io/', relayPort: null });
        process.env.CALL_REALTIME_ATTACHED = '1';
        console.log('[CALL] socket.io attached to Next.js server');
      } catch(e) { console.error('[CALL] socket.io attach failed:', e.message); }
    }
    return srv;
  };
} catch(e) { console.error('[CALL] socket.io init failed:', e.message); }
// === END CALL socket.io ===

`
    // Insert the patch code right before "startServer({"
    const patched = serverJsContent.replace(
      /startServer\(\{/,
      patchCode + 'startServer({'
    )

    if (patched !== serverJsContent) {
      writeFileSync(standaloneServerJs, patched)
      console.log('copy-production-runtime: server.js patched with socket.io monkey-patch')
    } else {
      console.log('copy-production-runtime: WARNING - could not patch server.js')
    }
  } else {
    console.log('copy-production-runtime: server.js already patched')
  }
}

console.log('copy-production-runtime: done — start with `node .next/standalone/server.js`')
