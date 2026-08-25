import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Check, Clock3, HeartHandshake, MessageCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { buildPostSaleMessage, buildPostSaleWhatsAppLink, POST_SALE_STAGES } from "@shared/postSale";

function displayDate(value: string) {
  return new Date(value.replace(" ", "T")).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

type PostSaleFollowupsBarProps = {
  visibleStart?: Date;
  visibleEnd?: Date;
};

export function PostSaleFollowupsBar({ visibleStart, visibleEnd }: PostSaleFollowupsBarProps) {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = visibleStart ? new Date(visibleStart) : new Date(today);
    const end = visibleEnd ? new Date(visibleEnd) : new Date(today);
    start.setHours(0, 0, 0, 0);
    if (!visibleEnd) end.setDate(end.getDate() + 45);
    end.setHours(23, 59, 59, 999);
    const periodContainsToday = today >= start && today <= end;

    return (data as any[])
      .filter((item) => ["scheduled", "due", "postponed", "failed"].includes(item.status))
      .filter((item) => {
        const scheduledAt = new Date(item.scheduledAt.replace(" ", "T"));
        const overdueInCurrentPeriod = periodContainsToday && (item.status === "due" || item.status === "failed") && scheduledAt < start;
        return overdueInCurrentPeriod || (scheduledAt >= start && scheduledAt <= end);
      })
      .slice(0, 30);
  }, [data, visibleStart, visibleEnd]);

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
    <section className="relative z-10 border-b border-emerald-500/25 bg-[#111c18]/95 px-3 py-2 flex-shrink-0 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 mb-1.5">
        <HeartHandshake className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-200">Lembretes de pós-venda · dia inteiro</span>
        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">{visible.length}</Badge>
        <span className="ml-auto hidden sm:inline text-[10px] text-emerald-100/60">Fixado acima dos horários</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
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
            <article key={item.id} className={`min-w-[300px] max-w-[360px] rounded-md border px-2.5 py-2 ${urgent ? "border-amber-500/50 bg-amber-950/30" : "border-emerald-500/30 bg-emerald-950/25"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    {item.clientName || "Cliente"} · {config?.label || item.stage}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.service} • {item.artistName}</p>
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
