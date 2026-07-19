/**
 * PIN hashing + signed access cookies, Web Crypto only (runs in Workers,
 * route handlers and `next dev` alike).
 */

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSecret(): string {
  const secret = process.env.PIN_COOKIE_SECRET;
  if (!secret) {
    // Dev fallback — production must set the real secret.
    return "dev-only-insecure-secret";
  }
  return secret;
}

export async function hashPin(pin: string): Promise<string> {
  return hmacHex(getSecret(), `pin:${pin}`);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return (await hashPin(pin)) === pinHash;
}

export function pinCookieName(eventId: string): string {
  return `pix_ev_${eventId}`;
}

const COOKIE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function makeAccessCookieValue(eventId: string): Promise<string> {
  const expires = Date.now() + COOKIE_TTL_MS;
  const sig = await hmacHex(getSecret(), `access:${eventId}:${expires}`);
  return `${expires}.${sig}`;
}

export async function verifyAccessCookieValue(
  eventId: string,
  value: string | undefined,
): Promise<boolean> {
  if (!value) return false;
  const [expiresStr, sig] = value.split(".");
  const expires = Number(expiresStr);
  if (!expires || expires < Date.now()) return false;
  const expected = await hmacHex(getSecret(), `access:${eventId}:${expires}`);
  return sig === expected;
}
