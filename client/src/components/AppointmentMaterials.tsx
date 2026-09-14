import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  materialUnitKey,
  type AppointmentKitDraft,
  type AppointmentKitItem,
} from "@shared/appointmentKit";
import { MaterialForecast, PlannedQuantityEditor } from "./MaterialForecast";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const selectClass =
  "min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
const validQuantity = (q: string) =>
  /^\d{1,9}(?:\.\d{1,3})?$/.test(q) && Number(q) > 0;
export default function AppointmentMaterials({
  appointmentId,
  artistId,
  artistName,
  clientName,
  date,
  enabled,
  canReadStock,
  draft,
  onDraftChange,
}: {
  appointmentId?: number;
  artistId: number;
  artistName: string;
  clientName: string;
  date: string;
  enabled: boolean;
  canReadStock: boolean;
  draft: AppointmentKitDraft;
  onDraftChange: (draft: AppointmentKitDraft) => void;
}) {
  const utils = trpc.useUtils();
  const inventory = trpc.pod.inventory.list.useQuery(
    { artistId },
    { enabled: enabled && canReadStock && Boolean(artistId) }
  );
  const planned = trpc.pod.planning.listByAppointment.useQuery(
    { appointmentId: appointmentId ?? 0 },
    { enabled: enabled && Boolean(appointmentId) }
  );
  const savedKit = trpc.pod.planning.clientKit.get.useQuery(
    { appointmentId: appointmentId ?? 0 },
    { enabled: enabled && Boolean(appointmentId) }
  );
  const kits = trpc.pod.planning.kits.list.useQuery(undefined, { enabled });
  const forecast = trpc.pod.planning.forecast.useQuery(
    { appointmentId: appointmentId ?? 0 },
    { enabled: enabled && Boolean(appointmentId) }
  );
  const previewItems = draft.items
    .filter((i): i is AppointmentKitItem & { tenantMaterialId: number } =>
      Boolean(i.tenantMaterialId)
    )
    .map(i => ({ tenantMaterialId: i.tenantMaterialId, quantity: i.quantity }));
  const preview = trpc.pod.planning.preview.useQuery(
    { artistId, date, items: previewItems },
    {
      enabled:
        enabled &&
        !appointmentId &&
        Boolean(artistId) &&
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date) &&
        previewItems.length > 0 &&
        previewItems.every(i => validQuantity(i.quantity)),
    }
  );
  const [name, setName] = useState<string | null>(null);
  const [selectedKit, setSelectedKit] = useState("");
  const [mode, setMode] = useState<"stock" | "missing">("stock");
  const [materialId, setMaterialId] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("unidade");
  const [quantity, setQuantity] = useState("1");
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());
  const refresh = () => {
    void utils.pod.planning.invalidate();
    void utils.pod.inventory.notices.invalidate();
  };
  const save = trpc.pod.planning.clientKit.save.useMutation({
    onSuccess: () => {
      setOperationKey(crypto.randomUUID());
      refresh();
    },
    onError: e => toast.error(e.message),
  });
  const unused = trpc.pod.planning.markUnused.useMutation({
    onSuccess: refresh,
    onError: e => toast.error(e.message),
  });
  const template = trpc.pod.planning.kits.create.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Modelo salvo para outros agendamentos.");
    },
    onError: e => toast.error(e.message),
  });
  const defaultName = `Kit de ${clientName.trim().split(/\s+/)[0] || "cliente"}`;
  const kitName =
    name ??
    (appointmentId
      ? (savedKit.data?.name ?? defaultName)
      : draft.name || defaultName);
  const rows = planned.data ?? [];
  const materials = inventory.data ?? [];
  const missing = appointmentId
    ? rows.filter(i => i.status === "planejado" && !i.tenantMaterialId).length
    : draft.items.filter(i => !i.tenantMaterialId).length;
  const changeDraft = (next: AppointmentKitDraft) =>
    onDraftChange({ ...next, operationKey: crypto.randomUUID() });
  const addItems = async (items: AppointmentKitItem[]) => {
    if (appointmentId) {
      await save.mutateAsync({
        appointmentId,
        operationKey,
        name: kitName.trim(),
        items,
      });
      toast.success(
        items.some(i => !i.tenantMaterialId)
          ? "Item incluído no kit. Lembrete de cadastro registrado para o artista."
          : "Kit atualizado."
      );
    } else {
      if (draft.items.length + items.length > 100) {
        toast.error("Use até 100 itens por kit.");
        return;
      }
      changeDraft({
        ...draft,
        name: kitName.trim(),
        items: [...draft.items, ...items],
      });
    }
  };
  const addMaterial = async () => {
    const material = materials.find(m => m.id === Number(materialId));
    if (mode === "stock" && !material) return;
    const item: AppointmentKitItem =
      mode === "stock"
        ? {
            tenantMaterialId: material!.id,
            name: material!.name,
            unit: material!.unit,
            quantity,
          }
        : { name: materialName.trim(), unit: unit.trim(), quantity };
    try {
      await addItems([item]);
      setMaterialId("");
      setMaterialName("");
      setQuantity("1");
    } catch {
      /* Keep the item and operation key for a safe retry. */
    }
  };
  const applyKit = async () => {
    const kit = kits.data?.find(k => k.id === Number(selectedKit));
    if (!kit) return;
    if (
      kit.items.some(i => !materials.some(m => m.id === i.tenantMaterialId))
    ) {
      toast.error(
        "Este kit contém materiais não disponibilizados para este artista. Monte o kit do cliente com os materiais dele ou registre os itens pendentes."
      );
      return;
    }
    try {
      await addItems(
        kit.items.map(i => ({
          tenantMaterialId: i.tenantMaterialId,
          name: i.materialName,
          unit: i.unit,
          quantity: i.quantity,
        }))
      );
      setSelectedKit("");
    } catch {
      /* Keep selection for retry. */
    }
  };
  const modelItems = appointmentId
    ? rows
        .filter(i => i.status === "planejado" && i.tenantMaterialId)
        .map(i => ({
          tenantMaterialId: i.tenantMaterialId!,
          quantity: i.quantityPlanned,
        }))
    : previewItems;
  return (
    <section className="space-y-4 py-2 pr-2">
      <div className="rounded-lg border border-primary/25 bg-primary/[0.04] p-3">
        <h3 className="text-sm font-semibold text-primary">
          Kit de materiais para {clientName || "este cliente"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Personalize os materiais de {artistName || "quem fará o atendimento"}{" "}
          para esta sessão. O planejamento não baixa nem reserva o estoque.
        </p>
      </div>
      {!artistId && (
        <p className="rounded-lg border border-amber-500/40 p-3 text-sm">
          Defina o artista responsável na aba Informações para criar o kit e
          direcionar os lembretes.
        </p>
      )}
      <fieldset
        disabled={!artistId || save.isPending || !enabled}
        className="space-y-4 disabled:opacity-60"
      >
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="appointment-kit-template">Selecionar kit salvo</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              id="appointment-kit-template"
              className={selectClass}
              value={selectedKit}
              onChange={e => setSelectedKit(e.target.value)}
            >
              <option value="">
                {kits.data?.length
                  ? "Escolher um modelo de kit"
                  : "Nenhum modelo salvo ainda"}
              </option>
              {kits.data?.map(k => (
                <option key={k.id} value={k.id}>
                  {k.name} · {k.items.length} itens
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedKit}
              onClick={() => void applyKit()}
            >
              Adicionar ao kit do cliente
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Os itens serão copiados para este agendamento. Você poderá
            personalizar as quantidades.
          </p>
          {kits.error && <p role="alert">{kits.error.message}</p>}
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <Label htmlFor="appointment-client-kit-name">
            Criar kit específico para {clientName || "este cliente"}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="appointment-client-kit-name"
              maxLength={160}
              value={kitName}
              onChange={e => {
                setName(e.target.value);
                if (!appointmentId)
                  changeDraft({ ...draft, name: e.target.value });
              }}
            />
            <Button
              type="button"
              disabled={kitName.trim().length < 2}
              onClick={() => {
                if (appointmentId)
                  void save
                    .mutateAsync({
                      appointmentId,
                      name: kitName.trim(),
                      operationKey,
                      items: [],
                    })
                    .then(() =>
                      toast.success(
                        "Kit do cliente salvo. Adicione os materiais abaixo."
                      )
                    )
                    .catch(() => {});
                else {
                  changeDraft({ ...draft, name: kitName.trim() });
                  toast.success(
                    "Kit preparado. Será salvo junto com o agendamento."
                  );
                }
              }}
            >
              {savedKit.data || draft.name
                ? "Salvar nome do kit"
                : "Criar kit do cliente"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Este kit pertence a este agendamento, incluindo materiais que ainda
            precisam ser cadastrados.
          </p>
          {savedKit.error && <p role="alert">{savedKit.error.message}</p>}
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <h4 className="text-sm font-semibold">Adicionar material ao kit</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "stock" ? "default" : "outline"}
              onClick={() => setMode("stock")}
            >
              Do estoque
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "missing" ? "default" : "outline"}
              onClick={() => setMode("missing")}
            >
              Material não listado
            </Button>
          </div>
          {mode === "stock" ? (
            <div>
              <Label htmlFor="appointment-stock-material">
                Material disponível para o artista
              </Label>
              <select
                id="appointment-stock-material"
                className={selectClass}
                value={materialId}
                onChange={e => setMaterialId(e.target.value)}
              >
                <option value="">Selecionar material</option>
                {materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ·{" "}
                    {m.loan
                      ? `Empréstimo #${m.loan.id}`
                      : m.ownerArtistId == null
                        ? "Estúdio"
                        : "Artista"}{" "}
                    · {m.currentQuantity} {m.unit}
                  </option>
                ))}
              </select>
              {inventory.isLoading && (
                <p role="status" className="text-xs">
                  Carregando materiais…
                </p>
              )}
              {inventory.error && <p role="alert">{inventory.error.message}</p>}
              {artistId > 0 && !inventory.isLoading && !materials.length && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum material disponível para este artista. Use “Material
                  não listado” para preparar o kit e lembrar o cadastro no
                  estoque.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="appointment-missing-name">
                  Nome e especificação do material
                </Label>
                <Input
                  id="appointment-missing-name"
                  maxLength={255}
                  value={materialName}
                  onChange={e => setMaterialName(e.target.value)}
                  placeholder="Ex.: Cartucho 3RL, 0,25 mm, marca…"
                />
              </div>
              <div>
                <Label htmlFor="appointment-missing-unit">Unidade de uso</Label>
                <Input
                  id="appointment-missing-unit"
                  maxLength={50}
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="unidade, ml, g…"
                />
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Será criado um lembrete para o artista cadastrar e vincular este
                material ao estoque. Essa inclusão não cria saldo disponível.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="appointment-material-quantity">
              Quantidade prevista{" "}
              {mode === "stock"
                ? `(${materials.find(m => m.id === Number(materialId))?.unit || "unidade do material"})`
                : `(${unit || "unidade"})`}
            </Label>
            <Input
              id="appointment-material-quantity"
              className="sm:w-32"
              inputMode="decimal"
              value={quantity}
              onChange={e => setQuantity(e.target.value.replace(",", "."))}
            />
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={
              !validQuantity(quantity) ||
              kitName.trim().length < 2 ||
              (mode === "stock"
                ? !materialId
                : materialName.trim().length < 2 || !unit.trim())
            }
            onClick={() => void addMaterial()}
          >
            Adicionar ao kit
          </Button>
        </div>
        {missing > 0 && (
          <p
            role="status"
            className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
          >
            {missing} material(is) pendente(s) de cadastro.{" "}
            {appointmentId
              ? "O artista tem um lembrete no sistema, com nova conferência antes da sessão."
              : "O lembrete será criado ao salvar o agendamento."}
          </p>
        )}
        {planned.error && <p role="alert">{planned.error.message}</p>}
        {appointmentId
          ? rows.map(row => (
              <article
                key={row.id}
                className="space-y-2 rounded-lg border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium break-words">
                      {row.nameSnapshot}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.quantityPlanned} {row.unitSnapshot} ·{" "}
                      {row.status === "planejado" && !row.tenantMaterialId
                        ? "Pendente de cadastro"
                        : row.status}
                    </p>
                  </div>
                  {row.status === "planejado" && (
                    <div className="flex flex-wrap gap-1">
                      <PlannedQuantityEditor
                        id={row.id}
                        value={row.quantityPlanned}
                        unit={row.unitSnapshot}
                        onSaved={refresh}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={unused.isPending}
                        onClick={() =>
                          unused.mutate({ plannedMaterialId: row.id })
                        }
                      >
                        Não usar
                      </Button>
                    </div>
                  )}
                </div>
                {row.status === "planejado" && !row.tenantMaterialId && (
                  <LinkPendingMaterial
                    appointmentId={appointmentId}
                    plannedId={row.id}
                    unit={row.unitSnapshot}
                    materials={materials}
                    onSaved={refresh}
                  />
                )}
              </article>
            ))
          : draft.items.map((item, index) => (
              <article
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.unit} ·{" "}
                    {item.tenantMaterialId
                      ? "Vinculado ao estoque"
                      : "Pendente de cadastro"}
                  </p>
                </div>
                <Input
                  className="w-24"
                  aria-label={`Quantidade de ${item.name}`}
                  inputMode="decimal"
                  value={item.quantity}
                  onChange={e =>
                    changeDraft({
                      ...draft,
                      items: draft.items.map((v, i) =>
                        i === index
                          ? { ...v, quantity: e.target.value.replace(",", ".") }
                          : v
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    changeDraft({
                      ...draft,
                      items: draft.items.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remover
                </Button>
              </article>
            ))}
        <MaterialForecast
          rows={appointmentId ? (forecast.data ?? []) : (preview.data ?? [])}
        />
        {(forecast.error || preview.error) && (
          <p role="alert">{(forecast.error || preview.error)?.message}</p>
        )}
        <div className="space-y-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={
              modelItems.length === 0 ||
              missing > 0 ||
              template.isPending ||
              kitName.trim().length < 2
            }
            onClick={() =>
              template.mutate({ name: kitName.trim(), items: modelItems })
            }
          >
            Salvar também como modelo reutilizável
          </Button>
          <p className="text-xs text-muted-foreground">
            Opcional: disponibiliza um modelo para outros agendamentos.
            Materiais pendentes precisam ser vinculados ao estoque antes de
            salvar o modelo.
          </p>
        </div>
      </fieldset>
    </section>
  );
}

function LinkPendingMaterial({
  appointmentId,
  plannedId,
  unit,
  materials,
  onSaved,
}: {
  appointmentId: number;
  plannedId: number;
  unit: string;
  materials: Array<{
    id: number;
    name: string;
    unit: string;
    ownerArtistId: number | null;
  }>;
  onSaved: () => void;
}) {
  const [id, setId] = useState("");
  const link = trpc.pod.planning.clientKit.linkMaterial.useMutation({
    onSuccess: () => {
      onSaved();
      toast.success(
        "Material vinculado. Pendência de cadastro resolvida; confira o saldo previsto."
      );
    },
    onError: e => toast.error(e.message),
  });
  return (
    <div className="space-y-2 rounded-md bg-amber-500/5 p-2">
      <p className="text-xs">
        Cadastre o material e registre seu recebimento em{" "}
        <a className="underline" href="/stock" target="_blank" rel="noreferrer">
          Estoque
        </a>
        . Depois, selecione o item correspondente abaixo.
      </p>
      <Label htmlFor={`link-material-${plannedId}`} className="text-xs">
        Vincular material cadastrado ({unit})
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          id={`link-material-${plannedId}`}
          className={selectClass}
          value={id}
          onChange={e => setId(e.target.value)}
        >
          <option value="">Selecionar material equivalente</option>
          {materials
            .filter(m => materialUnitKey(m.unit) === materialUnitKey(unit))
            .map(m => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.ownerArtistId == null ? "Estúdio" : "Artista"}
              </option>
            ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!id || link.isPending}
          onClick={() =>
            link.mutate({
              appointmentId,
              plannedMaterialId: plannedId,
              tenantMaterialId: Number(id),
            })
          }
        >
          Vincular ao estoque
        </Button>
      </div>
    </div>
  );
}
