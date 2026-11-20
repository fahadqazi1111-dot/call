# CALL — Deployment Guide (MySQL + ready-to-deploy ZIP)

This package deploys **the exact app you are running now** — every feature
(chats, calls, conferences, voice rooms, live video + battles, gifts with
animations and sounds, stories, wallet, ads, AI, admin panel) is included.

The realtime layer (socket.io) runs **inside the same Node process as Next.js**
on **one port** — nothing else has to be started, and it works on normal
"Next.js supported" hosting without reverse-proxy tricks.

---

## What is inside

| Path | Purpose |
|---|---|
| `src/` | Full Next.js app (all pages, API routes, components) |
| `public/` | All assets (gift videos, sounds, icons — ~40 MB) |
| `prisma/schema.mysql.prisma` | **MySQL** database schema (used in production) |
| `prisma/schema.prisma` | SQLite schema (local development only) |
| `deploy/call-mysql-full.sql` | **phpMyAdmin import file: tables + your current data** |
| `deploy/call-mysql-schema.sql` | Tables only (empty database import) |
| `deploy/production-server.js` | Production entry: Next.js + realtime on one port |
| `deploy/socket-service-bundle.cjs` | The bundled realtime service |
| `.env.example` | Copy to `.env` and fill in |
| `README-DEPLOY.md` | This guide |

---

## Requirements

- Node.js **20.9+** (22 LTS recommended) — check with `node -v`
- A **MySQL / MariaDB** database (5.7+ / 10.4+)
- npm (comes with Node)

> Shared hosting that "supports Next.js" runs Node apps — perfect.
> Plain PHP-only hosting will NOT work (the app needs Node).

---

## Step 1 — Create the MySQL database

1. In your hosting panel (or phpMyAdmin) create a database, e.g. `call_app`,
   and a database user with full rights on it.
   - Charset: **utf8mb4 / utf8mb4_unicode_ci** (default is fine).
2. Note the credentials: user, password, database name.

## Step 2 — Import the SQL file (phpMyAdmin)

1. Open **phpMyAdmin** → select your database → **Import** tab.
2. Choose `deploy/call-mysql-full.sql` → Import.
3. You now have **41 tables + your data** (users, gifts, settings, packages…),
   including your admin account — ready to log in right after deploy.

(If you prefer an empty database instead, import `deploy/call-mysql-schema.sql`.)

## Step 3 — Upload the ZIP and extract it

Upload `call-deploy.zip` via your hosting File Manager and extract it into the
folder your Node app points to (e.g. `domains/your-domain.com/app`).

## Step 4 — Create `.env`

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/DATABASE_NAME"
NEXT_PUBLIC_SOCKET_URL="/"
NEXT_PUBLIC_SOCKET_PATH="/socket.io/"
NEXT_PUBLIC_APP_URL="https://your-domain.com"
PORT=3000
```

**IMPORTANT:** set these BEFORE building — `NEXT_PUBLIC_*` values are baked
into the client bundle at build time.

## Step 5 — Install + generate the MySQL client

```bash
npm install
npx prisma generate --schema prisma/schema.mysql.prisma
```

(The second command is required because the default schema is the SQLite one
used for local development.)

## Step 6 — Build

```bash
npm run build
```

This builds Next.js, then assembles the runnable standalone folder with the
integrated realtime service.

## Step 7 — Start

```bash
node .next/standalone/production-server.js
```

One process serves everything:

- website + API on your port,
- realtime (socket.io) on `/socket.io/` of the same port,
- internal relay on `127.0.0.1:3004` (loopback only).

On hosting panels: set the **start command** to the line above and the port to
the one the panel assigns (`PORT` env is read automatically).

With pm2 (VPS):

```bash
npm i -g pm2
PORT=3000 pm2 start .next/standalone/production-server.js --name call
pm2 save && pm2 startup
```

---

## Verify after deploy

1. Open your domain — the app loads with your data.
2. Log in (admin: `fahadqazi1111@gmail.com`) — **change the password
   immediately** in the app settings.
3. Start a live from one device, watch from another — chat, gifts, reactions
   and battle scores must work (this proves the realtime layer is healthy).
4. Check the admin panel → AI settings keys are still stored (they live in the
   database, so they survive the move).

---

## Troubleshooting

**`npm run build` runs out of memory on shared hosting**
Shared plans sometimes cap Node RAM (~512 MB). Options: raise the plan limit,
or use a small VPS (2 GB) — on a VPS the exact same steps work and give the
best realtime performance.

**You skipped phpMyAdmin and prefer CLI**
```bash
mysql -u USER -p DATABASE_NAME < deploy/call-mysql-full.sql
# or let Prisma create the tables itself (empty database):
npx prisma db push --schema prisma/schema.mysql.prisma
```

**Realtime not connecting (gifts/chat not live)**
- `.env` must contain `NEXT_PUBLIC_SOCKET_URL="/"` **before** the build.
- Confirm the start command is `node .next/standalone/production-server.js`
  (NOT `next start` — the plain Next server has no realtime layer).

**Dates look shifted** — the dump stores all timestamps in UTC; MySQL session
time zone is set by the dump itself. If you ever re-dump manually, keep
`SET time_zone = '+00:00';`.

---

## What happens next

1. You deploy and send me the live URL.
2. I wrap the URL into the **Capacitor** Android/iOS app for Play Store /
   App Store (no PHP needed — the wrapper just points at your hosted app).
