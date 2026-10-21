/**
 * door.js: from a passkey's PRF bytes (or a recovery code) to a door vault's key, the way the
 * passkey article says. Vendored from newsroom.sgit.ai's assets/door.js (newsroom v0.12.x) with
 * one change: the relying party is a parameter, defaulting to this host, so the same code runs
 * here for user.sgit.ai and, in the lab's test vectors, for newsroom.sgit.ai.
 *
 * The derivation, written out (the article's steps 1 to 6, made exact):
 *   prf input        = SHA-256(RP + "/door/v1")                                a public constant
 *   door seed        = HKDF-SHA256(ikm = prf bytes, salt = SHA-256(RP), info = "sgit/door/v1", 32 bytes)
 *   passphrase       = hex( HKDF-SHA256(ikm = seed, salt = empty, info = "sgit/door/v1/passphrase", 32 bytes) )
 *   vault id         = 8 characters of [a-z0-9] drawn from HKDF-SHA256(ikm = seed, salt = empty, info = "sgit/door/v1/id", 64 bytes),
 *                      a byte accepted only when it is below 252 (= 7 × 36), so no character is favoured
 *   vault key        = sgit_private_vault_ + passphrase + ":" + vault id              (sgit's format)
 *   read key         = PBKDF2-HMAC-SHA256(passphrase, "sg-vault-v1:" + vault id, 600000, 32 bytes)        (sgit)
 *   write key        = PBKDF2-HMAC-SHA256(passphrase, "sg-vault-v1:write:" + vault id, 600000, 32 bytes)  (sgit)
 *   recovery door    = the same, with the 16 bytes of the recovery code as the ikm
 *
 * Checked against sgit's own Python by lab/vectors.json (the newsroom's, computed with sgit 0.21.0).
 *
 * @module door
 */

export const DEFAULT_RP = (typeof location !== 'undefined' && location.hostname) || 'user.sgit.ai'
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const te = new TextEncoder()
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
export const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
export const unhex = s => Uint8Array.from(s.match(/../g) || [], h => parseInt(h, 16))
export const sha256 = async data => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? te.encode(data) : data))
export const concat = (...parts) => { const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n); let i = 0; for (const p of parts) { out.set(p, i); i += p.length } return out }

// ------------------------------------------------------------ the crypto, all WebCrypto
export async function hkdf(ikm, salt, info, length) {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode(info) }, key, length * 8))
}
export async function pbkdf2(passphrase, salt, iterations = 600000) {
    const key = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveBits'])
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(salt), iterations }, key, 256))
}
export async function hmac(keyBytes, text) {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(text)))
}

/** The vault id: 8 characters of [a-z0-9] from an HKDF stream, with rejection sampling and a counter in the info if the stream runs short. */
export async function vaultIdFrom(seed, counter = 0) {
    let out = ''
    for (let round = 0; out.length < 8 && round < 8; round++) {
        const info = 'sgit/door/v1/id' + (counter ? `/${counter}` : '') + (round ? `/${round}` : '')
        for (const b of await hkdf(seed, new Uint8Array(0), info, 64)) {
            if (b < 252) out += ALPHABET[b % 36]
            if (out.length === 8) break
        }
    }
    return out
}

/** The article's derivation: from 32 PRF bytes (or the 16 bytes of a recovery code) to a door's passphrase and vault id. */
export async function doorFrom(ikm, counter = 0, rp = DEFAULT_RP) {
    const seed = await hkdf(ikm, await sha256(rp), 'sgit/door/v1', 32)
    const passphrase = hex(await hkdf(seed, new Uint8Array(0), 'sgit/door/v1/passphrase', 32))
    const vaultId = await vaultIdFrom(seed, counter)
    return { seed: hex(seed), passphrase, vaultId, rp }
}

/** sgit's derivation from a passphrase and a vault id: read key, write key, and the ids of the ref and the branch index. */
export async function sgitKeys(passphrase, vaultId) {
    const t0 = now()
    const read = await pbkdf2(passphrase, `sg-vault-v1:${vaultId}`)
    const t1 = now()
    const write = await pbkdf2(passphrase, `sg-vault-v1:write:${vaultId}`)
    const t2 = now()
    const ref = hex(await hmac(read, `sg-vault-v1:file-id:ref:${vaultId}`)).slice(0, 12)
    const idx = hex(await hmac(read, `sg-vault-v1:file-id:branch-index:${vaultId}`)).slice(0, 12)
    return { read, write, readHex: hex(read), writeHex: hex(write), refId: 'ref-pid-muw-' + ref, indexId: 'idx-pid-muw-' + idx,
             msRead: Math.round(t1 - t0), msWrite: Math.round(t2 - t1) }
}
export const readKeyString = (readHex, vaultId) => 'sgit_public_' + 'read_' + readHex + ':' + vaultId
export const prfInputText = (rp = DEFAULT_RP) => `${rp}/door/v1`

/** A recovery code: 128 bits as 26 characters of base32, shown in groups of 4 to be written down. */
export function recoveryCode(bytes) {
    bytes = bytes || crypto.getRandomValues(new Uint8Array(16))
    let bits = '', out = ''
    for (const b of bytes) bits += b.toString(2).padStart(8, '0')
    for (let i = 0; i < 26; i++) out += B32[parseInt(bits.slice(i * 5, i * 5 + 5).padEnd(5, '0'), 2)]
    return { bytes, code: out, shown: out.match(/.{1,4}/g).join('-') }
}
export function recoveryBytes(code) {
    const s = String(code || '').toUpperCase().replace(/[^A-Z2-7]/g, '')
    if (s.length !== 26) return null
    let bits = ''
    for (const ch of s) bits += B32.indexOf(ch).toString(2).padStart(5, '0')
    const out = new Uint8Array(16)
    for (let i = 0; i < 16; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
    return out
}

/** The authenticator data flags byte: UP, UV, BE (backup eligible: the passkey can sync), BS (backed up: it has). */
export function flagsOf(authData) {
    const f = new Uint8Array(authData)[32]
    return { up: !!(f & 1), uv: !!(f & 4), be: !!(f & 8), bs: !!(f & 16) }
}

/**
 * Make a passkey for this site with the PRF extension: a discoverable credential, user verification
 * required, under a user handle and display name chosen for the role. Returns what the browser reports,
 * including whether PRF is enabled for this credential, which the page checks and never guesses.
 */
export async function makePasskey(displayName, rpId = DEFAULT_RP) {
    const userId = crypto.getRandomValues(new Uint8Array(16))
    const c = await navigator.credentials.create({ publicKey: {
        rp: { id: rpId, name: rpId },
        user: { id: userId, name: displayName, displayName },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        extensions: { prf: {} },
        timeout: 120000,
    } })
    const ext = c.getClientExtensionResults()
    return { credId: c.id, prfEnabled: !!(ext.prf && ext.prf.enabled), path: c.authenticatorAttachment || 'not reported',
             userHandle: hex(userId), flags: flagsOf(c.response.getAuthenticatorData ? c.response.getAuthenticatorData() : new Uint8Array(33)) }
}

/**
 * The passkey gesture itself: navigator.credentials.get() with the PRF extension and the fixed input.
 * Returns { bytes, path, credId, userHandle, flags } or throws with the browser's reason. No PRF bytes is an
 * error with code ENOPRF (the "browser's own store" case of the article).
 */
export async function prfBytes(rpId = DEFAULT_RP) {
    const a = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)), rpId, userVerification: 'required',
        allowCredentials: [], extensions: { prf: { eval: { first: await sha256(prfInputText(rpId)) } } }, timeout: 120000,
    } })
    const ext = a.getClientExtensionResults()
    if (!ext.prf || !ext.prf.results || !ext.prf.results.first) { const e = new Error('The authenticator signed and returned no PRF bytes.'); e.code = 'ENOPRF'; throw e }
    return { bytes: new Uint8Array(ext.prf.results.first), path: a.authenticatorAttachment || 'not reported', credId: a.id,
             userHandle: a.response.userHandle ? hex(a.response.userHandle) : '', flags: flagsOf(a.response.authenticatorData) }
}
