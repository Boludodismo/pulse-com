import { useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ProfilePhoto = {
  profilePhotoUrl: string | null;
  profilePhotoKey: string | null;
};

type Props = ProfilePhoto & {
  name?: string | null;
  onChange: (photo: ProfilePhoto) => void;
  disabled?: boolean;
};

function initials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export function UserProfilePhotoField({
  profilePhotoUrl,
  name,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = trpc.users.uploadProfilePhoto.useMutation({
    onSuccess: onChange,
    onError: (error) =>
      toast.error(error.message || "Não foi possível enviar a foto."),
  });

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        toast.error("Não foi possível ler a imagem.");
        return;
      }
      upload.mutate({
        fileData: reader.result,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
      });
    };
    reader.onerror = () => toast.error("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <Avatar className="h-20 w-20 border-2 shrink-0">
        {profilePhotoUrl && (
          <AvatarImage
            src={profilePhotoUrl}
            alt={`Foto de ${name || "usuário"}`}
            className="object-cover"
          />
        )}
        <AvatarFallback className="text-lg font-semibold">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-sm font-medium">Foto do perfil</p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG ou WebP, até 5 MB.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            {profilePhotoUrl ? "Trocar foto" : "Adicionar foto"}
          </Button>
          {profilePhotoUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || upload.isPending}
              onClick={() =>
                onChange({ profilePhotoUrl: null, profilePhotoKey: null })
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
