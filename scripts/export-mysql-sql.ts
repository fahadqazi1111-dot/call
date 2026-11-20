/**
 * Exports the CALL database (SQLite) to a MySQL dump importable via phpMyAdmin.
 *
 * Output:
 *   deploy/call-mysql-schema.sql  — DDL only (from prisma migrate diff)
 *   deploy/call-mysql-full.sql    — DDL + all data (recommended import)
 *
 * Type conversion (SQLite storage -> MySQL):
 *   DateTime  INTEGER ms  -> 'YYYY-MM-DD HH:MM:SS.mmm'  (UTC)
 *   Boolean   0/1         -> 0/1
 *   String    TEXT        -> escaped 'literal'
 *   Int/Float             -> number
 *
 * Run:  bun run scripts/export-mysql-sql.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { Database } from 'bun:sqlite'

const SCHEMA = 'prisma/schema.prisma'
const DB_FILE = 'db/custom.db'
const DDL_FILE = 'deploy/call-mysql-schema.sql'
const OUT_FULL = 'deploy/call-mysql-full.sql'

/* ---------- 1. parse prisma schema: model -> { field: primitive type } ---------- */
const src = readFileSync(SCHEMA, 'utf8')
const lines = src.split('\n')
const PRIMITIVES = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'BigInt', 'Decimal', 'Json', 'Bytes'])
const fieldTypes = new Map<string, Map<string, string>>() // model -> field -> type
let currentModel: string | null = null
for (const l of lines) {
  const mm = l.match(/^model\s+(\w+)\s*\{/)
  if (mm) {
    currentModel = mm[1]
    fieldTypes.set(currentModel, new Map())
    continue
  }
  if (currentModel && l.startsWith('}')) {
    currentModel = null
    continue
  }
  if (currentModel) {
    const fm = l.match(/^ {2}(\w+)\s+([A-Za-z]+)(\?)?\s*(\[[^\]]*\])?\s*(@|$|\s)/)
    if (fm && PRIMITIVES.has(fm[2])) {
      fieldTypes.get(currentModel)!.set(fm[1], fm[2])
    }
  }
}

/* ---------- 2. DDL (always regenerated from the mysql schema) ---------- */
{
  console.log('Generating DDL via prisma migrate diff ...')
  execSync(
    'DATABASE_URL="mysql://user:pass@127.0.0.1:3306/call" bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.mysql.prisma --script -o ' +
      DDL_FILE,
    { stdio: 'inherit', cwd: process.cwd() }
  )
}
const ddlRaw = readFileSync(DDL_FILE, 'utf8')

/**
 * Shared-hosting import safety (phpMyAdmin on Hostinger = MariaDB):
 *
 * prisma migrate diff emits the foreign keys as trailing
 *   ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES ...
 * statements. On MariaDB servers those ADD CONSTRAINT statements can fail
 * even with FOREIGN_KEY_CHECKS = 0 (e.g. "#1825 - Failed to add the foreign
 * key constraint. Missing index for constraint ... in the referenced table"
 * — a structural check that the wrapping SET cannot disable, plus charset/
 * collation and version quirks on shared DBs).
 *
 * The application never depends on DB-level FK enforcement (Prisma resolves
 * relations in its own queries), so the import files ship WITHOUT foreign
 * keys — that eliminates the whole class of #1825/#1452/#3780/#1215 import
 * errors. The constraints are exported separately to deploy/call-mysql-fks.sql
 * for hosts that accept them (import optionally AFTER the main dump).
 */
const isFkStatement = (l: string) =>
  /ALTER TABLE `\w+` ADD CONSTRAINT `\w+` FOREIGN KEY/i.test(l)
const fkStatements = ddlRaw.split('\n').filter(isFkStatement)
const ddl = ddlRaw
  .split('\n')
  .filter((l) => !isFkStatement(l))
  .join('\n')

writeFileSync(
  'deploy/call-mysql-fks.sql',
  [
    '-- ============================================================',
    '-- CALL — optional foreign-key constraints',
    '-- Import this file AFTER call-mysql-full.sql has imported cleanly.',
    '--',
    '-- OPTIONAL: the app does not need DB-level foreign keys (Prisma resolves',
    '-- relations in its own queries). This file exists so hosts that accept',
    '-- them (MySQL 8, current MariaDB) can still enforce referential integrity.',
    '-- If importing this file fails on your shared host (phpMyAdmin/MariaDB',
    '-- can reject ADD CONSTRAINT with #1825 even with FOREIGN_KEY_CHECKS = 0),',
    '-- simply skip it — everything else works identically.',
    '-- ============================================================',
    '',
    'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    fkStatements.join('\n'),
    '',
    'SET FOREIGN_KEY_CHECKS = 1;',
    '',
  ].join('\n')
)
if (fkStatements.length) {
  console.log(`Wrote deploy/call-mysql-fks.sql — ${fkStatements.length} foreign keys (optional import)`)
}
// Keep the schema-only artifact FK-free as well
writeFileSync(DDL_FILE, ddl)

// Re-import safety: drop existing tables before creating them, so the dump
// can be imported repeatedly over a previous (partial) import without
// "#1050 - Table 'X' already exists". Runs after SET FOREIGN_KEY_CHECKS = 0,
// so FK-linked tables drop in any order.
const ddlTables = [...ddl.matchAll(/CREATE TABLE `(\w+)`/g)].map((m) => m[1])
const dropBlock = ddlTables.length
  ? `-- Drop existing tables (re-import safe)\nDROP TABLE IF EXISTS ${ddlTables.map((t) => '`' + t + '`').join(', ')};\n\n`
  : ''

/* ---------- 3. read sqlite + emit inserts ---------- */
const db = new Database(DB_FILE, { readonly: true })

const tables = (
  db
    .query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY rowid"
    )
    .all() as { name: string }[]
).map((r) => r.name)

const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
    .replace(/\0/g, '\\0')

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

function dateTimeFromValue(v: unknown): string | null {
  if (v === null || v === undefined) return null
  // Prisma 6 + SQLite stores DateTime as epoch millis (INTEGER); be tolerant
  // of older TEXT-stored values too.
  let ms: number
  if (typeof v === 'number') ms = v
  else {
    const n = Number(v)
    if (Number.isFinite(n) && /^\d{10,}$/.test(String(v).trim())) ms = n
    else {
      const d = new Date(String(v))
      if (isNaN(d.getTime())) return null
      ms = d.getTime()
    }
  }
  const d = new Date(ms)
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${String(d.getUTCMilliseconds()).padStart(3, '0')}`
  )
}

function sqlValue(table: string, col: string, v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  const type = fieldTypes.get(table)?.get(col)
  if (type === 'DateTime') {
    const s = dateTimeFromValue(v)
    return s ? `'${s}'` : 'NULL'
  }
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (typeof v === 'string') return `'${esc(v)}'`
  // Buffer etc. — serialize as string
  return `'${esc(String(v))}'`
}

const parts: string[] = []
parts.push(
  `-- ============================================================`,
  `-- CALL — full MySQL dump (schema + data) for phpMyAdmin import`,
  `-- Generated ${new Date().toISOString()}`,
  `-- All DateTime values are UTC.`,
  `-- ============================================================`,
  ``,
  `SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  `SET time_zone = '+00:00';`,
  `SET FOREIGN_KEY_CHECKS = 0;`,
  `SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';`,
  ``,
  dropBlock + ddl.trimEnd(),
  ``,
  `-- ============================================================`,
  `-- DATA`,
  `-- ============================================================`,
  ``,
  `START TRANSACTION;`,
  ``
)

let totalRows = 0
for (const table of tables) {
  const cols = (
    db.query(`PRAGMA table_info('${table}')`).all() as {
      cid: number
      name: string
      type: string
    }[]
  ).map((c) => c.name)
  if (!cols.length) {
    console.log(`  (skip ${table}: no columns)`)
    continue
  }
  const count = (db.query(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c
  if (count === 0) {
    console.log(`  ${table}: 0 rows`)
    continue
  }
  const colList = cols.map((c) => '`' + c + '`').join(', ')
  const selectStmt = db.query(`SELECT * FROM "${table}"`)
  const rows = selectStmt.all() as Record<string, unknown>[]
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const values = chunk
      .map((row) => `(${cols.map((c) => sqlValue(table, c, row[c])).join(', ')})`)
      .join(',\n  ')
    parts.push(`INSERT INTO \`${table}\` (${colList}) VALUES\n  ${values};`)
  }
  totalRows += count
  console.log(`  ${table}: ${count} rows`)
}

parts.push(``, `COMMIT;`, ``, `SET FOREIGN_KEY_CHECKS = 1;`, ``)

writeFileSync(OUT_FULL, parts.join('\n'))
console.log(`\nWrote ${OUT_FULL} — ${totalRows} rows across ${tables.length} tables`)
