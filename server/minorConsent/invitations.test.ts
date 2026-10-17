import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
const mock = vi.hoisted(() => ({
  record: {} as any,
  encrypted: "",
  last: null as any,
  consent: { enabled: 1, optedOutAt: null, phone: "+5531999999999" },
  integration: null as any,
  access: vi.fn(),
  send: vi.fn(),
  blocked: false,
  queries: [] as any[],
}));
vi.mock("../_core/env", () => ({
  ENV: {
    appBaseUrl: "https://crm.example.test",
    authSecurityKey: "test-invitation-key-".repeat(3),
  },
}));
vi.mock("../messaging/privateConnectionAccess", () => ({
  assertPrivateConnectionAccess: mock.access,
}));
vi.mock("../messaging/service", () => ({
  getActiveIntegration: async () => mock.integration,
  sendAndLog: mock.send,
}));
vi.mock("../messaging/outboundSafety", () => ({
  isOutboundMessagingBlocked: () => mock.blocked,
  OUTBOUND_BLOCKED_ERROR: "Ambiente de teste",
}));
vi.mock("../db", () => ({
  getClientById: async () => ({
    id: 7,
    name: "Cliente Nome Teste",
    phone: "31999999999",
  }),
}));
vi.mock("./database", () => ({
  rows: async (sql: string, args: any[]) => {
    mock.queries.push([sql, args]);
    if (sql.includes("encrypted_token"))
      return [{ encrypted_token: mock.encrypted }];
    if (sql.includes("FROM anamnese_requests"))
      return [
        { token: "b".repeat(64), statusRequest: mock.record.anamnese_status },
      ];
    if (sql.includes("FROM message_queue")) return mock.last ? [mock.last] : [];
    if (sql.includes("FROM integration_contacts")) return [mock.consent];
    if (sql.includes("INNER JOIN clients")) return [mock.record];
    return [];
  },
}));
import {
  sealInvitationToken,
  openInvitationToken,
  queueConsentInvitation,
  invitationLinks,
} from "./invitations";
import {
  invitationDeliveryError,
  invitationTrigger,
} from "./invitationDelivery";
import { sha } from "./backup";
import { minorConsentInvitationMessage } from "../../shared/minorConsent";
const token = "a".repeat(64),
  user = { id: 3, studioId: 1, role: "admin", openId: "test" } as any;
const r = () => ({ ...mock.record, id: 11, studio_id: 1, client_id: 7 });
beforeEach(() => {
  vi.clearAllMocks();
  mock.queries = [];
  mock.last = null;
  mock.blocked = false;
  mock.record = {
    id: 11,
    studio_id: 1,
    client_id: 7,
    status: "pending",
    expires_at: Date.now() + 600000,
    token_hash: sha(token),
    phone: "31999999999",
    isArchived: 0,
    anamnese_request_id: 99,
    anamnese_status: "pendente",
    anamnese_expires: new Date(Date.now() + 600000),
  };
  mock.consent = { enabled: 1, optedOutAt: null, phone: "+5531999999999" };
  mock.integration = { id: 2, name: "WhatsApp Teste", sandboxMode: 0 };
  mock.access.mockResolvedValue(undefined);
  mock.send.mockResolvedValue({
    success: true,
    queued: true,
    duplicate: false,
    messageId: "42",
  });
  mock.encrypted = sealInvitationToken(token, 1, 11);
});
describe("authorization sharing and direct WhatsApp", () => {
  it("protects recoverable links against another studio or request", () => {
    expect(mock.encrypted).not.toContain(token);
    expect(openInvitationToken(mock.encrypted, 1, 11)).toBe(token);
    expect(() => openInvitationToken(mock.encrypted, 2, 11)).toThrow();
    expect(() => openInvitationToken(mock.encrypted, 1, 12)).toThrow();
  });
  it("recovers the same pair without creating another anamnese", async () => {
    const a = await invitationLinks(r()),
      b = await invitationLinks(r());
    expect(a).toEqual(b);
    expect(a.link).toContain("/autorizacao/" + token);
    expect(a.anamneseLink).toContain("/anamnese/" + "b".repeat(64));
    expect(mock.queries.some(([sql]) => /INSERT|UPDATE/.test(sql))).toBe(false);
    expect(() => minorConsentInvitationMessage("Cliente", "link", "")).toThrow(
      /anamnese/
    );
  });
  it("queues both links on the configured connection and uses only the registered recipient", async () => {
    await expect(queueConsentInvitation(user, r())).resolves.toMatchObject({
      queued: true,
      duplicate: false,
    });
    const payload = mock.send.mock.calls[0][0];
    expect(payload).toMatchObject({
      studioId: 1,
      integrationId: 2,
      clientId: 7,
      recipientPhone: "+5531999999999",
      recipientType: "client",
    });
    expect(payload.message).toContain("/autorizacao/" + token);
    expect(payload.message).toContain("/anamnese/" + "b".repeat(64));
    expect(payload.message).toContain("Olá, Cliente!");
    expect(payload.message).not.toContain("Nome Teste");
    await queueConsentInvitation(user, r());
    expect(mock.send.mock.calls[1][0].idempotencyKey).toBe(
      payload.idempotencyKey
    );
  });
  it("preserves private connection access and refuses missing consent", async () => {
    mock.access.mockRejectedValueOnce(
      new TRPCError({ code: "FORBIDDEN", message: "Conexão privada" })
    );
    await expect(queueConsentInvitation(user, r())).rejects.toThrow(
      "Conexão privada"
    );
    expect(mock.send).not.toHaveBeenCalled();
    mock.consent.enabled = 0;
    await expect(queueConsentInvitation(user, r())).rejects.toThrow(
      /autorização de WhatsApp/
    );
    expect(mock.send).not.toHaveBeenCalled();
  });
  it("does not enqueue a second copy while delivery is pending or already sent", async () => {
    for (const status of ["pendente", "enviada", "respondida"]) {
      mock.last = { id: 42, status };
      expect((await queueConsentInvitation(user, r())).duplicate).toBe(true);
    }
    expect(mock.send).not.toHaveBeenCalled();
    mock.last = { id: 42, status: "erro" };
    await queueConsentInvitation(user, r());
    expect(mock.send.mock.calls[0][0].idempotencyKey).toContain("after-42");
  });
  it("refuses inactive/test connections and a stale consent phone", async () => {
    mock.integration = null;
    await expect(queueConsentInvitation(user, r())).rejects.toThrow(
      /Conecte e ative/
    );
    mock.integration = { id: 2, sandboxMode: 1 };
    await expect(queueConsentInvitation(user, r())).rejects.toThrow(/produção/);
    mock.integration.sandboxMode = 0;
    mock.consent.phone = "+5531888888888";
    await expect(queueConsentInvitation(user, r())).rejects.toThrow(
      /número atual/
    );
    expect(mock.send).not.toHaveBeenCalled();
  });
  it("revalidates the case and recipient immediately before worker delivery", async () => {
    const trigger = invitationTrigger(11, sha(token));
    expect(
      await invitationDeliveryError(1, trigger, 7, "+5531999999999", false)
    ).toBeNull();
    for (const change of [
      { status: "cancelled" },
      { status: "received" },
      { expires_at: Date.now() - 1 },
      { phone: "31988888888" },
      { client_id: 8 },
      { token_hash: sha("changed") },
      { anamnese_status: "cancelada" },
      { anamnese_expires: "invalid" },
    ]) {
      const previous = { ...mock.record };
      Object.assign(mock.record, change);
      expect(
        await invitationDeliveryError(1, trigger, 7, "+5531999999999", false)
      ).toBeTruthy();
      mock.record = previous;
    }
    expect(
      await invitationDeliveryError(1, trigger, 7, "+5531999999999", true)
    ).toContain("produção");
  });
});
