import { readFileSync } from 'node:fs'
const sql = readFileSync('/home/z/my-project/deploy/call-mysql-full.sql', 'utf8')

// 1. column types from CREATE TABLE bodies
const types = new Map()
for (const m of sql.matchAll(/CREATE TABLE `(\w+)` \(([\s\S]*?)\n\) /g)) {
  const cols = new Map()
  for (const line of m[2].split('\n')) {
    const cm = line.trim().match(/^`(\w+)` (\w+(?:\(\d+\))?)/)
    if (cm) cols.set(cm[1], cm[2])
  }
  types.set(m[1], cols)
}

// 2. FK pairs from ALTER TABLE statements
let ok = 0
const bad = []
for (const m of sql.matchAll(
  /ALTER TABLE `(\w+)` ADD CONSTRAINT `\w+` FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)`\(`(\w+)`\)/g
)) {
  const [, childT, childC, parentT, parentC] = m
  const ct = types.get(childT)?.get(childC)
  const pt = types.get(parentT)?.get(parentC)
  if (ct && pt && ct === pt) ok++
  else bad.push(`${childT}.${childC}(${ct}) -> ${parentT}.${parentC}(${pt})`)
}
console.log(`FK pairs valid: ${ok}`)
console.log(bad.length ? 'MISMATCHES:\n' + bad.join('\n') : 'All FK types match exactly.')
console.log(
  'senderId type:',
  types.get('Message')?.get('senderId'),
  '| User.id:',
  types.get('User')?.get('id')
)
