import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/trpc", () => {
  const endpoint = {
    useQuery: () => ({ data: null, isLoading: false }),
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  };
  return {
    trpc: {
      useUtils: () => ({ studioRelations: { card: { invalidate: vi.fn() } } }),
      studioRelations: new Proxy({}, { get: () => endpoint }),
    },
  };
});
vi.mock("./ui/dialog", async original => ({
  ...(await original<typeof import("./ui/dialog")>()),
  ...Object.fromEntries(
    [
      "Dialog",
      "DialogContent",
      "DialogHeader",
      "DialogTitle",
      "DialogDescription",
    ].map(key => [key, ({ children }: any) => children])
  ),
}));
vi.mock("./artist-card/ArtistEditorialCard", () => ({ default: () => null }));
vi.mock("./artist-card/CardImageEditor", () => ({ default: () => null }));
import ArtistCardEditor from "./ArtistCardEditor";

describe("artist card final save action", () => {
  it("puts the single save button after the photos, portfolio and sharing permission, associated with the card form", () => {
    const html = renderToStaticMarkup(
      createElement(ArtistCardEditor, { artistId: 7, name: "Artista" })
    );
    const submits = html.match(/<button[^>]*type="submit"[^>]*>/g) ?? [];
    expect(submits).toHaveLength(1);
    expect(submits[0]).toContain('form="artist-card-form-7"');
    expect(html).toContain('<form id="artist-card-form-7"');
    const saveAt = html.lastIndexOf("Salvar cartão");
    expect(saveAt).toBeGreaterThan(html.indexOf("Fotografias da apresentação"));
    expect(saveAt).toBeGreaterThan(html.indexOf("Portfólio"));
    expect(saveAt).toBeGreaterThan(
      html.indexOf("Autorizar compartilhamento do link")
    );
    expect(html).toContain("A escolha vale para todos os cartões enviados");
  });
});
