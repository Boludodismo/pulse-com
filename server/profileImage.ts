export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ProfileImageMime = keyof typeof MIME_EXTENSIONS;

function hasImageSignature(
  buffer: Buffer,
  mimeType: ProfileImageMime,
): boolean {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      buffer.length >= signature.length &&
      signature.every((byte, index) => buffer[index] === byte)
    );
  }
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function decodeProfileImage(
  fileData: string,
  mimeType: string,
): { buffer: Buffer; extension: string } {
  if (!(mimeType in MIME_EXTENSIONS)) {
    throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
  }

  const encoded = fileData.includes(",")
    ? fileData.slice(fileData.indexOf(",") + 1)
    : fileData;
  if (!encoded.trim()) {
    throw new Error("A imagem enviada está vazia.");
  }

  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length === 0) {
    throw new Error("Não foi possível ler a imagem.");
  }
  if (buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("A foto deve ter no máximo 5 MB.");
  }

  const supportedMime = mimeType as ProfileImageMime;
  if (!hasImageSignature(buffer, supportedMime)) {
    throw new Error(
      "O conteúdo do arquivo não corresponde a uma imagem válida.",
    );
  }

  return { buffer, extension: MIME_EXTENSIONS[supportedMime] };
}
