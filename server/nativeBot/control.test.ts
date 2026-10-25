import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  rows: vi.fn(),
  exec: vi.fn(),
  audit: vi.fn(),
  settings: vi.fn(),
  profile: vi.fn(),
  changed: vi.fn(),
  ai: vi.fn(),
  transaction: {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
  },
}));
vi.mock("./database", () => ({
  rows: db.rows,
  exec: db.exec,
  botAudit: db.audit,
  botPool: () => ({}),
  utcSql: () => "2026-10-25 01:00:00",
  withBotLock: async (_name: string, fn: any) => fn(db.transaction),
}));
vi.mock("./access", () => ({ settings: db.settings, getProfile: db.profile }));
vi.mock("./providers", () => ({
  askBotAi: db.ai,
  zapi: vi.fn(),
  safeBotError: () => "Erro",
  BotProviderError: class extends Error {},
}));
vi.mock("./qr", () => ({
  isQrBot: () => false,
  ownsQrSession: () => false,
  sendQr: vi.fn(),
}));
vi.mock("./events", () => ({ inboxChanged: db.changed }));
vi.mock("./attachments", () => ({ loadAttachment: vi.fn() }));
vi.mock("./receipts", () => ({ reconcileDeliveryStatus: vi.fn() }));
vi.mock("../appointmentActions", () => ({
  issueAppointmentActionLinks: vi.fn(),
  formatAppointmentActionLinks: vi.fn(),
}));
import { defaultBotConfig } from "../../shared/nativeBot";
import {
  processBotInbound,
  resumeExpiredConversations,
  validateBotDelivery,
} from "./service";
const cv = {
  id: 21,
  studio_id: 7,
  artist_id: 3,
  client_id: null,
  phone: "5538999999999",
  name: "Teste",
  mode: "human",
  revision: 4,
  opted_out: 0,
  closed_at: null,
  pause_until: null,
};
const settings = {
  studio_id: 7,
  enabled: 0,
  wa_secret: "encrypted",
  wa_status: "connected",
  webhook_ready: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T01:00:00Z"));
  db.settings.mockResolvedValue(settings);
  db.profile.mockResolvedValue({
    enabled: true,
    version: 1,
    config: defaultBotConfig(),
  });
  db.exec.mockResolvedValue({ affectedRows: 1 });
  db.rows.mockImplementation(async (sql: string) =>
    sql.includes("SELECT name FROM studios")
      ? [{ name: "Estúdio" }]
      : sql.includes("SELECT name FROM artists")
        ? [{ name: "Artista" }]
        : []
  );
});
afterEach(() => vi.useRealTimers());
describe("automação e atendimento manual independentes", () => {
  it("permite entrega manual com automação global desligada", async () => {
    expect(
      await validateBotDelivery(
        { role: "staff", expected_revision: 4 },
        cv,
        settings as any,
        {} as any
      )
    ).toBeNull();
  });
  it("bloqueia entrega automática com automação global desligada", async () => {
    expect(
      await validateBotDelivery(
        { role: "bot", expected_revision: 4 },
        cv,
        settings as any,
        {} as any
      )
    ).toContain("pausado");
  });
  it("não cancela resposta manual porque o assistente selecionado foi desativado", async () => {
    expect(
      await validateBotDelivery(
        { role: "staff", expected_revision: 4 },
        { ...cv, assistant_id: 99 },
        settings as any,
        {} as any
      )
    ).toBeNull();
    expect(
      db.rows.mock.calls.some(c => c[0].includes("tatuei_bot_assistants"))
    ).toBe(false);
  });
  it("continua bloqueando opt-out e atendimento encerrado para a equipe", async () => {
    expect(
      await validateBotDelivery(
        { role: "staff", expected_revision: 4 },
        { ...cv, opted_out: 1 },
        settings as any,
        {} as any
      )
    ).toContain("interrompeu");
    expect(
      await validateBotDelivery(
        { role: "staff", expected_revision: 4 },
        { ...cv, closed_at: "2026-10-25" },
        settings as any,
        {} as any
      )
    ).toContain("encerrado");
  });
  it("não consulta IA nem cria resposta durante pausa humana", async () => {
    db.rows.mockResolvedValue([cv]);
    db.settings.mockResolvedValue({ ...settings, enabled: 1 });
    await processBotInbound(
      { conversation_id: 21, studio_id: 7, body: "Quero uma tatuagem", id: 4 },
      {} as any
    );
    expect(db.ai).not.toHaveBeenCalled();
    expect(db.exec).not.toHaveBeenCalled();
  });
  it("expiração descarta backlog antes de retomar e não gera nova mensagem", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("WHERE mode='human'")
        ? [{ id: 21 }]
        : sql.includes("FOR UPDATE")
          ? [{ ...cv, pause_until: "2026-10-25 00:59:00" }]
          : []
    );
    await resumeExpiredConversations();
    const operations = db.exec.mock.calls.map(c => c[0]);
    expect(operations[0]).toContain("status='processed'");
    expect(operations[1]).toContain("SET mode=?");
    expect(operations.some(sql => sql.startsWith("INSERT"))).toBe(false);
    expect(db.transaction.commit).toHaveBeenCalledOnce();
    expect(db.changed).toHaveBeenCalledWith(7);
  });
  it("não retoma opt-out mesmo quando a consulta de candidatos ficou desatualizada", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("WHERE mode='human'")
        ? [{ id: 21 }]
        : sql.includes("FOR UPDATE")
          ? [{ ...cv, opted_out: 1, pause_until: "2026-10-25 00:59:00" }]
          : []
    );
    await resumeExpiredConversations();
    expect(db.exec).not.toHaveBeenCalled();
  });
});
