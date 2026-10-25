import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assistantSchema,
  automationBlocked,
  pauseExpired,
  pauseMinutesSchema,
} from "../../shared/botInbox";
import { validateAttachment } from "./attachments";

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  rows: vi.fn(),
  audit: vi.fn(),
  scope: vi.fn(),
  access: vi.fn(),
  mode: vi.fn(),
  private: vi.fn(),
  changed: vi.fn(),
  transaction: {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
  },
}));
vi.mock("./database", () => ({
  exec: mocks.exec,
  rows: mocks.rows,
  botAudit: mocks.audit,
  botPool: () => ({}),
  assertBotSchema: vi.fn(),
  utcSql: (d = new Date()) => d.toISOString().slice(0, 19).replace("T", " "),
  withBotLock: async (_name: string, fn: any) => fn(mocks.transaction),
}));
vi.mock("./access", () => ({
  scopedBotConversation: mocks.scope,
  accessBot: mocks.access,
  assertBotManager: (u: any) => {
    if (u.role !== "admin") throw new Error("Forbidden");
  },
}));
vi.mock("./service", () => ({ botThreadMode: mocks.mode }));
vi.mock("./qr", () => ({
  selectQr: vi.fn(),
  disconnectQr: vi.fn(),
  qrSnapshot: vi.fn(),
  isQrBot: () => false,
}));
vi.mock("./events", () => ({ inboxChanged: mocks.changed }));
vi.mock("../messaging/privateConnectionAccess", () => ({
  assertPrivateConnectionAccess: mocks.private,
}));
vi.mock("../saas", () => ({ isUserAccessActive: () => true }));
vi.mock("../invitedArtistAccess", () => ({
  assertInvitedArtistAccess: vi.fn(),
}));
import { router } from "../_core/trpc";
import { inboxProcedures } from "./inboxRouter";
const api = router(inboxProcedures);
const caller = (studioId = 7, role = "admin") =>
  api.createCaller({
    user: { id: 11, studioId, artistId: 3, role } as any,
    req: {} as any,
    res: {} as any,
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T01:00:00Z"));
  mocks.scope.mockResolvedValue({
    id: 21,
    studio_id: 7,
    artist_id: 3,
    mode: "bot",
    name: "Teste",
    assigned_user_id: null,
  });
  mocks.access.mockResolvedValue({ manager: true });
  mocks.rows.mockResolvedValue([]);
  mocks.exec.mockResolvedValue({ affectedRows: 1 });
});
afterEach(() => vi.useRealTimers());
describe("controle de atendimento", () => {
  it("pausa por 30 minutos, sob transação, registrando quem pausou", async () => {
    await caller().pauseConversation({ id: 21, minutes: 30 });
    expect(mocks.mode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 21 }),
      "human",
      mocks.transaction
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      expect.stringContaining("pause_until=?"),
      ["2026-10-25 01:30:00", 11, 21, 7],
      mocks.transaction
    );
    expect(mocks.transaction.commit).toHaveBeenCalledOnce();
    expect(mocks.changed).toHaveBeenCalledWith(7);
  });
  it("pausa sem prazo não recebe horário de retomada", async () => {
    await caller().pauseConversation({ id: 21, minutes: null });
    expect(mocks.exec).toHaveBeenCalledWith(
      expect.stringContaining("pause_until=?"),
      [null, 11, 21, 7],
      mocks.transaction
    );
  });
  it("não permite alterar uma conversa de outro estúdio", async () => {
    mocks.scope.mockRejectedValue(new Error("Forbidden"));
    await expect(
      caller(9).pauseConversation({ id: 21, minutes: 15 })
    ).rejects.toThrow("Forbidden");
    expect(mocks.exec).not.toHaveBeenCalled();
    expect(mocks.transaction.rollback).toHaveBeenCalledOnce();
  });
  it("não reativa opt-out ou conversa encerrada por expiração", () => {
    const cv = { mode: "human", pause_until: "2026-10-25 00:00:00" };
    expect(pauseExpired(cv)).toBe(true);
    expect(pauseExpired({ ...cv, opted_out: 1 })).toBe(false);
    expect(pauseExpired({ ...cv, closed_at: "2026-10-24 23:00:00" })).toBe(
      false
    );
    expect(pauseExpired({ ...cv, pause_until: null })).toBe(false);
    expect(pauseExpired({ ...cv, pause_until: "2026-10-25 02:00:00" })).toBe(
      false
    );
  });
  it("bloqueia automação em atendimento humano, opt-out e encerramento", () => {
    expect(automationBlocked({ mode: "bot" })).toBe(false);
    expect(automationBlocked({ mode: "human" })).toBe(true);
    expect(automationBlocked({ mode: "bot", opted_out: 1 })).toBe(true);
    expect(automationBlocked({ mode: "bot", closed_at: "2026-10-25" })).toBe(
      true
    );
  });
  it("reabrir mantém a equipe no controle", async () => {
    await caller().closeConversation({ id: 21, closed: false });
    expect(mocks.mode).toHaveBeenCalledWith(
      expect.anything(),
      "human",
      mocks.transaction
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      expect.stringContaining("closed_at=?"),
      [null, 21, 7],
      mocks.transaction
    );
  });
  it("recusa atribuição para pessoa sem acesso à conversa", async () => {
    await expect(
      caller().saveConversationDetails({
        id: 21,
        assignedUserId: 999,
        labels: [],
      })
    ).rejects.toThrow("atendente autorizado");
    expect(mocks.exec).not.toHaveBeenCalled();
  });
  it("nota interna é persistida no estúdio da sessão", async () => {
    await caller().addNote({ id: 21, body: "Apenas equipe" });
    expect(mocks.exec).toHaveBeenCalledWith(
      expect.stringContaining("tatuei_bot_notes"),
      [7, 21, 11, "Apenas equipe"]
    );
  });
  it("marca leitura somente se a mensagem pertence à conversa e ao estúdio", async () => {
    await caller().markRead({ id: 21, messageId: 999 });
    expect(mocks.rows).toHaveBeenCalledWith(
      expect.stringContaining("conversation_id=?"),
      [999, 7, 21]
    );
    expect(mocks.exec).not.toHaveBeenCalled();
    expect(mocks.changed).not.toHaveBeenCalled();
  });
  it("não permite vincular assistente de outro estúdio", async () => {
    await expect(
      caller().selectAssistant({ id: 21, assistantId: 999 })
    ).rejects.toThrow("Assistente indisponível");
    expect(mocks.exec).not.toHaveBeenCalled();
  });
  it("trocar assistente pausa a automação antes do vínculo", async () => {
    mocks.rows.mockResolvedValue([{ id: 4 }]);
    await caller().selectAssistant({ id: 21, assistantId: 4 });
    expect(mocks.mode).toHaveBeenCalledWith(
      expect.anything(),
      "human",
      mocks.transaction
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      expect.stringContaining("assistant_id=?"),
      [4, 21, 7],
      mocks.transaction
    );
  });
  it("colaborador não edita os assistentes do estúdio", async () => {
    await expect(
      caller(7, "collaborator").saveAssistant({
        name: "Recepção",
        instructions: "",
        knowledge: "",
        enabled: true,
      })
    ).rejects.toThrow("Forbidden");
    expect(mocks.exec).not.toHaveBeenCalled();
  });
  it("conflito de versão não sobrescreve assistente", async () => {
    mocks.exec.mockResolvedValue({ affectedRows: 0 });
    await expect(
      caller().saveAssistant({
        id: 4,
        version: 1,
        name: "Recepção",
        instructions: "",
        knowledge: "",
        enabled: true,
      })
    ).rejects.toThrow("outra tela");
    expect(mocks.exec).toHaveBeenCalledTimes(1);
  });
  it("impede pausas inválidas e bases excessivas", () => {
    expect(pauseMinutesSchema.safeParse(0).success).toBe(false);
    expect(pauseMinutesSchema.safeParse(10081).success).toBe(false);
    expect(
      assistantSchema.safeParse({
        name: "Recepção",
        instructions: "",
        knowledge: "a".repeat(30001),
        enabled: true,
      }).success
    ).toBe(false);
  });
});
describe("anexos privados", () => {
  it("recusa HTML e base64 malformado", () => {
    expect(() =>
      validateAttachment({
        name: "x",
        mime: "text/html" as any,
        base64: "SGVsbG8=",
      })
    ).toThrow();
    expect(() =>
      validateAttachment({ name: "x", mime: "application/pdf", base64: "ab==" })
    ).toThrow();
  });
  it("normaliza nomes sem permitir caminhos e quebras de cabeçalho", () => {
    expect(
      validateAttachment({
        name: '../a\r\n".pdf',
        mime: "application/pdf",
        base64: "JVBERi0=",
      }).name
    ).toBe(".._a___.pdf");
  });
});
