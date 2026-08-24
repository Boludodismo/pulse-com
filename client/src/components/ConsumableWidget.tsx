import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useLocation } from "wouter";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function formatCurrencyFloat(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function VariationBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.1;
  if (isNeutral) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-red-500" : "text-green-500"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

export default function ConsumableWidget() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.procedures.consumableSummary.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const grossMarginPct = data && data.current.totalRevenue > 0
    ? ((data.current.totalRevenue - data.current.totalCost) / data.current.totalRevenue) * 100
    : null;

  return (
    <Card
      className="cursor-pointer hover:bg-accent/30 transition-colors"
      onClick={() => setLocation("/reports")}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Insumos POD
          </CardTitle>
          {data && (
            <span className="text-[11px] text-muted-foreground capitalize">{data.current.label}</span>
          )}
        </div>
        <CardDescription className="text-xs">Custo de materiais e margem bruta das sessões</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Dados indisponíveis</p>
        ) : (
          <div className="space-y-3">
            {/* Custo total do mês */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {formatCurrencyFloat(data.current.totalCost)}
                </p>
                <p className="text-xs text-muted-foreground">Custo total de insumos</p>
              </div>
              <VariationBadge value={data.costVariation} />
            </div>

            {/* Separador */}
            <div className="border-t border-border" />

            {/* Margem bruta média por sessão */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xl font-semibold text-green-500">
                  {formatCurrencyFloat(data.current.avgGrossMargin)}
                </p>
                <p className="text-xs text-muted-foreground">Margem bruta média / sessão</p>
              </div>
              <VariationBadge value={data.marginVariation} />
            </div>

            {/* Linha de rodapé: sessões + % margem */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {data.current.sessions} sessão{data.current.sessions !== 1 ? "s" : ""} no mês
              </span>
              {grossMarginPct !== null && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                  grossMarginPct >= 60 ? "bg-green-500/10 text-green-600" :
                  grossMarginPct >= 30 ? "bg-yellow-500/10 text-yellow-600" :
                  "bg-red-500/10 text-red-600"
                }`}>
                  {grossMarginPct.toFixed(0)}% margem
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
