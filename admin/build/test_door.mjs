#!/usr/bin/env node
// Checks assets/door.js against the newsroom's test vectors (lab/vectors.json), computed
// with sgit's own Python. Run from anywhere: node admin/build/test_door.mjs
// Not part of the pre-release gate yet (it takes a second of PBKDF2); run it before a release
// and whenever door.js changes.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const door = await import(join(ROOT, 'assets', 'door.js'))
const v = JSON.parse(readFileSync(join(ROOT, 'lab', 'vectors.json'), 'utf8'))

const d = await door.doorFrom(door.unhex(v.prf_hex), 0, v.rp)
const k = await door.sgitKeys(d.passphrase, d.vaultId)
const checks = [
  ['seed', d.seed, v.seed], ['passphrase', d.passphrase, v.passphrase], ['vault_id', d.vaultId, v.vault_id],
  ['read_key', k.readHex, v.read_key], ['write_key', k.writeHex, v.write_key],
  ['ref_file_id', k.refId, v.ref_file_id], ['branch_index_file_id', k.indexId, v.branch_index_file_id],
]
let bad = 0
for (const [name, got, want] of checks) {
  const ok = got === want
  bad += !ok
  console.log(`  ${ok ? 'ok ' : '!! '} ${name.padEnd(22)} ${ok ? want.slice(0, 24) + '…' : `got ${got} want ${want}`}`)
}
// the recovery code round-trips
const r = door.recoveryCode()
const rt = door.hex(door.recoveryBytes(r.shown)) === door.hex(r.bytes)
bad += !rt
console.log(`  ${rt ? 'ok ' : '!! '} recovery code round-trips (${r.shown})`)
// a different relying party gives a different door from the same bytes
const d2 = await door.doorFrom(door.unhex(v.prf_hex), 0, 'user.sgit.ai')
const diff = d2.vaultId !== d.vaultId && d2.seed !== d.seed
bad += !diff
console.log(`  ${diff ? 'ok ' : '!! '} rp user.sgit.ai derives a different door (${d2.vaultId}) from rp ${v.rp} (${d.vaultId})`)
console.log(bad ? `test_door: ${bad} FAILED` : `test_door: OK, ${checks.length} vector values agree with sgit ${v.sgit_version}, ${k.msRead + k.msWrite} ms of PBKDF2`)
process.exit(bad ? 1 : 0)
