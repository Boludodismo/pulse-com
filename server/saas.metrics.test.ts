import { describe, expect, it } from "vitest";
import { summarizeSaasMetrics } from "./saas";

describe("summarizeSaasMetrics", () => {
  it("considera somente acessos ativos e demonstra que não há cobrança no MVP", () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = summarizeSaasMetrics({
      studios: [{ id: 1, isActive: 1 }, { id: 2, isActive: 0 }],
      users: [
        { role: "superadmin", isActive: 1 },
        { role: "admin", isActive: 1, studioId: 1, accessStatus: "active", accessExpiresAt: future },
        { role: "collaborator", isActive: 1, studioId: 1, accessStatus: "active" },
        { role: "collaborator", isActive: 1, studioId: 1, accessStatus: "active", accessExpiresAt: past },
        { role: "collaborator", isActive: 1, studioId: 1, accessStatus: "suspended" },
      ],
      invitations: [
        { status: "pending", expiresAt: future },
        { status: "pending", expiresAt: past },
        { status: "accepted", expiresAt: future },
        { status: "revoked", expiresAt: future },
      ],
    });

    expect(result).toMatchObject({
      totalStudios: 2,
      activeStudios: 1,
      activeUsers: 2,
      administrators: 1,
      collaborators: 1,
      activeTrialAccesses: 1,
      accessExpiringSoon: 1,
      billingEnabled: false,
      invitations: { pending: 1, accepted: 1, revoked: 1, expired: 1 },
    });
  });
});
