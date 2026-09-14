import { describe, expect, it, vi } from "vitest";
vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({
    url: `/api/storage?key=${encodeURIComponent(key)}&token=test`,
  })),
}));
import { storagePut } from "./storage";
import { decodeAvatar, saveArtistAvatar } from "./artistAvatar";
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7kAAAAASUVORK5CYII=";
describe("Foto de artista", () => {
  it("envia a foto ao storage e devolve o endereço persistente para o cadastro", async () => {
    const result = await saveArtistAvatar(10, {
      imageBase64: `data:image/png;base64,${png}`,
      mimeType: "image/png",
    });
    expect(result.photoKey).toMatch(/^artists\/10\/avatars\/.+\.png$/);
    expect(result.photoUrl).toContain("/api/storage?");
    expect(storagePut).toHaveBeenCalledWith(
      result.photoKey,
      Buffer.from(png, "base64"),
      "image/png"
    );
  });
  it("rejeita conteúdo que não corresponde ao formato declarado", () => {
    expect(() =>
      decodeAvatar({ imageBase64: png, mimeType: "image/jpeg" })
    ).toThrow();
    expect(() =>
      decodeAvatar({
        imageBase64: Buffer.from("<html>erro</html>").toString("base64"),
        mimeType: "image/png",
      })
    ).toThrow();
  });
  it("rejeita imagem maior que 5MB", () => {
    const large = Buffer.concat([
      Buffer.from(png, "base64"),
      Buffer.alloc(5 * 1024 * 1024),
    ]);
    expect(() =>
      decodeAvatar({
        imageBase64: large.toString("base64"),
        mimeType: "image/png",
      })
    ).toThrow();
  });
});
