import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Forecast = {
  material: {
    id: number;
    name: string;
    unit: string;
    ownerArtistId: number | null;
  };
  projectedQuantity: number;
  replenishmentQuantity: number;
  expiredQuantity: number;
  level: string;
  authorized: boolean;
};
export function MaterialForecast({ rows }: { rows: Array<Forecast | null> }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-semibold">Previsão até a sessão</p>
      {rows
        .filter((r): r is Forecast => r != null)
        .map(r => (
          <div
            key={r.material.id}
            className={`rounded-md border px-3 py-2 text-xs ${r.level === "shortage" ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" : r.level === "attention" ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium break-words">
                {r.material.name} ·{" "}
                {r.material.ownerArtistId == null
                  ? "Estúdio"
                  : "Estoque do artista"}
              </span>
              <strong>
                {r.level === "shortage"
                  ? "Falta prevista"
                  : r.level === "attention"
                    ? "Atenção ao mínimo"
                    : "Suficiente"}
              </strong>
            </div>
            <p className="mt-1">
              Saldo previsto:{" "}
              {r.projectedQuantity.toLocaleString("pt-BR", {
                maximumFractionDigits: 3,
              })}{" "}
              {r.material.unit}
              {r.replenishmentQuantity > 0
                ? ` · repor pelo menos ${r.replenishmentQuantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${r.material.unit}`
                : ""}
            </p>
            {!r.authorized && (
              <p>
                Material inativo ou não disponibilizado para este artista.
                Revise a seleção.
              </p>
            )}
            {r.expiredQuantity > 0 && (
              <p>
                Desconsiderados {r.expiredQuantity.toLocaleString("pt-BR")}{" "}
                {r.material.unit} com validade anterior à sessão.
              </p>
            )}
          </div>
        ))}
      <p className="text-xs text-muted-foreground">
        Considera os demais agendamentos até esta data e a validade dos lotes.
        Planejar não reserva nem baixa o saldo. Após salvar, os riscos geram
        avisos ao artista e ao estúdio.
      </p>
    </div>
  );
}
export function PlannedQuantityEditor({
  id,
  value,
  unit,
  onSaved,
}: {
  id: number;
  value: string;
  unit: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(value);
  const update = trpc.pod.planning.updateQuantity.useMutation({
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
    onError: e => toast.error(e.message),
  });
  if (!editing)
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => {
          setQuantity(value);
          setEditing(true);
        }}
      >
        Quantidade
      </Button>
    );
  return (
    <div className="flex flex-wrap gap-1">
      <Input
        className="w-24"
        aria-label={`Quantidade em ${unit}`}
        inputMode="decimal"
        value={quantity}
        onChange={e => setQuantity(e.target.value.replace(",", "."))}
      />
      <Button
        type="button"
        size="sm"
        disabled={update.isPending}
        onClick={() =>
          update.mutate({
            plannedMaterialId: id,
            expectedQuantity: value,
            quantity,
          })
        }
      >
        Salvar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={update.isPending}
        onClick={() => setEditing(false)}
      >
        Voltar
      </Button>
    </div>
  );
}
