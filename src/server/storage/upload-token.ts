import { createHmac, timingSafeEqual } from "node:crypto";

export type UploadGrant = { key: string; mime: string; bytes: number };
type Payload = UploadGrant & { exp: number };

const b64 = (s: string) => Buffer.from(s).toString("base64url");

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** A tamper-proof, expiring permission to upload exactly one file (used by the local driver). */
export function signUploadToken(
  grant: UploadGrant,
  secret: string,
  ttlSeconds: number,
  now = Date.now(),
): string {
  const payload: Payload = { ...grant, exp: Math.floor(now / 1000) + ttlSeconds };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

/** The grant inside a token, or null if it is forged, malformed or expired. */
export function verifyUploadToken(
  token: string,
  secret: string,
  now = Date.now(),
): UploadGrant | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    if (typeof p.key !== "string" || typeof p.mime !== "string" || !Number.isInteger(p.bytes)) {
      return null;
    }
    return { key: p.key, mime: p.mime, bytes: p.bytes };
  } catch {
    return null;
  }
}
