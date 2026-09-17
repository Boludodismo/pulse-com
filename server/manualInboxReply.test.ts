import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableColumns } from "drizzle-orm";
import { clients, inboxConversations, inboxMessages, inboxSyncState, integrationContacts, whatsappIntegrations } from "../drizzle/schema";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), token: vi.fn(), send: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./messaging/service", () => ({ getIntegrationApiToken: mocks.token }));
vi.mock("./messaging/providers/botconversa", () => ({ BotConversaProvider: class { sendExistingContactReply = mocks.send; } }));
import { sendManualInboxReply } from "./intelligentInbox/manualReply";

const input = { conversationId: 12, text: "Sua resposta", requestId: "550e8400-e29b-41d4-a716-446655440000" };
let rows: Record<string, any[]>;
let claimed: boolean;
let queries: { sql: string; params: any[] }[];
const tables: Record<string, any> = { clients, inbox_conversations: inboxConversations, inbox_messages: inboxMessages, inbox_sync_state: inboxSyncState, integration_contacts: integrationContacts, whatsapp_integrations: whatsappIntegrations };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false"); vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "test");
  claimed = false; queries = [];
  rows = {
    inbox_conversations: [{ id: 12, studioId: 10, syncStateId: 3, phone: "+5511999999999" }],
    inbox_sync_state: [{ id: 3, studioId: 10, integrationId: 9 }],
    whatsapp_integrations: [{ id: 9, studioId: 10, phoneNumber: "+5511888888888", sandboxMode: 0 }],
    integration_contacts: [{ clientId: 6, hasWhatsappOptIn: 1, optedOutAt: null }],
    clients: [{ id: 6, phone: "+5511999999999" }],
    inbox_messages: [],
  };
  const connection = { query: async (options: any, params: any[]) => {
    const sql = options.sql; queries.push({ sql, params });
    if (sql.startsWith("insert into `inbox_messages`")) {
      if (claimed) throw new Error("Duplicate entry");
      claimed = true;
      rows.inbox_messages = [{ id: 20, textContent: input.text, processingStatus: "sending" }];
      return [{ insertId: 20 }, []];
    }
    if (sql.startsWith("update `inbox_messages`")) {
      rows.inbox_messages[0].processingStatus = params[params.findIndex((p: any) => ["accepted", "failed", "unknown"].includes(p))];
      return [{ affectedRows: 1 }, []];
    }
    if (sql.includes('from `inbox_messages`') && params.includes("inbound")) return [[[1]], []];
    const table = /from `([^`]+)`/.exec(sql)?.[1];
    if (!table) throw new Error(sql);
    const columns = Object.keys(getTableColumns(tables[table]));
    return [(rows[table] || []).map(row => columns.map(key => row[key] ?? null)), []];
  } };
  mocks.getDb.mockResolvedValue(drizzle(connection as any));
  mocks.token.mockResolvedValue("test-token"); mocks.send.mockResolvedValue({ status: "accepted", messageId: "remote-1" });
});
afterEach(() => vi.unstubAllEnvs());

it("persiste a resposta e usa o telefone e a conexão da conversa, sem alterar automações", async () => {
  expect(await sendManualInboxReply(10, 5, input)).toMatchObject({ status: "accepted" });
  expect(mocks.send).toHaveBeenCalledWith("+5511999999999", input.text);
  expect(queries[0].sql).toContain("production_activated_by_user_id");
  expect(queries[0].params).toEqual(expect.arrayContaining([10, 5, 12]));
  expect(queries.filter(q => /^(insert|update)/.test(q.sql)).every(q => q.sql.includes("`inbox_messages`"))).toBe(true);
});
it("duas tentativas concorrentes com a mesma chave fazem um só envio", async () => {
  await Promise.all([sendManualInboxReply(10, 5, input), sendManualInboxReply(10, 5, input)]);
  expect(mocks.send).toHaveBeenCalledTimes(1);
});
it.each(["accepted", "sending", "unknown", "failed"])("não reenvia tentativa persistida em %s", async status => {
  rows.inbox_messages = [{ id: 20, textContent: input.text, processingStatus: status }];
  expect(await sendManualInboxReply(10, 5, input)).toEqual({ status, duplicate: true });
  expect(mocks.send).not.toHaveBeenCalled();
});
it("nega conversa fora do escopo privado antes de buscar token", async () => {
  rows.inbox_conversations = [];
  await expect(sendManualInboxReply(10, 5, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it("bloqueia homologação global antes de consultar o banco", async () => {
  vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "true");
  await expect(sendManualInboxReply(10, 5, input)).rejects.toThrow("bloqueado");
  expect(mocks.getDb).not.toHaveBeenCalled();
});
it.each([{}, { hasWhatsappOptIn: 1, optedOutAt: "2026-09-01" }])("respeita ausência ou revogação de consentimento", async consent => {
  rows.integration_contacts = [consent];
  await expect(sendManualInboxReply(10, 5, input)).rejects.toThrow("consentimento ativo");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("não usa consentimento de telefone antigo do cliente", async () => {
  rows.clients[0].phone = "+5531999999999";
  await expect(sendManualInboxReply(10, 5, input)).rejects.toThrow("telefone do cliente");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("respeita o destinatário de homologação da integração", async () => {
  Object.assign(rows.whatsapp_integrations[0], { sandboxMode: 1, sandboxTestPhone: "+5531999999999" });
  await expect(sendManualInboxReply(10, 5, input)).rejects.toThrow("telefone de homologação");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("mantém resultado incerto sem nova tentativa automática", async () => {
  mocks.send.mockResolvedValue({ status: "unknown" });
  expect(await sendManualInboxReply(10, 5, input)).toMatchObject({ status: "unknown" });
  await sendManualInboxReply(10, 5, input);
  expect(mocks.send).toHaveBeenCalledTimes(1);
});
