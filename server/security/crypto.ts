import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { ENV } from "../_core/env";

function key(context: string) {
  if (Buffer.byteLength(ENV.authSecurityKey) < 32)
    throw new Error("AUTH_SECURITY_KEY deve ter pelo menos 32 bytes.");
  return Buffer.from(
    hkdfSync("sha256", ENV.authSecurityKey, "tatuei-auth-v1", context, 32)
  );
}
export function digest(value: string) {
  return createHmac("sha256", key("token-digest")).update(value).digest("hex");
}
export function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function credentialVersion(
  user: {
    id: number;
    passwordHash: string | null;
    role?: string;
    email?: string | null;
  },
  version: number
) {
  return digest(
    `credentials:${user.id}:${user.passwordHash ?? ""}:${user.role ?? ""}:${user.email ?? ""}:${version}`
  );
}
export function encryptSecret(secret: string, userId: number) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("totp-storage"), iv);
  cipher.setAAD(Buffer.from(`totp:${userId}`));
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptSecret(value: string, userId: number) {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key("totp-storage"),
    data.subarray(0, 12)
  );
  decipher.setAAD(Buffer.from(`totp:${userId}`));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(data: Buffer) {
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function fromBase32(secret: string) {
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const char of secret) {
    const n = alphabet.indexOf(char);
    if (n < 0) throw new Error("Invalid TOTP secret");
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
export function totp(secret: string, counter: number, digits = 6) {
  const moving = Buffer.alloc(8);
  moving.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", fromBase32(secret)).update(moving).digest();
  const offset = hash[hash.length - 1] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits)
    .toString()
    .padStart(digits, "0");
}
export function verifyTotp(
  secret: string,
  code: string,
  lastCounter = -1,
  now = Date.now()
) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const counter of [current, current - 1, current + 1]) {
    if (counter > lastCounter && equal(totp(secret, counter), code))
      return counter;
  }
  return null;
}
