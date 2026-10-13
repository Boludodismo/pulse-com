import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { consentActive } from "@shared/consentSearch";
import WhatsappConsentField from "@/components/WhatsappConsentField";
import { toast } from "sonner";

export default function QuoteRecipient({ clientId, phone, integrationId, onIntegrationChange, onAuthorized, disabled }: {
  clientId: number; phone: string | null; integrationId: number | undefined;
  onIntegrationChange: (id: number | undefined) => void; onAuthorized: (enabled: boolean) => void; disabled: boolean;
}) {
  const { user } = useAuth();
  const manager = user?.role === "admin" || user?.role === "superadmin";
  const utils = trpc.useUtils();
  const integrations = trpc.messaging.listIntegrations.useQuery();
  const contacts = trpc.messaging.listWhatsappConsents.useQuery({ integrationId: integrationId || 1, clientId }, { enabled: !!integrationId });
  const consent = trpc.messaging.setWhatsappConsent.useMutation();
  const active = consentActive(contacts.data?.find(c => c.clientId === clientId) || {});
  useEffect(() => {
    if (!integrations.data) return;
    if (!integrations.data.some(i => i.id === integrationId)) onIntegrationChange(integrations.data.find(i => i.status === "ativo" && i.isEnabled === 1)?.id || integrations.data[0]?.id);
  }, [integrations.data, integrationId, onIntegrationChange]);
  useEffect(() => { onAuthorized(active && !contacts.isFetching && !contacts.isError && !consent.isPending); }, [active, clientId, integrationId, contacts.isFetching, contacts.isError, consent.isPending, onAuthorized]);
  async function change(enabled: boolean) {
    if (!integrationId || consent.isPending) return;
    try {
      await consent.mutateAsync({ integrationId, clientId, hasWhatsappOptIn: enabled, source: "orcamento_cliente" });
      await Promise.all([utils.messaging.listWhatsappConsents.invalidate(), utils.quotes.deliveryInfo.invalidate()]);
      toast.success(enabled ? "Autorização registrada no cadastro do cliente." : "Autorização revogada.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar a autorização."); }
  }
  return <div className="rounded-lg border p-3 space-y-3 sm:col-span-2">
    <p className="text-sm">WhatsApp do cliente: <strong>{phone || "Não cadastrado"}</strong></p>
    <label className="block text-sm space-y-1"><span>WhatsApp conectado do artista ou do estúdio</span><select className="w-full rounded-md border bg-background p-2" value={integrationId || ""} disabled={disabled || consent.isPending} onChange={e => onIntegrationChange(Number(e.target.value) || undefined)}>
      <option value="">Selecione a conexão</option>{integrations.data?.map(i => <option key={i.id} value={i.id}>{i.name} · {i.phoneNumber}</option>)}
    </select></label>
    {integrations.isLoading && <p className="text-sm">Consultando conexões…</p>}
    {integrations.error && <p role="alert" className="text-sm">{integrations.error.message}</p>}
    {integrations.data?.length === 0 && <p className="text-sm">Cadastre uma conexão em Mensagens para registrar a autorização e enviar pelo CRM. Você pode copiar o link.</p>}
    <p className="text-xs text-muted-foreground">O envio pelo CRM utiliza o número da conexão escolhida. Ao abrir o WhatsApp do aparelho, utilize a conta do artista ou do estúdio pela qual deseja enviar.</p>
    {!!integrationId && <><p className="text-sm" aria-live="polite">{contacts.isLoading ? "Consultando autorização…" : active ? "Cliente autorizado nesta conexão." : "Cliente sem autorização ativa nesta conexão."}</p>
      {contacts.error && <p role="alert" className="text-sm">{contacts.error.message}</p>}
      {manager && <WhatsappConsentField checked={active} disabled={disabled || consent.isPending || contacts.isFetching || contacts.isError || !phone} onChange={value => void change(value)} />}
      {!manager && !active && <p className="text-sm">Peça ao administrador para registrar a autorização do cliente.</p>}
    </>}
  </div>;
}
