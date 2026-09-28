import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { toast } from "sonner";
const validity = (s: string | null | undefined) =>
  s ? s.slice(0, 10).split("-").reverse().join("/") : "não registrada";
function Swatch({ hex, label }: { hex: string; label: string }) {
  const color = /^#[0-9a-f]{6,8}$/i.test(hex) ? hex : "#808080";
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-10 w-10 shrink-0 rounded border"
        style={{ backgroundColor: color }}
        aria-label={`${label}: ${hex}`}
      />
      <div className="text-sm">
        <p>{label}</p>
        <code>{hex}</code>
      </div>
    </div>
  );
}
function SessionColors({ procedure }: { procedure: any }) {
  const [open, setOpen] = useState(false),
    [copyText, setCopyText] = useState("");
  const samples = trpc.pod.session.listColorSamples.useQuery(
    { procedureId: procedure.id },
    { enabled: open }
  );
  const recipes = trpc.pod.session.listInkRecipes.useQuery(
    { procedureId: procedure.id },
    { enabled: open }
  );
  async function copy(recipe: any) {
    const sample = samples.data?.find(s => s.id === recipe.sampleId);
    const text = [
      `Receita ${recipe.code} · Sessão #${procedure.id} · ${procedure.title || "Sessão tattoo"}`,
      sample
        ? `Referência ${sample.code}: ${sample.hex}`
        : "Sem cor de referência vinculada",
      recipe.result
        ? `Resultado registrado: ${recipe.result.hex}`
        : "Resultado de cor não registrado",
      `${recipe.cupSize ? `Batoque ${recipe.cupSize}: ${recipe.cupCapacityMl} ml` : "Sem recipiente definido"} · Total ${recipe.totalDrops} gotas / ${recipe.estimatedMl} ml · ${recipe.dropsPerMl} gotas/ml`,
      ...recipe.items.map(
        (i: any) =>
          `${i.nameSnapshot}${i.brandSnapshot ? " · " + i.brandSnapshot : ""}: ${i.drops} gotas (${i.percentage}% / ${i.estimatedMl} ml) · Lote ${i.lotSnapshot || "não registrado"} · Validade ${validity(i.expiresAtSnapshot)}`
      ),
      recipe.status === "reverted"
        ? "Receita desfeita; consumo revertido."
        : "Receita registrada na sessão.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Receita copiada para consulta.");
    } catch {
      setCopyText(text);
      toast.info("Copie a receita no campo abaixo.");
    }
  }
  const list = recipes.data || [];
  function recipeCard(r: any) {
    return (
      <article key={r.id} className="rounded-lg border p-3 space-y-3">
        <div className="flex flex-wrap gap-2 justify-between">
          <h4 className="font-semibold">
            Mistura {r.code}
            {r.status === "reverted" ? " · Desfeita" : ""}
          </h4>
          <Button variant="outline" size="sm" onClick={() => void copy(r)}>
            Copiar receita {r.code}
          </Button>
        </div>
        {r.result ? (
          <Swatch hex={r.result.hex} label="Resultado registrado da mistura" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Cor resultante ainda não registrada.
          </p>
        )}
        <p className="text-sm">
          {r.cupSize ? `Batoque ${r.cupSize} · capacidade ${Number(r.cupCapacityMl)} ml` : "Sem recipiente definido"} ·{" "}
          {r.totalDrops} gotas · volume estimado {Number(r.estimatedMl)} ml ·
          conversão {Number(r.dropsPerMl)} gotas/ml
        </p>
        <ul className="space-y-2">
          {r.items.map((i: any) => (
            <li key={i.id} className="rounded border p-2 text-sm">
              <p className="font-medium">
                {i.nameSnapshot} {i.brandSnapshot && `· ${i.brandSnapshot}`}
              </p>
              <p>
                {i.drops} gotas · {Number(i.percentage)}% ·{" "}
                {Number(i.estimatedMl)} ml
              </p>
              <p className="text-muted-foreground">
                Lote: {i.lotSnapshot || "não registrado"} · Validade:{" "}
                {validity(i.expiresAtSnapshot)}
              </p>
            </li>
          ))}
        </ul>
      </article>
    );
  }
  return (
    <details
      className="rounded-lg border p-3"
      onToggle={e => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer min-h-11 font-medium">
        {procedure.title || "Sessão tattoo"} · Sessão #{procedure.id}
        {procedure.createdAt
          ? ` · ${validity(String(procedure.createdAt))}`
          : ""}
      </summary>
      {open && (
        <div className="space-y-4 mt-3">
          {(samples.isLoading || recipes.isLoading) && (
            <p>Carregando paleta e receitas…</p>
          )}
          {(samples.error || recipes.error) && (
            <p role="alert">
              {samples.error?.message || recipes.error?.message}
            </p>
          )}
          {samples.data?.length === 0 && recipes.data?.length === 0 && (
            <p>Nenhuma paleta ou mistura registrada nesta sessão.</p>
          )}
          {samples.data?.length ? (
            <>
              <p className="text-sm text-muted-foreground">
                Cores de referência salvas na sessão. As receitas abaixo mostram
                as misturas registradas e seus resultados, quando disponíveis.
              </p>
              <div className="flex flex-wrap gap-3">
                {samples.data.map(s => (
                  <Swatch key={s.id} hex={s.hex} label={s.code} />
                ))}
              </div>
            </>
          ) : null}
          {samples.data?.map(s => (
            <section key={s.id} className="space-y-2">
              <Swatch hex={s.hex} label={`Referência ${s.code}`} />
              <p className="text-xs text-muted-foreground">
                RGB {s.red} / {s.green} / {s.blue} · CMYK {s.cyan} / {s.magenta}{" "}
                / {s.yellow} / {s.black}
              </p>
              {list.filter(r => r.sampleId === s.id).map(recipeCard)}
              {!list.some(r => r.sampleId === s.id) && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma mistura vinculada a esta cor.
                </p>
              )}
            </section>
          ))}
          {list
            .filter(
              r => !r.sampleId || !samples.data?.some(s => s.id === r.sampleId)
            )
            .map(recipeCard)}
          {copyText && (
            <label className="block">
              Receita para copiar
              <textarea
                className="w-full min-h-48 rounded border bg-background p-3 text-base"
                readOnly
                value={copyText}
              />
            </label>
          )}
          <a className="text-sm underline" href={`/procedures/${procedure.id}`}>
            Abrir sessão e referência
          </a>
        </div>
      )}
    </details>
  );
}
export default function ClientColorHistory({ clientId }: { clientId: number }) {
  const q = trpc.procedures.listByClient.useQuery({ clientId });
  return (
    <section className="rounded-xl border p-4 mb-5 space-y-3">
      <h3 className="font-semibold">Paletas e receitas de cores por sessão</h3>
      <p className="text-sm text-muted-foreground">
        Abra uma sessão para consultar as cores, proporções e lotes das
        misturas. Copiar uma receita não movimenta o estoque.
      </p>
      {q.isLoading && <p>Carregando sessões…</p>}
      {q.error && <p role="alert">{q.error.message}</p>}
      {q.data?.length === 0 && <p>Nenhuma sessão cadastrada.</p>}
      {q.data?.map(p => (
        <SessionColors key={p.id} procedure={p} />
      ))}
    </section>
  );
}
