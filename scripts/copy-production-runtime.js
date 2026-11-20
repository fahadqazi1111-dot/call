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
 *
 * Pure Node — no bun required on the deploy machine.
 */
const { spawnSync, execFileSync } = require('node:child_process')
const { copyFileSync, existsSync, mkdirSync } = require('node:fs')
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

console.log('copy-production-runtime: done — start with `node .next/standalone/production-server.js`')
