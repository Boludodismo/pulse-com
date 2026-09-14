import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import { formatMessageTimestamp } from "@shared/studioClock";

const selectClass =
  "min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const labels: Record<string, string> = {
  requested: "Solicitado",
  approved: "Aprovado · aguarda entrega",
  delivered: "Entregue · reposição pendente",
  settled: "Quitado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  returned: "Devolução confirmada",
  replaced: "Reposição confirmada",
  deadline_changed: "Prazo alterado",
};
const dateLabel = (value: string | null) =>
  value
    ? `${value.slice(0, 10).split("-").reverse().join("/")} às ${value.slice(11, 16)}`
    : "A definir pelo proprietário";
const amountLabel = (value: string | number) =>
  Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export default function InventoryLoans() {
  const { user } = useAuth();
  const manager = ["admin", "superadmin"].includes(user?.role ?? "");
  const artists = trpc.artists.list.useQuery();
  const list = trpc.pod.inventory.loans.list.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const [requestOpen, setRequestOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState("open");
  const [borrower, setBorrower] = useState(String(user?.artistId ?? ""));
  const [source, setSource] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [appointmentId, setAppointmentId] = useState("");
  const [notes, setNotes] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const catalog = trpc.pod.inventory.loans.catalog.useQuery(
    { borrowerArtistId: Number(borrower) },
    { enabled: requestOpen && Boolean(borrower) }
  );
  const appointments = trpc.appointments.list.useQuery(undefined, {
    enabled: requestOpen && Boolean(borrower),
  });
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.pod.inventory.invalidate();
    void utils.pod.planning.invalidate();
  };
  const request = trpc.pod.inventory.loans.request.useMutation({
    onSuccess: () => {
      setRequestOpen(false);
      refresh();
      toast.success(
        "Pedido registrado. O proprietário receberá o aviso para aprovar e definir o prazo."
      );
    },
    onError: e => toast.error(e.message),
  });
  const rows = (list.data ?? []).filter(
    l =>
      filter === "all" ||
      ["requested", "approved", "delivered"].includes(l.status)
  );
  const loan = list.data?.find(l => l.id === selected);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Empréstimos de materiais</h2>
          <p className="text-sm text-muted-foreground">
            Pedido, entrega e reposição registrados entre o estúdio e os
            artistas.
          </p>
        </div>
        <Button
          onClick={() => {
            setBorrower(String(user?.artistId ?? ""));
            setSource("");
            setQuantity("1");
            setAppointmentId("");
            setNotes("");
            setRequestKey(crypto.randomUUID());
            setRequestOpen(true);
          }}
        >
          Solicitar material
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "open" ? "default" : "outline"}
          onClick={() => setFilter("open")}
        >
          Em aberto
        </Button>
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Todos e histórico
        </Button>
      </div>
      {list.isLoading && <p role="status">Carregando empréstimos…</p>}
      {list.error && <p role="alert">{list.error.message}</p>}
      {!list.isLoading && !list.error && rows.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-muted-foreground">
          Nenhum empréstimo nesta lista.
        </p>
      )}
      <div className="grid gap-3 xl:grid-cols-2">
        {rows.map(l => (
          <article key={l.id} className="rounded-xl border p-4 space-y-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold break-words">{l.materialName}</h3>
              <span
                className={`rounded-full px-2 py-1 text-xs ${l.status === "settled" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : l.status === "delivered" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted"}`}
              >
                {labels[l.status] ?? l.status}
              </span>
            </div>
            <p className="text-sm">
              <strong>{l.lenderName}</strong> → {l.borrowerName}
            </p>
            <p className="text-sm">
              {amountLabel(l.quantityApproved ?? l.quantityRequested)} {l.unit}
              {l.status === "delivered" &&
                ` · pendente: ${amountLabel(Number(l.quantityApproved) - Number(l.quantitySettled))} ${l.unit}`}
            </p>
            <p className="text-sm text-muted-foreground">
              Prazo: {dateLabel(l.dueAt)}
              {l.appointmentId ? ` · agendamento #${l.appointmentId}` : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(l.id)}
            >
              Abrir empréstimo #{l.id}
            </Button>
          </article>
        ))}
      </div>
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Solicitar material emprestado</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              request.mutate({
                requestKey,
                borrowerArtistId: Number(borrower),
                sourceMaterialId: Number(source),
                quantity: quantity.replace(",", "."),
                appointmentId: appointmentId
                  ? Number(appointmentId)
                  : undefined,
                notes: notes || undefined,
              });
            }}
          >
            <div>
              <Label htmlFor="loan-borrower">Artista que receberá</Label>
              <select
                required
                id="loan-borrower"
                className={selectClass}
                value={borrower}
                onChange={e => {
                  setBorrower(e.target.value);
                  setSource("");
                  setAppointmentId("");
                }}
                disabled={!manager}
              >
                <option value="">Escolher artista</option>
                {artists.data
                  ?.filter(a => manager || a.id === user?.artistId)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="loan-source">Material e proprietário</Label>
              <select
                required
                id="loan-source"
                className={selectClass}
                value={source}
                onChange={e => setSource(e.target.value)}
                disabled={!borrower || catalog.isLoading}
              >
                <option value="">Escolher material de outro estoque</option>
                {catalog.data?.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.ownerName} · {m.description}
                  </option>
                ))}
              </select>
              {catalog.error && (
                <p role="alert" className="text-sm text-destructive">
                  {catalog.error.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="loan-request-quantity">
                Quantidade (
                {catalog.data?.find(m => m.id === Number(source))?.unit ??
                  "unidade do material"}
                )
              </Label>
              <Input
                required
                id="loan-request-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="loan-appointment">
                Agendamento relacionado (opcional)
              </Label>
              <select
                id="loan-appointment"
                className={selectClass}
                value={appointmentId}
                onChange={e => setAppointmentId(e.target.value)}
              >
                <option value="">Sem agendamento</option>
                {appointments.data
                  ?.filter(
                    a =>
                      a.artistId === Number(borrower) &&
                      !["concluido", "cancelado"].includes(a.status)
                  )
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      #{a.id} · {dateLabel(a.date)} · {a.service}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="loan-request-notes">Observações</Label>
              <Input
                id="loan-request-notes"
                maxLength={2000}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O pedido não altera o saldo. Quem empresta aprova a quantidade,
              define o prazo e confirma a entrega.
            </p>
            <Button
              className="w-full"
              disabled={request.isPending || !source || !borrower}
            >
              Registrar pedido
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {loan && (
        <LoanDetail
          key={loan.id}
          loan={loan}
          onClose={() => setSelected(null)}
          onChange={refresh}
        />
      )}
    </section>
  );
}

type LoanView =
  inferRouterOutputs<AppRouter>["pod"]["inventory"]["loans"]["list"][number];
function LoanDetail({
  loan,
  onClose,
  onChange,
}: {
  loan: LoanView;
  onClose: () => void;
  onChange: () => void;
}) {
  const detail = trpc.pod.inventory.loans.detail.useQuery({ loanId: loan.id });
  const [action, setAction] = useState("view");
  const [amount, setAmount] = useState(
    loan.quantityApproved ?? loan.quantityRequested
  );
  const [due, setDue] = useState(
    loan.dueAt?.slice(0, 16).replace(" ", "T") ?? ""
  );
  const [lead, setLead] = useState(String(loan.reminderHours));
  const [notes, setNotes] = useState("");
  const [batchId, setBatchId] = useState("");
  const [source, setSource] = useState(String(loan.receivedMaterialId ?? ""));
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const success = () => {
    onChange();
    void detail.refetch();
    setAction("view");
    setOperationKey(crypto.randomUUID());
    toast.success("Registro salvo. Os avisos estão disponíveis no sistema.");
  };
  const options = {
    onSuccess: success,
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const approve = trpc.pod.inventory.loans.approve.useMutation(options);
  const deliver = trpc.pod.inventory.loans.deliver.useMutation(options);
  const settle = trpc.pod.inventory.loans.settle.useMutation(options);
  const close = trpc.pod.inventory.loans.closeRequest.useMutation(options);
  const extend = trpc.pod.inventory.loans.extend.useMutation(options);
  const busy = [approve, deliver, settle, close, extend].some(m => m.isPending);
  const selectedMaterialId =
    action === "deliver" ? loan.sourceMaterialId : Number(source);
  const batches =
    detail.data?.batches.filter(
      b =>
        b.tenantMaterialId === selectedMaterialId &&
        Number(b.remainingQuantity) > 0
    ) ?? [];
  const startAction = (next: string) => {
    setAction(next);
    setNotes("");
    setBatchId("");
    if (next === "settle") {
      setAmount(
        String(Number(loan.quantityApproved) - Number(loan.quantitySettled))
      );
      setSource(String(loan.receivedMaterialId ?? ""));
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const common = { loanId: loan.id, notes: notes || undefined };
    if (action === "approve")
      approve.mutate({
        ...common,
        quantity: amount.replace(",", "."),
        dueAt: due.replace("T", " ") + ":00",
        reminderHours: Number(lead),
      });
    if (action === "deliver")
      deliver.mutate({
        loanId: loan.id,
        batchId: batchId ? Number(batchId) : undefined,
      });
    if (action === "settle")
      settle.mutate({
        ...common,
        operationKey,
        sourceMaterialId: Number(source),
        batchId: batchId ? Number(batchId) : undefined,
        quantity: amount.replace(",", "."),
      });
    if (action === "extend")
      extend.mutate({
        loanId: loan.id,
        dueAt: due.replace("T", " ") + ":00",
        reminderHours: Number(lead),
        notes,
      });
    if (action === "reject" || action === "cancel")
      close.mutate({ loanId: loan.id, action, notes });
  };
  return (
    <Dialog open onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Empréstimo #{loan.id} · {loan.materialName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <p>
              <strong>{loan.lenderName}</strong> → {loan.borrowerName}
            </p>
            <p>
              {labels[loan.status]} ·{" "}
              {amountLabel(loan.quantityApproved ?? loan.quantityRequested)}{" "}
              {loan.unit}
            </p>
            <p>Prazo de reposição: {dateLabel(loan.dueAt)}</p>
            {loan.quantityApproved && (
              <p>
                Já devolvido/reposto: {amountLabel(loan.quantitySettled)}{" "}
                {loan.unit}
              </p>
            )}
            {loan.notes && <p>{loan.notes}</p>}
            {loan.decisionNotes && <p>{loan.decisionNotes}</p>}
          </div>
          {detail.isLoading && (
            <p role="status">Carregando lotes e histórico…</p>
          )}
          {detail.error && <p role="alert">{detail.error.message}</p>}
          {action === "view" && (
            <div className="flex flex-wrap gap-2">
              {loan.canLend && loan.status === "requested" && (
                <>
                  <Button onClick={() => startAction("approve")}>
                    Aprovar e definir prazo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => startAction("reject")}
                  >
                    Recusar pedido
                  </Button>
                </>
              )}
              {loan.canLend && loan.status === "approved" && (
                <Button onClick={() => startAction("deliver")}>
                  Confirmar entrega
                </Button>
              )}
              {loan.canLend && loan.status === "delivered" && (
                <Button onClick={() => startAction("settle")}>
                  Confirmar devolução / reposição
                </Button>
              )}
              {loan.canLend &&
                ["approved", "delivered"].includes(loan.status) && (
                  <Button
                    variant="outline"
                    onClick={() => startAction("extend")}
                  >
                    Alterar prazo
                  </Button>
                )}
              {loan.canBorrow &&
                ["requested", "approved"].includes(loan.status) && (
                  <Button
                    variant="outline"
                    onClick={() => startAction("cancel")}
                  >
                    Cancelar pedido
                  </Button>
                )}
            </div>
          )}
          {loan.status === "delivered" && (
            <p className="text-sm text-muted-foreground">
              O material recebido aparece no estoque de {loan.borrowerName},
              identificado pelo empréstimo. Para repor com uma nova compra,
              cadastre o recebimento em um material próprio de mesma
              especificação e unidade. {loan.lenderName} confirma a devolução ou
              reposição nesta tela.
            </p>
          )}
          {action !== "view" && (
            <form onSubmit={submit} className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold">
                {
                  (
                    {
                      approve: "Aprovar empréstimo",
                      deliver: "Confirmar entrega física",
                      settle: "Confirmar recebimento físico",
                      extend: "Alterar prazo",
                      reject: "Recusar pedido",
                      cancel: "Cancelar pedido",
                    } as Record<string, string>
                  )[action]
                }
              </h3>
              {action === "settle" && (
                <div>
                  <Label htmlFor="loan-settlement-source">
                    Origem do material devolvido/reposto
                  </Label>
                  <select
                    required
                    id="loan-settlement-source"
                    className={selectClass}
                    value={source}
                    onChange={e => {
                      setSource(e.target.value);
                      setBatchId("");
                    }}
                  >
                    <option value="">Escolher material do artista</option>
                    {detail.data?.candidates.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.isReturn
                          ? "Devolver material recebido"
                          : "Repor com material próprio"}{" "}
                        · {m.name} · saldo {amountLabel(m.currentQuantity)}{" "}
                        {m.unit}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {["deliver", "settle"].includes(action) && (
                <div>
                  <Label htmlFor="loan-batch">Lote entregue</Label>
                  <select
                    id="loan-batch"
                    className={selectClass}
                    value={batchId}
                    onChange={e => setBatchId(e.target.value)}
                  >
                    <option value="">Saldo anterior sem lote cadastrado</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.lot} · saldo {amountLabel(b.remainingQuantity)} ·
                        validade{" "}
                        {b.expiresAt
                          ? dateLabel(b.expiresAt).split(" às ")[0]
                          : "não informada"}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Escolha um lote com saldo suficiente. Reposição com material
                    próprio exige lote e fornecedor cadastrados.
                  </p>
                </div>
              )}
              {["approve", "settle"].includes(action) && (
                <div>
                  <Label htmlFor="loan-action-quantity">
                    Quantidade ({loan.unit})
                  </Label>
                  <Input
                    required
                    id="loan-action-quantity"
                    value={amount}
                    inputMode="decimal"
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>
              )}
              {["approve", "extend"].includes(action) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="loan-due">
                      Prazo no horário do estúdio
                    </Label>
                    <Input
                      required
                      id="loan-due"
                      type="datetime-local"
                      value={due}
                      onChange={e => setDue(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="loan-lead">Avisar antes (horas)</Label>
                    <Input
                      required
                      id="loan-lead"
                      type="number"
                      min={1}
                      max={720}
                      value={lead}
                      onChange={e => setLead(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {action !== "deliver" && (
                <div>
                  <Label htmlFor="loan-action-notes">
                    {["reject", "cancel", "extend"].includes(action)
                      ? "Motivo"
                      : "Observações"}
                  </Label>
                  <Input
                    id="loan-action-notes"
                    value={notes}
                    maxLength={2000}
                    required={["reject", "cancel", "extend"].includes(action)}
                    minLength={
                      ["reject", "cancel", "extend"].includes(action)
                        ? 2
                        : undefined
                    }
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              )}
              {action === "deliver" && (
                <p className="text-sm">
                  Confirmo que entreguei {amountLabel(loan.quantityApproved!)}{" "}
                  {loan.unit}. Essa confirmação transfere o saldo de{" "}
                  {loan.lenderName} para {loan.borrowerName}.
                </p>
              )}
              {action === "settle" && (
                <p className="text-sm">
                  Confirmo que recebi fisicamente a quantidade informada. O
                  saldo será retirado da origem selecionada e devolvido ao
                  estoque de {loan.lenderName}.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || detail.isLoading || Boolean(detail.error)}
                >
                  {busy ? "Salvando…" : "Confirmar registro"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setAction("view")}
                >
                  Voltar
                </Button>
              </div>
            </form>
          )}
          <div className="space-y-2 border-t pt-3">
            <h3 className="font-semibold">Histórico</h3>
            {detail.data?.events.map(e => (
              <div key={e.id} className="border-l-2 pl-3 text-sm">
                <p>
                  {labels[e.kind] ?? e.kind}
                  {e.quantity
                    ? ` · ${amountLabel(e.quantity)} ${loan.unit}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMessageTimestamp(e.createdAt)} · registro por usuário #
                  {e.createdByUserId}
                </p>
                {e.notes && (
                  <p className="break-words text-muted-foreground">{e.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
