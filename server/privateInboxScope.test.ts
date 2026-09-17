import { beforeEach, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
const mocks = vi.hoisted(() => ({getDb: vi.fn(), getUserById: vi.fn()}));
vi.mock("./db", () => mocks);
import { listInboxMessages, listInboxConversations, ingestReadonlyMessage } from "./intelligentInbox/service";
import { ENV } from "./_core/env";
const queries: {sql: string; params: unknown[]}[] = [];
beforeEach(() => {
  vi.resetAllMocks(); queries.length = 0;
  ENV.authMode = "local"; vi.stubEnv("LOCAL_ADMIN_EMAIL", "owner@example.test");
  const connection = { query: async (options: any, params: unknown[]) => {
    queries.push({sql: typeof options === "string" ? options : options.sql, params});
    return [[], []];
  }};
  mocks.getDb.mockResolvedValue(drizzle(connection as any));
});
it("não lê mensagens se a conversa não pertence à conexão pessoal no estúdio da sessão", async () => {
  expect(await listInboxMessages(10, 5, 999, 25)).toMatchObject({items: []});
  const lookup = queries[0];
  expect(lookup.sql).toContain("production_activated_by_user_id");
  expect(lookup.sql).toContain("inbox_sync_state");
  expect(lookup.params).toEqual(expect.arrayContaining([10, 5, 999, "botconversa", 1, "ativo"]));
  expect(queries.some(q => q.sql.includes('from `inbox_messages`'))).toBe(false);
});
it("conversas são filtradas por conexão antes da paginação", async () => {
  await listInboxConversations(20, 7, {limit: 25});
  expect(queries[0].sql).toContain("production_activated_by_user_id");
  expect(queries[0].sql).toContain("inner join `whatsapp_integrations`");
  expect(queries[0].params).toEqual(expect.arrayContaining([20, 7]));
});
it("webhook de conexão inexistente não captura conversa", async () => {
  expect(await ingestReadonlyMessage({studioId:10,integrationId:123,eventId:"evt",phone:"5538999999999",text:"teste"})).toEqual({stored:false});
  expect(queries).toHaveLength(1);
  expect(queries[0].params).toEqual(expect.arrayContaining([10,123,"botconversa",1,"ativo"]));
  expect(mocks.getUserById).not.toHaveBeenCalled();
});
