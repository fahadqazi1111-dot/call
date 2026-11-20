/* eslint-disable @typescript-eslint/no-require-imports -- next.config.ts runs in plain Node (not bundled): require is native here */
import type { NextConfig } from "next";

/**
 * Supervise the CALL signaling mini-service (mini-services/call-service,
 * ports 3003 client / 3004 internal relay).
 *
 * The whole realtime layer — gift animations & broadcasts, live WebRTC,
 * voice rooms, presence — depends on it. Detached background processes get
 * reaped in this sandbox between shell sessions, which silently killed the
 * service before. The Next.js server process tree survives, so the config
 * bootstraps a keepalive watchdog as its own child: probe port 3003 every
 * 10s and respawn `bun index.ts` whenever it is down.
 *
 * Production standalone deploys start the mini service via the platform
 * scripts (mini-services-start.sh) — the watchdog is dev-only and exits if
 * the service folder is missing.
 */
function startCallServiceWatchdog() {
  if (process.env.CALL_SKIP_MINI_SERVICE) return;
  try {
    // next.config runs in plain Node — require is available and not bundled
    const { spawn } = require("node:child_process") as typeof import("node:child_process");
    const path = require("node:path") as typeof import("node:path");
    const fs = require("node:fs") as typeof import("node:fs");
    const net = require("node:net") as typeof import("node:net");

    const dir = path.join(process.cwd(), "mini-services", "call-service");
    if (!fs.existsSync(path.join(dir, "index.ts"))) return; // standalone build — platform scripts own it

    // On hosts without bun (e.g. building the deploy ZIP on the customer's
    // Node-only hosting) the watchdog can never spawn the service — stay quiet.
    try {
      require("child_process").execSync("bun --version", { stdio: "ignore", timeout: 5000 });
    } catch {
      return;
    }

    const probe = (port: number) =>
      new Promise<boolean>((resolve) => {
        const s = net.connect(port, "127.0.0.1");
        const done = (ok: boolean) => {
          s.destroy();
          resolve(ok);
        };
        s.once("connect", () => done(true));
        s.once("error", () => done(false));
        setTimeout(() => done(false), 1500).unref();
      });

    let spawning = false;
    const ensureService = async () => {
      if (spawning) return;
      if (await probe(3003)) return;
      spawning = true;
      try {
        console.log("[call-app] signaling service down — spawning mini-services/call-service");
        const child = spawn("bun", ["index.ts"], { cwd: dir, stdio: "ignore", env: process.env });
        child.on("error", (e: Error) => console.error("[call-app] mini-service spawn failed:", e.message));
        child.on("exit", (code: number | null) =>
          console.error("[call-app] mini-service exited code=" + code + " — will respawn on next probe")
        );
        setTimeout(async () => {
          console.log("[call-app] signaling service probe after spawn:", (await probe(3003)) ? "UP" : "still down");
          spawning = false;
        }, 3000);
      } catch (e) {
        console.error("[call-app] mini-service spawn error:", e);
        spawning = false;
      }
    };

    void ensureService();
    setInterval(() => void ensureService(), 10_000).unref();
  } catch (e) {
    console.error("[call-app] watchdog bootstrap failed:", e);
  }
}

startCallServiceWatchdog();

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // remove the Next.js dev "N" badge from the bottom-left corner permanently
  devIndicators: false,
  experimental: {
    /**
     * Cap the build worker count.
     *
     * Next.js defaults to `os.cpus().length - 1` workers for
     * "Collecting page data" / "Generating static pages". Hostinger's build
     * machine reports ~64 CPUs but enforces a strict OS process/thread
     * limit, so 63 workers crashed with:
     *   "OS can't spawn worker thread: Resource temporarily unavailable
     *    (os error 11)"  ->  SIGABRT
     * Pinning a small number keeps the same footprint as the compile phase
     * (which succeeded) and works identically on local dev machines.
     */
    cpus: 1,
  },
};

export default nextConfig;
