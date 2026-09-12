/** Literal SQL LIKE search: '=' is the explicit escape character. */
export function consentSearchPattern(value: string): string {
  return `%${value.trim().replace(/[=%_]/g, match => `=${match}`)}%`;
}

export const CONSENT_PAGE_SIZE = 50;

export function canManageWhatsappConsent(role?: string | null): boolean {
  return role === "admin" || role === "superadmin";
}

export type ConsentState = {
  hasWhatsappOptIn?: number | boolean | null;
  optedOutAt?: string | null;
};

export function isWhatsappConsentEnabled(consent?: ConsentState | null): boolean {
  return Boolean(consent && (consent.hasWhatsappOptIn === 1 || consent.hasWhatsappOptIn === true) && !consent.optedOutAt);
}

export function consentStatusLabel(consent?: ConsentState | null): string {
  if (isWhatsappConsentEnabled(consent)) return "Autorizado";
  return consent?.optedOutAt ? "Autorização revogada" : "Não autorizado";
}

/** Never guess another studio or silently choose between multiple active senders. */
export function selectStudioConsentIntegration<T extends {
  id: number; studioId: number | null; status: string; isEnabled: number;
}>(integrations: T[], studioId?: number | null): T | undefined {
  if (!studioId) return undefined;
  const active = integrations.filter(item => item.studioId === studioId && item.status === "ativo" && item.isEnabled === 1);
  return active.length === 1 ? active[0] : undefined;
}
