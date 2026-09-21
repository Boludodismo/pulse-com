import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { parseMoneyCents, settlement } from "@shared/sessionFinalization";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";

export const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const date = (value?: string | null) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "não informada";
const STEPS = ["Materiais", "Cores", "Fotos", "Pagamento", "Revisão"];
function Color({ hex }: { hex: string }) {
  return (
    <span
      className="h-9 w-9 rounded border shrink-0 inline-block"
      style={{ backgroundColor: /^#[a-f0-9]{6}$/i.test(hex) ? hex : "#808080" }}
      aria-label={`Cor ${hex}`}
    />
  );
}

export default function SessionFinalization({
  procedureId,
  open,
  onClose,
  onMaterials,
  onColors,
  onPhoto,
  uploading,
  onSuccess,
}: {
  procedureId: number;
  open: boolean;
  onClose: () => void;
  onMaterials: () => void;
  onColors: () => void;
  onPhoto: () => void;
  uploading: boolean;
  onSuccess: () => void;
}) {
  const preview = trpc.procedures.finalizationPreview.useQuery(
    { procedureId },
    { enabled: open, refetchOnWindowFocus: true }
  );
  const data = preview.data;
  const utils = trpc.useUtils();
  const [step, setStep] = useState(0),
    [reviewed, setReviewed] = useState(false);
  const [total, setTotal] = useState(""),
    [received, setReceived] = useState("0,00");
  const [receiptIds, setReceiptIds] = useState<number[]>([]);
  const [method, setMethod] = useState<
    "pix" | "dinheiro" | "credito" | "debito" | "transferencia"
  >("pix");
  const [notes, setNotes] = useState(""),
    [nextSteps, setNextSteps] = useState("");
  const initialized = useRef(false),
    requestId = useRef<string>(crypto.randomUUID());
  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;
    setTotal(
      (
        (data.procedure.chargedAmount || data.appointment?.totalAmount || 0) /
        100
      )
        .toFixed(2)
        .replace(".", ",")
    );
  }, [data]);
  useEffect(() => {
    setReviewed(false);
  }, [
    data?.hash,
    total,
    received,
    receiptIds,
    method,
    notes,
    nextSteps,
    uploading,
  ]);
  useEffect(() => {
    if (open && !uploading) void preview.refetch();
  }, [open, uploading]);
  const finalize = trpc.procedures.finalize.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.procedures.invalidate(),
        utils.pod.session.invalidate(),
        utils.appointments.invalidate(),
        utils.transactions.invalidate(),
      ]);
      toast.success(
        "Sessão concluída. Recebimentos e saldo registrados na revisão."
      );
      onSuccess();
    },
    onError: error => {
      setReviewed(false);
      toast.error(error.message);
      void preview.refetch();
    },
  });
  const totalCents = parseMoneyCents(total),
    receivedCents = parseMoneyCents(received);
  let amounts: ReturnType<typeof settlement> | undefined,
    error = "";
  try {
    if (totalCents == null || receivedCents == null)
      throw new Error(
        "Informe os valores em reais, com até duas casas decimais."
      );
    amounts = settlement(
      totalCents,
      receivedCents,
      receiptIds,
      data?.receipts || []
    );
  } catch (e) {
    error = (e as Error).message;
  }
  const go = (next: number) => {
    if (next > step && next === 4 && error) return toast.error(error);
    setStep(next);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v && !finalize.isPending && !uploading) onClose();
      }}
    >
      <DialogContent className="w-[calc(100%_-_1rem)] max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Concluir sessão · {data?.procedure.title || "Revisão"}
          </DialogTitle>
        </DialogHeader>
        <nav
          aria-label="Etapas da conclusão"
          className="grid grid-cols-5 gap-1 shrink-0"
        >
          {STEPS.map((label, i) => (
            <Button
              key={label}
              variant={step === i ? "default" : "outline"}
              className="h-auto min-h-12 px-1 text-[10px] sm:text-xs whitespace-normal"
              aria-current={step === i ? "step" : undefined}
              disabled={finalize.isPending || uploading}
              onClick={() => go(i)}
            >
              {i + 1}. {label}
            </Button>
          ))}
        </nav>
        <div className="overflow-y-auto overscroll-contain min-h-0 flex-1 space-y-4 py-2">
          {preview.isLoading && <p>Carregando os registros da sessão…</p>}
          {preview.error && <p role="alert">{preview.error.message}</p>}
          {data?.procedure.status === "finalizado" && (
            <p role="alert">
              Esta sessão já foi concluída. Feche a revisão para consultar o
              histórico.
            </p>
          )}
          {data && (
            <fieldset
              disabled={finalize.isPending}
              className="space-y-4 min-w-0"
            >
              {step === 0 && (
                <>
                  <h3 className="font-semibold">Consumo confirmado</h3>
                  <p className="text-sm text-muted-foreground">
                    Confira os materiais e os lotes realmente utilizados.
                    Concluir a sessão não repete a baixa do estoque.
                  </p>
                  {!data.consumptions.some(i => i.status === "consumido") && (
                    <p>Nenhum consumo de estoque confirmado.</p>
                  )}
                  {data.consumptions
                    .filter(i => i.status === "consumido")
                    .map(i => (
                      <article
                        key={i.id}
                        className="rounded-lg border p-3 text-sm space-y-1"
                      >
                        <p className="font-medium">
                          {i.nameSnapshot} ·{" "}
                          {Number(i.quantity).toLocaleString("pt-BR")}{" "}
                          {i.unitSnapshot}
                        </p>
                        <p>
                          Lote: {i.lotSnapshot || "não informado"} · Validade:{" "}
                          {date(i.expiresAtSnapshot)}
                        </p>
                        <p className="text-muted-foreground">
                          Fornecedor:{" "}
                          {i.supplierNameSnapshot || "não informado"}
                        </p>
                      </article>
                    ))}
                  {!!data.legacy.length && (
                    <details className="border rounded p-3">
                      <summary>
                        Lançamentos avulsos de insumos ({data.legacy.length})
                      </summary>
                      <p className="text-xs">
                        Estes registros não comprovam baixa nem lote do estoque.
                      </p>
                      {data.legacy.map(i => (
                        <p key={i.id} className="text-sm">
                          {i.name} · {Number(i.quantity)} {i.unit}
                        </p>
                      ))}
                    </details>
                  )}
                  {!!data.planned.filter(i => i.status === "planejado")
                    .length && (
                    <div className="text-sm border rounded p-3">
                      <p className="font-medium">
                        Previstos no agendamento, sem consumo confirmado
                      </p>
                      {data.planned
                        .filter(i => i.status === "planejado")
                        .map(i => (
                          <p key={i.id}>
                            {i.nameSnapshot} · {Number(i.quantityPlanned)}{" "}
                            {i.unitSnapshot}
                          </p>
                        ))}
                      <p className="text-muted-foreground mt-2">
                        Itens apenas previstos não serão descontados.
                      </p>
                    </div>
                  )}
                  {!!data.preparation?.materials.length && (
                    <div className="border rounded p-3 text-sm space-y-2">
                      <h4 className="font-semibold">
                        Preparação inicial × consumo confirmado
                      </h4>
                      {data.preparation.materials.map(i => (
                        <p key={i.tenantMaterialId}>
                          {i.name}: previsto{" "}
                          {Number(i.quantity).toLocaleString("pt-BR")} {i.unit}{" "}
                          · utilizado{" "}
                          {data.consumptions
                            .filter(
                              c =>
                                c.status === "consumido" &&
                                c.tenantMaterialId === i.tenantMaterialId &&
                                c.unitSnapshot === i.unit
                            )
                            .reduce((sum, c) => sum + Number(c.quantity), 0)
                            .toLocaleString("pt-BR")}{" "}
                          {i.unit}
                        </p>
                      ))}
                      <p className="text-muted-foreground">
                        A preparação é apenas uma previsão; confirme no estoque
                        somente o que foi utilizado.
                      </p>
                    </div>
                  )}
                  <Button variant="outline" onClick={onMaterials}>
                    Voltar ao estoque para ajustar consumo
                  </Button>
                </>
              )}
              {step === 1 && (
                <>
                  <h3 className="font-semibold">Paleta e misturas da sessão</h3>
                  <p className="text-sm text-muted-foreground">
                    Confira as cores e as receitas salvas. Cores com código P
                    foram preparadas antes da sessão; misturas utilizadas
                    aparecem abaixo.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {data.samples.map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Color hex={s.hex} />
                        <span className="text-sm">
                          {s.code}
                          <br />
                          {s.hex}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!data.samples.length && <p>Nenhuma cor salva.</p>}
                  {data.recipes
                    .filter(r => r.status !== "reverted")
                    .map(r => {
                      const result = data.results.find(
                        i => i.recipeId === r.id
                      );
                      return (
                        <article
                          key={r.id}
                          className="rounded border p-3 text-sm space-y-2"
                        >
                          <p className="font-semibold">
                            Mistura {r.code} · Batoque {r.cupSize} ·{" "}
                            {Number(r.estimatedMl)} ml
                          </p>
                          {data.recipeItems
                            .filter(i => i.recipeId === r.id)
                            .map(i => (
                              <p key={i.id}>
                                {i.nameSnapshot} · {i.drops} gotas ·{" "}
                                {Number(i.percentage)}%<br />
                                <span className="text-muted-foreground">
                                  Lote: {i.lotSnapshot || "não informado"} ·
                                  Validade: {date(i.expiresAtSnapshot)}
                                </span>
                              </p>
                            ))}
                          {result ? (
                            <div className="flex items-center gap-2">
                              <Color hex={result.hex} />
                              <p>Resultado registrado: {result.hex}</p>
                            </div>
                          ) : (
                            <p className="text-amber-500">
                              Resultado visual da mistura ainda não registrado.
                            </p>
                          )}
                        </article>
                      );
                    })}
                  <Button variant="outline" onClick={onColors}>
                    Abrir painel para salvar cores e resultados
                  </Button>
                </>
              )}
              {step === 2 && (
                <>
                  <h3 className="font-semibold">Foto final e continuidade</h3>
                  {data.procedure.finalImageUrl ? (
                    <img
                      src={data.procedure.finalImageUrl}
                      alt="Foto final da sessão"
                      className="max-h-64 max-w-full rounded object-contain"
                    />
                  ) : (
                    <p className="text-sm">
                      Nenhuma foto final anexada. Você pode concluir sem foto e
                      acrescentar depois.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    disabled={uploading}
                    onClick={onPhoto}
                  >
                    {uploading
                      ? "Enviando foto…"
                      : data.procedure.finalImageUrl
                        ? "Adicionar outra foto final"
                        : "Anexar foto final"}
                  </Button>
                  <label className="block text-sm space-y-1">
                    Observações finais
                    <Textarea
                      value={notes}
                      maxLength={4000}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="O que foi realizado e observações do atendimento"
                    />
                  </label>
                  <label className="block text-sm space-y-1">
                    Pontos para a próxima sessão
                    <Textarea
                      value={nextSteps}
                      maxLength={4000}
                      onChange={e => setNextSteps(e.target.value)}
                      placeholder="Áreas a continuar, ajustes e detalhes para retomar o projeto"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    As observações anteriores serão preservadas.
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  <h3 className="font-semibold">Pagamento desta sessão</h3>
                  <label className="block text-sm">
                    Valor total da sessão (R$)
                    <Input
                      inputMode="decimal"
                      value={total}
                      onChange={e => setTotal(e.target.value)}
                    />
                  </label>
                  <details className="rounded border p-3">
                    <summary className="cursor-pointer min-h-11">
                      Selecionar recebimentos já registrados
                    </summary>
                    <p className="text-sm text-muted-foreground mb-3">
                      Marque somente pagamentos deste atendimento. Cada
                      lançamento selecionado será atribuído integralmente a esta
                      sessão e não será lançado novamente. Mostrando até 200
                      entradas recentes do cliente.
                    </p>
                    {!data.receipts.length && (
                      <p className="text-sm">Nenhum recebimento disponível.</p>
                    )}
                    {data.receipts.map(r => (
                      <label
                        key={r.id}
                        className="flex items-start gap-3 border-b py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 shrink-0"
                          checked={receiptIds.includes(r.id)}
                          onChange={e =>
                            setReceiptIds(ids =>
                              e.target.checked
                                ? [...ids, r.id]
                                : ids.filter(id => id !== r.id)
                            )
                          }
                        />
                        <span>
                          {money(r.amount)} · {date(r.date)} · #{r.id}
                          <br />
                          {r.description || r.category}
                          <br />
                          <span className="text-muted-foreground">
                            {r.appointmentId
                              ? `Agendamento #${r.appointmentId}`
                              : "Sem vínculo com agendamento"}{" "}
                            · {r.paymentMethod}
                          </span>
                        </span>
                      </label>
                    ))}
                  </details>
                  <label className="block text-sm">
                    Valor recebido agora (R$)
                    <Input
                      inputMode="decimal"
                      value={received}
                      onChange={e => setReceived(e.target.value)}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Informe apenas o dinheiro recebido e ainda não lançado.
                    Deixe zero para concluir com saldo pendente ou quando tudo
                    já estiver registrado.
                  </p>
                  {!!receivedCents && (
                    <label className="block text-sm">
                      Forma do novo pagamento
                      <select
                        className="w-full block p-3 rounded border bg-background"
                        value={method}
                        onChange={e =>
                          setMethod(e.target.value as typeof method)
                        }
                      >
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="credito">Cartão de crédito</option>
                        <option value="debito">Cartão de débito</option>
                        <option value="transferencia">Transferência</option>
                      </select>
                    </label>
                  )}
                  {error && (
                    <p role="alert" className="text-amber-500 text-sm">
                      {error}
                    </p>
                  )}
                  {amounts && (
                    <div className="rounded border p-3 text-sm space-y-1">
                      <p>
                        Já registrado e selecionado:{" "}
                        {money(amounts.previousCents)}
                      </p>
                      <p>Novo recebimento: {money(amounts.receivedCents)}</p>
                      <p className="font-semibold">
                        Saldo pendente: {money(amounts.outstandingCents)}
                      </p>
                    </div>
                  )}
                </>
              )}
              {step === 4 && (
                <>
                  <h3 className="font-semibold">Confira antes de concluir</h3>
                  <p>
                    {data.clientName} · {data.procedure.title}
                  </p>
                  <ul className="list-disc pl-5 text-sm space-y-2">
                    <li>
                      {
                        data.consumptions.filter(i => i.status === "consumido")
                          .length
                      }{" "}
                      consumos confirmados no estoque.
                    </li>
                    <li>
                      {data.samples.length} cores e{" "}
                      {data.recipes.filter(r => r.status !== "reverted").length}{" "}
                      misturas registradas.
                    </li>
                    <li>
                      Foto final:{" "}
                      {data.procedure.finalImageUrl ? "anexada" : "não anexada"}
                      .
                    </li>
                    {data.appointment && (
                      <li>
                        O agendamento #{data.appointment.id} será marcado como
                        concluído.
                      </li>
                    )}
                  </ul>
                  {amounts && (
                    <div className="rounded border p-3 text-sm space-y-1">
                      <p>Total da sessão: {money(amounts.totalCents)}</p>
                      <p>
                        Recebimentos anteriores selecionados:{" "}
                        {money(amounts.previousCents)}
                      </p>
                      <p>Registrar agora: {money(amounts.receivedCents)}</p>
                      <p className="font-semibold">
                        Saldo pendente: {money(amounts.outstandingCents)}
                      </p>
                    </div>
                  )}
                  {error && <p role="alert">{error}</p>}
                  {notes && (
                    <p className="text-sm whitespace-pre-wrap">
                      Observações: {notes}
                    </p>
                  )}
                  {nextSteps && (
                    <p className="text-sm whitespace-pre-wrap">
                      Próxima sessão: {nextSteps}
                    </p>
                  )}
                  <section className="border rounded p-3 space-y-2">
                    <h4 className="font-semibold">Acompanhamento pós-sessão</h4>
                    {data.followUp.map(r => (
                      <p key={r.id} className="text-sm">
                        {r.name} · {date(r.dueDate)}
                      </p>
                    ))}
                    {!data.followUp.length && (
                      <p className="text-sm">
                        Nenhuma regra de acompanhamento ativa neste estúdio.
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {data.canMessage
                        ? "O cliente possui autorização em uma conexão ativa. O envio seguirá as regras configuradas e verificará novamente a autorização."
                        : "O envio automático depende de telefone, autorização do cliente e conexão WhatsApp ativa. Revise isso na central de consentimentos."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Concluir não envia uma mensagem imediatamente nem concede
                      consentimento.
                    </p>
                  </section>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 mt-1 shrink-0"
                      checked={reviewed}
                      onChange={e => setReviewed(e.target.checked)}
                    />
                    Conferi materiais, cores, observações e pagamentos. Posso
                    concluir esta sessão.
                  </label>
                </>
              )}
            </fieldset>
          )}
        </div>
        <div className="border-t pt-3 flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline"
            disabled={finalize.isPending || uploading}
            onClick={() => (step ? setStep(step - 1) : onClose())}
          >
            {step ? "Voltar" : "Continuar sessão"}
          </Button>
          {preview.error && (
            <Button variant="outline" onClick={() => void preview.refetch()}>
              Atualizar revisão
            </Button>
          )}
          <Button
            className="flex-1 whitespace-normal h-auto min-h-11"
            disabled={
              !data ||
              !!preview.error ||
              preview.isFetching ||
              finalize.isPending ||
              uploading ||
              data.procedure.status === "finalizado" ||
              (step === 4 && (!reviewed || !!error))
            }
            onClick={() => {
              if (step < 4) return go(step + 1);
              if (!data || !amounts || !reviewed) return;
              finalize.mutate({
                procedureId,
                requestId: requestId.current,
                previewHash: data.hash,
                totalCents: amounts.totalCents,
                receivedCents: amounts.receivedCents,
                receiptIds,
                paymentMethod: method,
                notes,
                nextSteps,
                reviewed: true,
              });
            }}
          >
            {finalize.isPending
              ? "Concluindo…"
              : step === 4
                ? "Confirmar e concluir sessão"
                : "Continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
