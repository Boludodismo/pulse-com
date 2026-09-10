import { clientBirthDate } from "@shared/clientPersonal";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fields = [
  ["name", "Nome completo", "text", 255], ["phone", "Telefone / WhatsApp", "tel", 20],
  ["email", "E-mail", "email", 320], ["birthDate", "Data de nascimento", "text", 10],
  ["docNumber", "Documento (CPF / RG / passaporte)", "text", 50],
  ["instagram", "Instagram / redes sociais", "text", 100],
  ["cep", "CEP", "text", 10], ["street", "Rua / Avenida", "text", 255],
  ["number", "Número", "text", 20], ["complement", "Complemento", "text", 100],
  ["neighborhood", "Bairro", "text", 100], ["reference", "Referência", "text", 255],
  ["city", "Cidade", "text", 100], ["state", "Estado", "text", 50], ["country", "País", "text", 50],
] as const;


// Keep typing as plain text: native date inputs can commit partial years as 00xx.
function birthdayInputValue(value: string): string {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}(?:[ T].*)?$/.test(raw)) return raw.slice(0, 10).split("-").reverse().join("/");
  if (/^\d{8}$/.test(raw)) return raw.slice(0, 2) + "/" + raw.slice(2, 4) + "/" + raw.slice(4);
  return raw;
}

export function EditClientDialog({ client }: { client: { id: number } & Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const utils = trpc.useUtils();
  const update = trpc.clients.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.clients.getById.invalidate({ id: client.id }), utils.clients.list.invalidate(), utils.clients.search.invalidate()]);
      setOpen(false);
      toast.success("Cadastro do cliente atualizado!");
    },
    onError: (error) => toast.error("Não foi possível salvar", { description: error.message }),
  });
  function startEditing() {
    const values: Record<string, string> = {};
    for (const [key] of fields) {
      const value = client[key];
      values[key] = typeof value === "string" ? (key === "birthDate" ? birthdayInputValue(value) : value) : "";
    }
    setForm(values);
    setOpen(true);
  }
  return <>
    <Button variant="outline" onClick={startEditing}><Pencil className="h-4 w-4 mr-2" />Editar cliente</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!update.isPending) setOpen(value); }}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Complete ou corrija os dados pessoais e o endereço do cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => {
          event.preventDefault();
          let birthDate: string | null = null;
          if ((form.birthDate || "").trim()) {
            const displayDate = birthdayInputValue(form.birthDate);
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate) || Number(displayDate.slice(6)) < 1000) {
              toast.error("Informe a data completa em DD/MM/AAAA, com quatro dígitos no ano.");
              return;
            }
            try { birthDate = clientBirthDate(displayDate); }
            catch { toast.error("Data de nascimento inválida. Confira o dia, o mês e o ano."); return; }
          }
          update.mutate({ id: client.id, data: { ...form, name: (form.name || "").trim(), birthDate } });
        }} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(([key, label, type, maxLength]) => <div key={key} className="space-y-2 min-w-0">
              <Label htmlFor={"edit-client-" + key}>{label}{key === "name" ? " *" : ""}</Label>
              <Input id={"edit-client-" + key} type={type} maxLength={maxLength}
                inputMode={key === "birthDate" ? "numeric" : undefined}
                placeholder={key === "birthDate" ? "DD/MM/AAAA" : undefined}
                autoComplete={key === "birthDate" ? "bday" : undefined}
                onBlur={key === "birthDate" ? () => setForm(previous => ({ ...previous, birthDate: birthdayInputValue(previous.birthDate || "") })) : undefined}
                required={key === "name"} value={form[key] || ""} disabled={update.isPending}
                onChange={(event) => setForm(previous => ({ ...previous, [key]: event.target.value }))} />
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={update.isPending || !(form.name || "").trim()}>
              {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar alterações
            </Button>
            <Button type="button" variant="outline" disabled={update.isPending} onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
