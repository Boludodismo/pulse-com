import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import QuotePreview from "../client/src/components/quotes/QuotePreview";
import { buildEmptyQuoteEditorData, encodeQuoteModel, decodeQuoteModel, quoteCover, quoteMediaSchema, resolveQuoteText, DEFAULT_CONCEPT_PRESETS, personalizedConceptPreset, reusableQuoteText } from "../shared/quoteProposal";

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


describe("personalized concept presets", () => {
  it.each(DEFAULT_CONCEPT_PRESETS)("personalizes $name without retaining the previous client", preset => {
    const editor = buildEmptyQuoteEditorData(); editor.project.concept = preset.content;
    const original = JSON.stringify(editor);
    expect(resolveQuoteText(editor, "  Gabriel   Henrique ").project.concept).toContain("Gabriel,");
    expect(resolveQuoteText(editor, "Ágatha Cunha").project.concept).toContain("Ágatha,");
    expect(resolveQuoteText(editor, "Ágatha Cunha").project.concept).not.toContain("Gabriel");
    expect(resolveQuoteText(editor, "Ágatha Cunha").project.concept).not.toContain("Cunha");
    expect(JSON.stringify(editor)).toBe(original);
  });
  it("adapts a saved generic concept once and preserves artist edits", () => {
    const text = "Projeto autoral. Manter o detalhe escolhido pelo artista.";
    const template = personalizedConceptPreset(text);
    expect(template).toBe("{primeiro_nome}, " + text);
    expect(personalizedConceptPreset(template)).toBe(template);
    expect(personalizedConceptPreset("Olá, {primeiro_nome}! Seu projeto.")).toBe("Olá, {primeiro_nome}! Seu projeto.");
    expect(personalizedConceptPreset("")).toBe("");
    const editor = buildEmptyQuoteEditorData(); editor.project.concept = template;
    const finalized = resolveQuoteText(editor, "João da Silva");
    expect(finalized.project.concept).toBe("João, " + text);
    expect(resolveQuoteText(finalized, "Maria Souza").project.concept).toBe(finalized.project.concept);
  });
  it("stores reusable text without the selected client's literal full or first name", () => {
    expect(reusableQuoteText("João da Silva, João escolheu a arte.", "João da Silva")).toBe("{primeiro_nome}, {primeiro_nome} escolheu a arte.");
    expect(reusableQuoteText("Ana, manter Anabela e banana.", "Ana Maria")).toBe("{primeiro_nome}, manter Anabela e banana.");
    expect(reusableQuoteText("Olá, Ana (M.)!", "Ana (M.)")).toBe("Olá, {primeiro_nome}!");
    expect(reusableQuoteText("Texto livre")).toBe("Texto livre");
  });
  it("renders every default concept for the client without exposing template variables", () => {
    for (const preset of DEFAULT_CONCEPT_PRESETS) {
      const editor = buildEmptyQuoteEditorData(); editor.project.concept = preset.content;
      const html = renderToStaticMarkup(createElement(QuotePreview, { editor, identity: { client: { name: "Maria Fernanda" }, artist: { name: "Artista" }, studio: { name: "Estúdio" } }, createdDate: "2026-10-13", validUntil: "2026-10-28" }));
      expect(html).toContain("Maria,"); expect(html).not.toContain("{primeiro_nome}");
    }
  });
});
