import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CONSENT_PAGE_SIZE, canManageWhatsappConsent, consentSearchPattern, consentStatusLabel, isWhatsappConsentEnabled, selectStudioConsentIntegration } from "../shared/whatsappConsentUi";

const integration = (id: number, studioId: number, status = "ativo", isEnabled = 1) => ({ id, studioId, status, isEnabled });

describe("consent search and authorization helpers", () => {
  it("keeps name fragments and trims only outside whitespace", () => expect(consentSearchPattern("  Ana Júlia  ")).toBe("%Ana Júlia%"));
  it("treats percent as a literal rather than match-all", () => expect(consentSearchPattern("%" )).toBe("%=%%"));
  it("escapes underscore and the explicit escape character", () => expect(consentSearchPattern("a_b=c")).toBe("%a=_b==c%"));
  it("does not turn quotes into SQL syntax", () => expect(consentSearchPattern("D'Ávila")).toBe("%D'Ávila%"));
  it("uses fifty visible rows with a separate lookahead", () => expect(CONSENT_PAGE_SIZE).toBe(50));
  it.each([undefined, null, { hasWhatsappOptIn: 0 }, { hasWhatsappOptIn: null }])("does not infer consent from missing or negative data: %s", state => expect(isWhatsappConsentEnabled(state)).toBe(false));
  it("accepts explicitly enabled consent", () => expect(isWhatsappConsentEnabled({ hasWhatsappOptIn: 1, optedOutAt: null })).toBe(true));
  it("honors revocation even when an old opt-in flag remains", () => expect(isWhatsappConsentEnabled({ hasWhatsappOptIn: 1, optedOutAt: "2026-09-12 12:00:00" })).toBe(false));
  it("distinguishes never-authorized and revoked records", () => { expect(consentStatusLabel(null)).toBe("Não autorizado"); expect(consentStatusLabel({ optedOutAt: "2026-09-12" })).toBe("Autorização revogada"); });
  it.each(["admin", "superadmin"])("preserves authorized manager role %s", role => expect(canManageWhatsappConsent(role)).toBe(true));
  it.each(["artist", "collaborator", "user", undefined])("does not grant new role permissions: %s", role => expect(canManageWhatsappConsent(role)).toBe(false));
  it("never selects a sender from another studio", () => expect(selectStudioConsentIntegration([integration(2, 22)], 11)).toBeUndefined());
  it("requires an explicitly selected studio", () => expect(selectStudioConsentIntegration([integration(2, 22)], null)).toBeUndefined());
  it("selects the single active enabled sender of the correct studio", () => expect(selectStudioConsentIntegration([integration(1, 11, "inativo"), integration(2, 22), integration(3, 11)], 11)?.id).toBe(3));
  it("does not use a disabled sender", () => expect(selectStudioConsentIntegration([integration(1, 11, "ativo", 0)], 11)).toBeUndefined());
  it("does not guess among multiple active senders", () => expect(selectStudioConsentIntegration([integration(1, 11), integration(2, 11)], 11)).toBeUndefined());
});

describe("source integration guards (not a database or browser test)", () => {
  const router = readFileSync("server/routers/messaging.ts", "utf8");
  const list = router.slice(router.indexOf("listWhatsappConsents:"), router.indexOf("setWhatsappConsent:"));
  const modal = readFileSync("client/src/components/EventModal.tsx", "utf8");
  const controls = readFileSync("client/src/components/WhatsappConsentControls.tsx", "utf8");
  it("searches inside the scoped server query before pagination", () => {
    expect(list).toContain("eq(clients.studioId, integration.studioId)");
    expect(list).toContain("eq(clients.isArchived, 0)");
    expect(list).toContain("eq(clients.id, input.clientId)");
    expect(list).toContain("COLLATE utf8mb4_unicode_ci LIKE ${consentSearchPattern(input.search)} ESCAPE '='");
    expect(list).toContain(".orderBy(asc(clients.name), asc(clients.id)).limit(input.limit).offset(input.offset)");
    expect(list.indexOf("consentSearchPattern(input.search)")).toBeLessThan(list.indexOf(".limit(input.limit)"));
  });
  it("does not weaken the existing mutation permission check", () => expect(router.slice(router.indexOf("setWhatsappConsent:"))).toContain("requireIntegrationManager(ctx)"));
  it("does not retain the hidden grant-on-schedule checkbox", () => {
    expect(modal).not.toContain("setRecordWhatsAppConsent");
    expect((modal.match(/recordWhatsAppConsent: false/g) ?? []).length).toBe(2);
    expect(modal).toContain('key={`${consentStudioId}:${clientId}`}');
  });
  it("captures quick consent before creation and saves it on the actual returned client", () => {
    expect(modal).toContain("if (!quickConsent.prepare(quickClientPhone)) return");
    expect(modal).toContain("await quickConsent.afterCreated(newClient)");
    expect(controls).toContain("clientId: client.id, hasWhatsappOptIn: true");
    expect(controls).toContain("não cadastre o cliente novamente");
  });
  it("shares the consent cache and queries selected clients beyond the old first-200 limit", () => {
    expect(controls).toContain("utils.messaging.listWhatsappConsents.invalidate()");
    expect(controls).toContain("integrationId: integrationId ?? 0, clientId, limit: 1");
  });
  it("has no message-send, provider-configuration or appointment mutation", () => {
    expect(controls).not.toMatch(/trpc\.(appointments|notifications)\./);
    expect(controls).not.toMatch(/\.(sendMessage|sendReminders|saveIntegration|activateIntegration)\./);
  });
});
