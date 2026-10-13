import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import QuotePreview from "../client/src/components/quotes/QuotePreview";
import { buildEmptyQuoteEditorData, encodeQuoteModel, decodeQuoteModel, quoteCover, quoteMediaSchema, resolveQuoteText } from "../shared/quoteProposal";

const image = (n: number) => quoteMediaSchema.parse({ key: `quotes/1/2/media/${n}.png`, url: `https://example.test/${n}.png` });
describe("complete quote models and arbitrary cover", () => {
  it("retains reusable settings, clears all customer images and negotiated values and does not mutate the quote", () => {
    const editor = buildEmptyQuoteEditorData();
    editor.project.style = "Realismo preto e cinza"; editor.project.bodyRegion = "Antebraço";
    editor.project.concept = "Olá, {primeiro_nome}!"; editor.pricing.totalAmount = 250000; editor.pricing.depositAmount = 40000;
    editor.media.clientReference = image(1); editor.media.suggestedArtwork = image(2); editor.media.gallery = [image(3)]; editor.media.coverKey = image(3).key;
    editor.additionalProjects = [{ id: "customer-project", project: editor.project, images: [image(4)] }];
    const model = decodeQuoteModel(encodeQuoteModel(editor));
    expect(model.project).toEqual(editor.project); expect(model.media).toMatchObject({ coverKey: null, clientReference: null, suggestedArtwork: null, gallery: [] });
    expect(model.pricing).toMatchObject({ totalAmount: 0, depositAmount: 0 }); expect(model.additionalProjects[0].images).toEqual([]);
    expect(model.additionalProjects[0].id).not.toBe("customer-project"); expect(editor.media.gallery).toHaveLength(1); expect(editor.pricing.totalAmount).toBe(250000);
  });
  it("turns the selected customer's name in reusable message texts into a first-name field", () => {
    const editor = buildEmptyQuoteEditorData(); editor.project.concept = "Olá, João da Silva! João, confira sua proposta.";
    const model = decodeQuoteModel(encodeQuoteModel(editor, "João da Silva"));
    expect(model.project.concept).toBe("Olá, {primeiro_nome}! {primeiro_nome}, confira sua proposta.");
    expect(resolveQuoteText(model, "Ana Maria").project.concept).toBe("Olá, Ana! Ana, confira sua proposta.");
    editor.project.concept = "Olá, Ana (M.)! Anabela.";
    expect(decodeQuoteModel(encodeQuoteModel(editor, "Ana (M.)")).project.concept).toBe("Olá, {primeiro_nome}! Anabela.");
  });
  it("checks complete model size in bytes and rejects malformed models", () => {
    const editor = buildEmptyQuoteEditorData(); editor.project.concept = "😀".repeat(3900); editor.terms = editor.project.concept;
    editor.pricing.depositText = editor.project.concept; editor.pricing.installmentInfo = editor.project.concept;
    expect(() => encodeQuoteModel(editor)).toThrow("60 KB"); expect(() => decodeQuoteModel('{"clientId":3}')).toThrow();
  });
  it("uses the current customer's first name and each project's own region and size", () => {
    const editor = buildEmptyQuoteEditorData(); editor.project.bodyRegion = "Braço"; editor.project.sizeText = "18 cm";
    editor.project.concept = "Olá, {primeiro_nome}! {local_corpo}: {tamanho}";
    editor.additionalProjects = [{ id: "second", project: { ...editor.project, bodyRegion: "Perna", sizeText: "25 cm" }, images: [] }];
    expect(resolveQuoteText(editor, "Ana Maria").project.concept).toBe("Olá, Ana! Braço: 18 cm");
    expect(resolveQuoteText(editor, "Gabriel Henrique").additionalProjects[0].project.concept).toBe("Olá, Gabriel! Perna: 25 cm");
    expect(editor.project.concept).toContain("{primeiro_nome}");
  });
  it("renders a gallery cover and personalized texts while preserving the legacy cover fallback", () => {
    const editor = buildEmptyQuoteEditorData(); editor.media.clientReference = image(1); editor.media.gallery = [image(2)];
    expect(quoteCover(editor)?.key).toBe(image(1).key); editor.media.coverKey = image(2).key;
    editor.project.concept = "Olá, {primeiro_nome}!";
    const html = renderToStaticMarkup(createElement(QuotePreview, { editor, identity: { client: { name: "Ana Maria" }, artist: { name: "Artista" }, studio: { name: "Estúdio" } }, createdDate: "2026-10-13", validUntil: "2026-10-28" }));
    expect(quoteCover(editor)?.key).toBe(image(2).key); expect(html).toContain("Olá, Ana!"); expect(html).not.toContain("{primeiro_nome}");
    editor.media.gallery = []; expect(quoteCover(editor)).toBeNull();
  });
});
