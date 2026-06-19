// ============================================================
//  AUTH — password hashing + verification (server-side only)
//  Uses Node's built-in scrypt. Format stored in the sheet:
//    scrypt$<saltHex>$<hashHex>
//  This is operational access control, not bank-grade security.
// ============================================================
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const test = scryptSync(password, salt, 64);
    const known = Buffer.from(hash, "hex");
    if (test.length !== known.length) return false;
    return timingSafeEqual(test, known);
  } catch {
    return false;
  }
}

// ---------- Lightweight signed session token ----------
// token = base64(payload).hmac  — signed with AUTH_SECRET.
// Good enough to keep a login session; not a full JWT stack.

function authSecret(): string {
  return process.env.AUTH_SECRET || "change-me-in-vercel-env-AUTH_SECRET";
}

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
  attendantId: string;
  displayName: string;
  exp: number; // epoch ms
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", authSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "cw_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
