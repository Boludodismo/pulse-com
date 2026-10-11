import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import {
  cardImageEditSchema,
  pixelCrop,
  originalCardImageEdit,
} from "../shared/artistCardImage";
import { buildArtistVCard } from "../shared/artistCardContact";
import {
  parsePresentation,
  toPublicPresentation,
} from "../shared/artistCardPresentation";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  storagePut: vi.fn(),
  storageReadBuffer: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./storage", () => ({
  storagePut: mocks.storagePut,
  storageReadBuffer: mocks.storageReadBuffer,
}));
vi.mock("./saas", () => ({ isUserAccessActive: vi.fn(async () => true) }));
import {
  artistCardEditorialProcedures,
  projectPublicCard,
} from "./routers/artistCardEditorial";
import { router } from "./_core/trpc";
import { renderCardImage } from "./artistCardImage";
import { invitedRoutePermission } from "./invitedArtistAccess";

const cardRouter = router(artistCardEditorialProcedures);
const ctx = {
  user: { id: 1, studioId: 10, role: "admin" },
  studioId: 10,
} as any;
const key = "artists/10/6/card/cover/original.png";
const media = {
  key,
  url: "https://example.com/original.png",
  alt: "Capa",
  x: 10,
  y: 20,
};
const presentation = {
  version: 1 as const,
  tagline: "Texto preservado",
  cover: media,
  contact: { phone: "+5531999999999", email: "publico@example.com" },
};
const row = {
  id: 1,
  images: "[]",
  presentation: JSON.stringify(presentation),
  published: 1,
  headline: "Título preservado",
  description: "Biografia preservada",
  links: "[]",
};
function database(reads: any[][]) {
  const writes: any[] = [];
  const db: any = {
    select: () => {
      const rows = reads.shift() || [];
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => chain,
        innerJoin: () => chain,
        for: () => chain,
        then: (r: any) => Promise.resolve(rows).then(r),
      };
      return chain;
    },
    update: () => ({
      set: (values: any) => ({ where: async () => writes.push(values) }),
    }),
    insert: () => ({
      values: () => ({ onDuplicateKeyUpdate: async () => {} }),
    }),
    transaction: async (f: any) => f(db),
  };
  mocks.getDb.mockResolvedValue(db);
  return writes;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.storagePut.mockImplementation(async (key: string) => ({
    key,
    url: `https://example.com/${key}`,
  }));
});

describe("recorte real e restauração do cartão", () => {
  it("rejeita recorte fora da imagem e trata arredondamento na borda", () => {
    expect(
      cardImageEditSchema.safeParse({
        appearance: "color",
        crop: { x: 0.9, y: 0, width: 0.5, height: 1 },
      }).success
    ).toBe(false);
    expect(
      pixelCrop({ x: 0.999, y: 0, width: 0.001, height: 1 }, 333, 200)
    ).toEqual({ left: 332, top: 0, width: 1, height: 200 });
  });
  it("produz o recorte correto e preto e branco sem alterar a fonte", async () => {
    const source = await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 240, g: 20, b: 10 },
      },
    })
      .png()
      .toBuffer();
    const original = Buffer.from(source);
    const output = await renderCardImage(source, {
      crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      appearance: "bw",
    });
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([50, 40]);
    const { data } = await sharp(output)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(Math.abs(data[0] - data[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(data[1] - data[2])).toBeLessThanOrEqual(1);
    expect(source.equals(original)).toBe(true);
    expect(meta.exif).toBeUndefined();
  });
  it("respeita a orientação EXIF de fotos de celular antes de recortar", async () => {
    const source = await sharp({
      create: { width: 100, height: 80, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const output = await renderCardImage(source, originalCardImageEdit);
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([80, 100]);
    expect(meta.orientation).toBeUndefined();
    expect((await sharp(source).metadata()).orientation).toBe(6);
  });
  it("mantém a cor quando escolhida e limita a saída", async () => {
    const source = await sharp({
      create: {
        width: 3000,
        height: 1000,
        channels: 3,
        background: { r: 240, g: 20, b: 10 },
      },
    })
      .png()
      .toBuffer();
    const output = await renderCardImage(source, originalCardImageEdit);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(2048);
    const { data } = await sharp(output)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[0] - data[1]).toBeGreaterThan(100);
  });
  it("rejeita arquivo inválido em processamento", async () => {
    await expect(
      renderCardImage(Buffer.from("invalid"), originalCardImageEdit)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("salva uma cópia e mantém a fonte, os textos e os contatos", async () => {
    const writes = database([[{ id: 6, studioId: 10 }], [row]]);
    mocks.storageReadBuffer.mockResolvedValue(
      await sharp({
        create: { width: 80, height: 60, channels: 3, background: "red" },
      })
        .png()
        .toBuffer()
    );
    await cardRouter.createCaller(ctx).editPresentationImage({
      artistId: 6,
      slot: "cover",
      expectedKey: key,
      edit: originalCardImageEdit,
    });
    const result = JSON.parse(writes[0].presentation);
    expect(result.contact).toEqual(presentation.contact);
    expect(result.tagline).toBe(presentation.tagline);
    expect(result.cover.original).toEqual({ key, url: media.url });
    expect(result.cover.key).not.toBe(key);
    expect(result.cover.appearance).toBe("color");
    expect(mocks.storageReadBuffer).toHaveBeenCalledWith(key, 5 * 1024 * 1024);
    expect(Object.keys(writes[0])).toEqual(["presentation"]);
  });
  it("restaura a original sem reprocessar ou sobrescrever arquivos", async () => {
    const edited = {
      ...media,
      key: "artists/10/6/card/cover/edited/rendered.jpg",
      original: { key, url: media.url },
      edit: originalCardImageEdit,
      appearance: "bw",
    };
    const writes = database([
      [{ id: 6, studioId: 10 }],
      [
        {
          ...row,
          presentation: JSON.stringify({ ...presentation, cover: edited }),
        },
      ],
    ]);
    await cardRouter.createCaller(ctx).editPresentationImage({
      artistId: 6,
      slot: "cover",
      expectedKey: edited.key,
      edit: null,
    });
    const result = JSON.parse(writes[0].presentation);
    expect(result.cover.key).toBe(key);
    expect(result.cover.url).toBe(media.url);
    expect(result.cover.edit).toBeUndefined();
    expect(result.cover.appearance).toBe("color");
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.storageReadBuffer).not.toHaveBeenCalled();
  });
  it("rejeita uma versão antiga da foto antes de ler arquivos", async () => {
    const writes = database([[{ id: 6, studioId: 10 }], [row]]);
    await expect(
      cardRouter.createCaller(ctx).editPresentationImage({
        artistId: 6,
        slot: "cover",
        expectedKey: "old",
        edit: originalCardImageEdit,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(writes).toEqual([]);
    expect(mocks.storageReadBuffer).not.toHaveBeenCalled();
  });
  it("rejeita fonte de outro estúdio mesmo em metadados corrompidos", async () => {
    const writes = database([
      [{ id: 6, studioId: 10 }],
      [
        {
          ...row,
          presentation: JSON.stringify({
            ...presentation,
            cover: {
              ...media,
              original: {
                key: "artists/11/6/card/cover/file.jpg",
                url: media.url,
              },
            },
          }),
        },
      ],
    ]);
    await expect(
      cardRouter.createCaller(ctx).editPresentationImage({
        artistId: 6,
        slot: "cover",
        expectedKey: key,
        edit: originalCardImageEdit,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toEqual([]);
    expect(mocks.storageReadBuffer).not.toHaveBeenCalled();
  });
  it("restaura o portfólio preservando legenda, ordem e outras fotos", async () => {
    const workKey = "artists/10/6/portfolio/edited/file.jpg",
      original = { key: "artists/10/6/portfolio/original.png", url: media.url };
    const images = [
      {
        key: workKey,
        url: "https://example.com/edited.jpg",
        caption: "Legenda preservada",
        original,
        edit: originalCardImageEdit,
      },
      { key: "other", url: media.url, caption: "Outra" },
    ];
    const writes = database([
      [{ id: 6, studioId: 10 }],
      [{ ...row, images: JSON.stringify(images) }],
    ]);
    await cardRouter
      .createCaller(ctx)
      .editWorkImage({ artistId: 6, expectedKey: workKey, edit: null });
    const result = JSON.parse(writes[0].images);
    expect(result[0]).toMatchObject({
      key: original.key,
      caption: "Legenda preservada",
      url: original.url,
    });
    expect(result[1]).toEqual(images[1]);
    expect(Object.keys(writes[0])).toEqual(["images"]);
  });
});
describe("acesso privado e conteúdo público", () => {
  it("bloqueia edição por outro artista e acesso sem login", async () => {
    const writes = database([[{ id: 6, studioId: 10 }]]);
    await expect(
      cardRouter
        .createCaller({
          ...ctx,
          user: { ...ctx.user, role: "collaborator", artistId: 5 },
        })
        .editWorkImage({ artistId: 6, expectedKey: "key", edit: null })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes).toEqual([]);
    await expect(
      cardRouter
        .createCaller({ ...ctx, user: null })
        .setCardPublication({ artistId: 6, published: false })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("permite as rotas próprias do artista convidado", () => {
    for (const route of [
      "editPresentationImage",
      "editWorkImage",
      "setCardPublication",
    ])
      expect(invitedRoutePermission(`studioRelations.${route}`)).toBe("self");
  });
  it("pausa apenas a publicação, sem alterar textos nem fotos", async () => {
    const writes = database([[{ id: 6, studioId: 10 }], [row]]);
    await cardRouter
      .createCaller(ctx)
      .setCardPublication({ artistId: 6, published: false });
    expect(writes).toEqual([{ published: 0 }]);
  });
  it("não retorna cartão pausado na consulta pública", async () => {
    database([[]]);
    await expect(
      cardRouter
        .createCaller({ ...ctx, user: null })
        .publicCard({ token: "a".repeat(48) })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("inclui apenas contato escolhido e remove fontes e recortes da projeção pública", () => {
    const stored = {
      ...presentation,
      cover: {
        ...media,
        appearance: "color",
        original: {
          key: "private-original",
          url: "https://example.com/private.jpg",
        },
        edit: originalCardImageEdit,
      },
    };
    const publicCard = projectPublicCard({
      name: "Artista",
      photo: null,
      headline: "",
      description: "",
      links: "[]",
      images: JSON.stringify([{ ...stored.cover, caption: "Trabalho" }]),
      presentation: JSON.stringify(stored),
    });
    expect(publicCard.presentation?.contact).toEqual(presentation.contact);
    expect(JSON.stringify(publicCard)).not.toContain("private-original");
    expect(JSON.stringify(publicCard)).not.toContain("private.jpg");
    expect(publicCard.images[0]).toEqual({
      url: media.url,
      caption: "Trabalho",
      appearance: "color",
    });
    expect(
      toPublicPresentation(parsePresentation(row.presentation))?.cover
    ).toEqual(
      media && { url: media.url, alt: media.alt, x: media.x, y: media.y }
    );
  });
});
describe("contato compatível com importação em celular", () => {
  const card = {
    name: "João Artista",
    headline: "Tatuador",
    links: [{ label: "Instagram", url: "https://instagram.com/exemplo" }],
    presentation: {
      contact: { phone: "(31) 99999-9999", email: "contato@example.com" },
    },
  };
  const url = "https://crm.tatuei.com/artista/" + "a".repeat(48);
  it("inclui nome, contatos, cartão e links com CRLF", () => {
    const v = buildArtistVCard(card, url);
    expect(v).toContain("BEGIN:VCARD\r\nVERSION:3.0\r\n");
    expect(v).toContain("TEL;TYPE=CELL:31999999999");
    expect(v).toContain("EMAIL;TYPE=INTERNET:contato@example.com");
    expect(v.replace(/\r\n /g, "")).toContain("https://instagram.com/exemplo");
    expect(v).toContain("FN:João Artista");
  });
  it("escapa quebra de linha e mantém caracteres UTF-8 ao dobrar linhas", () => {
    const v = buildArtistVCard(
      { ...card, name: "Á".repeat(100) + "\nTEL:malicioso" },
      url
    );
    expect(v).not.toContain("\r\nTEL:malicioso");
    for (const line of v.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(v.replace(/\r\n /g, "")).toContain("Á".repeat(100));
  });
  it("permite HTTP apenas no desenvolvimento local, sem credenciais", () => {
    expect(
      buildArtistVCard(card, "http://127.0.0.1:3000/artista/teste")
    ).toContain("BEGIN:VCARD");
    expect(() =>
      buildArtistVCard(card, "http://crm.tatuei.com/artista/teste")
    ).toThrow();
    expect(() =>
      buildArtistVCard(card, "http://user:pass@localhost/artista/teste")
    ).toThrow();
  });
  it("gera contato compacto para QR sem links excessivos nem dados privados", () => {
    const v = buildArtistVCard(card, url, true);
    expect(v).not.toContain("instagram.com");
    expect(v).toContain("contato@example.com");
    expect(() => buildArtistVCard(card, "javascript:alert(1)")).toThrow();
  });
});
