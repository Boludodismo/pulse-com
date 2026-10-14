import React, { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function QuickQuoteField({ value, options, label, onChange }: {
  value: string; options: readonly string[]; label: string; onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<"list" | "manual">("list");
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (selected && listRef.current) listRef.current.scrollTop = Math.max(0, selected.offsetTop - 4);
  }, [mode]);
  return <div className="min-w-0 space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant={mode === "list" ? "default" : "outline"} aria-pressed={mode === "list"} onClick={() => setMode("list")}>Escolher na lista</Button>
      <Button type="button" size="sm" variant={mode === "manual" ? "default" : "outline"} aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>Digitar manualmente</Button>
    </div>
    {mode === "manual" ? <Input aria-label={label + " — preenchimento manual"} maxLength={120} value={value} onChange={e => onChange(e.target.value)} placeholder={label === "Tempo estimado" ? "Ex.: 4 a 5 horas" : "Ex.: até 6x no cartão"} /> : <>
      <p id={id} className="text-xs text-muted-foreground">Role a lista e toque na opção desejada.</p>
      <div ref={listRef} role="group" aria-label={label + " — opções"} aria-describedby={id} className="relative h-36 overflow-y-auto overscroll-contain rounded-md border border-input bg-background p-1" style={{ scrollbarGutter: "stable", touchAction: "pan-y" }}>
        {["", ...options].map(option => <button type="button" key={option} aria-pressed={value === option} onClick={() => onChange(option)} className={"block min-h-11 w-full rounded px-3 py-2 text-left text-sm " + (value === option ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent")}>{option || "Não informar"}</button>)}
      </div>
    </>}
    <p className="break-words text-xs text-muted-foreground">Texto no orçamento: <strong>{value || "Não informado"}</strong></p>
  </div>;
}

