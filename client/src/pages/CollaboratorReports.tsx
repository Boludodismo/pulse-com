import { useState, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";
import {
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pencil,
  BarChart3,
  Percent,
  ArrowUpRight,
  Building2,
} from "lucide-react";

type Period = "daily" | "weekly" | "monthly" | "annual";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  annual: "Anual",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getRefDate(period: Period, offset: number): string {
  const now = new Date();
  if (period === "daily") {
    now.setDate(now.getDate() + offset);
  } else if (period === "weekly") {
    now.setDate(now.getDate() + offset * 7);
  } else if (period === "monthly") {
    now.setMonth(now.getMonth() + offset);
  } else {
    now.setFullYear(now.getFullYear() + offset);
  }
  return now.toISOString().slice(0, 10);
}

function periodLabel(period: Period, refDate: string): string {
  const d = new Date(refDate + "T12:00:00");
  if (period === "daily") {
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }
  if (period === "weekly") {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return `${mon.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${sun.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  if (period === "monthly") {
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  return String(d.getFullYear());
}

export default function CollaboratorReports() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [period, setPeriod] = useState<Period>("monthly");
  const [offset, setOffset] = useState(0);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [editRateOpen, setEditRateOpen] = useState(false);
  const [editArtistId, setEditArtistId] = useState<number | null>(null);
  const [editPercentage, setEditPercentage] = useState<string>("50");
  const [editNotes, setEditNotes] = useState<string>("");

  const refDate = useMemo(() => getRefDate(period, offset), [period, offset]);

  const { data: rates = [], refetch: refetchRates } = trpc.collaboratorRates.list.useQuery();
  const { data: summary = [], isLoading: summaryLoading } = trpc.collaboratorReports.summary.useQuery({
    period,
    referenceDate: refDate,
  });
  const { data: artistDetail, isLoading: detailLoading } = trpc.collaboratorReports.byPeriod.useQuery(
    { artistName: selectedArtist!, period, referenceDate: refDate },
    { enabled: !!selectedArtist }
  );

  const upsertRateMutation = trpc.collaboratorRates.upsert.useMutation({
    onSuccess: () => {
      toast.success("Percentual atualizado com sucesso!");
      setEditRateOpen(false);
      refetchRates();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleEditRate = (artistId: number, currentPercentage: number, currentNotes: string | null) => {
    setEditArtistId(artistId);
    setEditPercentage(String(currentPercentage));
    setEditNotes(currentNotes || "");
    setEditRateOpen(true);
  };

  const handleSaveRate = () => {
    if (!editArtistId) return;
    const pct = parseInt(editPercentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Percentual deve ser entre 0 e 100");
      return;
    }
    upsertRateMutation.mutate({
      artistId: editArtistId,
      percentage: pct,
      notes: editNotes || undefined,
    });
  };

  const totalRevenue = summary.reduce((s, a) => s + a.totalRevenue, 0);
  const totalPaid = summary.reduce((s, a) => s + a.paidRevenue, 0);
  const totalCollaborator = summary.reduce((s, a) => s + a.collaboratorEarnings, 0);
  const totalStudio = summary.reduce((s, a) => s + a.studioEarnings, 0);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Relatórios de Colaboradores</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Acompanhe os ganhos e percentuais de cada artista
          </p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="text-orange-400 border-orange-400/50 gap-1 text-xs sm:text-sm whitespace-nowrap">
            <Percent className="h-3 w-3" />
            <span className="hidden sm:inline">Modo Administrador</span><span className="sm:hidden">Admin</span>
          </Badge>
        )}
      </div>

      {/* Controles de Período */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-3 flex-wrap">
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-full sm:w-auto overflow-x-auto">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPeriod(p); setOffset(0); }}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                period === p
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 ml-auto sm:ml-auto w-full sm:w-auto">
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setOffset(o => o - 1)}>
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <span className="text-xs sm:text-sm font-medium min-w-[120px] sm:min-w-[180px] text-center capitalize">
            {periodLabel(period, refDate)}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}>
            <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>

      {/* Cards de Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Receita Total</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{formatBRL(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Receita Paga</span>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-500">{formatBRL(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Colaboradores</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-blue-500">{formatBRL(totalCollaborator)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Estúdio</span>
              <Building2 className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-orange-500">{formatBRL(totalStudio)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Colaboradores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Desempenho por Colaborador
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : summary.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Nenhum artista cadastrado
            </div>
          ) : (
            <div className="space-y-2">
              {summary.map((artist) => {
                const rate = rates.find(r => r.artistId === artist.artistId);
                return (
                  <div
                    key={artist.artistId}
                    className={`rounded-lg border p-4 cursor-pointer transition-all hover:border-primary/50 ${
                      selectedArtist === artist.artistName
                        ? "border-primary bg-primary/5"
                        : "border-border/50"
                    }`}
                    onClick={() => setSelectedArtist(
                      selectedArtist === artist.artistName ? null : artist.artistName
                    )}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      {/* Info do artista */}
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {artist.artistName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{artist.artistName}</p>
                          <p className="text-xs text-muted-foreground">
                            {artist.specialty || "Tatuador"} · {artist.totalAppointments} agendamento(s)
                          </p>
                        </div>
                      </div>

                      {/* Percentual + editar */}
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Percentual</p>
                          <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-primary">{artist.percentage}%</span>
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditRate(artist.artistId, artist.percentage, rate?.notes ?? null);
                                }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Valores */}
                        <div className="hidden sm:grid grid-cols-3 gap-4 text-right ml-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Receita</p>
                            <p className="text-sm font-semibold">{formatBRL(artist.totalRevenue)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Colaborador</p>
                            <p className="text-sm font-semibold text-blue-500">{formatBRL(artist.collaboratorEarnings)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Estúdio</p>
                            <p className="text-sm font-semibold text-orange-500">{formatBRL(artist.studioEarnings)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barra de progresso do percentual */}
                    <div className="mt-3">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full transition-all"
                          style={{ width: `${artist.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Colaborador {artist.percentage}%</span>
                        <span>Estúdio {100 - artist.percentage}%</span>
                      </div>
                    </div>

                    {/* Valores mobile */}
                    <div className="sm:hidden grid grid-cols-3 gap-2 mt-3 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Receita</p>
                        <p className="text-sm font-semibold">{formatBRL(artist.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Colabo.</p>
                        <p className="text-sm font-semibold text-blue-500">{formatBRL(artist.collaboratorEarnings)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Estúdio</p>
                        <p className="text-sm font-semibold text-orange-500">{formatBRL(artist.studioEarnings)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detalhe do Artista Selecionado */}
      {selectedArtist && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Agendamentos de {selectedArtist} — {periodLabel(period, refDate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : !artistDetail || artistDetail.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agendamento neste período.</p>
            ) : (
              <div className="space-y-2">
                {artistDetail.appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground text-xs min-w-[80px]">
                        {new Date(apt.date).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                        {" "}
                        {apt.date.slice(11, 16)}
                      </div>
                      <div>
                        <p className="font-medium">{apt.clientName || "Cliente"}</p>
                        <p className="text-xs text-muted-foreground">{apt.service}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-semibold">R$ {apt.totalAmountBRL}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Colaborador</p>
                        <p className="font-semibold text-blue-500">R$ {apt.collaboratorAmountBRL}</p>
                      </div>
                      <div>
                        {apt.paymentStatus === "pago" ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Pago</Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-400 border-orange-400/30 text-xs">Pendente</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {/* Totais do artista */}
                <div className="border-t pt-3 mt-2 flex justify-end gap-6 text-sm">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Receita</p>
                    <p className="font-bold">{formatBRL(artistDetail.totalRevenue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Colaborador ({artistDetail.percentage}%)</p>
                    <p className="font-bold text-blue-500">{formatBRL(artistDetail.collaboratorEarnings)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Estúdio ({100 - artistDetail.percentage}%)</p>
                    <p className="font-bold text-orange-500">{formatBRL(artistDetail.studioEarnings)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de Edição de Percentual */}
      <Dialog open={editRateOpen} onOpenChange={setEditRateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Editar Percentual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Percentual do Colaborador (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={editPercentage}
                onChange={(e) => setEditPercentage(e.target.value)}
                className="mt-1.5"
                placeholder="Ex: 50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O estúdio receberá {100 - (parseInt(editPercentage) || 0)}%
              </p>
            </div>
            {/* Barra visual */}
            <div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, parseInt(editPercentage) || 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span className="text-blue-400">Colaborador {editPercentage || 0}%</span>
                <span className="text-orange-400">Estúdio {100 - (parseInt(editPercentage) || 0)}%</span>
              </div>
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1.5"
                placeholder="Ex: Contrato especial, comissão variável..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditRateOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveRate}
                disabled={upsertRateMutation.isPending}
              >
                {upsertRateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
