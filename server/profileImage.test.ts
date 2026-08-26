import { describe, expect, it } from "vitest";
import { decodeProfileImage, MAX_PROFILE_PHOTO_BYTES } from "./profileImage";

const asBase64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");

describe("decodeProfileImage", () => {
  it("aceita JPG, PNG e WebP pelas assinaturas reais", () => {
    expect(
      decodeProfileImage(asBase64([0xff, 0xd8, 0xff, 0x00]), "image/jpeg")
        .extension,
    ).toBe("jpg");
    expect(
      decodeProfileImage(
        asBase64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ).extension,
    ).toBe("png");
    expect(
      decodeProfileImage(
        Buffer.from("RIFF0000WEBP").toString("base64"),
        "image/webp",
      ).extension,
    ).toBe("webp");
  });

  it("recusa formato declarado que não é permitido", () => {
    expect(() =>
      decodeProfileImage(asBase64([0x47, 0x49, 0x46]), "image/gif"),
    ).toThrow("Formato inválido");
  });

  it("recusa arquivo com assinatura incompatível", () => {
    expect(() =>
      decodeProfileImage(asBase64([0x00, 0x01, 0x02]), "image/jpeg"),
    ).toThrow("não corresponde");
  });

  it("recusa arquivo acima de 5 MB", () => {
    const oversized = Buffer.alloc(MAX_PROFILE_PHOTO_BYTES + 1, 0);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    expect(() =>
      decodeProfileImage(oversized.toString("base64"), "image/jpeg"),
    ).toThrow("no máximo 5 MB");
  });
});
