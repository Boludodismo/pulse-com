import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function WhatsappConsentField(props: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return <div className="flex items-start gap-3 rounded-lg border p-3">
    <Checkbox id={id} checked={props.checked} disabled={props.disabled} onCheckedChange={value => props.onChange(value === true)} />
    <div className="space-y-1">
      <Label htmlFor={id} className="cursor-pointer leading-snug">Habilitar notificações do cliente pelo WhatsApp</Label>
      <p className="text-xs text-muted-foreground">Ativado por padrão para confirmações, lembretes e acompanhamento do atendimento. Desmarque se o cliente não quiser receber. A escolha é registrada pelo usuário do sistema.</p>
    </div>
  </div>;
}
