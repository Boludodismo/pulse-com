import { useState } from "react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import type { ArtistEditorialCardProps } from "./ArtistEditorialCard";
import {
  downloadArtistContact,
  downloadArtistQr,
  downloadArtistPdf,
} from "../../lib/artistCardExport";

export default function ArtistCardSharing({
  card,
  token,
  published,
  busy,
  onPublication,
}: {
  card: ArtistEditorialCardProps;
  token: string;
  published: boolean;
  busy: boolean;
  onPublication: (published: boolean) => void;
}) {
  const [working, setWorking] = useState(false);
  const url = `${window.location.origin}/artista/${token}`;
  const run = async (fn: () => Promise<unknown>) => {
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        toast.error(
          e instanceof Error
            ? e.message
            : "Não foi possível concluir. Tente novamente."
        );
    } finally {
      setWorking(false);
    }
  };
  const disabled = busy || working;
  return (
    <section
      className="space-y-3 rounded-lg border p-4"
      aria-label="Publicação e compartilhamento do cartão"
    >
      <h3 className="font-semibold">Publicação e compartilhamento</h3>
      <p className="text-sm">
        Status:{" "}
        <strong>{published ? "Publicado" : "Publicação pausada"}</strong>
      </p>
      <p className="text-sm text-muted-foreground">
        Estas opções usam o conteúdo já salvo. Ao pausar, o link deixa de exibir
        o cartão. Arquivos já baixados continuam com quem os recebeu.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => onPublication(!published)}
      >
        {published ? "Pausar publicação" : "Publicar cartão"}
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !published}
          onClick={() =>
            run(async () => {
              await navigator.clipboard.writeText(url);
              toast.success("Link copiado.");
            })
          }
        >
          Copiar link
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !published}
          onClick={() =>
            run(async () => {
              if (navigator.share)
                await navigator.share({ title: card.name, url });
              else {
                await navigator.clipboard.writeText(url);
                toast.success("Link copiado para compartilhar.");
              }
            })
          }
        >
          Compartilhar cartão
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !published}
          onClick={() => downloadArtistContact(card, url)}
        >
          Baixar contato (.vcf)
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !published}
          onClick={() => run(() => downloadArtistQr(card, url))}
        >
          Baixar QR Code do perfil
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !published}
          onClick={() => run(() => downloadArtistQr(card, url, true))}
        >
          Baixar QR Code do contato
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !published}
          onClick={() =>
            run(async () => {
              const result = await downloadArtistPdf(card, url);
              if (result.missingImages)
                toast.warning(
                  "PDF baixado. Algumas imagens não carregaram; confira o arquivo."
                );
            })
          }
        >
          {working ? "Preparando arquivo…" : "Baixar cartão em PDF"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O QR do perfil abre a página e precisa de internet. O QR do contato
        contém os dados públicos e os links cadastrados; pode ser lido sem
        conexão em aplicativos compatíveis. A foto acompanha o arquivo .vcf.
      </p>
    </section>
  );
}
