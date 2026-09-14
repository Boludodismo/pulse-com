import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Copy, Mail, MessageCircle } from "lucide-react";

interface SendAnamneseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
}

export default function SendAnamneseDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  clientEmail,
  clientPhone,
}: SendAnamneseDialogProps) {
  const [sentVia, setSentVia] = useState<"email" | "whatsapp">("whatsapp");
  const [sentTo, setSentTo] = useState(clientPhone || clientEmail || "");
  const [generatedLink, setGeneratedLink] = useState("");

  const createRequestMutation = trpc.anamnese.createRequest.useMutation({
    onSuccess: (data) => {
      setGeneratedLink(data.link);
      toast.success("Link gerado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao gerar link", { description: error.message });
    },
  });

  const handleGenerate = () => {
    if (!sentTo) {
      toast.error("Preencha o email ou telefone do cliente");
      return;
    }
    createRequestMutation.mutate({
      clientId,
      sentVia,
      sentTo,
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copiado!");
  };

  const handleSendWhatsApp = () => {
    const message = `Olá ${clientName}! Por favor, preencha sua ficha de anamnese através deste link: ${generatedLink}`;
    const whatsappUrl = `https://wa.me/${sentTo.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleSendEmail = () => {
    const subject = "Ficha de Anamnese - Estúdio de Tatuagem";
    const body = `Olá ${clientName}!\n\nPor favor, preencha sua ficha de anamnese através deste link:\n${generatedLink}\n\nObrigado!`;
    const mailtoUrl = `mailto:${sentTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Link de Anamnese</DialogTitle>
          <DialogDescription>
            Gere um link único para {clientName} preencher a ficha de anamnese
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Enviar via</Label>
              <RadioGroup value={sentVia} onValueChange={(val) => setSentVia(val as "email" | "whatsapp")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="whatsapp" id="whatsapp" />
                  <Label htmlFor="whatsapp" className="font-normal cursor-pointer">
                    WhatsApp
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="email" id="email" />
                  <Label htmlFor="email" className="font-normal cursor-pointer">
                    Email
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>{sentVia === "email" ? "Email" : "Telefone (WhatsApp)"}</Label>
              <Input
                value={sentTo}
                onChange={(e) => setSentTo(e.target.value)}
                placeholder={sentVia === "email" ? "email@exemplo.com" : "(11) 99999-9999"}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={createRequestMutation.isPending}
              className="w-full"
            >
              {createRequestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Link"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Link Gerado</Label>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="bg-muted" />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Este link expira em 7 dias e pode ser usado apenas uma vez.
              </p>
            </div>

            <div className="flex gap-2">
              {sentVia === "whatsapp" && (
                <Button onClick={handleSendWhatsApp} className="flex-1">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Enviar no WhatsApp
                </Button>
              )}
              {sentVia === "email" && (
                <Button onClick={handleSendEmail} className="flex-1">
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar por Email
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setGeneratedLink("");
                onOpenChange(false);
              }}
              className="w-full"
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
