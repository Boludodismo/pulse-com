import { useState } from "react";
import { trpc } from "@/lib/trpc";
import SessionMaterialPicker, {
  type SessionMaterialOption,
} from "./SessionMaterialPicker";
import SessionMaterialQuantity from "./SessionMaterialQuantity";
import { defaultSessionQuantity } from "@shared/sessionMaterialDefaults";
import {
  preparationMaterial,
  type SessionPreparation,
} from "@shared/sessionPreparation";
import { Button } from "./ui/button";
import { toast } from "sonner";

export default function PreparationMaterials({
  materials,
  value,
  onChange,
}: {
  materials: SessionMaterialOption[];
  value: SessionPreparation["materials"];
  onChange: (value: SessionPreparation["materials"]) => void;
}) {
  const [selected, setSelected] = useState<SessionMaterialOption | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [showKits, setShowKits] = useState(false);
  const kits = trpc.pod.planning.kits.list.useQuery(undefined, {
    enabled: showKits,
  });
  function select(material: SessionMaterialOption) {
    setSelected(material);
    setQuantity(
      value.find(i => i.tenantMaterialId === material.id)?.quantity ||
        defaultSessionQuantity(material)
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Separe os materiais e indique quanto pretende usar. A escolha do lote e
        a baixa acontecem ao confirmar o consumo na sessão.
      </p>
      <SessionMaterialPicker
        materials={materials}
        more={!!value.length}
        onSelect={select}
      />
      {selected && (
        <div className="border rounded-lg p-3 space-y-3">
          <p className="font-medium">{selected.name}</p>
          <SessionMaterialQuantity
            key={selected.id}
            material={selected}
            value={quantity}
            onChange={setQuantity}
            planning
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !preparationMaterial.safeParse({
                  tenantMaterialId: selected.id,
                  name: selected.name,
                  unit: selected.unit,
                  quantity,
                }).success
              }
              onClick={() => {
                const next = {
                  tenantMaterialId: selected.id,
                  name: selected.name,
                  unit: selected.unit,
                  quantity,
                };
                onChange([
                  ...value.filter(i => i.tenantMaterialId !== selected.id),
                  next,
                ]);
                setSelected(null);
              }}
            >
              {value.some(i => i.tenantMaterialId === selected.id)
                ? "Atualizar quantidade"
                : "Adicionar ao planejamento"}
            </Button>
          </div>
        </div>
      )}
      {value.map(item => (
        <div
          key={item.tenantMaterialId}
          className="border rounded-lg p-3 space-y-2"
        >
          <p className="font-medium break-words">{item.name}</p>
          <p>
            {Number(item.quantity).toLocaleString("pt-BR")} {item.unit}
          </p>
          {!materials.some(m => m.id === item.tenantMaterialId) && (
            <p role="alert" className="text-sm text-amber-500">
              Material indisponível para este artista. Remova ou substitua.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!materials.some(m => m.id === item.tenantMaterialId)}
              onClick={() =>
                select(materials.find(m => m.id === item.tenantMaterialId)!)
              }
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(value.filter(i => i !== item))}
              aria-label={`Remover ${item.name}`}
            >
              Remover
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={() => setShowKits(!showKits)}>
        {showKits ? "Fechar kits" : "Reutilizar um kit de materiais"}
      </Button>
      {showKits && (
        <div className="space-y-2">
          {kits.isLoading && <p>Carregando kits…</p>}
          {kits.error && <p role="alert">{kits.error.message}</p>}
          {kits.data?.length === 0 && <p>Nenhum kit cadastrado.</p>}
          {kits.data?.map(kit => (
            <Button
              key={kit.id}
              className="w-full h-auto min-h-11 whitespace-normal"
              variant="outline"
              onClick={() => {
                const allowed = kit.items.filter(i =>
                  materials.some(m => m.id === i.tenantMaterialId)
                );
                const additions = allowed
                  .filter(
                    i =>
                      !value.some(
                        v => v.tenantMaterialId === i.tenantMaterialId
                      )
                  )
                  .map(i => ({
                    tenantMaterialId: i.tenantMaterialId,
                    name: i.materialName,
                    unit: i.unit,
                    quantity: i.quantity,
                  }));
                onChange([...value, ...additions]);
                if (allowed.length < kit.items.length)
                  toast.warning(
                    "Alguns itens do kit não estão disponíveis para este artista e não foram adicionados."
                  );
                else
                  toast.success(
                    "Kit adicionado. Materiais já selecionados mantiveram suas quantidades."
                  );
                setShowKits(false);
              }}
            >
              {kit.name} · {kit.items.length} materiais
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
