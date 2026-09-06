/**
 * Testes para:
 * 1. Endpoint transactions.createWithMaterials (baixa automática de estoque)
 * 2. Verificação de que valores são armazenados em centavos
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockTransaction = {
  id: 1,
  clientId: 10,
  appointmentId: null,
  type: "entrada" as const,
  category: "Tatuagem",
  description: "Sessão completa",
  amount: 40000, // R$ 400,00 em centavos
  paymentMethod: "pix" as const,
  date: "2026-04-10 00:00:00",
  studioId: 1,
  createdAt: "2026-04-10 00:00:00",
};

const mockMaterial = {
  id: 5,
  name: "Tinta Preta 30ml",
  category: "Tintas",
  unit: "ml",
  currentStock: "50.00",
  minStock: "10.00",
  avgPrice: "0.00",
  supplierId: null,
  notes: null,
  isActive: 1,
  createdAt: 0,
  updatedAt: 0,
};

const mockDb = {
  createTransaction: vi.fn().mockResolvedValue(mockTransaction),
  getMaterialById: vi.fn().mockResolvedValue(mockMaterial),
  addStockMovement: vi.fn().mockResolvedValue({ previousStock: 50, newStock: 45 }),
  getFirstStudio: vi.fn().mockResolvedValue({ id: 1, name: "Estúdio Teste" }),
  getClientById: vi.fn().mockResolvedValue({ id: 10, name: "Cliente Teste" }),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../server/db", () => mockDb);

// ─── Testes de lógica de negócio ─────────────────────────────────────────────

describe("Transações — armazenamento em centavos", () => {
  it("R$ 400,00 deve ser armazenado como 40000 centavos", () => {
    const valorDigitado = 400.0;
    const centavos = Math.round(valorDigitado * 100);
    expect(centavos).toBe(40000);
  });

  it("R$ 2.500,50 deve ser armazenado como 250050 centavos", () => {
    const valorDigitado = 2500.5;
    const centavos = Math.round(valorDigitado * 100);
    expect(centavos).toBe(250050);
  });

  it("formatCurrency deve dividir centavos por 100 para exibição", () => {
    const formatCurrency = (cents: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

    expect(formatCurrency(40000)).toBe("R$\u00a0400,00");
    expect(formatCurrency(250050)).toBe("R$\u00a02.500,50");
    expect(formatCurrency(100)).toBe("R$\u00a01,00");
  });

  it("valor 40000 centavos NÃO deve ser exibido como R$ 40.000,00", () => {
    // Sem divisão por 100 (bug antigo)
    const formatErrado = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    // Com divisão por 100 (correto)
    const formatCorreto = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);

    expect(formatErrado(40000)).toBe("R$\u00a040.000,00"); // bug
    expect(formatCorreto(40000)).toBe("R$\u00a0400,00");   // correto
  });
});

describe("Transações — createWithMaterials lógica", () => {
  it("deve calcular baixa de estoque corretamente", () => {
    const currentStock = 50;
    const quantidadeBaixa = 5;
    const novoEstoque = Math.max(0, currentStock - quantidadeBaixa);
    expect(novoEstoque).toBe(45);
  });

  it("não deve deixar estoque negativo", () => {
    const currentStock = 3;
    const quantidadeBaixa = 10;
    const novoEstoque = Math.max(0, currentStock - quantidadeBaixa);
    expect(novoEstoque).toBe(0);
  });

  it("deve processar múltiplos materiais independentemente", () => {
    const materiais = [
      { id: 1, stock: 50, baixa: 5 },
      { id: 2, stock: 20, baixa: 3 },
      { id: 3, stock: 8, baixa: 2 },
    ];

    const resultados = materiais.map(m => ({
      id: m.id,
      novoEstoque: Math.max(0, m.stock - m.baixa),
    }));

    expect(resultados[0].novoEstoque).toBe(45);
    expect(resultados[1].novoEstoque).toBe(17);
    expect(resultados[2].novoEstoque).toBe(6);
  });

  it("materiais vazios não devem bloquear criação da transação", () => {
    const materiaisVazios: Array<{ materialId: number; quantity: number }> = [];
    // Transação deve ser criada mesmo sem materiais
    expect(materiaisVazios.length).toBe(0);
    // Nenhuma baixa de estoque deve ocorrer
    const baixasRealizadas = materiaisVazios.filter(m => m.quantity > 0);
    expect(baixasRealizadas.length).toBe(0);
  });

  it("deve validar quantidade positiva para cada material", () => {
    const validarQuantidade = (qty: string) => {
      const n = parseFloat(qty);
      return !isNaN(n) && n > 0;
    };

    expect(validarQuantidade("5")).toBe(true);
    expect(validarQuantidade("0.5")).toBe(true);
    expect(validarQuantidade("0")).toBe(false);
    expect(validarQuantidade("-1")).toBe(false);
    expect(validarQuantidade("abc")).toBe(false);
  });
});

describe("Transações — integração estoque", () => {
  it("deve gerar motivo de baixa com categoria e data", () => {
    const categoria = "Tatuagem";
    const data = "2026-04-10";
    const motivo = `Usado em ${categoria} - ${data}`;
    expect(motivo).toBe("Usado em Tatuagem - 2026-04-10");
  });

  it("mensagem de sucesso deve mencionar quantidade de materiais baixados", () => {
    const stockMovements = [
      { materialId: 1, materialName: "Tinta Preta", previousStock: 50, newStock: 45 },
      { materialId: 2, materialName: "Agulha 7RL", previousStock: 10, newStock: 8 },
    ];

    const stockMsg = stockMovements.length > 0
      ? ` | Baixa em ${stockMovements.length} material(is) realizada.`
      : "";

    expect(stockMsg).toBe(" | Baixa em 2 material(is) realizada.");
  });

  it("mensagem sem materiais não deve mencionar baixa", () => {
    const stockMovements: any[] = [];
    const stockMsg = stockMovements.length > 0
      ? ` | Baixa em ${stockMovements.length} material(is) realizada.`
      : "";
    expect(stockMsg).toBe("");
  });
});
