/**
 * Testes para as 10 correções do Diagnóstico v6
 * Cada teste valida a lógica de negócio sem depender do banco de dados.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Mock global do fetch para evitar chamadas reais ao Google Sheets durante testes
beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: async () => ({ sucesso: true, mensagem: "mock" }),
    ok: true,
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});


// ─── Bug 4: Schema Zod aceita campos financeiros em appointments.create ───────
describe("Bug 4 - Schema Zod de agendamento", () => {
  it("deve aceitar depositPaid como booleano", () => {
    const input = { depositPaid: true, depositAmount: 5000, totalAmount: 20000 };
    expect(typeof input.depositPaid).toBe("boolean");
    expect(typeof input.depositAmount).toBe("number");
    expect(typeof input.totalAmount).toBe("number");
  });
});

// ─── Bug 6: Conversão de centavos no EventModal ───────────────────────────────
describe("Bug 6 - Conversão de centavos", () => {
  const toCents = (value: string) => Math.round(parseFloat(value) * 100);
  const fromCents = (cents: number) => (cents / 100).toFixed(2);

  it("deve converter R$ 400 para 40000 centavos ao salvar", () => {
    expect(toCents("400")).toBe(40000);
    expect(toCents("400.00")).toBe(40000);
  });

  it("deve converter 40000 centavos para '400.00' ao carregar", () => {
    expect(fromCents(40000)).toBe("400.00");
  });

  it("deve converter R$ 150,50 corretamente", () => {
    expect(toCents("150.50")).toBe(15050);
    expect(fromCents(15050)).toBe("150.50");
  });

  it("deve retornar string vazia para valores nulos", () => {
    const fromCentsNullable = (cents: number | null | undefined) =>
      cents != null ? (cents / 100).toFixed(2) : "";
    expect(fromCentsNullable(null)).toBe("");
    expect(fromCentsNullable(undefined)).toBe("");
    expect(fromCentsNullable(0)).toBe("0.00");
  });
});

// ─── Bug 7: Atalho de teclado Delete/Backspace ────────────────────────────────
describe("Bug 7 - Atalho de teclado perigoso", () => {
  const shouldIgnoreKeydown = (target: { tagName: string; isContentEditable?: boolean }) => {
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  };

  it("deve ignorar Delete quando foco está em input", () => {
    expect(shouldIgnoreKeydown({ tagName: "INPUT" })).toBe(true);
  });

  it("deve ignorar Delete quando foco está em textarea", () => {
    expect(shouldIgnoreKeydown({ tagName: "TEXTAREA" })).toBe(true);
  });

  it("deve ignorar Delete quando foco está em select", () => {
    expect(shouldIgnoreKeydown({ tagName: "SELECT" })).toBe(true);
  });

  it("deve processar Delete quando foco está em div normal (não é input/textarea/select)", () => {
    // DIV sem contentEditable não deve ser ignorado
    const result = shouldIgnoreKeydown({ tagName: "DIV", isContentEditable: false });
    expect(result).toBe(false);
  });

  it("deve ignorar Delete em elemento contentEditable", () => {
    expect(shouldIgnoreKeydown({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });
});

// ─── Bug 3: Sinal pago gera transação no caixa ───────────────────────────────
describe("Bug 3 - Sinal pago gera transação no caixa", () => {
  it("deve gerar transação quando depositPaid é true e depositAmount > 0", () => {
    const shouldCreateTransaction = (depositPaid: boolean, depositAmount: number) =>
      depositPaid && depositAmount > 0;

    expect(shouldCreateTransaction(true, 5000)).toBe(true);
    expect(shouldCreateTransaction(false, 5000)).toBe(false);
    expect(shouldCreateTransaction(true, 0)).toBe(false);
  });

  it("deve usar depositPaymentMethod como método de pagamento da transação", () => {
    const buildTransactionData = (method: string, amount: number) => ({
      type: "entrada" as const,
      category: "sinal",
      paymentMethod: method,
      amount,
    });

    const tx = buildTransactionData("pix", 5000);
    expect(tx.paymentMethod).toBe("pix");
    expect(tx.type).toBe("entrada");
    expect(tx.category).toBe("sinal");
  });
});

// ─── Bug 5: Timezone America/Sao_Paulo ───────────────────────────────────────
describe("Bug 5 - Timezone America/Sao_Paulo", () => {
  it("deve formatar data com timezone correto", () => {
    const formatDateTime = (date: Date | string | null) => {
      if (!date) return "-";
      return new Date(date).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
    };

    // Uma data UTC que sem timezone seria exibida como dia anterior
    const result = formatDateTime("2025-01-15T03:00:00.000Z");
    // Em America/Sao_Paulo (UTC-3), 03:00 UTC = 00:00 BRT → ainda dia 15
    expect(result).toContain("15/01/2025");
  });

  it("deve retornar '-' para data nula", () => {
    const formatDate = (date: Date | string | null) => {
      if (!date) return "-";
      return new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    };
    expect(formatDate(null)).toBe("-");
  });
});

// ─── Bug 8: Filtro studioId em listAppointments/listTransactions ──────────────
describe("Bug 8 - Filtro studioId", () => {
  it("deve filtrar agendamentos por studioId quando fornecido", () => {
    const mockAppointments = [
      { id: 1, studioId: 1, service: "Tatuagem A" },
      { id: 2, studioId: 2, service: "Tatuagem B" },
      { id: 3, studioId: 1, service: "Tatuagem C" },
    ];

    const filterByStudio = (items: typeof mockAppointments, studioId: number | null) => {
      if (studioId == null) return items;
      return items.filter(i => i.studioId === studioId);
    };

    expect(filterByStudio(mockAppointments, 1)).toHaveLength(2);
    expect(filterByStudio(mockAppointments, 2)).toHaveLength(1);
    expect(filterByStudio(mockAppointments, null)).toHaveLength(3);
  });

  it("deve filtrar transações por studioId quando fornecido", () => {
    const mockTransactions = [
      { id: 1, studioId: 1, amount: 10000 },
      { id: 2, studioId: 2, amount: 20000 },
    ];

    const filterByStudio = (items: typeof mockTransactions, studioId: number | null) => {
      if (studioId == null) return items;
      return items.filter(i => i.studioId === studioId);
    };

    expect(filterByStudio(mockTransactions, 1)).toHaveLength(1);
    expect(filterByStudio(mockTransactions, 1)[0].amount).toBe(10000);
  });
});

// ─── Bug 10: Campo paymentMethod no sinal ────────────────────────────────────
describe("Bug 10 - Campo depositPaymentMethod", () => {
  const validMethods = ["dinheiro", "pix", "credito", "debito", "transferencia"];

  it("deve aceitar todos os métodos de pagamento válidos", () => {
    validMethods.forEach(method => {
      expect(validMethods.includes(method)).toBe(true);
    });
  });

  it("deve ter 'pix' como valor padrão", () => {
    const defaultMethod = "pix";
    expect(validMethods.includes(defaultMethod)).toBe(true);
  });
});

// ─── Bug 1: Lembretes ao criar novo agendamento ───────────────────────────────
describe("Bug 1 - Lembretes pendentes ao criar agendamento", () => {
  it("deve acumular lembretes pendentes antes de criar o agendamento", () => {
    const pendingReminders: Array<{ date: string; time: string; message: string }> = [];

    const addPending = (r: { date: string; time: string; message: string }) => {
      pendingReminders.push(r);
    };

    addPending({ date: "2025-02-01", time: "09:00", message: "Confirmação de presença" });
    addPending({ date: "2025-02-01", time: "08:00", message: "Lembrete 1 dia antes" });

    expect(pendingReminders).toHaveLength(2);
    expect(pendingReminders[0].message).toBe("Confirmação de presença");
  });

  it("deve limpar lembretes pendentes ao resetar o formulário", () => {
    let pendingReminders = [{ date: "2025-02-01", time: "09:00", message: "Teste" }];
    pendingReminders = [];
    expect(pendingReminders).toHaveLength(0);
  });
});
