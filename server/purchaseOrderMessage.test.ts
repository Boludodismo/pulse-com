import { describe, expect, it } from "vitest";
import {
  buildWhatsAppOrderMessage,
  formatQuoteItemLine,
  sanitizeCatalogItemName,
} from "./purchaseOrderMessage";

describe("purchase order message", () => {
  it("cleans repeated catalog segments and technical hyphens", () => {
    expect(
      sanitizeCatalogItemName({
        materialName: "Skin Ink · Round Liner · Round Liner 1005 · 1005-RL",
        materialCategory: "Cartuchos e agulhas",
        quantity: "1",
        materialUnit: "cx",
      }),
    ).toBe("Cartucho Skin Ink Round Liner 1005 RL");
  });

  it("removes internal metadata and duplicated SKU information", () => {
    expect(
      sanitizeCatalogItemName({
        materialName:
          "Easy Glow · Tintas Easy Glow · Cor a escolher 30 ml · EASY-30 · _Novo item selecionado no catálogo técnico_ · variantId: 87",
        materialCategory: "Tintas e pigmentos",
        quantity: 2,
        materialUnit: "frasco",
      }),
    ).toBe("Tinta Easy Glow Cor a escolher 30 ml");
  });

  it("formats each line in the supplier-friendly pattern", () => {
    expect(
      formatQuoteItemLine({
        materialName: "Skin Ink · Round Liner · 1005-RL",
        materialCategory: "Cartuchos e agulhas",
        quantity: "1.000",
        materialUnit: "cx",
      }),
    ).toBe("• 1 cx — Cartucho Skin Ink Round Liner 1005 RL");
  });

  it("builds the humanized message without prices, notes or database noise", () => {
    const message = buildWhatsAppOrderMessage({
      items: [
        {
          materialName: "Skin Ink · Round Liner · Round Liner 1005 · 1005-RL",
          materialCategory: "Cartuchos e agulhas",
          quantity: "1",
          materialUnit: "cx",
        },
      ],
    });

    expect(message).toContain(
      "Olá! Tudo bem?\n\nGostaria de fazer um orçamento",
    );
    expect(message).toContain(
      "📦 *Lista de Materiais:*\n• 1 cx — Cartucho Skin Ink Round Liner 1005 RL",
    );
    expect(message).toContain("Assim que me passarem os valores e o prazo");
    expect(message.endsWith("Obrigado!")).toBe(true);
    expect(message).not.toMatch(/Novo item|variantId|R\$/i);
  });
});
