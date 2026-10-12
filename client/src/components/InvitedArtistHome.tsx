import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import ArtistCardEditor from "./ArtistCardEditor";
import { ARTIST_ACCESS_LABELS } from "@shared/artistInvitations";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import {
  Users,
  CalendarDays,
  Wallet,
  Cake,
  Package,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Palette,
  Contact,
  ChevronDown,
  ShieldCheck,
  FileText,
  Bell,
} from "lucide-react";

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
const dateLabel = (date: string) =>
  new Date(date.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
const statuses: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  reagendado: "Reagendado",
};

export default function InvitedArtistHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [showCard, setShowCard] = useState(false);
  const access = trpc.artistInvitations.access.useQuery();
  const panel = trpc.artistDashboard.overview.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
  const can = (module: string) =>
    access.data?.some(p => p.module === module && !!p.canRead) ?? false;
  const canWrite = (module: string) =>
    access.data?.some(
      p => p.module === module && !!p.canRead && !!p.canWrite
    ) ?? false;
  const stock = trpc.pod.inventory.list.useQuery(undefined, {
    enabled: can("stock"),
    staleTime: 5 * 60_000,
  });
  const data = panel.data;
  const lowStock =
    stock.data?.filter(
      m => Number(m.currentQuantity) <= Number(m.minimumQuantity)
    ) ?? [];
  const month = data
    ? new Date(data.today + "T12:00:00").toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })
    : "";
  const metrics = [
    ...(data?.totalClients != null
      ? [
          {
            title: "Meus clientes",
            value: String(data.totalClients),
            detail: "Clientes vinculados a você",
            icon: Users,
          },
        ]
      : []),
    ...(data?.appointments
      ? [
          {
            title: "Agendamentos",
            value: String(data.appointments.count),
            detail: `${data.appointments.completed} concluído(s) no mês`,
            icon: CalendarDays,
          },
        ]
      : []),
    ...(data?.finance
      ? [
          {
            title: "Minha participação",
            value: money(data.finance.earnings),
            detail: `${data.finance.percentage}% dos atendimentos pagos no mês`,
            icon: Wallet,
          },
        ]
      : []),
    ...(data?.birthdays
      ? [
          {
            title: "Aniversariantes",
            value: String(data.birthdays.length),
            detail: "Meus clientes · próximos 30 dias",
            icon: Cake,
          },
        ]
      : []),
  ];
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-12 w-12 sm:h-14 sm:w-14">
            {data?.artist.photoUrl && (
              <AvatarImage
                src={data.artist.photoUrl}
                alt={`Foto de ${data.artist.name}`}
                className="object-cover"
              />
            )}
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {(data?.artist.name || user?.name || "A").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
              Olá,{" "}
              {(data?.artist.name || user?.name || "Artista").split(" ")[0]}
            </h1>
            <p className="text-sm text-muted-foreground">
              Seu painel de artista{" "}
              <span className="capitalize">{month && `· ${month}`}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("appointments") && (
            <Button size="sm" onClick={() => navigate("/schedule")}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Minha agenda
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCard(v => !v)}
          >
            <Contact className="mr-2 h-4 w-4" />
            Meu cartão
          </Button>
        </div>
      </div>

      {panel.isError ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p role="alert" className="text-sm">
              Não foi possível carregar seu painel. Tente novamente.
            </p>
            <Button variant="outline" size="sm" onClick={() => panel.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : panel.isLoading ? (
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
          {metrics.map(metric => (
            <Card key={metric.title} className="min-w-0">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 pb-2 pt-4">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <metric.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="break-words text-xl font-bold tabular-nums sm:text-2xl">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metric.detail}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {data?.upcoming && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Próximos atendimentos
              </CardTitle>
              <CardDescription>Sua agenda a partir de hoje</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.upcoming.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum atendimento agendado a partir de hoje.
                </p>
              ) : (
                data.upcoming.map(a => (
                  <button
                    key={a.id}
                    onClick={() => navigate("/schedule")}
                    className="flex w-full min-w-0 items-start gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:border-primary/50"
                  >
                    <div className="shrink-0 rounded-md bg-primary/10 px-2 py-2 text-center text-xs font-medium text-primary">
                      <p>{dateLabel(a.date)}</p>
                      <p className="mt-1">{a.date.slice(11, 16)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">
                        {a.clientName || "Cliente"}
                      </p>
                      <p className="mt-1 break-words text-xs text-muted-foreground">
                        {a.service}
                      </p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {statuses[a.status] || a.status}
                      </Badge>
                    </div>
                    <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
              {data.upcoming.some(a => a.date.slice(0, 10) === data.today) && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
                  <Bell className="h-4 w-4 shrink-0" />
                  Você tem atendimento(s) hoje. Confira sua agenda.
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {data?.birthdays && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cake className="h-4 w-4 text-primary" />
                Aniversariantes
              </CardTitle>
              <CardDescription>
                Seus clientes nos próximos 30 dias
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.birthdays.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum aniversário nos próximos 30 dias.
                </p>
              ) : (
                data.birthdays.slice(0, 5).map(b => (
                  <button
                    key={b.id}
                    onClick={() => navigate(`/clients/${b.id}`)}
                    className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border/50 p-3 text-left hover:border-primary/50"
                  >
                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                      <Cake className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">
                        {b.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.days === 0 ? "Hoje" : `Em ${b.days} dia(s)`}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm">
                      {dateLabel(b.date)}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}
        {can("stock") && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4 text-primary" />
                Meu estoque
              </CardTitle>
              <CardDescription>
                Materiais próprios ou disponibilizados para você
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stock.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : stock.isError ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  Não foi possível consultar seu estoque.
                </p>
              ) : !stock.data?.length ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Você ainda não tem materiais disponíveis.
                </p>
              ) : lowStock.length ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                    {lowStock.length} material(is) no limite mínimo
                  </p>
                  {lowStock.slice(0, 4).map(m => (
                    <div
                      key={m.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 break-words">{m.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {Number(m.currentQuantity)} {m.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-4 text-green-500">
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                  <p className="text-sm">
                    Seus materiais estão acima do mínimo.
                  </p>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => navigate("/stock")}
              >
                Abrir estoque
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
        {data?.consumables && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-4 w-4 text-primary" />
                Minhas sessões e insumos
              </CardTitle>
              <CardDescription className="capitalize">{month}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {data.consumables.sessions}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sessões cadastradas neste mês
                </p>
              </div>
              <div className="border-t pt-3">
                <p className="break-words text-xl font-semibold">
                  {money(Math.round(data.consumables.estimatedCost * 100))}
                </p>
                <p className="text-xs text-muted-foreground">
                  Custo estimado dos insumos registrados
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/procedures")}
              >
                Abrir sessões
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acesso rápido</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {can("clients") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/clients")}
            >
              <Users className="mr-2 h-4 w-4" />
              Meus clientes
            </Button>
          )}
          {canWrite("clients") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/clients/new")}
            >
              Novo cliente
            </Button>
          )}
          {can("quotes") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/quotes")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Orçamentos
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/commitments")}
          >
            <Bell className="mr-2 h-4 w-4" />
            Meus lembretes
          </Button>
          {can("reports") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/reports")}
            >
              Relatórios
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Meus acessos
              <ChevronDown className="ml-auto h-4 w-4" />
            </summary>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {access.data
                ?.filter(p => !!p.canRead)
                .map(p => (
                  <div key={p.module} className="min-w-0 rounded-lg border p-3">
                    <p className="break-words text-sm font-medium">
                      {ARTIST_ACCESS_LABELS[p.module]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.canWrite
                        ? "Visualizar e editar"
                        : "Somente visualizar"}
                    </p>
                  </div>
                ))}
              {access.data?.every(p => !p.canRead) && (
                <p className="text-sm text-muted-foreground">
                  Solicite ao proprietário acesso às áreas de trabalho.
                </p>
              )}
            </div>
          </details>
        </CardContent>
      </Card>
      {showCard && user?.artistId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meu cartão de artista</CardTitle>
            <CardDescription>
              Personalize sua apresentação pública
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArtistCardEditor
              artistId={user.artistId}
              name={data?.artist.name || user.name || "Artista"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
