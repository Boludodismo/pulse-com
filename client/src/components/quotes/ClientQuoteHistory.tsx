import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useArtistAccess } from "@/hooks/useArtistAccess";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventModal } from "@/components/EventModal";
import QuoteFollowupActions from "./QuoteFollowupActions";
import { quoteHistoryDate as date } from "@shared/quoteHistory";
import { CalendarPlus, FileText } from "lucide-react";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const sources: Record<string, string> = { public_accept: "Aceite pelo link", public_question: "Dúvida pelo link", manual_response: "Resposta registrada pela equipe" };
const statuses: Record<string, string> = { finalized: "Finalizado", sent: "Enviado", approved: "Aprovado", rejected: "Recusado", cancelled: "Cancelado", expired: "Vencido" };
type Filter = "all" | "sent" | "responded" | "booked" | "waiting";

export default function ClientQuoteHistory({ clientId }: { clientId: number }) {
  const { can, invited } = useArtistAccess();
  const [filter, setFilter] = useState<Filter>("all");
  const [artistId, setArtistId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [scheduling, setScheduling] = useState<{ id: number; artistId: number; artistName: string; title: string; totalAmount: number } | null>(null);
  const utils = trpc.useUtils();
  const artists = trpc.artists.list.useQuery(undefined, { enabled: !invited });
  const query = trpc.quotes.clientHistory.useInfiniteQuery({ clientId, filter, artistId: artistId ? Number(artistId) : undefined }, { getNextPageParam: last => last.nextCursor, refetchInterval: 30000 });
  const detail = trpc.quotes.historyDetail.useQuery({ id: selected! }, { enabled: selected !== null, refetchInterval: selected ? 30000 : false });
  const totals = query.data?.pages[0]?.totals;
  const items = query.data?.pages.flatMap(page => page.items) || [];
  const data = detail.data;
  return <section className="space-y-4 py-4">
    <div><h2 className="text-lg font-semibold">Histórico de orçamentos</h2><p className="text-sm text-muted-foreground">Textos e condições de cada versão, sem duplicar imagens. Datas de envio e resposta no horário de Brasília.</p></div>
    <div className="grid grid-cols-3 gap-2 sm:gap-4">{([
      ["Enviados", totals?.sent, "sent"], ["Respondidos", totals?.responded, "responded"], ["Agendados", totals?.booked, "booked"],
    ] as const).map(([label, value, choice]) => <button key={choice} aria-pressed={filter === choice} className={`rounded-xl border p-3 sm:p-4 text-left ${filter === choice ? "border-primary bg-primary/10" : "bg-card"}`} onClick={() => setFilter(filter === choice ? "all" : choice)}><span className="text-xs sm:text-sm text-muted-foreground">{label}</span><strong className="block mt-1 text-2xl">{value ?? "—"}</strong></button>)}</div>
    <div className="flex flex-wrap gap-2 items-center"><Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Todos ({totals?.total ?? "—"})</Button><Button size="sm" variant={filter === "waiting" ? "default" : "outline"} onClick={() => setFilter("waiting")}>Aguardando resposta</Button>{!invited && <select aria-label="Filtrar orçamentos por artista" className="min-w-0 max-w-full rounded-md border bg-background p-2 text-sm" value={artistId} onChange={e => setArtistId(e.target.value)}><option value="">Todos os artistas</option>{artists.data?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}</div>
    <p className="text-xs text-muted-foreground">Cada orçamento conta uma vez, mesmo com várias sessões. Cancelamentos e remarcações sem uma sessão ativa não contam como agendados. Visualizar o link não conta como resposta.</p>
    {query.isLoading && <p role="status">Carregando histórico…</p>}
    {query.error && <p role="alert">Não foi possível carregar o histórico. <button className="underline" onClick={() => void query.refetch()}>Tentar novamente</button></p>}
    {!query.isLoading && !query.error && !items.length && <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-6 w-6"/><p>Nenhum orçamento encontrado neste filtro.</p><p className="text-xs mt-1">Os orçamentos finalizados deste cliente aparecerão aqui automaticamente.</p></div>}
    {items.map(row => <article key={row.id} className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs font-semibold text-primary">{row.quoteNumber} · v{row.version}</p><h3 className="font-semibold break-words">{row.title}</h3><p className="text-sm text-muted-foreground">{row.artistName}</p></div><div className="flex flex-wrap gap-1"><Badge variant="secondary">{statuses[row.status] || row.status}</Badge>{row.respondedAt && <Badge variant="outline">Respondido</Badge>}{!!row.booked && <Badge variant="outline">Agendado</Badge>}</div></div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Envio</dt><dd>{row.sentAt ? date(row.sentAt) : "Envio não registrado"}</dd></div><div><dt className="text-muted-foreground">Validade</dt><dd>{date(row.validUntil, true)}</dd></div><div><dt className="text-muted-foreground">Valor</dt><dd className="font-medium">{money(row.totalAmount)}</dd></div></dl>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(row.id)}>Ver textos e acompanhamento</Button>{can("appointments", true) && can("quotes", true) && !["cancelled", "rejected"].includes(row.status) && <Button variant="outline" size="sm" onClick={() => setScheduling(row)}><CalendarPlus className="mr-2 h-4 w-4"/>Agendar orçamento</Button>}</div>
    </article>)}
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Carregar mais orçamentos</Button>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{data?.quoteNumber || "Orçamento"} · histórico</DialogTitle></DialogHeader>
      {detail.isLoading && <p>Carregando textos…</p>}{detail.error && <p role="alert">Não foi possível abrir este orçamento.</p>}
      {data && <div className="space-y-5 text-sm break-words">
        <div className="grid gap-2 sm:grid-cols-2"><p>Criação: {date(data.createdDate, true)}</p><p>Validade: {date(data.validUntil, true)}</p><p>Primeiro envio: {date(data.sentAt)}</p><p>Primeira resposta: {date(data.respondedAt)}</p></div>
        <QuoteFollowupActions id={data.id} clientId={clientId} responded={!!data.respondedAt} disabled={data.status === "cancelled"}/>
        {data.respondedAt && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"><strong>{sources[data.responseSource || ""] || "Resposta registrada"}</strong>{data.responseText && <p className="whitespace-pre-wrap mt-1">{data.responseText}</p>}{data.acceptedAt && <p className="mt-1">Aceite: {date(data.acceptedAt)}</p>}</div>}
        {data.questionText && data.questionText !== data.responseText && <div className="rounded-lg border p-3"><strong>Dúvida do cliente · {date(data.questionAt)}</strong><p className="whitespace-pre-wrap">{data.questionText}</p></div>}
        {data.bookings.length > 0 && <div><h3 className="font-semibold">Sessões vinculadas</h3>{data.bookings.map(a => <p key={a.id}>#{a.id} · {date(a.date, true)} às {a.date.slice(11, 16)} · {a.status}</p>)}</div>}
        {!data.text && <p role="alert">Este orçamento legado precisa ser conferido no editor para exibir os textos.</p>}
        {data.text && <>
          <div><h3 className="font-semibold">Responsável: {data.text.artist.name}</h3><p>{data.text.artist.specialty}</p><p className="whitespace-pre-wrap">{data.text.artist.bio}</p><p>{[data.text.artist.phone, data.text.artist.email, data.text.artist.instagram].filter(Boolean).join(" · ")}</p><p>Estúdio: {[data.text.studio.name, data.text.studio.phone, data.text.studio.email, data.text.studio.instagram].filter(Boolean).join(" · ")}</p></div>
          {data.text.projects.map((p, i) => <section key={i} className="rounded-lg border p-4 space-y-2"><h3 className="font-semibold">{i + 1}. {p.title}</h3><p>{[p.style, p.bodyRegion, p.sizeText, p.durationText, `${p.sessions} sessão(ões)`].filter(Boolean).join(" · ")}</p><p className="whitespace-pre-wrap">{p.concept}</p>{p.captions.map((c, n) => <div key={n} className="border-l-2 pl-3"><p className="font-medium">Imagem {n + 1}{c.alt ? ` · ${c.alt}` : ""}</p><p className="whitespace-pre-wrap">{c.description || "Sem descrição."}</p></div>)}</section>)}
          <section className="space-y-2"><h3 className="font-semibold">Valores e condições</h3><p>{data.text.pricing.mainLabel}: {money(data.text.pricing.totalAmount)}</p><p>Sinal: {money(data.text.pricing.depositAmount)}{!data.text.pricing.showDeposit && " (não exibido na proposta)"}</p><p className="whitespace-pre-wrap">{data.text.pricing.depositText}{!data.text.pricing.showDepositText && data.text.pricing.depositText && " (texto não exibido na proposta)"}</p><p className="whitespace-pre-wrap">{data.text.pricing.installmentText}</p><p className="whitespace-pre-wrap">{data.text.pricing.installmentInfo}{!data.text.pricing.showInstallmentInfo && data.text.pricing.installmentInfo && " (texto não exibido na proposta)"}</p><p className="whitespace-pre-wrap">{data.text.terms}</p></section>
        </>}
      </div>}
    </DialogContent></Dialog>
    {scheduling && <EventModal isOpen onClose={() => setScheduling(null)} initialClientId={clientId} initialQuote={scheduling} onSuccess={() => { void utils.quotes.clientHistory.invalidate({ clientId }); void utils.quotes.historyDetail.invalidate(); }}/>} 
  </section>;
}
