import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function LowStockWidget() {
  const { data, isLoading } = trpc.stock.getLowStock.useQuery(undefined, {
    refetchInterval: 10 * 60 * 1000, // revalida a cada 10 min
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">Alerta de Estoque</CardTitle>
          <CardDescription>Materiais abaixo ou no limite mínimo</CardDescription>
        </div>
        <Package className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-2">
            {data.map((mat: any) => {
              const current = parseFloat(String(mat.currentStock));
              const min = parseFloat(String(mat.minStock));
              // Crítico: estoque zerado ou muito abaixo do mínimo (< 50% do mínimo)
              const isCritical = min > 0 && current < min * 0.5;

              return (
                <div
                  key={mat.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-colors ${
                    isCritical
                      ? "bg-red-500/8 border-red-500/25"
                      : "bg-amber-500/8 border-amber-500/25"
                  }`}
                >
                  {/* Ícone de alerta */}
                  <div
                    className={`flex items-center justify-center h-8 w-8 rounded-md shrink-0 ${
                      isCritical
                        ? "bg-red-500/15 text-red-600"
                        : "bg-amber-500/15 text-amber-600"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>

                  {/* Nome e categoria */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mat.name}</p>
                    {mat.category && (
                      <p className="text-xs text-muted-foreground truncate">{mat.category}</p>
                    )}
                  </div>

                  {/* Quantidade atual */}
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        isCritical ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {current % 1 === 0 ? current.toFixed(0) : current.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      mín: {min % 1 === 0 ? min.toFixed(0) : min.toFixed(1)} {mat.unit || "un"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-500 opacity-70" />
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Estoque em nível ideal
            </p>
            <p className="text-xs text-muted-foreground">Todos os materiais estão acima do mínimo</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
