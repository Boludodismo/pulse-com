import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";

export type DraftAttachment = {
  name: string;
  mime: "image/png" | "image/jpeg" | "application/pdf";
  data: string;
};

function FileCard({
  file,
  onRemove,
  disabled,
}: {
  file: DraftAttachment;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const src = `data:${file.mime};base64,${file.data}`;
  const [pdfSource,setPdfSource]=useState<string>();
  useEffect(()=>{
    if(!preview||file.mime!=="application/pdf"){setPdfSource(undefined);return;}
    const bytes=Uint8Array.from(atob(file.data),character=>character.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
    setPdfSource(url);
    return ()=>URL.revokeObjectURL(url);
  },[preview,file.mime,file.data]);
  return (
    <div className="min-w-0 rounded border p-2 space-y-2">
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setPreview(true)}
        aria-label={`Visualizar ${file.name}`}
      >
        {file.mime.startsWith("image/") ? (
          <img
            src={src}
            alt={file.name}
            className="h-24 w-full rounded object-contain bg-muted"
          />
        ) : (
          <div className="h-24 rounded bg-muted flex items-center justify-center font-semibold">
            PDF
          </div>
        )}
        <span className="block text-xs break-all mt-1">{file.name}</span>
      </button>
      {onRemove && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remover ${file.name}`}
        >
          Remover
        </Button>
      )}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-3xl max-h-[90dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="break-all">{file.name}</DialogTitle>
          </DialogHeader>
          {file.mime.startsWith("image/") ? (
            <img
              src={src}
              alt={file.name}
              className="max-h-[65dvh] w-full object-contain"
            />
          ) : (
            <iframe
              src={pdfSource}
              title={file.name}
              className="w-full h-[60dvh] rounded border"
            />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const bytes = Uint8Array.from(atob(file.data), c =>
                c.charCodeAt(0)
              );
              const url = URL.createObjectURL(
                new Blob([bytes], { type: file.mime })
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = file.name;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Baixar arquivo
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SavedCommitmentAttachment({
  id,
  name,
  onRemove,
  disabled,
}: {
  id: number;
  name: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  const file = trpc.commitments.attachment.useQuery({ id });
  if (file.isLoading)
    return (
      <p className="text-sm" role="status">
        Carregando {name}…
      </p>
    );
  if (!file.data)
    return (
      <p role="alert" className="text-sm">
        Não foi possível carregar {name}.
      </p>
    );
  return (
    <FileCard
      file={file.data as DraftAttachment}
      onRemove={onRemove}
      disabled={disabled}
    />
  );
}

export function CommitmentAttachmentPicker({
  files,
  onChange,
  savedCount = 0,
  disabled = false,
  onReadingChange,
}: {
  files: DraftAttachment[];
  onChange: (files: DraftAttachment[]) => void;
  savedCount?: number;
  disabled?: boolean;
  onReadingChange?: (reading: boolean) => void;
}) {
  const [reading, setReading] = useState(false);
  const select = async (selected: File[]) => {
    if (reading || disabled) return;
    const added: DraftAttachment[] = [];
    setReading(true);
    onReadingChange?.(true);
    try {
      for (const file of selected) {
        if (files.length + savedCount + added.length >= 5) {
          toast.error("Limite de cinco anexos por série.");
          break;
        }
        if (file.size > 2 * 1024 * 1024 || file.name.length > 150) {
          toast.error(
            `${file.name}: limite de 2 MB e nome de até 150 caracteres.`
          );
          continue;
        }
        if (
          !["image/png", "image/jpeg", "application/pdf"].includes(file.type)
        ) {
          toast.error("Use PNG, JPG ou PDF.");
          continue;
        }
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () =>
            reject(new Error("Não foi possível ler o arquivo."));
          reader.readAsDataURL(file);
        });
        added.push({
          name: file.name,
          mime: file.type as DraftAttachment["mime"],
          data,
        });
      }
      onChange([...files, ...added]);
    } catch {
      toast.error("Não foi possível ler o arquivo. Selecione novamente.");
    } finally {
      setReading(false);
      onReadingChange?.(false);
    }
  };
  return (
    <div className="space-y-2">
      <label className="block">
        Anexos (PNG, JPG ou PDF, até 2 MB; cinco por série)
        <Input
          type="file"
          multiple
          accept="image/png,image/jpeg,application/pdf"
          disabled={disabled || reading}
          onChange={e => {
            const selected = Array.from(e.target.files || []);
            e.target.value = "";
            void select(selected);
          }}
        />
      </label>
      {reading && (
        <p role="status" className="text-sm">
          Preparando miniaturas…
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {files.map((file, index) => (
          <FileCard
            key={`${index}:${file.name}`}
            file={file}
            disabled={disabled || reading}
            onRemove={() => onChange(files.filter((_, i) => i !== index))}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Os anexos e as remoções só são gravados ao clicar em Salvar.
      </p>
    </div>
  );
}
