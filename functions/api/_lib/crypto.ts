// Password hashing, session tokens, and digests — all via the WebCrypto API
// available in the Cloudflare Workers runtime (no Node 'crypto', no bcrypt).
//
// Password scheme: PBKDF2-HMAC-SHA256 over a *peppered* password.
//   1. HMAC-SHA256(AUTH_SECRET, password)  → couples the hash to a server-held secret
//      (the pepper). An attacker with a DB dump but not AUTH_SECRET cannot brute-force.
//   2. PBKDF2(peppered, randomSalt, iterations) → the stored derived key.
//
// Stored format (self-describing, so params can evolve and rehash-on-login works):
//   pbkdf2$<pepperVersion>$sha256$<iterations>$<base64 salt>$<base64 hash>
// The pepper version (`v1`) lets AUTH_SECRET be rotated later without bricking every
// login: keep verifying old versions with the old secret, rehash to the new one.

const PEPPER_VERSION = 'v1'
// Cloudflare Workers' crypto.subtle caps PBKDF2 at 100,000 iterations and throws
// NotSupportedError above it. Node crypto (used by `wrangler pages dev` / Vitest) allows
// more, which is why 210k passed every local gate yet 500'd on the deployed runtime.
// verifyPassword reads the iteration count from each stored hash, so legacy hashes must be
// re-derived at ≤100k for signin to work on Workers.
const PBKDF2_ITERATIONS = 100_000
const KEY_LEN_BYTES = 32
const SALT_LEN_BYTES = 16

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** HMAC-SHA256(secret, password) — the pepper step applied before PBKDF2. */
async function pepper(password: string, secret: string): Promise<ArrayBuffer> {
  // Fail closed: a missing AUTH_SECRET would otherwise HMAC with the literal "undefined",
  // silently collapsing the pepper for every user (security hardening).
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', key, encoder.encode(password))
}

async function pbkdf2(peppered: ArrayBuffer, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN_BYTES * 8,
  )
  return new Uint8Array(bits)
}

/** Hash a plaintext password into the storable self-describing string. */
export async function hashPassword(password: string, secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN_BYTES))
  const hash = await pbkdf2(await pepper(password, secret), salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PEPPER_VERSION}$sha256$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

/** Constant-time verify of a plaintext password against a stored hash string. */
export async function verifyPassword(password: string, stored: string, secret: string): Promise<boolean> {
  const parts = stored.split('$')
  // pbkdf2 $ version $ sha256 $ iterations $ salt $ hash
  if (parts.length !== 6 || parts[0] !== 'pbkdf2' || parts[2] !== 'sha256') return false
  const iterations = Number.parseInt(parts[3], 10)
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = fromBase64(parts[4])
    expected = fromBase64(parts[5])
  } catch {
    return false
  }
  const actual = await pbkdf2(await pepper(password, secret), salt, iterations)
  return timingSafeEqual(actual, expected)
}

/**
 * Burn roughly the same time as a real verify, for unknown emails. Defends against
 * account-enumeration via response-timing on the sign-in endpoint.
 */
export async function dummyVerify(password: string, secret: string): Promise<void> {
  const salt = new Uint8Array(SALT_LEN_BYTES)
  await pbkdf2(await pepper(password, secret), salt, PBKDF2_ITERATIONS)
}

/** XOR-based constant-time byte comparison. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** A 256-bit opaque session token (base64url). The raw value goes in the cookie; only its hash is stored. */
export function generateToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

/** SHA-256 hex digest of a string (used to store session-token and CSRF hashes). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** RFC 4122 v4 UUID — used for users.id, sessions.id, and other TEXT primary keys. */
export function newId(): string {
  return crypto.randomUUID()
}
