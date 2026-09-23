import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
// Reuses only the platform's encryption material, never another provider's API credentials.
function key(studioId: number) {
  const source =
    process.env.NATIVE_BOT_ENCRYPTION_KEY ||
    process.env.BOTCONVERSA_ENCRYPTION_KEY;
  if (!source || Buffer.from(source, "base64").length !== 32)
    throw new Error("Proteção das credenciais não configurada no servidor.");
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(source, "base64"),
      "tatuei-native-bot-v1",
      String(studioId),
      32
    )
  );
}
export function sealBotSecret(value: string, studioId: number) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(studioId), iv);
  cipher.setAAD(Buffer.from(String(studioId)));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}
export function openBotSecret(value: string, studioId: number) {
  const [v, iv, tag, body, ...extra] = value.split(".");
  if (v !== "v1" || !iv || !tag || !body || extra.length)
    throw new Error("Credencial inválida.");
  const c = createDecipheriv(
    "aes-256-gcm",
    key(studioId),
    Buffer.from(iv, "base64url")
  );
  c.setAAD(Buffer.from(String(studioId)));
  c.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    c.update(Buffer.from(body, "base64url")),
    c.final(),
  ]).toString("utf8");
}
