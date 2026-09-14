/**
 * Testes para o módulo googleSheetsSync.ts
 *
 * Estratégia: intercepta global.fetch para capturar as chamadas
 * e verifica que o payload enviado via GET ?dados= está correto.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  syncClientToSheets,
  syncAppointmentToSheets,
  syncAnamnesisSubmissionToSheets,
  syncMaterialToSheets,
  syncStockMovementToSheets,
} from "./googleSheetsSync";

// ─── helpers ───────────────────────────────────────────────────────────────

function mockFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ sucesso: true }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getCapturedPayload(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  expect(fetchMock).toHaveBeenCalled();
  const callUrl: string = fetchMock.mock.calls[0][0];
  const url = new URL(callUrl);
  const dados = url.searchParams.get("dados");
  expect(dados).not.toBeNull();
  return JSON.parse(decodeURIComponent(dados!));
}

// ─── setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GOOGLE_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/TEST/exec";
  process.env.GOOGLE_SHEETS_SYNC_SECRET = "test-secret-123";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  delete process.env.GOOGLE_SHEETS_SYNC_SECRET;
});

// ─── testes ────────────────────────────────────────────────────────────────

describe("googleSheetsSync", () => {
  describe("syncClientToSheets", () => {
    it("deve enviar GET com payload de cliente correto", () => {
      const fetchMock = mockFetch();

      syncClientToSheets({
        id: 42,
        name: "Maria Silva",
        phone: "(11) 99999-0001",
        email: "maria@example.com",
        birthDate: "15/03/1990",
        city: "São Paulo",
        state: "SP",
      });

      const payload = getCapturedPayload(fetchMock);
      expect(payload.tipo).toBe("cliente");
      expect(payload.cliente_id).toBe("42");
      expect(payload.nome_completo).toBe("Maria Silva");
      expect(payload.email).toBe("maria@example.com");
      expect(payload.cidade).toBe("São Paulo");
      expect(payload.uf).toBe("SP");
      expect(payload.secret).toBe("test-secret-123");
    });

    it("deve formatar o telefone removendo caracteres não numéricos", () => {
      const fetchMock = mockFetch();
      syncClientToSheets({ id: 1, name: "Teste", phone: "(11) 98765-4321" });
      const payload = getCapturedPayload(fetchMock);
      expect(payload.telefone_whatsapp).toBe("11987654321");
    });

    it("deve extrair dia e mês do aniversário", () => {
      const fetchMock = mockFetch();
      syncClientToSheets({ id: 1, name: "Teste", birthDate: "25/12/1985" });
      const payload = getCapturedPayload(fetchMock);
      expect(payload.dia_aniversario).toBe("25");
      expect(payload.mes_aniversario).toBe("12");
    });
  });

  describe("syncAppointmentToSheets", () => {
    it("deve enviar GET com payload de agendamento correto", () => {
      const fetchMock = mockFetch();
      const startTime = new Date("2025-07-15T14:30:00");

      syncAppointmentToSheets({
        id: 100,
        clientId: 42,
        clientName: "João Costa",
        clientPhone: "11987654321",
        artistName: "Willian",
        startTime,
        service: "Tatuagem Tribal",
        status: "agendado",
        depositPaid: true,
        depositAmount: 150,
        totalPrice: 500,
      });

      const payload = getCapturedPayload(fetchMock);
      expect(payload.tipo).toBe("agendamento");
      expect(payload.agendamento_id).toBe("100");
      expect(payload.nome_cliente).toBe("João Costa");
      expect(payload.profissional).toBe("Willian");
      expect(payload.servico).toBe("Tatuagem Tribal");
      expect(payload.sinal_pago).toBe("sim");
      expect(payload.valor_sinal).toBe("150");
      expect(payload.valor_total).toBe("500");
    });
  });

  describe("syncAnamnesisSubmissionToSheets", () => {
    it("deve enviar GET com payload de submissão de anamnese correto", () => {
      const fetchMock = mockFetch();

      syncAnamnesisSubmissionToSheets({
        id: 7,
        clientId: 42,
        appointmentId: 100,
        submittedAt: new Date("2025-07-15T10:00:00"),
      });

      const payload = getCapturedPayload(fetchMock);
      expect(payload.tipo).toBe("anamnese");
      expect(payload.anamnese_id).toBe("SUB-7");
      expect(payload.cliente_id).toBe("42");
      expect(payload.agendamento_id).toBe("100");
    });
  });

  describe("syncMaterialToSheets", () => {
    it("deve enviar GET com payload de material correto", () => {
      const fetchMock = mockFetch();

      syncMaterialToSheets({
        id: 5,
        category: "Tintas",
        model: "Tinta Preta Dynamic",
        currentStock: 50,
        unit: "ml",
        minStock: 20,
        criticalStock: 10,
      });

      const payload = getCapturedPayload(fetchMock);
      expect(payload.tipo).toBe("estoque");
      expect(payload.item_id).toBe("5");
      expect(payload.categoria).toBe("Tintas");
      expect(payload.quantidade_atual).toBe("50");
      expect(payload.status_estoque).toBe("normal");
    });

    it("deve calcular status_estoque como crítico quando abaixo do limite crítico", () => {
      const fetchMock = mockFetch();
      syncMaterialToSheets({
        id: 1,
        model: "Item Crítico",
        currentStock: 3,
        minStock: 10,
        criticalStock: 5,
      });
      const payload = getCapturedPayload(fetchMock);
      expect(payload.status_estoque).toBe("critico");
    });

    it("deve calcular status_estoque como baixo quando entre crítico e mínimo", () => {
      const fetchMock = mockFetch();
      syncMaterialToSheets({
        id: 1,
        model: "Item Baixo",
        currentStock: 7,
        minStock: 10,
        criticalStock: 5,
      });
      const payload = getCapturedPayload(fetchMock);
      expect(payload.status_estoque).toBe("baixo");
    });
  });

  describe("syncStockMovementToSheets", () => {
    it("deve enviar GET com payload de movimentação correto", () => {
      const fetchMock = mockFetch();

      syncStockMovementToSheets({
        id: 20,
        materialId: 5,
        movementType: "saida",
        quantity: 10,
        unit: "ml",
        reason: "Uso em procedimento",
        responsible: "Willian",
        createdAt: new Date("2025-07-15T15:00:00"),
      });

      const payload = getCapturedPayload(fetchMock);
      expect(payload.tipo).toBe("movimentacao_estoque");
      expect(payload.movimento_id).toBe("20");
      expect(payload.item_id).toBe("5");
      expect(payload.tipo_movimento).toBe("saida");
      expect(payload.quantidade).toBe("10");
      expect(payload.responsavel).toBe("Willian");
    });
  });

  describe("sem configuração", () => {
    it("não deve chamar fetch quando GOOGLE_SHEETS_WEBHOOK_URL não está configurada", () => {
      const savedUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      const savedSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET;
      delete process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      delete process.env.GOOGLE_SHEETS_SYNC_SECRET;

      const fetchMock = mockFetch();
      syncClientToSheets({ id: 1, name: "Teste" });
      expect(fetchMock).not.toHaveBeenCalled();

      process.env.GOOGLE_SHEETS_WEBHOOK_URL = savedUrl;
      process.env.GOOGLE_SHEETS_SYNC_SECRET = savedSecret;
    });
  });
});
