import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Clock3, HeartHandshake, MessageCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { buildPostSaleMessage, buildPostSaleWhatsAppLink, POST_SALE_STAGES } from "@shared/postSale";

function displayDate(value: string) {
  return new Date(value.replace(" ", "T")).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function PostSaleFollowupsBar() {
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.postSaleFollowups.list.useQuery(undefined, { refetchInterval: 60_000 });
  const refresh = () => utils.postSaleFollowups.list.invalidate();
  const update = trpc.postSaleFollowups.update.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const sendNow = trpc.postSaleFollowups.sendNow.useMutation({
    onSuccess: () => { toast.success("Mensagem enviada automaticamente."); refresh(); },
    onError: (error) => toast.error(error.message),
  });

  const visible = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 45);
    return (data as any[])
      .filter((item) => ["scheduled", "due", "postponed", "failed"].includes(item.status))
      .filter((item) => item.status === "due" || item.status === "failed" || new Date(item.scheduledAt.replace(" ", "T")) <= cutoff)
      .slice(0, 12);
  }, [data]);

  if (isLoading || visible.length === 0) return null;

  const postpone = (id: number) => {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    next.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const scheduledAt = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())} 10:00:00`;
    update.mutate({ id, status: "postponed", scheduledAt });
  };

  return (
    <section className="border-b border-border bg-emerald-950/20 px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <HeartHandshake className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-200">Pós-venda automático</span>
        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">{visible.length} acompanhamento(s)</Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visible.map((item: any) => {
          const config = POST_SALE_STAGES.find((stage) => stage.stage === item.stage);
          const message = item.message || buildPostSaleMessage({
            stage: item.stage,
            clientName: item.clientName,
            artistName: item.artistName,
            service: item.service,
          });
          const whatsappLink = buildPostSaleWhatsAppLink(item.clientPhone, message);
          const urgent = item.status === "due" || item.status === "failed";
          return (
            <article key={item.id} className={`min-w-[285px] max-w-[330px] rounded-lg border p-2.5 ${urgent ? "border-amber-500/50 bg-amber-950/20" : "border-emerald-500/25 bg-background/70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{item.clientName || "Cliente"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{config?.label || item.stage} • {item.artistName}</p>
                </div>
                <Badge className={urgent ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"}>
                  {item.status === "failed" ? "Falhou" : item.status === "due" ? "Hoje/atrasado" : displayDate(item.scheduledAt)}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700" disabled={!whatsappLink}
                  onClick={() => whatsappLink && window.open(whatsappLink, "_blank", "noopener,noreferrer")}>
                  <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                </Button>
                {item.deliveryMode === "automatic" && urgent && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={sendNow.isPending}
                    onClick={() => sendNow.mutate({ id: item.id })}>
                    <Zap className="h-3 w-3 mr-1" /> Enviar agora
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-[11px]"
                  onClick={() => update.mutate({ id: item.id, deliveryMode: item.deliveryMode === "automatic" ? "manual" : "automatic" })}>
                  <Zap className="h-3 w-3 mr-1" /> {item.deliveryMode === "automatic" ? "Auto ligado" : "Ativar auto"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => postpone(item.id)}>
                  <Clock3 className="h-3 w-3 mr-1" /> +7 dias
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => update.mutate({ id: item.id, status: "completed" })}>
                  <Check className="h-3 w-3 mr-1" /> Concluir
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
