import { useState } from "react";
import AppointmentMaterialPicker from "./AppointmentMaterialPicker";
import { materialUiError } from "@shared/materialSearch";
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
  canWriteStock,
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
  canWriteStock: boolean;
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
    onError: e =>
      toast.error(
        materialUiError(
          e,
          "Não foi possível salvar a alteração. Tente novamente."
        )
      ),
  });
  const unused = trpc.pod.planning.markUnused.useMutation({
    onSuccess: refresh,
    onError: e =>
      toast.error(
        materialUiError(
          e,
          "Não foi possível salvar a alteração. Tente novamente."
        )
      ),
  });
  const template = trpc.pod.planning.kits.create.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Modelo salvo para outros agendamentos.");
    },
    onError: e =>
      toast.error(
        materialUiError(
          e,
          "Não foi possível salvar a alteração. Tente novamente."
        )
      ),
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
        throw new Error("Use até 100 itens por kit.");
      }
      changeDraft({
        ...draft,
        name: kitName.trim(),
        items: [...draft.items, ...items],
      });
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
          {kits.error && (
            <p role="alert">
              {materialUiError(
                kits.error,
                "Não foi possível carregar os kits. Tente novamente."
              )}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void kits.refetch()}
              >
                Recarregar kits
              </button>
            </p>
          )}
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
          {savedKit.error && (
            <p role="alert">
              {materialUiError(
                savedKit.error,
                "Não foi possível carregar o kit deste agendamento."
              )}
            </p>
          )}
        </div>
        {inventory.isLoading && (
          <p role="status" className="text-xs">
            Carregando estoque…
          </p>
        )}
        {inventory.error && (
          <p role="alert" className="text-sm">
            {materialUiError(
              inventory.error,
              "Não foi possível carregar os materiais do estoque."
            )}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void inventory.refetch()}
            >
              Recarregar estoque
            </button>
          </p>
        )}
        <AppointmentMaterialPicker
          key={artistId}
          artistId={artistId}
          artistName={artistName}
          materials={materials}
          enabled={enabled}
          canReadStock={canReadStock}
          canWriteStock={canWriteStock}
          onAdd={addItems}
        />
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
        {planned.error && (
          <p role="alert">
            {materialUiError(
              planned.error,
              "Não foi possível carregar os materiais previstos."
            )}
          </p>
        )}
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
          <p role="alert">
            {materialUiError(
              forecast.error || preview.error,
              "Não foi possível conferir o saldo previsto."
            )}
          </p>
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
    onError: e =>
      toast.error(
        materialUiError(
          e,
          "Não foi possível salvar a alteração. Tente novamente."
        )
      ),
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
