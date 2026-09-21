import type { SessionPreparation } from "@shared/sessionPreparation";
import { Button } from "./ui/button";

export default function SessionPreparationSummary({
  preparation,
  onMaterial,
  onRecipe,
}: {
  preparation: SessionPreparation | null | undefined;
  onMaterial?: (id: number, quantity: string, unit: string) => void;
  onRecipe?: (index: number) => void;
}) {
  if (
    !preparation ||
    (!preparation.materials.length && !preparation.colors.length)
  )
    return null;
  return (
    <details className="rounded-lg border p-3 space-y-3">
      <summary className="cursor-pointer min-h-11 font-medium">
        Preparação da sessão · {preparation.materials.length} materiais ·{" "}
        {preparation.colors.length} cores
      </summary>
      <p className="text-sm text-muted-foreground">
        Quantidades e receitas previstas. Consulte o consumo confirmado para
        saber o que já foi utilizado.
      </p>
      {preparation.materials.map(item => (
        <div
          className="border rounded p-2 space-y-2"
          key={item.tenantMaterialId}
        >
          <p className="text-sm">
            {item.name} · {Number(item.quantity).toLocaleString("pt-BR")}{" "}
            {item.unit}
          </p>
          {onMaterial && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onMaterial(item.tenantMaterialId, item.quantity, item.unit)
              }
            >
              Preparar consumo
            </Button>
          )}
        </div>
      ))}
      {preparation.colors.map((color, i) => (
        <div key={i} className="border rounded p-2 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="h-9 w-9 rounded border shrink-0"
              style={{ backgroundColor: color.hex }}
            />
            <p className="text-sm">
              P{String(i + 1).padStart(2, "0")} · {color.name} · {color.hex}
            </p>
          </div>
          {!!color.ingredients.length && (
            <>
              <p className="text-sm">
                Batoque {color.cupSize} · {color.dropsPerMl} gotas/ml
              </p>
              {color.ingredients.map(item => (
                <p className="text-sm" key={item.tenantMaterialId}>
                  {item.name}: {item.drops} gotas ·{" "}
                  {(
                    (item.drops /
                      color.ingredients.reduce((n, i) => n + i.drops, 0)) *
                    100
                  ).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  %
                </p>
              ))}
              {onRecipe && (
                <Button size="sm" variant="outline" onClick={() => onRecipe(i)}>
                  Carregar receita para revisar
                </Button>
              )}
            </>
          )}
        </div>
      ))}
    </details>
  );
}
