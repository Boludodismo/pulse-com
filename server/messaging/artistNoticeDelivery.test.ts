import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
const state = vi.hoisted(() => ({
  db: vi.fn(),
  route: vi.fn(),
  contextError: vi.fn(),
  send: vi.fn(),
  writes: vi.fn(),
}));
vi.mock("../db", () => ({ getDb: state.db }));
vi.mock("./artistNotifications", async original => ({
  ...(await original<typeof import("./artistNotifications")>()),
  artistNotificationRoute: state.route,
  artistNoticeContextError: state.contextError,
}));
vi.mock("./providers/botconversa", () => ({
  BotConversaProvider: class {
    sendMessage = state.send;
  },
}));
vi.mock("./crypto", async original => ({
  ...(await original<typeof import("./crypto")>()),
  decryptIntegrationSecret: () => "isolated-test-token",
}));
vi.mock("../quoteDelivery", () => ({
  quoteIdFromTrigger: () => undefined,
  reconcileDeliveredQuotes: async () => undefined,
}));
import { processPendingIntegrationJobs } from "./service";
let trigger: string, phone: string, recipient: string;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OUTBOUND_MESSAGING_DISABLED", "false");
  vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "isolated-test");
  trigger = "artist_appointment_created";
  phone = "+5531999998888";
  recipient = phone;
  state.route.mockResolvedValue({ integrationId: 19, viaStudio: true });
  state.contextError.mockResolvedValue(null);
  state.send.mockResolvedValue({ success: true, messageId: "test-delivery" });
  state.db.mockResolvedValue({
    select: () => {
      let table = "";
      const q: any = {
        from: (t: any) => {
          table = getTableName(t);
          return q;
        },
        where: () => q,
        limit: async () =>
          (
            ({
              integration_jobs: [
                {
                  id: 1,
                  integrationId: 19,
                  studioId: 2,
                  payload: JSON.stringify({
                    messageQueueId: 20,
                    artistId: 7,
                    clientId: 3,
                    recipientType: "artist",
                    recipientPhone: recipient,
                    message: "Aviso de teste",
                  }),
                  idempotencyKey: "artist-event",
                  attemptCount: 0,
                  maxAttempts: 3,
                },
              ],
              whatsapp_integrations: [
                {
                  id: 19,
                  studioId: 2,
                  isEnabled: 1,
                  status: "ativo",
                  sandboxMode: 0,
                  encryptedApiToken: "sealed",
                  provider: "botconversa",
                },
              ],
              message_queue: [
                { trigger, appointmentId: 14, recipientType: "artist" },
              ],
              artists: [{ id: 7, phone, active: 1 }],
              artist_notification_settings: [],
            }) as Record<string, any[]>
          )[table] ?? [],
      };
      return q;
    },
    update: (t: any) => ({
      set: (patch: any) => ({
        where: async () => {
          state.writes(getTableName(t), patch);
          return [{ affectedRows: 1 }];
        },
      }),
    }),
  });
});
describe("artist notification delivery guard", () => {
  it("sends care feedback through the same worker ownership and recipient guards", async () => {
    trigger='care_artist_feedback:9';
    expect(await processPendingIntegrationJobs()).toMatchObject({completed:1,failed:0});
    expect(state.contextError).toHaveBeenCalledWith(expect.objectContaining({trigger,artistId:7,clientId:3}));
    state.contextError.mockResolvedValue('Artista alterado');
    expect(await processPendingIntegrationJobs()).toMatchObject({completed:0,failed:1});
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it("delivers the approved studio fallback with no optional reminder opt-in and audits completion", async () => {
    expect(await processPendingIntegrationJobs()).toMatchObject({
      completed: 1,
      failed: 0,
    });
    expect(state.send).toHaveBeenCalledWith("+5531999998888", "Aviso de teste");
    expect(state.contextError).toHaveBeenCalledWith({
      studioId: 2,
      artistId: 7,
      clientId: 3,
      appointmentId: 14,
      trigger,
    });
    expect(state.writes).toHaveBeenCalledWith(
      "message_queue",
      expect.objectContaining({ status: "enviada" })
    );
  });
  it("rejects a queued notice after channel ownership changes", async () => {
    state.route.mockResolvedValue({ integrationId: 22, viaStudio: false });
    expect(await processPendingIntegrationJobs()).toMatchObject({
      failed: 1,
      completed: 0,
    });
    expect(state.send).not.toHaveBeenCalled();
  });
  it("rejects a queued notice after artist reassignment", async () => {
    state.contextError.mockResolvedValue(
      "O artista responsável pelo agendamento mudou."
    );
    expect(await processPendingIntegrationJobs()).toMatchObject({ failed: 1 });
    expect(state.send).not.toHaveBeenCalled();
  });
  it("rejects a queued notice if the artist registered phone changes", async () => {
    phone = "+5531988887777";
    expect(await processPendingIntegrationJobs()).toMatchObject({ failed: 1 });
    expect(state.send).not.toHaveBeenCalled();
  });
  it("keeps optional reminders blocked when their authorization is disabled", async () => {
    trigger = "custom";
    expect(await processPendingIntegrationJobs()).toMatchObject({ failed: 1 });
    expect(state.send).not.toHaveBeenCalled();
    expect(state.route).not.toHaveBeenCalled();
  });
  it("retries a provider failure using the existing queue", async () => {
    state.send.mockResolvedValue({ success: false, error: "temporary outage" });
    expect(await processPendingIntegrationJobs()).toMatchObject({
      retried: 1,
      failed: 0,
    });
    expect(state.writes).toHaveBeenCalledWith(
      "integration_jobs",
      expect.objectContaining({ status: "retry", attemptCount: 1 })
    );
  });
});
