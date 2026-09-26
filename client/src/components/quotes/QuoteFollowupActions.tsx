import { useArtistAccess } from "@/hooks/useArtistAccess";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { quoteHistoryDate } from "@shared/quoteHistory";

function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function QuoteFollowupActions({ id, clientId, responded = false, disabled = false }: { id: number; clientId: number; responded?: boolean; disabled?: boolean }) {
  const {can} = useArtistAccess();
  disabled = disabled || !can("quotes", true);
  const utils = trpc.useUtils();
  const info = trpc.quotes.deliveryInfo.useQuery({ id }, { refetchInterval: query => query.state.data?.lastDelivery && (query.state.data.lastDelivery.status === "pendente" || (["enviada", "respondida"].includes(query.state.data.lastDelivery.status) && !query.state.data.sentAt)) ? 5000 : false });
  const [mode, setMode] = useState<"send" | "sent" | "response" | null>(null);
  const [occurredAt, setOccurredAt] = useState(localNow);
  const [text, setText] = useState("");
  const refresh = async () => {
    setMode(null);
    await Promise.all([utils.quotes.deliveryInfo.invalidate({ id }), utils.quotes.clientHistory.invalidate({ clientId }),
      utils.quotes.historyDetail.invalidate({ id }), utils.quotes.list.invalidate(), utils.customerCare.tags.invalidate({ clientId }), utils.clients.search.invalidate()]);
  };
  const send = trpc.quotes.sendViaIntegration.useMutation({ onSuccess: async result => { toast.success(result.duplicate ? "Este orçamento já possui um envio registrado na integração." : "Orçamento na fila de envio. A confirmação aparecerá aqui."); await refresh(); }, onError: e => toast.error(e.message) });
  const sent = trpc.quotes.recordSent.useMutation({ onSuccess: async () => { toast.success("Envio registrado e etiqueta aplicada."); await refresh(); }, onError: e => toast.error(e.message) });
  const response = trpc.quotes.recordResponse.useMutation({ onSuccess: async () => { toast.success("Resposta registrada e etiqueta aplicada."); setText(""); await refresh(); }, onError: e => toast.error(e.message) });
  const data = info.data;
  const delivery = data?.lastDelivery;
  const provider = ({ botconversa: "BotConversa", zapi: "Z-API", meta: "WhatsApp Meta" } as Record<string, string>)[data?.provider || ""] || "WhatsApp do CRM";
  const pending = send.isPending || sent.isPending || response.isPending;
  const open = (value: typeof mode) => { setOccurredAt(localNow()); setMode(value); };
  return <section className="rounded-xl border bg-card p-4 space-y-3" aria-label="Envio e acompanhamento do orçamento">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" disabled={disabled || !data?.available || Boolean(delivery) || pending} onClick={() => open("send")}><Send className="mr-2 h-4 w-4"/>Enviar pelo WhatsApp do CRM</Button>
      {!data?.sentAt && <Button type="button" variant="outline" disabled={disabled || pending} onClick={() => open("sent")}>Registrar envio externo</Button>}
      {!responded && <Button type="button" variant="outline" disabled={disabled || pending} onClick={() => open("response")}>Registrar resposta externa</Button>}
    </div>
    <div className="text-sm text-muted-foreground space-y-1" aria-live="polite">
      {info.error && <p role="alert">Não foi possível consultar o envio. <button className="underline" onClick={() => void info.refetch()}>Tentar novamente</button></p>}
      {delivery?.status === "pendente" && <p>Na fila do {provider}. A etiqueta será aplicada após a confirmação de envio.</p>}
      {delivery?.status === "erro" && <p role="alert">Falha no envio: {delivery.error || "confira a integração"}. <a className="underline" href="/messaging">Ver tentativas em Mensagens</a>.</p>}
      {delivery?.status === "cancelada" && <p>Envio cancelado na integração. <a className="underline" href="/messaging">Ver em Mensagens</a>.</p>}
      {data?.sentAt && <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500"/>Enviado em {quoteHistoryDate(data.sentAt)} · {data.sentSource === "integration" ? "confirmado pela integração" : "registrado pela equipe"}</p>}
      {data?.reason && !delivery && <p>{data.reason}</p>}
      <p>Copiar ou compartilhar o link não confirma o envio. Use o registro externo para conversas feitas fora do CRM.</p>
    </div>
    <Dialog open={mode !== null} onOpenChange={value => { if (!value && !pending) setMode(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{mode === "send" ? `Enviar orçamento · ${provider}` : mode === "sent" ? "Registrar envio feito fora do CRM" : "Registrar resposta recebida fora do CRM"}</DialogTitle><DialogDescription>{mode === "send" ? "Confira o destinatário e a mensagem antes de enviar." : "Confirme apenas um envio ou uma resposta que realmente aconteceu."}</DialogDescription></DialogHeader>
        {mode === "send" ? <><p className="font-medium">{data?.clientName} · {data?.phone}</p><p className="rounded-lg bg-muted p-3 whitespace-pre-wrap break-words text-sm">{data?.message}</p><Button disabled={pending || !data?.available || Boolean(delivery)} onClick={() => send.mutate({ id })}>{send.isPending ? "Enfileirando…" : "Confirmar e enviar orçamento"}</Button></> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); const at = new Date(occurredAt); if (!Number.isFinite(at.getTime())) { toast.error("Informe uma data válida."); return; } if (mode === "sent") sent.mutate({ id, occurredAt: at.toISOString() }); else response.mutate({ id, text, occurredAt: at.toISOString() }); }}>
          <label className="block text-sm space-y-2"><span>{mode === "sent" ? "Data e hora do envio" : "Data e hora da resposta"} (horário deste aparelho)</span><Input type="datetime-local" required max={localNow()} value={occurredAt} onChange={e => setOccurredAt(e.target.value)}/></label>
          {mode === "response" && <label className="block text-sm space-y-2"><span>Resumo da resposta do cliente</span><Textarea required minLength={2} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Ex.: cliente pediu outra data para iniciar o projeto."/><span className="text-xs text-muted-foreground">Este registro não significa aceite nem agendamento.</span></label>}
          <Button disabled={pending} type="submit">{pending ? "Salvando…" : "Confirmar registro"}</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </section>;
}
