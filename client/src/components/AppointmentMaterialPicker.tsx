import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  TECHNICAL_CATALOG_2026,
  canAddCatalogItemToOperationalStock,
} from "@shared/technicalCatalog2026";
import {
  MATERIAL_CATEGORIES,
  materialCategory,
  matchesMaterialSearch,
  materialUiError,
} from "@shared/materialSearch";
import { materialDescription } from "@shared/materialDescription";
import {
  materialUnitKey,
  type AppointmentKitItem,
} from "@shared/appointmentKit";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type StockMaterial = {
  id: number;
  name: string;
  unit: string;
  category: string | null;
  ownerArtistId: number | null;
  currentQuantity: string;
  catalogItemId: number | null;
  brand?: string | null;
  line?: string | null;
  model?: string | null;
  configuration?: string | null;
  diameter?: string | null;
  needleCount?: number | null;
  notes?: string | null;
  loan?: { id: number } | null;
};
type Choice = {
  key: string;
  name: string;
  unit: string;
  category: string;
  details: string;
  source: "stock" | "reference";
  material?: StockMaterial;
  technicalCatalogIndex?: number;
  catalogItemId?: number;
  blocked?: boolean;
  evidence?: string;
};
const selectClass =
  "min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
const units = [
  "unidade",
  "ml",
  "g",
  "par",
  "metro",
  "folha",
  "rolo",
  "frasco",
  "caixa",
];
const validQuantity = (q: string) =>
  /^\d{1,9}(?:\.\d{1,3})?$/.test(q) && Number(q) > 0;
export default function AppointmentMaterialPicker({
  artistId,
  artistName,
  materials,
  enabled,
  canReadStock,
  canWriteStock,
  onAdd,
}: {
  artistId: number;
  artistName: string;
  materials: StockMaterial[];
  enabled: boolean;
  canReadStock: boolean;
  canWriteStock: boolean;
  onAdd: (items: AppointmentKitItem[]) => Promise<void>;
}) {
  const { user } = useAuth();
  const manager = ["admin", "superadmin"].includes(user?.role || "");
  const utils = trpc.useUtils();
  const catalog = trpc.pod.catalog.list.useQuery(undefined, {
    enabled: enabled && canReadStock,
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [limit, setLimit] = useState(30);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [other, setOther] = useState(false);
  const [name, setName] = useState("");
  const [newCategory, setNewCategory] = useState("Outros");
  const [unit, setUnit] = useState("unidade");
  const [brand, setBrand] = useState("");
  const [owner, setOwner] = useState("artist");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const registration = useRef<{ signature: string; key: string } | null>(null);
  const create = trpc.pod.inventory.create.useMutation();
  const choices = useMemo(() => {
    const stocks: Choice[] = materials.map(m => ({
      key: `stock:${m.id}`,
      name: m.name,
      unit: m.unit,
      category: materialCategory(m.name, m.category),
      details: materialDescription(m),
      source: "stock",
      material: m,
    }));
    const technical: Choice[] = TECHNICAL_CATALOG_2026.map((t, index) => ({
      key: `technical:${index}`,
      name: t.name,
      unit: t.baseUnit,
      category: materialCategory(t.name, t.category),
      source: "reference",
      details: [
        t.brandName,
        t.lineName,
        t.sku,
        t.format,
        t.needleCount && `${t.needleCount} pontas`,
        t.needleDiameter != null && `${t.needleDiameter} mm`,
        t.taper,
        t.packageUnit,
      ]
        .filter(Boolean)
        .join(" · "),
      technicalCatalogIndex: index,
      blocked: !canAddCatalogItemToOperationalStock(t),
      evidence: t.evidenceStatus,
      material: materials.find(
        m =>
          m.brand === t.brandName &&
          m.line === t.lineName &&
          m.model === (t.sku ?? null) &&
          m.name === t.name &&
          materialUnitKey(m.unit) === materialUnitKey(t.baseUnit)
      ),
    }));
    const global: Choice[] = (catalog.data?.items ?? []).map(t => ({
      key: `catalog:${t.id}`,
      name: t.name,
      unit: t.defaultUnit,
      category: materialCategory(
        t.name,
        t.subcategory ||
          catalog.data?.categories.find(c => c.id === t.categoryId)?.name
      ),
      details: [t.code, t.configuration, t.diameter, t.technicalSpecification]
        .filter(Boolean)
        .join(" · "),
      source: "reference",
      catalogItemId: t.id,
      material: materials.find(
        m =>
          m.catalogItemId === t.id &&
          materialUnitKey(m.unit) === materialUnitKey(t.defaultUnit)
      ),
    }));
    return [...stocks, ...global, ...technical];
  }, [materials, catalog.data]);
  const categories = Array.from(
    new Set([...MATERIAL_CATEGORIES, ...choices.map(c => c.category)])
  );
  const filtered = choices.filter(
    c =>
      (source === "all" || c.source === source) &&
      (category === "all" || c.category === category) &&
      matchesMaterialSearch(`${c.name} ${c.category} ${c.details}`, query)
  );
  const registering = other || Boolean(selected && !selected.material);
  const displayUnit = other
    ? unit
    : selected?.material?.unit || selected?.unit || "unidade";
  const choose = (c: Choice) => {
    setSelected(c);
    setOther(false);
    setQuantity("1");
    setOwner("artist");
  };
  const submit = async () => {
    if (saving || !validQuantity(quantity) || (!selected && !other)) return;
    setSaving(true);
    try {
      let material = selected?.material;
      if (!material) {
        const input = {
          ownerArtistId: owner === "studio" ? null : artistId,
          suppliedArtistId: owner === "studio" ? artistId : undefined,
          technicalCatalogIndex: selected?.technicalCatalogIndex,
          catalogItemId: selected?.catalogItemId,
          name: other ? name.trim() : selected!.name,
          category: other ? newCategory : selected!.category,
          unit: displayUnit.trim(),
          brand: other ? brand.trim() || undefined : undefined,
          currentQuantity: "0",
          minimumQuantity: "0",
          unitCost: "0",
        };
        const signature = JSON.stringify(input);
        if (registration.current?.signature !== signature)
          registration.current = { signature, key: crypto.randomUUID() };
        const saved = await create.mutateAsync({
          ...input,
          registrationKey: registration.current.key,
        });
        material = {
          id: saved.id,
          name: input.name,
          unit: input.unit,
          category: input.category,
          ownerArtistId: input.ownerArtistId,
          currentQuantity: "0",
          catalogItemId: input.catalogItemId ?? null,
        };
        await utils.pod.inventory.list.invalidate();
      }
      await onAdd([
        {
          tenantMaterialId: material.id,
          name: material.name,
          unit: material.unit,
          quantity,
        },
      ]);
      if (registering)
        toast.success(
          "Material cadastrado no estoque e incluído no kit. Registre a entrada quando recebê-lo."
        );
      registration.current = null;
      setSelected(null);
      setOther(false);
      setName("");
      setBrand("");
      setQuantity("1");
    } catch (error) {
      toast.error(
        materialUiError(
          error as Error,
          "Não foi possível salvar o material. Tente novamente."
        )
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      className="space-y-3 rounded-lg border p-3"
      aria-label="Busca de materiais"
    >
      <h4 className="text-sm font-semibold">
        Buscar e adicionar material ao kit
      </h4>
      <Label htmlFor="appointment-material-search">Buscar material</Label>
      <Input
        id="appointment-material-search"
        value={query}
        placeholder="Nome, marca, modelo, 3RL, diâmetro…"
        onChange={e => {
          setQuery(e.target.value);
          setLimit(30);
        }}
      />
      <Label htmlFor="appointment-material-category">Categoria</Label>
      <select
        id="appointment-material-category"
        className={selectClass}
        value={category}
        onChange={e => {
          setCategory(e.target.value);
          setLimit(30);
        }}
      >
        <option value="all">Todas as categorias</option>
        {categories.map(c => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2" aria-label="Origem do material">
        {[
          ["all", "Todos"],
          ["stock", "Estoque"],
          ["reference", "Referências"],
        ].map(([id, label]) => (
          <Button
            type="button"
            key={id}
            size="sm"
            variant={source === id ? "default" : "outline"}
            aria-pressed={source === id}
            onClick={() => {
              setSource(id);
              setLimit(30);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {catalog.error && (
        <p role="alert" className="text-xs">
          {materialUiError(
            catalog.error,
            "Não foi possível carregar as referências cadastradas."
          )}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void catalog.refetch()}
          >
            Tentar novamente
          </button>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {filtered.length} resultado(s) · Estoque do artista e materiais
        disponibilizados pelo estúdio.
      </p>
      <div
        className="max-h-64 space-y-2 overflow-y-auto"
        aria-label="Resultados de materiais"
      >
        {filtered.slice(0, limit).map(c => (
          <button
            key={c.key}
            type="button"
            disabled={c.blocked || saving}
            aria-pressed={!other && selected?.key === c.key}
            onClick={() => choose(c)}
            className={`w-full rounded-md border p-3 text-left text-sm disabled:opacity-50 ${!other && selected?.key === c.key ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
          >
            <span className="block font-medium break-words">{c.name}</span>
            <span className="block text-xs text-muted-foreground break-words">
              {c.details}
            </span>
            <span className="mt-1 block text-xs">
              {c.category} ·{" "}
              {c.source === "stock"
                ? c.material?.loan
                  ? `Empréstimo #${c.material.loan.id}`
                  : c.material?.ownerArtistId == null
                    ? "Estúdio"
                    : "Artista"
                : "Referência"}{" "}
              ·{" "}
              {c.material
                ? `Saldo ${c.material.currentQuantity} ${c.material.unit}`
                : "Ainda não cadastrado no estoque"}
              {c.blocked
                ? " · Uso bloqueado no catálogo"
                : c.evidence === "pendente"
                  ? " · Dados do produto a conferir"
                  : ""}
            </span>
          </button>
        ))}
        {!filtered.length && (
          <p className="p-2 text-sm text-muted-foreground">
            Nenhum material encontrado. Ajuste a busca ou cadastre em Outros.
          </p>
        )}
        {filtered.length > limit && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLimit(n => n + 30)}
          >
            Mostrar mais resultados
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant={other ? "default" : "outline"}
        className="w-full"
        disabled={!canWriteStock || saving}
        onClick={() => {
          setOther(true);
          setSelected(null);
          setName(query);
          setNewCategory(category === "all" ? "Outros" : category);
          setUnit("unidade");
          setOwner("artist");
        }}
      >
        Outros — cadastrar material
      </Button>
      {!canWriteStock && (
        <p className="text-xs text-muted-foreground">
          O cadastro de novos materiais exige permissão de edição do estoque.
        </p>
      )}
      {(other || selected) && (
        <fieldset
          disabled={saving}
          className="space-y-3 rounded-md bg-muted/20 p-3"
        >
          {other ? (
            <>
              <Label htmlFor="appointment-new-material-name">
                Nome e especificação do material
              </Label>
              <Input
                id="appointment-new-material-name"
                maxLength={255}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex.: Luva nitrílica preta, tamanho M"
              />
              <Label htmlFor="appointment-new-material-category">
                Categoria do novo material
              </Label>
              <select
                id="appointment-new-material-category"
                className={selectClass}
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                {categories.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <Label htmlFor="appointment-new-material-brand">
                Marca (opcional)
              </Label>
              <Input
                id="appointment-new-material-brand"
                maxLength={120}
                value={brand}
                onChange={e => setBrand(e.target.value)}
              />
              <Label htmlFor="appointment-new-material-unit">
                Unidade de uso
              </Label>
              <select
                id="appointment-new-material-unit"
                className={selectClass}
                value={units.includes(unit) ? unit : "custom"}
                onChange={e =>
                  setUnit(e.target.value === "custom" ? "" : e.target.value)
                }
              >
                {units.map(u => (
                  <option key={u}>{u}</option>
                ))}
                <option value="custom">Outra unidade</option>
              </select>
              {!units.includes(unit) && (
                <Input
                  aria-label="Outra unidade de uso"
                  maxLength={50}
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="Nome da unidade"
                />
              )}
            </>
          ) : (
            <p className="text-sm font-medium">
              Selecionado: {selected?.name} · {displayUnit}
            </p>
          )}
          {registering && (
            <>
              {manager ? (
                <>
                  <Label htmlFor="appointment-new-material-owner">
                    Cadastrar no estoque de
                  </Label>
                  <select
                    id="appointment-new-material-owner"
                    className={selectClass}
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                  >
                    <option value="artist">
                      {artistName || "Artista responsável"}
                    </option>
                    <option value="studio">
                      Estúdio · disponibilizar para{" "}
                      {artistName || "este artista"}
                    </option>
                  </select>
                </>
              ) : (
                <p className="text-xs">
                  Cadastro no estoque de {artistName || "seu artista"}.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                O material será salvo no estoque com saldo inicial zero.
                Registre o recebimento, o custo e o lote na aba Estoque. A
                quantidade abaixo é a previsão de uso nesta sessão.
              </p>
            </>
          )}
          <Label htmlFor="appointment-material-quantity">
            Quantidade prevista para o kit ({displayUnit || "unidade"})
          </Label>
          <Input
            id="appointment-material-quantity"
            className="sm:w-32"
            inputMode="decimal"
            value={quantity}
            onChange={e => setQuantity(e.target.value.replace(",", "."))}
          />
          <Button
            type="button"
            className="w-full"
            disabled={
              saving ||
              !validQuantity(quantity) ||
              (registering && !canWriteStock) ||
              (other && (name.trim().length < 2 || !/[a-zA-ZÀ-ÿ]/.test(unit)))
            }
            onClick={() => void submit()}
          >
            {saving
              ? "Salvando…"
              : registering
                ? "Cadastrar no estoque e adicionar ao kit"
                : "Adicionar ao kit"}
          </Button>
        </fieldset>
      )}
    </section>
  );
}
