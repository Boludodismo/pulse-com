import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuickQuoteField from "../client/src/components/quotes/QuickQuoteField";
import { QUOTE_DURATION_OPTIONS } from "../shared/quoteProposal";

describe("scrollable quote selection fields", () => {
  it("offers both entry modes, half-hour increments and a selected duration", () => {
    const html = renderToStaticMarkup(createElement(QuickQuoteField, { label: "Tempo estimado", value: "1 hora e 30 minutos", options: QUOTE_DURATION_OPTIONS, onChange: () => {} }));
    expect(html).toContain("Escolher na lista"); expect(html).toContain("Digitar manualmente");
    expect(html).toContain("overflow-y-auto"); expect(html).toContain("touch-action:pan-y");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("1 hora"); expect(html).toContain("1 hora e 30 minutos"); expect(html).toContain("2 horas e 30 minutos");
    expect(html).toContain("Texto no orçamento:");
  });
  it("retains a previously entered custom value while offering installment choices", () => {
    const html = renderToStaticMarkup(createElement(QuickQuoteField, { label: "Parcelamento", value: "4x com entrada", options: ["À vista", "Até 3x no cartão de crédito", "Até 18x no cartão de crédito"], onChange: () => {} }));
    expect(html).toContain("4x com entrada"); expect(html).toContain("Até 18x no cartão de crédito");
    expect(html).toContain("Não informar"); expect(html).not.toContain("<select");
  });
});
