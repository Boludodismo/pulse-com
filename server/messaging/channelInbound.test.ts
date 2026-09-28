import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchChannelInbound } from "./channelInbound";
const db = vi.hoisted(() => ({
  rows: vi.fn(),
  exec: vi.fn(),
  reply: vi.fn(),
  persist: vi.fn(),
  inbox: vi.fn(),
}));
vi.mock("../nativeBot/database", () => ({
  rows: db.rows,
  exec: db.exec,
  withBotLock: async (_: string, fn: any) => fn({}),
}));
vi.mock("../nativeBot/webhook", () => ({ persistBotInbound: db.persist }));
vi.mock("./webhook", () => ({ handleWebhookReply: db.reply }));
vi.mock("../intelligentInbox/service", () => ({
  ingestReadonlyMessage: db.inbox,
}));
const s = { studio_id: 7, wa_integration_id: 19 } as any;
const event = {
  instanceId: "12345",
  messageId: "event-1",
  phone: "5511999998888",
  fromMe: false,
  text: { message: "1" },
};
beforeEach(() => {
  vi.clearAllMocks();
  db.rows.mockImplementation(async (sql: string) =>
    sql.includes("integration_events") ? [] : [{ wa_integration_id: 19 }]
  );
  db.reply.mockResolvedValue(false);
});
describe("roteamento do canal único", () => {
  it("não repete evento já processado", async () => {
    db.rows.mockResolvedValue([{ status: "processed" }]);
    await dispatchChannelInbound(s, event, event.phone);
    expect(db.reply).not.toHaveBeenCalled();
    expect(db.persist).not.toHaveBeenCalled();
  });
  it("confirmação da agenda é registrada sem gerar segunda resposta do Bot", async () => {
    db.reply.mockResolvedValue(true);
    await dispatchChannelInbound(s, event, event.phone);
    expect(db.reply).toHaveBeenCalledTimes(1);
    expect(db.persist.mock.calls[0].slice(-2)).toEqual([true, true]);
  });
  it("mensagem comum é encaminhada uma vez ao Bot", async () => {
    await dispatchChannelInbound(s, event, event.phone);
    expect(db.persist.mock.calls[0].slice(-2)).toEqual([true, false]);
    expect(db.inbox).toHaveBeenCalledTimes(1);
  });
  it("não encaminha evento de outro canal ao Bot selecionado", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("integration_events") ? [] : [{ wa_integration_id: 20 }]
    );
    await dispatchChannelInbound(s, event, event.phone);
    expect(db.persist).not.toHaveBeenCalled();
    expect(db.reply).toHaveBeenCalledTimes(1);
  });
  it("canal exclusivo do Bot não aciona respostas pelo número ativo da Central", async () => {
    db.rows.mockImplementation(async (sql: string) =>
      sql.includes("tatuei_bot_settings") ? [{ wa_integration_id: 19 }] : []
    );
    await dispatchChannelInbound(s, event, event.phone);
    expect(db.reply).not.toHaveBeenCalled();
    expect(db.persist).toHaveBeenCalledTimes(1);
  });
  it("não repete efeito externo após falha incerta", async () => {
    db.rows.mockResolvedValue([{ status: "failed" }]);
    await expect(dispatchChannelInbound(s, event, event.phone)).rejects.toThrow(
      "revisão"
    );
    expect(db.reply).not.toHaveBeenCalled();
  });
});
