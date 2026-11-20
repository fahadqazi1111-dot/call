import { createCallService } from './service'

/**
 * CALL signaling service — dev/process entry.
 *
 * Self-hosts on port 3003 (socket.io path '/', routed by the gateway's
 * XTransformPort query param). The internal relay is mounted on THIS SAME
 * server at /internal/* — Next.js API routes POST to
 * http://127.0.0.1:3003/internal/relay (set via CALL_RELAY_URL in .env).
 *
 * Pass `relayPort: 3004` to ALSO listen on a separate loopback port 3004
 * (useful for direct curl tests / legacy callers) — omitted by default since
 * the main-server /internal/* path covers all callers.
 *
 * Production instead bundles ./service.ts and runs it INSIDE the Next.js
 * server on one port (deploy/production-server.js → socket.io '/socket.io/',
 * relay at /internal/* on that same port — Hostinger shared hosting only
 * allows ONE port per process).
 */
createCallService()
