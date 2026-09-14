import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const value = process.env.BOTCONVERSA_ENCRYPTION_KEY;
  if (!value) throw new Error("A chave de criptografia BotConversa não está configurada.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("A chave de criptografia BotConversa deve possuir 32 bytes.");
  return key;
}

/** Criptografa credenciais no servidor com AES-256-GCM e versão explícita. */
export function encryptIntegrationSecret(value: string): string {
  if (!value) throw new Error("Não é possível criptografar um valor vazio.");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTION_VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** Decriptografa credenciais apenas na camada de integração do servidor. */
export function decryptIntegrationSecret(ciphertext: string): string {
  const [version, rawIv, rawTag, rawEncrypted, ...extra] = ciphertext.split(".");
  if (version !== ENCRYPTION_VERSION || !rawIv || !rawTag || !rawEncrypted || extra.length) {
    throw new Error("Formato de credencial criptografada inválido.");
  }
  const iv = Buffer.from(rawIv, "base64url");
  const tag = Buffer.from(rawTag, "base64url");
  const encrypted = Buffer.from(rawEncrypted, "base64url");
  if (iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) throw new Error("Metadados de credencial inválidos.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function createConnectionKey(): string {
  return randomBytes(32).toString("base64url");
}

export function hashIntegrationPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function createWebhookSignature(payload: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${payload}`).digest("hex");
}

export function isWebhookSignatureValid(payload: string, secret: string, signature?: string): boolean {
  if (!signature) return false;
  // Preferência: assinatura SHA-256 calculada sobre o payload.
  if (/^[a-f0-9]{64}$/i.test(signature)) {
    const expected = Buffer.from(createWebhookSignature(payload, secret), "hex");
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  // O Bloco de Integração do BotConversa permite cabeçalhos estáticos,
  // mas não calcula HMAC arbitrário. O segredo exclusivo da conexão é
  // aceito apenas no cabeçalho e comparado em tempo constante.
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function maskSecret(value?: string | null): string | null {
  return value ? "••••••••••••••••" : null;
}
