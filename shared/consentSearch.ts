export function consentTags(raw: unknown): string[] {
  if (!raw) return [];
  let data: any = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return raw
        .split(/[,;]+/)
        .map(t => t.trim())
        .filter(Boolean);
    }
  }
  return (Array.isArray(data) ? data : [data])
    .map(t => (typeof t === "string" ? t : t?.name || t?.label || ""))
    .filter(Boolean);
}
export function consentActive(c: {
  hasWhatsappOptIn?: number | null;
  optedOutAt?: unknown;
}) {
  return c.hasWhatsappOptIn === 1 && !c.optedOutAt;
}
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function matchesConsent(
  c: { clientName: string; phone?: string | null; tags?: unknown },
  search: string,
  tag: string
) {
  const q = normalized(search.trim()),
    digits = q.replace(/\D/g, "");
  return (
    (!tag || consentTags(c.tags).includes(tag)) &&
    (!q ||
      normalized(c.clientName).includes(q) ||
      (!!digits &&
        /^[\d\s()+-]+$/.test(q) &&
        String(c.phone || "")
          .replace(/\D/g, "")
          .includes(digits)) ||
      consentTags(c.tags).some(t => normalized(t).includes(q)))
  );
}
