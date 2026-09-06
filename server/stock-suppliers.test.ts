import { describe, it, expect } from "vitest";
import { buildWhatsAppOrderMessage } from "./db";

// ============ buildWhatsAppOrderMessage ============
describe("buildWhatsAppOrderMessage", () => {
  it("deve incluir o nome do fornecedor na mensagem", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Distribuidora Tattoo SP",
      items: [
        { materialName: "Cartucho 7RL", quantity: "10", materialUnit: "cx", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("Distribuidora Tattoo SP");
  });

  it("deve listar todos os itens com nome e quantidade", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Fornecedor X",
      items: [
        { materialName: "Tinta Preta 30ml", quantity: "5", materialUnit: "un", unitPrice: "0", notes: null },
        { materialName: "Luvas P", quantity: "2", materialUnit: "cx", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("Tinta Preta 30ml");
    expect(msg).toContain("Luvas P");
    expect(msg).toContain("5 un");
    expect(msg).toContain("2 cx");
  });

  it("deve incluir preço unitário quando maior que zero", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Fornecedor Y",
      items: [
        { materialName: "Agulha 3RL", quantity: "20", materialUnit: "un", unitPrice: "2.50", notes: null },
      ],
    });
    expect(msg).toContain("R$ 2.50");
  });

  it("não deve incluir preço quando for zero", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Fornecedor Y",
      items: [
        { materialName: "Agulha 3RL", quantity: "20", materialUnit: "un", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).not.toContain("R$ 0.00");
  });

  it("deve incluir observações do item quando presentes", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Fornecedor Z",
      items: [
        { materialName: "Tinta Vermelha", quantity: "3", materialUnit: "un", unitPrice: "0", notes: "Cor viva, não desbotada" },
      ],
    });
    expect(msg).toContain("Cor viva, não desbotada");
  });

  it("deve incluir observações gerais do pedido quando presentes", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Fornecedor W",
      notes: "Entregar até sexta-feira",
      items: [
        { materialName: "Filme PVC", quantity: "1", materialUnit: "rolo", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("Entregar até sexta-feira");
  });

  it("deve numerar os itens sequencialmente", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Fornecedor A",
      items: [
        { materialName: "Item 1", quantity: "1", materialUnit: "un", unitPrice: "0", notes: null },
        { materialName: "Item 2", quantity: "2", materialUnit: "un", unitPrice: "0", notes: null },
        { materialName: "Item 3", quantity: "3", materialUnit: "un", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("1. Item 1");
    expect(msg).toContain("2. Item 2");
    expect(msg).toContain("3. Item 3");
  });

  it("deve incluir cabeçalho 'PEDIDO DE ORÇAMENTO'", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Qualquer",
      items: [
        { materialName: "X", quantity: "1", materialUnit: "un", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("PEDIDO DE ORÇAMENTO");
  });

  it("deve incluir mensagem de encerramento amigável", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Qualquer",
      items: [
        { materialName: "X", quantity: "1", materialUnit: "un", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("orçamento");
  });

  it("deve lidar com supplierName null sem quebrar", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: null,
      items: [
        { materialName: "X", quantity: "1", materialUnit: "un", unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("N/A");
  });

  it("deve lidar com materialName null sem quebrar", () => {
    const msg = buildWhatsAppOrderMessage({
      supplierName: "Fornecedor",
      items: [
        { materialName: null, quantity: "1", materialUnit: null, unitPrice: "0", notes: null },
      ],
    });
    expect(msg).toContain("Item");
  });
});

// ============ Lógica de alerta de estoque mínimo ============
describe("Lógica de alerta de estoque mínimo", () => {
  const isLowStock = (current: number, min: number) => min > 0 && current <= min;
  const isEmpty = (current: number) => current <= 0;

  it("deve alertar quando estoque atual <= mínimo", () => {
    expect(isLowStock(5, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
  });

  it("não deve alertar quando estoque atual > mínimo", () => {
    expect(isLowStock(11, 10)).toBe(false);
    expect(isLowStock(100, 10)).toBe(false);
  });

  it("não deve alertar quando mínimo é zero (sem controle)", () => {
    expect(isLowStock(0, 0)).toBe(false);
    expect(isLowStock(5, 0)).toBe(false);
  });

  it("deve identificar estoque zerado corretamente", () => {
    expect(isEmpty(0)).toBe(true);
    expect(isEmpty(-1)).toBe(true);
    expect(isEmpty(0.1)).toBe(false);
  });
});

// ============ Lógica de movimentação de estoque ============
describe("Lógica de movimentação de estoque", () => {
  const calcNewStock = (current: number, type: "entrada" | "saida" | "ajuste", qty: number) => {
    if (type === "entrada") return current + qty;
    if (type === "saida") return Math.max(0, current - qty);
    return qty; // ajuste = novo valor absoluto
  };

  it("entrada deve somar ao estoque atual", () => {
    expect(calcNewStock(10, "entrada", 5)).toBe(15);
    expect(calcNewStock(0, "entrada", 3)).toBe(3);
  });

  it("saída deve subtrair do estoque atual", () => {
    expect(calcNewStock(10, "saida", 3)).toBe(7);
    expect(calcNewStock(10, "saida", 10)).toBe(0);
  });

  it("saída não deve resultar em estoque negativo", () => {
    expect(calcNewStock(5, "saida", 10)).toBe(0);
    expect(calcNewStock(0, "saida", 1)).toBe(0);
  });

  it("ajuste deve definir o novo valor absoluto", () => {
    expect(calcNewStock(10, "ajuste", 7)).toBe(7);
    expect(calcNewStock(0, "ajuste", 25)).toBe(25);
  });
});
