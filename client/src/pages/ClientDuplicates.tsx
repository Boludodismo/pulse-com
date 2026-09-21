import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  mergeFields,
  identityText,
  identityPhone,
  type MergeField,
} from "@shared/clientDuplicates";

const selectClass =
  "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm";
const display = (value: any) =>
  value == null || value === "" ? "Não informado" : String(value);
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100
  );
export default function ClientDuplicates() {
  const [, navigate] = useLocation(),
    utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const manager = user?.role === "admin" || user?.role === "superadmin";
  const global = user?.role === "superadmin" && !user.studioId;
  const [studio, setStudio] = useState("");
  const { data: studios = [] } = trpc.saas.studios.useQuery(undefined, {
    enabled: !!global,
  });
  const scope = useMemo(
    () => (global ? { studioId: Number(studio) || undefined } : {}),
    [global, studio]
  );
  const enabled = !!manager && (!global || !!studio);
  const [search, setSearch] = useState(""),
    [limit, setLimit] = useState(30);
  const [pair, setPair] = useState<{
    targetId: number;
    sourceId: number;
  } | null>(null);
  const [choices, setChoices] = useState<Partial<Record<MergeField, number>>>(
    {}
  );
  const [samePerson, setSamePerson] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const [manual, setManual] = useState(false),
    [first, setFirst] = useState(""),
    [second, setSecond] = useState("");
  const candidates = trpc.clientMerge.candidates.useQuery(scope, { enabled });
  const history = trpc.clientMerge.history.useQuery(scope, { enabled });
  const previewInput = {
    ...scope,
    targetId: pair?.targetId || 1,
    sourceId: pair?.sourceId || 2,
    choices,
  };
  const preview = trpc.clientMerge.preview.useQuery(previewInput, {
    enabled: enabled && !!pair,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const confirm = trpc.clientMerge.confirm.useMutation({
    onSuccess: async result => {
      toast.success(
        `Cadastros unidos. Registro de auditoria #${result.auditId}.`
      );
      setPair(null);
      setChoices({});
      setSamePerson(false);
      setReviewed(false);
      await Promise.all([
        utils.clientMerge.invalidate(),
        utils.clients.invalidate(),
        utils.contactImport.invalidate(),
        utils.messaging.invalidate(),
        utils.pod.invalidate(),
      ]);
    },
    onError: async error => {
      toast.error(error.message);
      setSamePerson(false);
      setReviewed(false);
      await preview.refetch();
    },
  });
  useEffect(() => {
    setSamePerson(false);
    setReviewed(false);
  }, [pair, choices, preview.data?.hash]);
  const clients = candidates.data?.clients || [];
  const byId = new Map(clients.map(c => [Number(c.id), c]));
  const matches = (client: any) => {
    const text = identityText(search),
      digits = search.replace(/\D/g, "");
    return (
      !text ||
      identityText(
        [client.name, client.email, ...client.tags].join(" ")
      ).includes(text) ||
      (digits.length > 0 && identityPhone(client.phone).includes(digits)) ||
      String(client.id) === search.trim()
    );
  };
  const pairs = (candidates.data?.pairs || []).filter(
    p => matches(byId.get(p.a)) || matches(byId.get(p.b))
  );
  const manualClients = clients.filter(matches);
  const pick = (targetId: number, sourceId: number) => {
    setPair({ targetId, sourceId });
    setChoices({});
    setSamePerson(false);
    setReviewed(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const data = preview.data;
  const principal = data?.clients.find(c => Number(c.id) === pair?.targetId);
  const source = data?.clients.find(c => Number(c.id) === pair?.sourceId);
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Revisar clientes duplicados</h1>
          <p className="text-sm text-muted-foreground">
            Compare dois cadastros e escolha quais informações manter.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={confirm.isPending}
          onClick={() => (pair ? setPair(null) : navigate("/clients"))}
        >
          {pair ? "Voltar à lista" : "Voltar aos clientes"}
        </Button>
      </div>
      {!manager && user && (
        <p>A revisão está disponível para administradores.</p>
      )}
      {global && (
        <label className="block space-y-2">
          Empresa
          <select
            className={selectClass}
            value={studio}
            onChange={e => {
              setStudio(e.target.value);
              setPair(null);
              setChoices({});
            }}
          >
            <option value="">Selecione a empresa</option>
            {studios.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {enabled && !pair && (
        <>
          <Card>
            <CardContent className="space-y-3 pt-5 text-sm">
              <p>
                Nomes e telefones iguais são apenas sugestões. Confirme que se
                trata da mesma pessoa antes de unir. Nenhum cadastro é unido
                automaticamente.
              </p>
              <p className="text-muted-foreground">
                Você escolhe o principal, revisa os dados e vê os históricos que
                serão reunidos. O cadastro de origem é arquivado e a operação
                fica registrada.
              </p>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              aria-label="Buscar possíveis duplicados"
              placeholder="Buscar por nome, telefone, e-mail ou etiqueta"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setLimit(30);
              }}
            />
            <Button variant="outline" onClick={() => setManual(!manual)}>
              {manual ? "Fechar escolha manual" : "Escolher dois cadastros"}
            </Button>
          </div>
          {manual && (
            <Card>
              <CardContent className="space-y-3 pt-5">
                <p className="text-sm">
                  Use a busca acima para localizar cada cadastro. A seleção
                  permanece enquanto você pesquisa o outro.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      value: first,
                      set: setFirst,
                      label: "Cadastro principal",
                    },
                    {
                      value: second,
                      set: setSecond,
                      label: "Cadastro de origem",
                    },
                  ].map(control => (
                    <label key={control.label} className="space-y-1 text-sm">
                      {control.label}
                      <select
                        className={selectClass}
                        value={control.value}
                        onChange={e => control.set(e.target.value)}
                      >
                        <option value="">Selecione</option>
                        {(control.value &&
                        !manualClients.some(c => String(c.id) === control.value)
                          ? [byId.get(Number(control.value)), ...manualClients]
                          : manualClients
                        )
                          .filter(Boolean)
                          .map(c => (
                            <option key={c!.id} value={c!.id}>
                              #{c!.id} · {c!.name} ·{" "}
                              {c!.phone || "Sem telefone"}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
                <Button
                  disabled={!first || !second || first === second}
                  onClick={() => pick(Number(first), Number(second))}
                >
                  Comparar cadastros escolhidos
                </Button>
              </CardContent>
            </Card>
          )}
          {candidates.isLoading ? (
            <p>Procurando possíveis duplicados…</p>
          ) : candidates.error ? (
            <p role="alert">{candidates.error.message}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {pairs.length} comparação(ões) sugerida(s). Um cliente pode
                aparecer em mais de uma comparação.
              </p>
              {!pairs.length && (
                <p>
                  Nenhuma sugestão encontrada para esta busca. Você também pode
                  escolher dois cadastros manualmente.
                </p>
              )}
              {pairs.slice(0, limit).map(p => (
                <Card key={`${p.a}:${p.b}`}>
                  <CardContent className="space-y-3 pt-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[p.a, p.b].map(id => {
                        const c = byId.get(id)!;
                        return (
                          <div key={id} className="min-w-0">
                            <p className="break-words font-medium">
                              {c.name}{" "}
                              <span className="text-xs text-muted-foreground">
                                #{id}
                              </span>
                            </p>
                            <p className="break-words text-sm text-muted-foreground">
                              {c.phone || "Sem telefone"} ·{" "}
                              {c.email || "Sem e-mail"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {c.appointmentCount} agendamento(s) ·{" "}
                              {money(Number(c.totalSpent))}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.reasons.map(r => (
                        <Badge key={r} variant="secondary">
                          {r}
                        </Badge>
                      ))}
                      {p.conflicts.map(r => (
                        <Badge
                          key={r}
                          variant="outline"
                          className="text-amber-500"
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="outline" onClick={() => pick(p.a, p.b)}>
                      Comparar #{p.a} e #{p.b}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {pairs.length > limit && (
                <Button variant="outline" onClick={() => setLimit(limit + 30)}>
                  Mostrar mais comparações
                </Button>
              )}
            </>
          )}
          {!!history.data?.length && (
            <Card>
              <CardHeader>
                <CardTitle>Últimas uniões</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.data.map(h => (
                  <div className="text-sm" key={h.id}>
                    <p>
                      #{h.source_id} {h.source_name} → #{h.target_id}{" "}
                      {h.target_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Registro #{h.id} · Administrador #{h.actor_id} ·{" "}
                      {h.created_at}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
      {pair && (
        <>
          {preview.isFetching && (
            <p role="status">Conferindo dados e históricos…</p>
          )}
          {preview.error && (
            <div role="alert" className="space-y-2">
              <p>{preview.error.message}</p>
              <Button variant="outline" onClick={() => preview.refetch()}>
                Atualizar prévia
              </Button>
            </div>
          )}
          {data && principal && source && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { c: principal, label: "Principal: permanece ativo" },
                  { c: source, label: "Origem: será arquivado" },
                ].map(({ c, label }) => (
                  <Card key={label}>
                    <CardHeader>
                      <CardTitle className="text-base">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="break-words font-semibold">
                        {c.name} · #{c.id}
                      </p>
                      <p className="text-sm">{c.phone || "Sem telefone"}</p>
                      <Button
                        className="mt-3"
                        variant="link"
                        onClick={() =>
                          window.open(`/clients/${c.id}`, "_blank", "noopener")
                        }
                      >
                        Consultar histórico
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button
                variant="outline"
                disabled={confirm.isPending}
                onClick={() => pick(pair.sourceId, pair.targetId)}
              >
                Trocar o cadastro principal
              </Button>
              <Card>
                <CardHeader>
                  <CardTitle>Dados que ficarão no principal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Por padrão, os dados do principal são mantidos. Escolha a
                    origem para completar campos vazios ou resolver diferenças.
                    O tipo do documento acompanha o documento escolhido.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(Object.entries(mergeFields) as [MergeField, string][])
                      .filter(
                        ([key]) => principal[key] != null || source[key] != null
                      )
                      .map(([key, label]) => (
                        <label key={key} className="min-w-0 space-y-1 text-sm">
                          <span className="font-medium">{label}</span>
                          <select
                            className={selectClass}
                            disabled={confirm.isPending}
                            value={choices[key] ?? pair.targetId}
                            onChange={e =>
                              setChoices({
                                ...choices,
                                [key]: Number(e.target.value),
                              })
                            }
                          >
                            <option value={pair.targetId}>
                              Principal: {display(principal[key])}
                            </option>
                            <option value={pair.sourceId}>
                              Origem: {display(source[key])}
                            </option>
                          </select>
                          {display(principal[key]) !== display(source[key]) && (
                            <p className="break-words text-xs text-muted-foreground">
                              Principal: {display(principal[key])}
                              <br />
                              Origem: {display(source[key])}
                            </p>
                          )}
                        </label>
                      ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Históricos reunidos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th className="pb-2">Histórico</th>
                          <th className="px-2 pb-2">Principal</th>
                          <th className="px-2 pb-2">Origem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.counts.map(r => (
                          <tr key={r.table} className="border-t">
                            <td className="py-2">{r.label}</td>
                            <td className="px-2">{r.principal}</td>
                            <td className="px-2">{r.origem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm">
                    Totais do cadastro: {data.counters.appointmentCount}{" "}
                    agendamento(s) · {money(data.counters.totalSpent)}.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sessões, fotos, materiais, lotes, validades e receitas
                    mantêm seus registros. Etiquetas repetidas ficam apenas uma
                    vez. Lançamentos e agendamentos são reunidos sem excluir
                    possíveis repetições.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp e acompanhamentos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.consentRecords.map(r => (
                      <div key={r.clientId} className="rounded border p-3">
                        <p className="font-medium">
                          Cadastro #{r.clientId}: {r.status}
                        </p>
                        <p>{r.phone || "Sem telefone autorizado"}</p>
                        {r.source && (
                          <p className="break-words text-xs text-muted-foreground">
                            Origem: {r.source}
                          </p>
                        )}
                        {r.date && (
                          <p className="text-xs text-muted-foreground">
                            {r.date}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p>{data.consent.message}</p>
                  <p>
                    As autorizações do cadastro arquivado serão desativadas.
                  </p>
                  <p>
                    {data.pendingMessages} mensagem(ns) pendente(s) e{" "}
                    {data.pendingCare} acompanhamento(s) pendente(s) serão
                    cancelados para revisão. Mensagens já enviadas permanecem no
                    histórico.
                  </p>
                </CardContent>
              </Card>
              {!!data.conflicts.length && (
                <div className="rounded-lg border border-amber-500/40 p-4 text-sm">
                  <p className="font-medium">Confira estas diferenças:</p>
                  {data.conflicts.map(c => (
                    <p key={c}>{c}</p>
                  ))}
                </div>
              )}
              {!!data.blockers.length && (
                <div
                  role="alert"
                  className="space-y-2 rounded-lg border border-destructive p-4"
                >
                  <p className="font-semibold">Resolva antes de unir</p>
                  {data.blockers.map(b => (
                    <p key={b} className="text-sm">
                      {b}
                    </p>
                  ))}
                  <Button variant="outline" onClick={() => preview.refetch()}>
                    Atualizar prévia
                  </Button>
                </div>
              )}
              <Card>
                <CardContent className="space-y-4 pt-5">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={samePerson}
                      disabled={confirm.isPending || preview.isFetching}
                      onChange={e => setSamePerson(e.target.checked)}
                    />
                    Conferi os dados e confirmo que os cadastros #
                    {pair.targetId} e #{pair.sourceId} pertencem à mesma pessoa.
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={reviewed}
                      disabled={confirm.isPending || preview.isFetching}
                      onChange={e => setReviewed(e.target.checked)}
                    />
                    Revisei os campos, os históricos e os efeitos sobre
                    autorizações e acompanhamentos. Quero arquivar a origem e
                    reunir os históricos no principal.
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Esta ação fica na auditoria. Não há desfazer automático.
                  </p>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={
                      !samePerson ||
                      !reviewed ||
                      confirm.isPending ||
                      preview.isFetching ||
                      !!preview.error ||
                      !!data.blockers.length
                    }
                    onClick={() =>
                      confirm.mutate({
                        ...previewInput,
                        hash: data.hash,
                        samePerson: true,
                        reviewed: true,
                      })
                    }
                  >
                    {confirm.isPending
                      ? "Unindo cadastros…"
                      : `Confirmar união no cadastro #${pair.targetId}`}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
