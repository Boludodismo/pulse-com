import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
const state = vi.hoisted(() => ({
  care: vi.fn(),
  replyNotice: vi.fn(),
  actionNotice: vi.fn(),
  updates: vi.fn(),
  getDb: vi.fn(),
}));
vi.mock("./customerCare", () => ({ recordCareWhatsappReply: state.care }));
vi.mock("./artistNotifications", () => ({
  queueArtistCustomerReply: state.replyNotice,
}));
vi.mock("../appointmentActions", () => ({
  queueArtistActionNotification: state.actionNotice,
}));
vi.mock("../db", () => ({ getDb: state.getDb }));
import { handleWebhookReply } from "./webhook";
let queued: any[];
beforeEach(() => {
  vi.clearAllMocks();
  state.care.mockResolvedValue(false);
  state.replyNotice.mockResolvedValue(true);
  state.actionNotice.mockResolvedValue(true);
  queued = [
    {
      id: 20,
      studioId: 2,
      appointmentId: 14,
      clientId: 3,
      status: "enviada",
      recipientType: "client",
    },
  ];
  state.getDb.mockResolvedValue({
    select: () => {
      let table = "";
      const q: any = {
        from: (t: any) => {
          table = getTableName(t);
          return q;
        },
        where: () => q,
        orderBy: () => q,
        limit: async () =>
          table === "message_queue"
            ? queued
            : [{ id: 14, studioId: 2, artistId: 7, clientId: 3 }],
      };
      return q;
    },
    update: () => ({
      set: (patch: any) => ({
        where: async () => {
          state.updates(patch);
          return [];
        },
      }),
    }),
  });
});
describe("authenticated replies keep the assigned artist notified", () => {
  it.each([
    ["1", "confirmed"],
    ["2", "reschedule_requested"],
  ])(
    "keeps legacy reply %s and uses the complete artist/studio context",
    async (text, action) => {
      expect(
        await handleWebhookReply("+5531988887777", text, 2, "event-1", 19)
      ).toBe(true);
      expect(state.actionNotice).toHaveBeenCalledWith({
        studioId: 2,
        appointmentId: 14,
        action,
        actionEventKey: "webhook:event-1",
      });
      expect(state.replyNotice).not.toHaveBeenCalled();
      expect(state.updates).toHaveBeenCalledTimes(2);
    }
  );
  it("forwards ordinary text once without changing appointment status or suppressing the bot", async () => {
    expect(
      await handleWebhookReply(
        "+5531988887777",
        "Pode ser às 15h?",
        2,
        "event-2",
        19
      )
    ).toBe(false);
    expect(state.replyNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        studioId: 2,
        appointmentId: 14,
        eventKey: "event-2",
      })
    );
    expect(state.updates).not.toHaveBeenCalled();
    expect(state.actionNotice).not.toHaveBeenCalled();
  });
  it("lets the care handler notify its exact artist without a second generic notice", async () => {
    state.care.mockResolvedValue(true);
    expect(
      await handleWebhookReply("+5531988887777", "Tudo certo", 2, "event-3", 19)
    ).toBe(true);
    expect(state.replyNotice).not.toHaveBeenCalled();
    expect(state.updates).not.toHaveBeenCalled();
  });
  it("keeps recorded customer confirmation successful if internal notification fails", async () => {
    state.actionNotice.mockRejectedValue(new Error("temporary failure"));
    expect(
      await handleWebhookReply("+5531988887777", "1", 2, "event-4", 19)
    ).toBe(true);
    expect(state.updates).toHaveBeenCalledWith({
      confirmationStatus: "confirmado",
    });
  });
  it("does not interpret a reply against an unsent reminder or another tenant", async () => {
    queued[0].status = "pendente";
    await handleWebhookReply("+5531988887777", "1", 2, "event-5", 19);
    expect(state.actionNotice).not.toHaveBeenCalled();
    expect(state.updates).not.toHaveBeenCalled();
    await expect(handleWebhookReply("+5531988887777", "1")).rejects.toThrow(
      "Empresa obrigatória"
    );
  });
});
