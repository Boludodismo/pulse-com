import { sessionMaterialName, isSessionCup, sessionCupSizeLabel } from "@shared/sessionInkQuantity";
import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type SessionMaterialOption = {
  id: number;
  name: string;
  unit: string;
  currentQuantity: string;
  brand?: string | null;
  configuration?: string | null;
  category?: string | null;
  ownerArtistId?: number | null;
};

export const formatMaterialQuantity = (value: string | number) =>
  Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function SessionMaterialPicker({ materials, onSelect, disabled, more = false }: {
  materials: SessionMaterialOption[];
  onSelect: (material: SessionMaterialOption) => void;
  disabled?: boolean;
  more?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);
  const matches = materials.filter(material => {
    const text = normalize([material.name, material.brand, material.configuration, material.category,
      material.ownerArtistId == null ? "estudio" : "artista"].filter(Boolean).join(" "));
    return words.every(word => text.includes(word));
  });
  return <div className="space-y-2 min-w-0">
    <Button type="button" variant="outline" className="w-full min-h-11 gap-2" disabled={disabled}
      aria-expanded={open} onClick={() => { setOpen(!open); setSearch(""); }}>
      <Plus className="h-4 w-4" />{open ? "Fechar busca de materiais" : more ? "Adicionar mais materiais" : "Buscar material"}
    </Button>
    {open && <div className="rounded-lg border bg-background p-2 space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input autoFocus className="pl-9 min-h-11 text-base" value={search}
          placeholder="Nome, marca ou código do material..." aria-label="Buscar material por nome, marca ou código"
          onChange={event => setSearch(event.target.value)} />
      </div>
      <div className="max-h-64 overflow-y-auto overscroll-contain" aria-label="Resultados da busca de materiais">
        {matches.slice(0, 40).map(material => <button type="button" key={material.id}
          className="w-full text-left rounded-md p-3 min-h-14 hover:bg-accent border-b last:border-0"
          onClick={() => { onSelect(material); setSearch(""); setOpen(false); }}>
          <span className="block text-sm font-medium break-words">{sessionMaterialName(material)}</span>
          <span className="block text-xs text-muted-foreground break-words">
            {[material.brand, isSessionCup(material) ? `Tamanho: ${sessionCupSizeLabel(material) || "não informado"}` : material.configuration, material.ownerArtistId == null ? "Estúdio" : "Artista"].filter(Boolean).join(" · ")}
            {" · Saldo: "}{formatMaterialQuantity(material.currentQuantity)} {material.unit}{" · #"}{material.id}
          </span>
        </button>)}
        {!matches.length && <p className="p-3 text-sm text-muted-foreground">Nenhum material encontrado.</p>}
        {matches.length > 40 && <p className="p-2 text-xs text-muted-foreground">Mostrando 40 de {matches.length}. Digite para refinar a busca.</p>}
      </div>
    </div>}
  </div>;
}
