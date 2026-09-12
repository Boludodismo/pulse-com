import MaterialSpecificationFields,{emptySpecification,specificationFromMaterial,type SpecificationForm} from "./MaterialSpecificationFields";
import ReceiveMaterial from "./ReceiveMaterial";
import {materialDescription} from "@shared/materialDescription";
import TechnicalCatalog from "./TechnicalCatalog";
import { TECHNICAL_CATALOG_2026 } from "@shared/technicalCatalog2026";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Package, Users } from "lucide-react";

type Form = SpecificationForm & {
  technicalCatalogIndex?: number;
  name: string;
  owner: string;
  unit: string;
  currentQuantity: string;
  minimumQuantity: string;
  unitCost: string;
};
const emptyForm = (owner: string): Form => ({
  ...emptySpecification,
  name: "",
  owner,
  unit: "unidade",
  currentQuantity: "0",
  minimumQuantity: "0",
  unitCost: "0",
});
const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
export default function ArtistInventory() {
  const { user } = useAuth();
  const manager = user?.role === "admin" || user?.role === "superadmin";
  const utils = trpc.useUtils();
  const inventory = trpc.pod.inventory.list.useQuery();
  const artistsQuery = trpc.artists.list.useQuery();
  const artists = artistsQuery.data ?? [];
  const materials = inventory.data ?? [];
  const [receiving,setReceiving]=useState<(typeof materials)[number]|null>(null);
  const [view, setView] = useState("stock");
  const [owner, setOwner] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [supply, setSupply] = useState<{
    id: number;
    name: string;
    artistIds: number[];
  } | null>(null);
  const [balance, setBalance] = useState<{
    id: number;
    name: string;
    quantity: string;
    reason: string;
  } | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const history = trpc.pod.inventory.movements.useQuery(
    { tenantMaterialId: historyId ?? 0 },
    { enabled: historyId != null }
  );
  const refresh = () => {
    utils.pod.inventory.invalidate();
  };
  const error = (e: { message: string }) => toast.error(e.message);
  const create = trpc.pod.inventory.create.useMutation({
    onSuccess: () => {
      refresh();
      setForm(null);
      toast.success("Material cadastrado no estoque escolhido.");
    },
    onError: error,
  });
  const update = trpc.pod.inventory.updateDetails.useMutation({
    onSuccess: () => {
      refresh();
      setForm(null);
      toast.success("Material atualizado.");
    },
    onError: error,
  });
  const supplied = trpc.pod.inventory.setSuppliedArtists.useMutation({
    onSuccess: () => {
      refresh();
      setSupply(null);
      toast.success("Fornecimento atualizado.");
    },
    onError: error,
  });
  const adjust = trpc.pod.inventory.adjustBalance.useMutation({
    onSuccess: () => {
      refresh();
      setBalance(null);
      toast.success("Saldo atualizado e movimentação registrada.");
    },
    onError: error,
  });
  const archive = trpc.pod.inventory.archive.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Material arquivado. Histórico preservado.");
    },
    onError: error,
  });
  const ownerName = (id: number | null) =>
    id == null
      ? "Estúdio"
      : (artists.find(a => a.id === id)?.name ?? `Artista #${id}`);
  const filtered = materials.filter(
    m =>
      (owner === "all" ||
        (owner === "studio"
          ? m.ownerArtistId == null
          : m.ownerArtistId === Number(owner))) &&
      materialDescription(m).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
  const setField = (key: keyof Form, value: string) =>
    setForm(previous => previous && { ...previous, [key]: value, ...(["name","unit"].includes(key)?{technicalCatalogIndex:undefined}:{}) });
  const busy = create.isPending || update.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const fields = {
      category:form.category,brand:form.brand,line:form.line,model:form.model,configuration:form.configuration,diameter:form.diameter,
      needleCount:form.needleCount?Number(form.needleCount):null,gauge:form.gauge,taper:form.taper,packageQuantity:form.packageQuantity?Number(form.packageQuantity):null,purchaseUnit:form.purchaseUnit,
      name: form.name,
      unit: form.unit,
      minimumQuantity: form.minimumQuantity.replace(",", "."),
      unitCost: form.unitCost.replace(",", "."),
    };
    if (editingId) {
      const material = materials.find(m => m.id === editingId)!;
      update.mutate({
        tenantMaterialId: editingId,
        ...fields,
        lot: material.lot ?? undefined,
        notes: material.notes ?? undefined,
        expiresAt: material.expiresAt
          ? new Date(material.expiresAt).toISOString()
          : undefined,
      });
    } else
      create.mutate({
        ...fields,
        technicalCatalogIndex: form.technicalCatalogIndex,
        ownerArtistId: form.owner === "studio" ? null : Number(form.owner),
        currentQuantity: form.currentQuantity.replace(",", "."),
      });
  };
  return (
    <section className="space-y-5">
      {receiving&&<ReceiveMaterial material={receiving} onClose={()=>setReceiving(null)}/>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Package className="text-orange-500" /> Estoques do estúdio e dos
            artistas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cada proprietário tem seu próprio saldo. O estúdio escolhe quais
            materiais fornece a cada artista.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(
              emptyForm(
                manager
                  ? owner === "all"
                    ? "studio"
                    : owner
                  : String(user?.artistId)
              )
            );
          }}
          disabled={!manager && !user?.artistId}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo material
        </Button>
      </div>
      <div className="flex gap-2"><Button variant={view === "stock" ? "default" : "outline"} onClick={() => setView("stock")}>Estoque operacional</Button><Button variant={view === "catalog" ? "default" : "outline"} onClick={() => setView("catalog")}>Catálogo técnico</Button></div>
      {view === "catalog" && <TechnicalCatalog onSelect={index => {
        const item = TECHNICAL_CATALOG_2026[index];
        setEditingId(null);
        setForm({ ...emptyForm(manager ? (owner === "all" ? "studio" : owner) : String(user?.artistId)), ...specificationFromMaterial({category:item.category,brand:item.brandName,line:item.lineName,model:item.sku,configuration:item.format,diameter:item.needleDiameter,needleCount:item.needleCount,taper:item.taper,packageQuantity:item.unitsPerPackage,purchaseUnit:item.purchaseUnit}), name: item.name, unit: item.baseUnit, technicalCatalogIndex: index });
      }} />}
      <div hidden={view !== "stock"} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="inventory-owner">Proprietário do estoque</Label>
          <select
            id="inventory-owner"
            className={selectClass}
            value={owner}
            onChange={e => setOwner(e.target.value)}
          >
            <option value="all">Todos os estoques disponíveis</option>
            <option value="studio">Estúdio</option>
            {artists.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="inventory-search">Buscar material</Label>
          <Input
            id="inventory-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nome, marca, formato, calibre…"
          />
        </div>
      </div>
      {inventory.isLoading && <p role="status">Carregando estoques…</p>}
      {inventory.error && (
        <p role="alert" className="text-destructive">
          {inventory.error.message}{" "}
          <Button variant="outline" onClick={() => inventory.refetch()}>
            Tentar novamente
          </Button>
        </p>
      )}
      {!inventory.isLoading && !inventory.error && filtered.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum material neste estoque. Cadastre o primeiro material para
            começar.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map(material => {
          const editable =
            manager ||
            (user?.artistId != null &&
              material.ownerArtistId === user.artistId);
          const artist = artists.find(a => a.id === material.ownerArtistId);
          return (
            <Card key={material.id}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-lg break-words">
                      {material.name}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={artist?.photoUrl ?? undefined} />
                        <AvatarFallback>
                          {material.ownerArtistId == null
                            ? "E"
                            : ownerName(material.ownerArtistId).slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      {ownerName(material.ownerArtistId)}
                    </div>
                  </div>
                  <div className="text-right">
                    <strong className="text-xl">
                      {Number(material.currentQuantity).toLocaleString("pt-BR")}
                    </strong>{" "}
                    <span className="text-sm">{material.unit}</span>
                    <p className="text-xs text-muted-foreground">
                      Mínimo:{" "}
                      {Number(material.minimumQuantity).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                {Number(material.currentQuantity) <=
                  Number(material.minimumQuantity) && (
                  <p className="text-sm text-amber-500">
                    Estoque no mínimo ou abaixo do mínimo.
                  </p>
                )}
                {material.ownerArtistId == null && (
                  <div className="rounded-md bg-muted/50 p-3 text-sm">
                    <p className="font-medium">Fornecido pelo estúdio para:</p>
                    <p className="text-muted-foreground mt-1">
                      {material.suppliedTo.length
                        ? material.suppliedTo.map(ownerName).join(", ")
                        : "Nenhum artista selecionado"}
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground break-words">{materialDescription(material)}</p>
                <p className="text-sm text-muted-foreground">
                  Custo por {material.unit}:{" "}
                  {Number(material.unitCost).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {editable && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(material.id);
                          setForm({
                            ...specificationFromMaterial(material),
                            name: material.name,
                            owner:
                              material.ownerArtistId == null
                                ? "studio"
                                : String(material.ownerArtistId),
                            unit: material.unit,
                            currentQuantity: material.currentQuantity,
                            minimumQuantity: material.minimumQuantity,
                            unitCost: material.unitCost,
                          });
                        }}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={()=>setReceiving(material)}>Receber / lotes</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setBalance({
                            id: material.id,
                            ...specificationFromMaterial(material),
                            name: material.name,
                            quantity: material.currentQuantity,
                            reason: "",
                          })
                        }
                      >
                        Ajustar saldo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setHistoryId(material.id)}
                      >
                        Histórico
                      </Button>
                    </>
                  )}
                  {manager && material.ownerArtistId == null && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSupply({
                          id: material.id,
                          name: material.name,
                          artistIds: [...material.suppliedTo],
                        })
                      }
                    >
                      <Users className="mr-2 h-4 w-4" /> Escolher artistas
                    </Button>
                  )}
                  {editable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={archive.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `Arquivar ${material.name}? O histórico será preservado.`
                          )
                        )
                          archive.mutate({ tenantMaterialId: material.id });
                      }}
                    >
                      Arquivar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </div>
      <Dialog
        open={form != null}
        onOpenChange={open => {
          if (!open && !busy) setForm(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar material" : "Novo material"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <form onSubmit={submit} className="space-y-4">
              {!editingId&&<label className="block text-sm">Usar material existente como modelo<select className={selectClass} defaultValue="" onChange={e=>{const m=materials.find(m=>m.id===Number(e.target.value));if(m)setForm(previous=>previous&&({...previous,...specificationFromMaterial(m),name:m.name,unit:m.unit,technicalCatalogIndex:undefined,currentQuantity:"0"}));}}><option value="">Novo cadastro ou selecionar um modelo</option>{materials.map(m=><option key={m.id} value={m.id}>{materialDescription(m)}</option>)}</select></label>}
              {form.technicalCatalogIndex != null && <p className="rounded-md border border-orange-500/40 p-3 text-sm">{TECHNICAL_CATALOG_2026[form.technicalCatalogIndex].brandName} · {TECHNICAL_CATALOG_2026[form.technicalCatalogIndex].lineName}. Informe o saldo e o custo por {form.unit}. Uma embalagem contém {TECHNICAL_CATALOG_2026[form.technicalCatalogIndex].unitsPerPackage} {form.unit}. Confirme os dados do produto antes da compra.</p>}
              <div>
                <Label htmlFor="material-owner">Este material pertence a</Label>
                <select
                  required
                  id="material-owner"
                  className={selectClass}
                  value={form.owner}
                  disabled={!!editingId || !manager}
                  onChange={e => setField("owner", e.target.value)}
                >
                  {manager && <option value="studio">Estúdio</option>}
                  {artists
                    .filter(a => a.active === 1 || String(a.id) === form.owner)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label htmlFor="material-name">Nome</Label>
                <Input
                  required
                  minLength={2}
                  maxLength={255}
                  id="material-name"
  
                  value={form.name}
                  onChange={e => setField("name", e.target.value)}
                />
              </div>
              <MaterialSpecificationFields value={form} materials={materials} onChange={(key,value)=>setForm(previous=>previous&&({...previous,[key]:value,technicalCatalogIndex:undefined}))}/>
              <div>
                <Label htmlFor="material-unit">
                  Unidade (unidade, ml, par…)
                </Label>
                <Input
                  required
                  maxLength={50}
                  id="material-unit"
  
                  value={form.unit}
                  onChange={e => setField("unit", e.target.value)}
                />
              </div>
              {!editingId && (
                <div>
                  <Label htmlFor="material-quantity">Saldo inicial sem rastreabilidade por lote</Label>
                  <p className="text-xs text-muted-foreground">Para registrar fornecedor, lote e validade, deixe zero e use Receber / lotes após salvar.</p>
                  <Input
                    required
                    inputMode="decimal"
                    id="material-quantity"
                    value={form.currentQuantity}
                    onChange={e => setField("currentQuantity", e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="material-minimum">Estoque mínimo</Label>
                <Input
                  required
                  inputMode="decimal"
                  id="material-minimum"
                  value={form.minimumQuantity}
                  onChange={e => setField("minimumQuantity", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="material-cost">Custo unitário (R$)</Label>
                <Input
                  required
                  inputMode="decimal"
                  id="material-cost"
                  value={form.unitCost}
                  onChange={e => setField("unitCost", e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar material"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={supply != null}
        onOpenChange={open => {
          if (!open && !supplied.isPending) setSupply(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fornecimento de {supply?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione os artistas que podem consumir este material do estoque do
            estúdio. Sem seleção, cada artista utiliza seus próprios insumos.
          </p>
          <div className="max-h-72 overflow-y-auto space-y-3">
            {artists
              .filter(a => a.active === 1)
              .map(a => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={supply?.artistIds.includes(a.id) ?? false}
                    onChange={e =>
                      setSupply(
                        previous =>
                          previous && {
                            ...previous,
                            artistIds: e.target.checked
                              ? [...previous.artistIds, a.id]
                              : previous.artistIds.filter(id => id !== a.id),
                          }
                      )
                    }
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={a.photoUrl ?? undefined} />
                    <AvatarFallback>{a.name[0]}</AvatarFallback>
                  </Avatar>
                  <span>{a.name}</span>
                </label>
              ))}
          </div>
          <Button
            disabled={supplied.isPending || artistsQuery.isLoading}
            onClick={() =>
              supply &&
              supplied.mutate({
                tenantMaterialId: supply.id,
                artistIds: supply.artistIds.filter(id =>
                  artists.some(a => a.id === id && a.active === 1)
                ),
              })
            }
          >
            {supplied.isPending ? "Salvando…" : "Salvar fornecimento"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={balance != null}
        onOpenChange={open => {
          if (!open && !adjust.isPending) setBalance(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar saldo: {balance?.name}</DialogTitle>
          </DialogHeader>
          {balance && (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                adjust.mutate({
                  tenantMaterialId: balance.id,
                  newQuantity: balance.quantity.replace(",", "."),
                  reason: balance.reason,
                });
              }}
            >
              <div>
                <Label htmlFor="balance-quantity">
                  Quantidade total após o ajuste
                </Label>
                <Input
                  required
                  id="balance-quantity"
                  inputMode="decimal"
                  value={balance.quantity}
                  onChange={e =>
                    setBalance({ ...balance, quantity: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="balance-reason">Motivo</Label>
                <Input
                  required
                  minLength={2}
                  id="balance-reason"
                  value={balance.reason}
                  onChange={e =>
                    setBalance({ ...balance, reason: e.target.value })
                  }
                  placeholder="Compra, conferência física, perda…"
                />
              </div>
              <Button disabled={adjust.isPending}>
                {adjust.isPending ? "Salvando…" : "Salvar ajuste"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={historyId != null}
        onOpenChange={open => !open && setHistoryId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentações do material</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-3">
            {history.isLoading && <p>Carregando…</p>}
            {history.error && <p role="alert">{history.error.message}</p>}
            {history.data?.map(m => (
              <div key={m.id} className="border-b pb-3 text-sm">
                <p className="font-medium">{m.reason}</p>
                <p>
                  Saldo: {Number(m.previousQuantity).toLocaleString("pt-BR")} →{" "}
                  {Number(m.newQuantity).toLocaleString("pt-BR")}
                </p>
                <p className="text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
            {history.data?.length === 0 && (
              <p>Nenhuma movimentação registrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
