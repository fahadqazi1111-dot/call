import { createCallService } from './service'

/**
 * CALL signaling service — dev/process entry.
 *
 * Self-hosts on port 3003 (socket.io path '/', routed by the gateway's
 * XTransformPort query param) + internal relay on 127.0.0.1:3004.
 *
 * Production instead bundles ./service.ts and runs it INSIDE the Next.js
 * server on one port (deploy/production-server.js → socket.io '/socket.io/').
 */
createCallService()
