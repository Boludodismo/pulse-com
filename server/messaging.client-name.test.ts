import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), send: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./messaging/outboundSafety", () => ({
  isOutboundMessagingBlocked: () => false,
}));
vi.mock("./messaging/crypto", () => ({
  decryptIntegrationSecret: () => "test-only",
  encryptIntegrationSecret: () => "test-only",
  hashIntegrationPayload: () => "test-hash",
}));
vi.mock("./messaging/providers/botconversa", () => ({
  BotConversaProvider: class {
    sendMessage = mocks.send;
  },
}));
import { processPendingIntegrationJobs, sendAndLog } from "./messaging/service";
function database(name: string | null = "Maria Fernanda Souza") {
  const writes: any[] = [],
    filters: any[] = [];
  const integration = {
    id: 9,
    studioId: 7,
    isEnabled: 1,
    status: "ativo",
    provider: "botconversa",
    encryptedApiToken: "test-only",
    sandboxMode: 0,
  };
  const payload = {
    clientId: 23,
    messageQueueId: 50,
    recipientPhone: "+5531996531316",
    recipientName: "Nome antigo",
    message: "Bom dia, {primeiro_nome}!",
  };
  const job = {
    id: 30,
    studioId: 7,
    integrationId: 9,
    idempotencyKey: "test-client-name",
    status: "pending",
    attemptCount: 0,
    maxAttempts: 5,
    payload: JSON.stringify(payload),
  };
  const records: Record<string, any[]> = {
    integration_jobs: [job],
    whatsapp_integrations: [integration],
    message_queue: [{ trigger: "birthday_reminder" }],
    integration_contacts: [{ hasWhatsappOptIn: 1, optedOutAt: null }],
    clients: name ? [{ name }] : [],
  };
  const db: any = {
    select: () => {
      let table = "";
      const q: any = {
        from: (t: any) => {
          table = getTableName(t);
          return q;
        },
        where: (condition: any) => {
          filters.push({ table, ...new MySqlDialect().sqlToQuery(condition) });
          return q;
        },
        limit: async () => records[table] || [],
      };
      return q;
    },
    update: (t: any) => ({
      set: (values: any) => ({
        where: async () => {
          writes.push({ table: getTableName(t), values });
          return [{ affectedRows: 1 }];
        },
      }),
    }),
    insert: (t: any) => ({
      values: async (values: any) => {
        writes.push({ table: getTableName(t), values });
        return [{ insertId: 50 }];
      },
    }),
    transaction: async (fn: any) => fn(db),
  };
  mocks.getDb.mockResolvedValue(db);
  return { writes, filters };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ success: true, messageId: "mock-only" });
});
describe("personalização antes da entrega", () => {
  it("preenche jobs antigos pelo cliente e empresa corretos e salva o texto entregue no histórico", async () => {
    const d = database();
    expect((await processPendingIntegrationJobs()).completed).toBe(1);
    expect(mocks.send).toHaveBeenCalledWith(
      "+5531996531316",
      "Bom dia, Maria!"
    );
    expect(d.filters.find(f => f.table === "clients").params).toEqual([
      23, 7, 0,
    ]);
    expect(
      d.writes.some(
        w =>
          w.table === "message_queue" && w.values.message === "Bom dia, Maria!"
      )
    ).toBe(true);
    expect(
      d.writes.some(
        w =>
          w.table === "integration_jobs" &&
          w.values.payload?.includes("Bom dia, Maria!")
      )
    ).toBe(true);
  });
  it("não entrega um marcador literal quando o cliente não pode ser encontrado", async () => {
    database(null);
    expect((await processPendingIntegrationJobs()).failed).toBe(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("personaliza antes de criar uma nova mensagem na fila", async () => {
    const d = database("João da Silva");
    expect(
      await sendAndLog({
        studioId: 7,
        integrationId: 9,
        clientId: 23,
        recipientType: "client",
        recipientName: "Nome antigo",
        recipientPhone: "+5531996531316",
        message: "Feliz aniversário, {primeiro_nome}!",
      })
    ).toMatchObject({ success: true, queued: true });
    expect(d.writes.find(w => w.table === "message_queue").values.message).toBe(
      "Feliz aniversário, João!"
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
