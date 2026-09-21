import { useState } from "react";
import {
  type PreparationColor,
  preparationColor,
} from "@shared/sessionPreparation";
import { isSessionInk, SESSION_CUP_ML } from "@shared/sessionInkQuantity";
import SessionMaterialPicker, {
  type SessionMaterialOption,
} from "./SessionMaterialPicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function PreparationPalette({
  value,
  onChange,
  materials,
}: {
  value: PreparationColor[];
  onChange: (colors: PreparationColor[]) => void;
  materials: SessionMaterialOption[];
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const update = (index: number, patch: Partial<PreparationColor>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const inks = materials.filter(isSessionInk);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Prepare cores de referência e, se desejar, a receita em gotas. As cores
        são referências visuais; o resultado real da mistura será registrado na
        sessão.
      </p>
      <Button
        disabled={value.length >= 20}
        variant="outline"
        onClick={() => {
          setEditing(value.length);
          onChange([
            ...value,
            {
              name: `Cor ${value.length + 1}`,
              hex: "#808080",
              cupSize: "M",
              dropsPerMl: 20,
              ingredients: [],
            },
          ]);
        }}
      >
        Adicionar cor à paleta
      </Button>
      {value.map((color, index) => (
        <article key={index} className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="h-10 w-10 rounded border shrink-0"
              style={{
                backgroundColor: /^#[0-9a-f]{6}$/i.test(color.hex)
                  ? color.hex
                  : "#808080",
              }}
            />
            <p className="flex-1 break-words">
              {color.name} · {color.hex}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(editing === index ? null : index)}
            >
              {editing === index ? "Fechar" : "Editar"}
            </Button>
          </div>
          {editing === index && (
            <>
              <label className="block text-sm">
                Nome da cor
                <Input
                  value={color.name}
                  maxLength={80}
                  onChange={e => update(index, { name: e.target.value })}
                />
              </label>
              <div className="flex gap-3 items-end">
                <label className="text-sm">
                  Escolher cor
                  <input
                    type="color"
                    className="block h-11 w-16"
                    value={color.hex}
                    onChange={e => update(index, { hex: e.target.value })}
                  />
                </label>
                <label className="flex-1 text-sm">
                  Código HEX
                  <Input
                    value={color.hex}
                    maxLength={7}
                    onChange={e => update(index, { hex: e.target.value })}
                  />
                </label>
              </div>
              <label className="block text-sm">
                Batoque da mistura
                <select
                  className="block w-full rounded border bg-background p-3"
                  value={color.cupSize}
                  onChange={e =>
                    update(index, {
                      cupSize: e.target.value as PreparationColor["cupSize"],
                    })
                  }
                >
                  {Object.entries(SESSION_CUP_ML).map(([s, ml]) => (
                    <option key={s} value={s}>
                      {s} · {ml} ml
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Gotas por ml
                <Input
                  type="number"
                  min={5}
                  max={60}
                  value={color.dropsPerMl}
                  onChange={e =>
                    update(index, { dropsPerMl: Number(e.target.value) })
                  }
                />
              </label>
              <SessionMaterialPicker
                materials={inks.filter(
                  m => !color.ingredients.some(i => i.tenantMaterialId === m.id)
                )}
                more={!!color.ingredients.length}
                disabled={color.ingredients.length >= 10}
                onSelect={m =>
                  update(index, {
                    ingredients: [
                      ...color.ingredients,
                      { tenantMaterialId: m.id, name: m.name, drops: 1 },
                    ],
                  })
                }
              />
              {color.ingredients.map((ingredient, j) => (
                <div
                  key={ingredient.tenantMaterialId}
                  className="border rounded p-2 space-y-2"
                >
                  <label className="block text-sm">
                    {ingredient.name} · gotas
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={ingredient.drops}
                      onChange={e =>
                        update(index, {
                          ingredients: color.ingredients.map((i, k) =>
                            j === k
                              ? { ...i, drops: Number(e.target.value) }
                              : i
                          ),
                        })
                      }
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      update(index, {
                        ingredients: color.ingredients.filter(
                          i => i !== ingredient
                        ),
                      })
                    }
                  >
                    Remover tinta
                  </Button>
                </div>
              ))}
            </>
          )}
          {color.ingredients.length > 0 && (
            <p className="text-sm">
              {color.ingredients
                .map(i => `${i.name}: ${i.drops} gotas`)
                .join(" + ")}{" "}
              · volume estimado{" "}
              {(
                color.ingredients.reduce((n, i) => n + i.drops, 0) /
                color.dropsPerMl
              ).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{" "}
              ml
            </p>
          )}
          {!preparationColor.safeParse(color).success && (
            <p role="alert" className="text-sm text-amber-500">
              Revise a cor, as gotas e a capacidade do batoque.
            </p>
          )}
          {color.ingredients.some(
            i => !inks.some(m => m.id === i.tenantMaterialId)
          ) && (
            <p role="alert" className="text-sm text-amber-500">
              Uma tinta não está disponível para este artista. Edite a receita.
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(value.filter((_, i) => i !== index));
              setEditing(null);
            }}
          >
            Remover cor
          </Button>
        </article>
      ))}
      {!value.length && (
        <p className="text-sm text-muted-foreground">
          Você pode continuar sem paleta e escolher as cores durante a sessão.
        </p>
      )}
    </div>
  );
}
