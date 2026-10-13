import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuotePreview from "../client/src/components/quotes/QuotePreview";
import { buildEmptyQuoteEditorData, personalizeQuoteInformation, removeQuotePersonalization, resolveQuoteText, encodeQuoteModel, decodeQuoteModel, QUOTE_DURATION_NOTE, QUOTE_CARD_FEE_TEXT, QUOTE_DURATION_OPTIONS, DEFAULT_DEPOSIT_PRESETS, DEFAULT_INSTALLMENT_PRESETS, DEFAULT_TERMS_PRESETS } from "../shared/quoteProposal";

describe("informative quote personalization and selectors", () => {
  it("places the deposit vocative between commas and repairs the old appended marker", () => {
    const original = DEFAULT_DEPOSIT_PRESETS[0].content;
    const personalized = personalizeQuoteInformation(original + "{primeiro_nome}");
    expect(personalized).toBe(original.replace("O sinal ", "O sinal, {primeiro_nome}, "));
    expect(removeQuotePersonalization(personalized)).toBe(original);
    expect(personalizeQuoteInformation(personalized)).toBe(personalized);
  });
  it.each([...DEFAULT_DEPOSIT_PRESETS, ...DEFAULT_INSTALLMENT_PRESETS, ...DEFAULT_TERMS_PRESETS])("resolves $name for the selected first name without leftovers", preset => {
    const editor = buildEmptyQuoteEditorData();
    editor.terms = personalizeQuoteInformation(preset.content);
    expect(resolveQuoteText(editor, "Ágatha Cunha").terms).toContain("Ágatha,");
    expect(resolveQuoteText(editor, "Gabriel Henrique").terms).toContain("Gabriel,");
    expect(resolveQuoteText(editor, "").terms).not.toMatch(/\{primeiro_nome\}|^,|,\s*,/);
    expect(resolveQuoteText(editor, "Ágatha Cunha").terms).not.toContain("Cunha");
  });
  it("repairs markers in editable payloads without mutating the input", () => {
    const editor = buildEmptyQuoteEditorData(); editor.pricing.depositText = DEFAULT_DEPOSIT_PRESETS[0].content + "{primeiro_nome}";
    expect(resolveQuoteText(editor, "Ágatha").pricing.depositText).toContain("O sinal, Ágatha, confirma");
    expect(editor.pricing.depositText).toContain("{primeiro_nome}");
  });
  it("preserves selector choices in saved models and displays the duration note for each project", () => {
    const editor = buildEmptyQuoteEditorData(); editor.project.durationText = "3 horas";
    editor.pricing.installmentText = "Até 18x no cartão de crédito"; editor.pricing.passCardFees = true; editor.pricing.installmentInfo = QUOTE_CARD_FEE_TEXT;
    editor.additionalProjects = [{ id: "second", project: { ...editor.project, durationText: "30 minutos" }, images: [] }];
    const saved = decodeQuoteModel(encodeQuoteModel(editor));
    expect(saved.pricing.passCardFees).toBe(true); expect(saved.pricing.installmentText).toBe(editor.pricing.installmentText);
    expect(QUOTE_DURATION_OPTIONS).toContain("3 horas"); expect(QUOTE_DURATION_OPTIONS).toContain("2 horas e 30 minutos");
    const html = renderToStaticMarkup(createElement(QuotePreview, { editor: saved, identity: { client: { name: "Ágatha Cunha" }, artist: { name: "Artista" }, studio: { name: "Estúdio" } }, createdDate: "2026-10-13", validUntil: "2026-10-28" }));
    expect(html.split(QUOTE_DURATION_NOTE)).toHaveLength(3); expect(html).toContain(QUOTE_CARD_FEE_TEXT);
  });
});
