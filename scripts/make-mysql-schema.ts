/**
 * Generates prisma/schema.mysql.prisma from prisma/schema.prisma:
 *   1. datasource provider: sqlite -> mysql
 *   2. adds @db.Text to every String field that is NOT the primary key,
 *      NOT @unique and NOT referenced by @@index/@@unique
 *      (MySQL cannot index bare TEXT columns; 191-char indexed columns are
 *      the utf8mb4-safe maximum Prisma uses by default).
 *
 * Everything else (models, fields, defaults, relations, indexes) is copied
 * byte-for-byte so both schemas stay in lock-step.
 *
 * Run:  bun run scripts/make-mysql-schema.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = 'prisma/schema.prisma'
const OUT = 'prisma/schema.mysql.prisma'

const src = readFileSync(SRC, 'utf8')
const lines = src.split('\n')

type Model = { name: string; start: number; end: number }
const models: Model[] = []
lines.forEach((l, i) => {
  const m = l.match(/^model\s+(\w+)\s*\{/)
  if (m) models.push({ name: m[1], start: i, end: -1 })
})
// close each model block at its matching closing brace (first "}" at col 0)
for (const mod of models) {
  for (let j = mod.start + 1; j < lines.length; j++) {
    if (lines[j].startsWith('}')) {
      mod.end = j
      break
    }
  }
}

const out = lines.slice()
const touched = new Set<string>()

for (const mod of models) {
  // fields referenced by composite @@index / @@unique (must stay VARCHAR)
  const indexed = new Set<string>()
  for (let j = mod.start; j <= mod.end; j++) {
    const l = lines[j]
    for (const m of l.matchAll(/@@(?:index|unique)\(\[(.*?)\]\)/g)) {
      for (const f of m[1].split(',')) {
        const name = f.trim().split(/\s+/)[0]
        if (name && name !== 'sort' && name !== 'Desc' && name !== 'Asc') indexed.add(name)
      }
    }
  }

  for (let j = mod.start + 1; j < mod.end; j++) {
    const l = lines[j]
    // field lines are exactly "  name   Type   ...attributes // comment"
    const fm = l.match(/^ {2}(\w+)\s+String(\??)(\s|$)/)
    if (!fm) continue
    const field = fm[1]
    if (/@id\b/.test(l) || /@unique\b/.test(l)) continue // keep VARCHAR for keys
    if (indexed.has(field)) continue // keep VARCHAR for indexed fields
    if (/@db\./.test(l)) continue // already has a native type attribute

    // insert "@db.Text" before the trailing // comment, else at end of line
    const ci = l.indexOf('//')
    let base = ci === -1 ? l : l.slice(0, ci)
    const comment = ci === -1 ? '' : l.slice(ci)
    base = base.replace(/\s+$/, '')
    out[j] = `${base} @db.Text${comment ? ' ' + comment.trimEnd() : ''}`
    touched.add(`${mod.name}.${field}`)
  }
}

// provider swap — only inside the datasource block
let inDatasource = false
for (let i = 0; i < out.length; i++) {
  if (/^datasource\s/.test(out[i])) inDatasource = true
  else if (inDatasource && out[i].startsWith('}')) inDatasource = false
  if (inDatasource && /provider\s*=\s*"sqlite"/.test(out[i])) {
    out[i] = out[i].replace('provider = "sqlite"', 'provider = "mysql"')
  }
}

writeFileSync(OUT, out.join('\n'))
console.log(
  `schema.mysql.prisma written — provider=mysql, @db.Text added to ${touched.size} fields`
)
console.log(`models: ${models.length}`)
