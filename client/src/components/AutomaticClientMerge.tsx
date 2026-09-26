import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { AutomaticPair } from "@shared/clientDuplicates";

export default function AutomaticClientMerge({
  scope,
  onCompare,
}: {
  scope: { studioId?: number };
  onCompare: (targetId: number, sourceId: number) => void;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<number[]>([]),
    [pairs, setPairs] = useState<AutomaticPair[] | null>(null),
    [reviewed, setReviewed] = useState(false);
  const [selectionScope, setSelectionScope] = useState(scope.studioId);
  const automatic = trpc.clientMerge.automatic.useQuery(scope, {
    enabled: false,
    retry: false,
  });
  const preview = trpc.clientMerge.previewBatch.useQuery(
    { ...scope, pairs: pairs || [] },
    { enabled: !!pairs?.length, retry: false, refetchOnWindowFocus: false }
  );
  useEffect(() => setReviewed(false), [preview.data?.hash]);
  const confirm = trpc.clientMerge.confirmBatch.useMutation({
    onSuccess: async result => {
      toast.success(
        `${result.count} duplicado(s) retirado(s) da lista ativa. Históricos reunidos. Registro #${result.batchId}.`
      );
      setOpen(false);
      setPairs(null);
      setSelected([]);
      setReviewed(false);
      await Promise.all([
        utils.clientMerge.invalidate(),
        utils.clients.invalidate(),
        utils.messaging.invalidate(),
        utils.pod.invalidate(),
        utils.contactImport.invalidate(),
      ]);
    },
    onError: async error => {
      toast.error(error.message);
      setReviewed(false);
      setPairs(null);
      await prepare();
    },
  });
  async function prepare() {
    setOpen(true);
    setPairs(null);
    setReviewed(false);
    setSelected([]);
    setSelectionScope(scope.studioId);
    const result = await automatic.refetch();
    if (result.data && !result.error)
      setSelected(
        result.data.items.filter(p => !p.blockers.length).map(p => p.sourceId)
      );
  }
  const scopeMatches = selectionScope === scope.studioId;
  const items = scopeMatches ? automatic.data?.items || [] : [];
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">
          Seleção automática de duplicados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O sistema sugere o principal com mais dados preenchidos e marca os
          cadastros compatíveis. Você revisa a seleção e confirma as uniões de
          uma vez. A busca automática considera todos os clientes desta empresa.
        </p>
        <Button
          onClick={prepare}
          disabled={automatic.isFetching || confirm.isPending}
        >
          {automatic.isFetching
            ? "Conferindo cadastros e históricos…"
            : open
              ? "Atualizar seleção automática"
              : "Selecionar automaticamente"}
        </Button>
        {open && scopeMatches && (
          <>
            <p className="text-sm">
              A seleção exige nome completo e CPF válido iguais, ou nome,
              telefone, e-mail e nascimento iguais, sem conflitos de identidade.
              Cadastros com sessões em andamento ou pausadas ficam para revisão
              posterior.
            </p>
            {automatic.error && <p role="alert">{automatic.error.message}</p>}
            {!automatic.isFetching && automatic.data && !items.length && (
              <p>
                Nenhum grupo disponível para seleção automática. Use as
                comparações individuais abaixo para analisar os casos com dados
                insuficientes ou sessões ativas.
              </p>
            )}
            {!!items.length && !automatic.isFetching && (
              <>
                <p className="text-sm">
                  {selected.length} origem(ns) selecionada(s) de {items.length}{" "}
                  exibida(s).{" "}
                  {automatic.data!.total > 30 &&
                    "São exibidas até 30 origens por rodada. Atualize a seleção após concluir para encontrar as demais."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={confirm.isPending}
                    onClick={() => {
                      setSelected(
                        items
                          .filter(p => !p.blockers.length)
                          .map(p => p.sourceId)
                      );
                      setPairs(null);
                      setReviewed(false);
                    }}
                  >
                    Marcar disponíveis
                  </Button>
                  <Button
                    variant="outline"
                    disabled={confirm.isPending}
                    onClick={() => {
                      setSelected([]);
                      setPairs(null);
                      setReviewed(false);
                    }}
                  >
                    Desmarcar todos
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map(item => {
                    const main = item.clients.find(
                        c => Number(c.id) === item.targetId
                      )!,
                      source = item.clients.find(
                        c => Number(c.id) === item.sourceId
                      )!;
                    return (
                      <div
                        key={item.sourceId}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <label className="flex items-start gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 h-5 w-5 shrink-0"
                            checked={selected.includes(item.sourceId)}
                            disabled={
                              !!item.blockers.length || confirm.isPending
                            }
                            onChange={e => {
                              setSelected(
                                e.target.checked
                                  ? [...selected, item.sourceId]
                                  : selected.filter(id => id !== item.sourceId)
                              );
                              setPairs(null);
                              setReviewed(false);
                            }}
                          />
                          <span className="min-w-0 break-words">
                            <strong>
                              Arquivar #{item.sourceId}: {source.name}
                            </strong>
                            <br />
                            Manter #{item.targetId}: {main.name}
                            <br />
                            <span className="text-muted-foreground">
                              Origem: {source.phone || "sem telefone"} ·
                              Principal: {main.phone || "sem telefone"}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {item.reasons.join(" · ")}
                            </span>
                          </span>
                        </label>
                        <details className="text-sm">
                          <summary className="cursor-pointer">
                            Ver dados de identificação
                          </summary>
                          <div className="space-y-2 pt-2">
                            {[
                              { c: main, label: "Principal" },
                              { c: source, label: "Origem" },
                            ].map(({ c, label }) => (
                              <p key={label} className="break-words">
                                <strong>
                                  {label} #{c.id}
                                </strong>
                                <br />
                                E-mail: {c.email || "Não informado"}
                                <br />
                                Documento: {c.docNumber || "Não informado"}
                                <br />
                                Nascimento:{" "}
                                {c.birthDate
                                  ? String(c.birthDate)
                                      .slice(0, 10)
                                      .split("-")
                                      .reverse()
                                      .join("/")
                                  : "Não informado"}
                              </p>
                            ))}
                          </div>
                        </details>
                        {item.blockers.map(b => (
                          <p key={b} className="text-sm text-amber-500">
                            {b}
                          </p>
                        ))}
                        <Button
                          variant="link"
                          disabled={confirm.isPending}
                          onClick={() =>
                            onCompare(item.targetId, item.sourceId)
                          }
                        >
                          Escolher dados ou outro principal
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  disabled={
                    !selected.length || confirm.isPending || preview.isFetching
                  }
                  onClick={() => {
                    setReviewed(false);
                    setPairs(
                      items
                        .filter(p => selected.includes(p.sourceId))
                        .map(p => ({
                          targetId: p.targetId,
                          sourceId: p.sourceId,
                        }))
                    );
                  }}
                >
                  Revisar {selected.length} união(ões)
                </Button>
              </>
            )}
            {pairs && (
              <div className="space-y-4 border-t pt-4">
                {preview.isFetching && (
                  <p role="status">Preparando a prévia da seleção…</p>
                )}
                {preview.error && <p role="alert">{preview.error.message}</p>}
                {preview.data && !preview.isFetching && (
                  <>
                    <h3 className="font-semibold">
                      Confira antes de confirmar
                    </h3>
                    <p className="text-sm">
                      Os campos do principal serão mantidos. Os históricos das
                      origens serão reunidos e as origens sairão da lista ativa.
                      Materiais, lotes, paletas e receitas permanecem
                      registrados. Cada união fica na auditoria; não há desfazer
                      automático.
                    </p>
                    {preview.data.items.map(item => (
                      <details
                        key={item.sourceId}
                        className="rounded border p-3"
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          #{item.sourceId} → principal #{item.targetId}:
                          históricos e autorizações
                        </summary>
                        <div className="space-y-2 pt-3 text-sm">
                          <p>
                            {item.consent.message.replace(
                              "os dois cadastros",
                              "todos os cadastros do grupo"
                            )}
                          </p>
                          <p>
                            {item.pendingMessages} mensagem(ns) e{" "}
                            {item.pendingCare} acompanhamento(s) pendente(s)
                            nesta comparação serão cancelados para revisão.
                            Registros do principal podem aparecer em mais de uma
                            comparação.
                          </p>
                          <ul className="space-y-1">
                            {item.counts.map(c => (
                              <li key={c.table}>
                                {c.label}: {c.principal} no principal +{" "}
                                {c.origem} na origem
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    ))}
                    {preview.data.items
                      .flatMap(p => p.blockers)
                      .map((b, i) => (
                        <p
                          role="alert"
                          key={i}
                          className="text-sm text-amber-500"
                        >
                          {b}
                        </p>
                      ))}
                    <label className="flex gap-3 items-start text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 shrink-0"
                        checked={reviewed}
                        disabled={confirm.isPending}
                        onChange={e => setReviewed(e.target.checked)}
                      />
                      Revisei todos os grupos selecionados, confirmo que cada
                      origem pertence à mesma pessoa que seu principal e
                      autorizo reunir os históricos e arquivar as origens.
                    </label>
                    <Button
                      disabled={
                        !reviewed ||
                        confirm.isPending ||
                        !!preview.error ||
                        preview.data.items.some(p => p.blockers.length > 0)
                      }
                      onClick={() =>
                        confirm.mutate({
                          ...scope,
                          pairs,
                          hash: preview.data!.hash,
                          reviewed: true,
                        })
                      }
                    >
                      {confirm.isPending
                        ? "Unindo seleção…"
                        : `Confirmar ${preview.data.count} união(ões)`}
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
