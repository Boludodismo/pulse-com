import { useState, useMemo } from "react";

// Tipos explícitos para o retorno da API
interface ArtistPeriod {
  period: string;
  revenue: number;
  appointments: number;
  completed: number;
  avgTicket: number;
}

interface ArtistData {
  name: string;
  totalRevenue: number;
  totalAppointments: number;
  percentage: number;
  avgTicket: number;
  periods: ArtistPeriod[];
}

interface ArtistRevenueData {
  artists: ArtistData[];
  periods: string[];
  grandTotal: number;
  groupBy: string;
}
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter,
  ZAxis, LineChart, Line,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2, PieChart as PieChartIcon, Circle, TrendingUp } from "lucide-react";

// Paleta de cores para artistas (laranja, âmbar, vermelho, ouro, etc.)
const ARTIST_COLORS = [
  "#f97316", "#fb923c", "#fbbf24", "#f59e0b",
  "#ef4444", "#dc2626", "#e11d48", "#be185d",
  "#d97706", "#b45309", "#92400e", "#78350f",
];

type GroupBy = "week" | "month" | "bimonth" | "year";
type ChartType = "bubbles" | "bars" | "pie" | "lines";

interface PeriodOption {
  label: string;
  value: GroupBy;
  startDate: string;
  endDate: string;
}

function getPeriodOptions(): PeriodOption[] {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

  // Semana atual
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Mês atual
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Bimestre atual (últimos 2 meses)
  const startOfBimonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfBimonth = endOfMonth;

  // Ano atual
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

  return [
    { label: "Semanal", value: "week", startDate: fmt(startOfWeek), endDate: fmt(endOfWeek) },
    { label: "Mensal", value: "month", startDate: fmt(startOfMonth), endDate: fmt(endOfMonth) },
    { label: "Bimestral", value: "bimonth", startDate: fmt(startOfBimonth), endDate: fmt(endOfBimonth) },
    { label: "Anual", value: "year", startDate: fmt(startOfYear), endDate: fmt(endOfYear) },
  ];
}

function formatCurrency(value: number) {
  // Valores armazenados em centavos no banco
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatPeriodLabel(period: string, groupBy: GroupBy) {
  if (groupBy === "week") {
    const [year, week] = period.split("-");
    return `Sem ${week}/${year}`;
  }
  if (groupBy === "bimonth") {
    const [year, bim] = period.split("-");
    return `${bim}/${year}`;
  }
  if (groupBy === "year") return period;
  // month: YYYY-MM
  const [year, month] = period.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

// Componente de bolha customizado para o ScatterChart
const CustomBubble = (props: {
  cx?: number; cy?: number; r?: number; fill?: string; name?: string; value?: number;
}) => {
  const { cx = 0, cy = 0, r = 0, fill } = props;
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={fill}
      fillOpacity={0.85}
      stroke={fill}
      strokeWidth={2}
      strokeOpacity={0.4}
    />
  );
};

export function ArtistRevenueChart() {
  const periodOptions = useMemo(() => getPeriodOptions(), []);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>(periodOptions[1]); // Mensal por padrão
  const [chartType, setChartType] = useState<ChartType>("bubbles");
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());

  const { data: rawData, isLoading } = trpc.reports.artistRevenue.useQuery({
    startDate: selectedPeriod.startDate,
    endDate: selectedPeriod.endDate,
    groupBy: selectedPeriod.value,
  });

  // Normalizar data para evitar never[]
  const data: ArtistRevenueData | null = useMemo(() => {
    if (!rawData || Array.isArray(rawData)) return null;
    return rawData as ArtistRevenueData;
  }, [rawData]);

  // Artistas filtrados
  const filteredArtists = useMemo(() => {
    if (!data) return [];
    if (selectedArtists.size === 0) return data.artists;
    return data.artists.filter((a) => selectedArtists.has(a.name));
  }, [data, selectedArtists]);

  const toggleArtist = (name: string) => {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Dados para gráfico de barras agrupadas por período
  const barData = useMemo(() => {
    if (!data) return [];
    return data.periods.map((period) => {
      const entry: Record<string, string | number> = {
        period: formatPeriodLabel(period, selectedPeriod.value),
      };
      for (const artist of filteredArtists) {
        const p = artist.periods.find((pp) => pp.period === period);
        entry[artist.name] = p ? p.revenue : 0;
      }
      return entry;
    });
  }, [data, filteredArtists, selectedPeriod.value]);

  // Dados para gráfico de pizza (totais por artista)
  const pieData = useMemo(() => {
    if (!data) return [];
    return filteredArtists.map((a, i) => ({
      name: a.name,
      value: a.totalRevenue,
      color: ARTIST_COLORS[i % ARTIST_COLORS.length],
    }));
  }, [filteredArtists]);

  // Dados para gráfico de bolhas (receita = tamanho, artista = cor, período = eixo X)
  const bubbleData = useMemo(() => {
    if (!data) return [];
    return filteredArtists.flatMap((artist, ai) =>
      artist.periods.map((p, pi) => ({
        x: pi,
        y: artist.totalRevenue > 0 ? (p.revenue / artist.totalRevenue) * 100 : 0,
        z: p.revenue,
        name: artist.name,
        period: formatPeriodLabel(p.period, selectedPeriod.value),
        revenue: p.revenue,
        appointments: p.appointments,
        color: ARTIST_COLORS[ai % ARTIST_COLORS.length],
      }))
    );
  }, [filteredArtists, selectedPeriod.value]);

  // Dados para gráfico de linhas
  const lineData = useMemo(() => barData, [barData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.artists || data.artists.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Receita por Tatuador</CardTitle>
          <CardDescription>Nenhum dado disponível para o período selecionado</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Receita por Tatuador</CardTitle>
            <CardDescription>
              Total: <span className="font-semibold text-orange-500">{formatCurrency(data.grandTotal)}</span>
              {" · "}{data.artists.length} artistas
            </CardDescription>
          </div>

          {/* Seletor de período */}
          <div className="flex flex-wrap gap-1">
            {periodOptions.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={selectedPeriod.value === opt.value ? "default" : "outline"}
                className={selectedPeriod.value === opt.value
                  ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
                  : ""}
                onClick={() => setSelectedPeriod(opt)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Seletor de tipo de gráfico */}
        <div className="flex gap-1 mt-2">
          <Button
            size="sm" variant={chartType === "bubbles" ? "default" : "ghost"}
            className={chartType === "bubbles" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            onClick={() => setChartType("bubbles")}
          >
            <Circle className="h-4 w-4 mr-1" /> Círculos
          </Button>
          <Button
            size="sm" variant={chartType === "bars" ? "default" : "ghost"}
            className={chartType === "bars" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            onClick={() => setChartType("bars")}
          >
            <BarChart2 className="h-4 w-4 mr-1" /> Barras
          </Button>
          <Button
            size="sm" variant={chartType === "pie" ? "default" : "ghost"}
            className={chartType === "pie" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            onClick={() => setChartType("pie")}
          >
            <PieChartIcon className="h-4 w-4 mr-1" /> Pizza
          </Button>
          <Button
            size="sm" variant={chartType === "lines" ? "default" : "ghost"}
            className={chartType === "lines" ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            onClick={() => setChartType("lines")}
          >
            <TrendingUp className="h-4 w-4 mr-1" /> Linhas
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filtro de artistas */}
        <div className="flex flex-wrap gap-2 mb-4">
          {data.artists.map((artist, i) => {
            const isSelected = selectedArtists.size === 0 || selectedArtists.has(artist.name);
            return (
              <button
                key={artist.name}
                onClick={() => toggleArtist(artist.name)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                  isSelected
                    ? "opacity-100 border-transparent"
                    : "opacity-40 border-dashed border-muted-foreground"
                }`}
                style={isSelected ? {
                  backgroundColor: ARTIST_COLORS[i % ARTIST_COLORS.length] + "22",
                  borderColor: ARTIST_COLORS[i % ARTIST_COLORS.length],
                  color: ARTIST_COLORS[i % ARTIST_COLORS.length],
                } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: ARTIST_COLORS[i % ARTIST_COLORS.length] }}
                />
                {artist.name.split(" ")[0]}
                <span className="ml-1 opacity-70">{artist.percentage}%</span>
              </button>
            );
          })}
          {selectedArtists.size > 0 && (
            <button
              onClick={() => setSelectedArtists(new Set())}
              className="text-xs text-muted-foreground underline px-1"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {/* GRÁFICO DE CÍRCULOS/BOLHAS */}
        {chartType === "bubbles" && (
          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Tamanho do círculo = receita no período. Posição vertical = % da receita total do artista.
            </p>
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Período"
                  tickCount={data.periods.length}
                  tickFormatter={(v) => {
                    const p = data.periods[v];
                    return p ? formatPeriodLabel(p, selectedPeriod.value) : "";
                  }}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="% Receita"
                  unit="%"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  domain={[0, 100]}
                />
                <ZAxis type="number" dataKey="z" range={[200, 3000]} name="Receita" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "Receita") return [formatCurrency(value), "Receita"];
                    if (name === "% Receita") return [`${value.toFixed(1)}%`, "% do total"];
                    return [value, name];
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
                        <p className="font-semibold text-sm mb-1" style={{ color: d.color }}>{d.name}</p>
                        <p>Período: <span className="font-medium">{d.period}</span></p>
                        <p>Receita: <span className="font-medium text-orange-500">{formatCurrency(d.revenue)}</span></p>
                        <p>Agendamentos: <span className="font-medium">{d.appointments}</span></p>
                        <p>% do total: <span className="font-medium">{d.y?.toFixed(1)}%</span></p>
                      </div>
                    );
                  }}
                />
                {filteredArtists.map((artist, i) => (
                  <Scatter
                    key={artist.name}
                    name={artist.name}
                    data={bubbleData.filter((b) => b.name === artist.name)}
                    fill={ARTIST_COLORS[i % ARTIST_COLORS.length]}
                    shape={<CustomBubble />}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* GRÁFICO DE BARRAS */}
        {chartType === "bars" && (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 100000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {filteredArtists.map((artist, i) => (
                <Bar
                  key={artist.name}
                  dataKey={artist.name}
                  fill={ARTIST_COLORS[i % ARTIST_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={40}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* GRÁFICO DE PIZZA */}
        {chartType === "pie" && (
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={60}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    percent > 0.05 ? `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%` : ""
                  }
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Receita"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 min-w-[200px]">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate max-w-[120px]">{entry.name}</span>
                  </div>
                  <span className="font-medium text-orange-400">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRÁFICO DE LINHAS */}
        {chartType === "lines" && (
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={lineData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 100000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {filteredArtists.map((artist, i) => (
                <Line
                  key={artist.name}
                  type="monotone"
                  dataKey={artist.name}
                  stroke={ARTIST_COLORS[i % ARTIST_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: ARTIST_COLORS[i % ARTIST_COLORS.length] }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Tabela de ranking */}
        <div className="mt-6 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tatuador</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Receita Total</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Agendamentos</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Ticket Médio</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">% Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredArtists.map((artist, i) => (
                <tr key={artist.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: ARTIST_COLORS[i % ARTIST_COLORS.length] }}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{artist.name}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-orange-400">
                    {formatCurrency(artist.totalRevenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {artist.totalAppointments}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {formatCurrency(artist.avgTicket)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${artist.percentage}%`,
                            backgroundColor: ARTIST_COLORS[i % ARTIST_COLORS.length],
                          }}
                        />
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: ARTIST_COLORS[i % ARTIST_COLORS.length], color: ARTIST_COLORS[i % ARTIST_COLORS.length] }}
                      >
                        {artist.percentage}%
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
