import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuotePreview from "../client/src/components/quotes/QuotePreview";
import { buildEmptyQuoteEditorData, quoteMediaSchema } from "../shared/quoteProposal";

describe("quote image descriptions in the customer document", () => {
  it("renders each image's own description, escapes markup and links to the published card", () => {
    const editor = buildEmptyQuoteEditorData();
    const image = (id: string) => quoteMediaSchema.parse({ key: id, url: `https://example.test/${id}.png`, description: `${id}: linha 1\n<script>linha 2</script>` });
    editor.media.clientReference = image("reference");
    editor.media.suggestedArtwork = image("artwork");
    editor.media.gallery = [image("gallery")];
    editor.additionalProjects = [{ id: "two", project: editor.project, images: [image("additional")] }];
    const props = { editor, identity: { client: { name: "Cliente" }, artist: { name: "Artista" }, studio: {} }, quoteNumber: "ORC-1", createdDate: "2026-09-26", validUntil: "2026-10-10" };
    const html = renderToStaticMarkup(createElement(QuotePreview, { ...props, artistCardUrl: "/artista/published-token" }));
    for (const id of ["reference", "artwork", "gallery", "additional"]) expect(html).toContain(`${id}: linha 1\n&lt;script&gt;linha 2&lt;/script&gt;`);
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="/artista/published-token"');
    expect(html).toContain("Acessar cartão virtual do artista");
    props.editor = buildEmptyQuoteEditorData();
    const empty = renderToStaticMarkup(createElement(QuotePreview, props));
    expect(empty).not.toContain("quote-image-description");
    expect(empty).not.toContain("quote-artist-card-link");
  });
});
