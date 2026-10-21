/* users.sgit.ai, the lab. Every card is a thing you can press; every step is written to the log.
   This page writes nothing to any server. It talks to the passkey store for the gesture and to
   nothing else. The keys it derives live in this page's memory and are cleared by Forget. */
import * as door from './door.js'

const $ = id => document.getElementById(id)
const state = { passkey: null, prf: null, door: null, keys: null, recovery: null }
const t0 = Date.now()

function log(msg, cls) {
    const el = $('lablog')
    const line = document.createElement('div')
    const t = ((Date.now() - t0) / 1000).toFixed(1).padStart(6, ' ')
    line.textContent = `${t}s  ${msg}`
    if (cls) line.className = cls
    el.appendChild(line)
    el.scrollTop = el.scrollHeight
}
function out(id, rows) {
    const el = $(id)
    el.textContent = ''
    for (const [k, v, cls] of rows) {
        const kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k
        const vv = document.createElement('span'); if (cls) vv.className = cls; vv.textContent = v
        el.appendChild(kk); el.appendChild(vv); el.appendChild(document.createTextNode('\n'))
    }
}
const fp = async bytes => door.hex(await door.sha256(bytes)).slice(0, 16)
const yn = b => b ? 'yes' : 'no'

// ---------------------------------------------------------------- 1. this browser
async function browserCheck() {
    const rows = []
    rows.push(['secure context', yn(window.isSecureContext), window.isSecureContext ? 'ok' : 'bad'])
    rows.push(['this origin', location.hostname])
    rows.push(['relying party used', door.DEFAULT_RP])
    const hasWA = !!window.PublicKeyCredential
    rows.push(['WebAuthn', yn(hasWA), hasWA ? 'ok' : 'bad'])
    if (hasWA) {
        try { rows.push(['platform authenticator', yn(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())]) } catch { rows.push(['platform authenticator', 'could not ask']) }
        try { rows.push(['conditional mediation', yn(PublicKeyCredential.isConditionalMediationAvailable && await PublicKeyCredential.isConditionalMediationAvailable())]) } catch { }
        rows.push(['PRF', 'cannot be known until a passkey is made; the store says then', 'dim'])
    }
    rows.push(['Web Crypto', yn(!!(crypto && crypto.subtle)), crypto && crypto.subtle ? 'ok' : 'bad'])
    const remembered = safeGet('users.lab.passkey')
    rows.push(['a passkey remembered here', remembered ? `${remembered.label} (${remembered.credId.slice(0, 12)}…)` : 'none', 'dim'])
    out('out1', rows)
    log('browser checked')
}
function safeGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
function safeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } }
function safeDel(k) { try { localStorage.removeItem(k) } catch { } }

// ---------------------------------------------------------------- 2. make a passkey
async function makePasskey() {
    const label = ($('pkname').value || `${door.DEFAULT_RP} · reader`).trim()
    log(`making a passkey for ${door.DEFAULT_RP} as "${label}", with the PRF extension…`)
    try {
        const r = await door.makePasskey(label)
        state.passkey = { ...r, label }
        safeSet('users.lab.passkey', { credId: r.credId, label, made: new Date().toISOString() })
        out('out2', [
            ['credential id', r.credId.slice(0, 24) + '…'],
            ['PRF enabled', yn(r.prfEnabled), r.prfEnabled ? 'ok' : 'bad'],
            ['path', r.path],
            ['user handle', r.userHandle.slice(0, 16) + '… (chosen by this page, not secret)', 'dim'],
            ['backup eligible / backed up', `${yn(r.flags.be)} / ${yn(r.flags.bs)}`],
        ])
        log(r.prfEnabled ? 'passkey made; PRF is enabled for it' : 'passkey made, but the store returned prf.enabled = false: no door can be derived from it', r.prfEnabled ? 'ok' : 'bad')
        if (!r.prfEnabled) log('the ladder: sign in to a store that syncs; use your phone by QR; plug in a hardware key; or stay on this device with the recovery code', 'dim')
    } catch (e) {
        out('out2', [['error', `${e.name}: ${e.message}`, 'bad']])
        log(`create failed: ${e.name}: ${e.message}`, 'bad')
    }
}

// ---------------------------------------------------------------- 3. get the bytes
async function getBytes() {
    log(`asking for the PRF bytes with input SHA-256("${door.prfInputText()}")…`)
    try {
        const r = await door.prfBytes()
        state.prf = r
        out('out3', [
            ['fingerprint of the bytes', await fp(r.bytes), 'ok'],
            ['bytes', `${r.bytes.length}, kept in memory only`, 'dim'],
            ['path', r.path + (r.path === 'cross-platform' ? ' (a phone by QR, or a hardware key: its own door)' : '')],
            ['credential id', r.credId.slice(0, 24) + '…'],
            ['flags', `up ${yn(r.flags.up)} · uv ${yn(r.flags.uv)} · be ${yn(r.flags.be)} · bs ${yn(r.flags.bs)}`],
        ])
        log(`got 32 bytes by the ${r.path} path; fingerprint ${await fp(r.bytes)}`, 'ok')
        log('the same passkey gives the same bytes on every device it syncs to, through the same kind of path. Press again on another device and compare the fingerprint.', 'dim')
    } catch (e) {
        out('out3', [['error', e.code === 'ENOPRF' ? 'the authenticator signed and returned no PRF bytes: no door can be derived by this path' : `${e.name}: ${e.message}`, 'bad']])
        log(`get failed: ${e.code || e.name}: ${e.message}`, 'bad')
    }
}

// ---------------------------------------------------------------- 4. derive the door
async function deriveDoor() {
    if (!state.prf) { log('get the bytes first', 'bad'); return }
    log('deriving the door: HKDF to a seed, a passphrase and an 8-character address…')
    const d = await door.doorFrom(state.prf.bytes)
    state.door = d
    log(`door address ${d.vaultId}; now sgit's PBKDF2 at 600,000 iterations, twice…`)
    const k = await door.sgitKeys(d.passphrase, d.vaultId)
    state.keys = k
    out('out4', [
        ['door address (vault id)', d.vaultId, 'ok'],
        ['ref file id', k.refId],
        ['branch index file id', k.indexId],
        ['passphrase', `256 bits, kept in memory; fingerprint ${await fp(door.unhex(d.passphrase))}`, 'dim'],
        ['read key derived in', `${k.msRead} ms`],
        ['write key derived in', `${k.msWrite} ms`],
        ['fetched from a server', 'nothing. This lab does not ask whether a door exists at that address.', 'dim'],
    ])
    log(`door derived in ${k.msRead + k.msWrite} ms of key stretching. On a phone, several times that.`, 'ok')
}

// ---------------------------------------------------------------- 5. recovery code
async function makeRecovery() {
    const r = door.recoveryCode()
    state.recovery = r
    log('made a recovery code: 128 bits as 26 characters of base32')
    const d = await door.doorFrom(r.bytes)
    out('out5', [
        ['the code', r.shown, 'ok'],
        ['its door address', d.vaultId],
        ['parses back', yn(door.hex(door.recoveryBytes(r.shown)) === door.hex(r.bytes)), 'ok'],
        ['note', 'this is a lab; nothing holds this code and no door is written for it', 'dim'],
    ])
}
async function checkRecovery() {
    const bytes = door.recoveryBytes($('rcin').value)
    if (!bytes) { out('out5b', [['error', 'a recovery code is 26 characters of A–Z and 2–7', 'bad']]); return }
    const d = await door.doorFrom(bytes)
    out('out5b', [['its door address', d.vaultId, 'ok'], ['note', 'derived; nothing fetched', 'dim']])
    log(`a typed recovery code derives door ${d.vaultId}`)
}

// ---------------------------------------------------------------- 6. test vectors
async function vectors() {
    log('running the newsroom’s test vectors through this site’s copy of the derivation (rp = newsroom.sgit.ai)…')
    let v
    try { v = await (await fetch('vectors.json')).json() } catch (e) { out('out6', [['error', 'could not load vectors.json', 'bad']]); return }
    const d = await door.doorFrom(door.unhex(v.prf_hex), 0, v.rp)
    const k = await door.sgitKeys(d.passphrase, d.vaultId)
    const checks = [
        ['seed', d.seed, v.seed], ['passphrase', d.passphrase, v.passphrase], ['vault id', d.vaultId, v.vault_id],
        ['read key', k.readHex, v.read_key], ['write key', k.writeHex, v.write_key],
        ['ref file id', k.refId, v.ref_file_id], ['branch index file id', k.indexId, v.branch_index_file_id],
    ]
    const rows = [['vectors', `sgit ${v.sgit_version}, rp ${v.rp}, ${v.pbkdf2_iterations.toLocaleString()} iterations`, 'dim']]
    let ok = 0
    for (const [name, got, want] of checks) { const same = got === want; ok += same; rows.push([name, same ? `agrees (${String(want).slice(0, 20)}…)` : `DIFFERS: got ${got}, want ${want}`, same ? 'ok' : 'bad']) }
    rows.push(['result', `${ok} of ${checks.length} values agree with sgit’s Python`, ok === checks.length ? 'ok' : 'bad'])
    out('out6', rows)
    log(`${ok} of ${checks.length} test-vector values agree`, ok === checks.length ? 'ok' : 'bad')
}

// ---------------------------------------------------------------- forget
function forget() {
    for (const k of Object.keys(state)) state[k] = null
    safeDel('users.lab.passkey')
    for (const id of ['out2', 'out3', 'out4', 'out5', 'out5b']) $(id).textContent = ''
    log('forgotten: the bytes, the door and the keys are gone from memory; the remembered label is cleared. The passkey itself is in your store, and only you can delete it there.', 'dim')
    browserCheck()
}

$('b1').onclick = browserCheck
$('b2').onclick = makePasskey
$('b3').onclick = getBytes
$('b4').onclick = deriveDoor
$('b5').onclick = makeRecovery
$('b5b').onclick = checkRecovery
$('b6').onclick = vectors
$('bforget').onclick = forget
log(`lab loaded on ${location.hostname}; nothing has left this page`)
browserCheck()
vectors()
