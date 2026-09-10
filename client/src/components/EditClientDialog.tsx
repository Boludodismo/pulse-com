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
  ["email", "E-mail", "email", 320], ["birthDate", "Data de nascimento", "date", 10],
  ["docNumber", "Documento (CPF / RG / passaporte)", "text", 50],
  ["instagram", "Instagram / redes sociais", "text", 100],
  ["cep", "CEP", "text", 10], ["street", "Rua / Avenida", "text", 255],
  ["number", "Número", "text", 20], ["complement", "Complemento", "text", 100],
  ["neighborhood", "Bairro", "text", 100], ["reference", "Referência", "text", 255],
  ["city", "Cidade", "text", 100], ["state", "Estado", "text", 50], ["country", "País", "text", 50],
] as const;

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
      values[key] = typeof value === "string" ? (key === "birthDate" ? value.slice(0, 10) : value) : "";
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
          update.mutate({ id: client.id, data: { ...form, name: (form.name || "").trim(), birthDate: form.birthDate || null } });
        }} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(([key, label, type, maxLength]) => <div key={key} className="space-y-2 min-w-0">
              <Label htmlFor={"edit-client-" + key}>{label}{key === "name" ? " *" : ""}</Label>
              <Input id={"edit-client-" + key} type={type} maxLength={maxLength}
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
