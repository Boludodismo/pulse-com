import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function WhatsappConsentField(props: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return <div className="flex items-start gap-3 rounded-lg border p-3">
    <Checkbox id={id} checked={props.checked} disabled={props.disabled} onCheckedChange={value => props.onChange(value === true)} />
    <div className="space-y-1">
      <Label htmlFor={id} className="cursor-pointer leading-snug">Cliente autorizou receber notificações pelo WhatsApp</Label>
      <p className="text-xs text-muted-foreground">Marque quando o cliente tiver autorizado. Salvar o cadastro não envia mensagens.</p>
    </div>
  </div>;
}
