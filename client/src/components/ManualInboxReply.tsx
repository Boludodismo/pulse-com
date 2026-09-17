import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Attempt = { text: string; requestId: string };
export function ManualInboxReply({ conversationId, recipient, phone, enabled, storageKey }: {
  conversationId: number; recipient: string; phone: string; enabled: boolean; storageKey: string;
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch { return null; }
  });
  const [text, setText] = useState(attempt?.text || "");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const utils = trpc.useUtils();
  const send = trpc.intelligentInbox.sendReply.useMutation({ retry: false });

  async function submit() {
    if (busy.current || !enabled || !text.trim()) return;
    const current = attempt ?? { text: text.trim(), requestId: crypto.randomUUID() };
    // Keep the same attempt through network failures and page refreshes.
    try { sessionStorage.setItem(storageKey, JSON.stringify(current)); }
    catch { setNotice("Não foi possível guardar a tentativa neste navegador. Libere o armazenamento antes de enviar."); return; }
    busy.current = true;
    setAttempt(current);
    setNotice("");
    try {
      const result = await send.mutateAsync({ conversationId, ...current });
      if (result.status === "accepted" || result.status === "failed") {
        sessionStorage.removeItem(storageKey);
        setAttempt(null);
        if (result.status === "accepted") setText("");
      }
      setNotice(result.status === "accepted" ? "Resposta aceita pelo BotConversa. Isso ainda não confirma a entrega ao celular."
        : result.status === "failed" ? "Resposta não enviada. Confira o contato e a conexão no BotConversa antes de tentar novamente."
        : "Envio ainda não confirmado. Confira a conversa no BotConversa antes de enviar outra resposta.");
      await utils.intelligentInbox.messages.invalidate({ conversationId });
    } catch (error) {
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (["BAD_REQUEST", "NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED"].includes(code || "")) {
        sessionStorage.removeItem(storageKey); setAttempt(null);
        setNotice(error instanceof Error ? error.message : "Envio não autorizado.");
      } else setNotice("A conexão foi interrompida. Use Verificar envio para consultar a mesma tentativa sem duplicá-la.");
    } finally { busy.current = false; }
  }

  return <div className="space-y-3 border-t pt-4">
    <label htmlFor={`reply-${conversationId}`} className="block text-sm font-medium">Responder para {recipient} · {phone}</label>
    <Textarea id={`reply-${conversationId}`} value={text} onChange={event => setText(event.target.value)}
      disabled={!enabled || !!attempt || send.isPending} maxLength={4000} rows={4} placeholder="Escreva sua resposta…" />
    <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{text.length}/4000</span>
      <Button type="button" onClick={submit} disabled={!enabled || !text.trim() || send.isPending}>
        {send.isPending ? "Aguarde…" : attempt ? "Verificar envio" : "Enviar resposta"}
      </Button></div>
    {(notice || attempt) && <p role="status" className="text-sm">{notice || "Existe uma tentativa pendente de confirmação. Clique em Verificar envio."}</p>}
    {attempt && !send.isPending && <Button type="button" variant="outline" onClick={() => {
      if (!window.confirm("Você conferiu esta tentativa no BotConversa? Uma nova tentativa pode duplicar uma mensagem já recebida.")) return;
      sessionStorage.removeItem(storageKey); setAttempt(null); setText(""); setNotice("");
    }}>Já conferi no BotConversa</Button>}
    <p className="text-xs text-muted-foreground">O envio usa a conexão e o consentimento cadastrados na Central de Mensagens.</p>
  </div>;
}
