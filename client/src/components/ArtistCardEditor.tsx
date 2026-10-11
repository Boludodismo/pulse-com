import { useState, useEffect, useRef } from "react";
import { normalizeCardLinks } from "../../../shared/studioRelations";
import {
  toPublicPresentation,
  type StoredMedia,
  type ArtistCardPresentationPatch,
} from "../../../shared/artistCardPresentation";
import { trpc } from "@/lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { toast } from "sonner";
import ArtistEditorialCard from "./artist-card/ArtistEditorialCard";
import CardImageEditor from "./artist-card/CardImageEditor";
import ArtistCardSharing from "./artist-card/ArtistCardSharing";
import {
  originalCardImageEdit,
  type CardImageEdit,
} from "../../../shared/artistCardImage";

type Slot = "cover" | "about" | "process";
type Mime = "image/jpeg" | "image/png" | "image/webp";
type Texts = Required<Omit<ArtistCardPresentationPatch, "contact">>;
const emptyTexts = (): Texts => ({
  quote: "",
  tagline: "",
  specialties: "",
  techniques: "",
  education: "",
  experience: "",
  location: "",
});
const fields = [
  ["tagline", "Frase da capa", 180],
  ["quote", "Frase autoral", 180],
  ["specialties", "Especialidades", 500],
  ["techniques", "Técnicas", 500],
  ["education", "Formação e aperfeiçoamentos", 1200],
  ["experience", "Experiência profissional", 700],
  ["location", "Local de atuação público", 200],
] as const;
const slotNames: Record<Slot, string> = {
  cover: "Capa",
  about: "Foto da biografia",
  process: "Foto do processo",
};
async function readImage(
  file: File
): Promise<{ imageBase64: string; mimeType: Mime }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("A imagem deve ter no máximo 5 MB.");
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    r.readAsDataURL(file);
  });
  return { imageBase64, mimeType: file.type as Mime };
}
function MediaSlot({
  slot,
  media,
  busy,
  onUpload,
  onRemove,
  onFocal,
  onEdit,
}: {
  slot: Slot;
  media?: StoredMedia | null;
  busy: boolean;
  onUpload: (slot: Slot, file: File) => Promise<void>;
  onRemove: (slot: Slot, key: string) => void;
  onFocal: (
    slot: Slot,
    key: string,
    draft: { alt: string; x: number; y: number }
  ) => void;
  onEdit: (slot: Slot, media: StoredMedia) => void;
}) {
  const [alt, setAlt] = useState(media?.alt ?? "");
  useEffect(() => setAlt(media?.alt ?? ""), [media?.key, media?.alt]);
  return (
    <section
      className="space-y-3 rounded-lg border border-zinc-700 p-4"
      aria-label={slotNames[slot]}
    >
      <h4 className="font-medium">{slotNames[slot]}</h4>
      {media && (
        <>
          <img
            src={media.url}
            alt={alt || slotNames[slot]}
            className="aspect-[4/3] w-full rounded object-cover"
            style={{
              objectPosition: `${media.x}% ${media.y}%`,
              filter: media.appearance === "color" ? "none" : "grayscale(1)",
            }}
          />
          <label className="block text-sm">
            Descrição da imagem
            <Input
              maxLength={200}
              value={alt}
              disabled={busy}
              onChange={e => setAlt(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onEdit(slot, media)}
            >
              Recortar e ajustar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                onFocal(slot, media.key, { alt, x: media.x, y: media.y })
              }
            >
              Salvar descrição
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onRemove(slot, media.key)}
            >
              Remover foto
            </Button>
          </div>
        </>
      )}
      <label className="block text-sm">
        {media ? "Substituir foto" : "Enviar foto"}
        <Input
          type="file"
          aria-label={`${media ? "Substituir" : "Enviar"} ${slotNames[slot]}`}
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async e => {
            const input = e.currentTarget,
              file = input.files?.[0];
            if (file) await onUpload(slot, file);
            input.value = "";
          }}
        />
      </label>
    </section>
  );
}
export default function ArtistCardEditor({
  artistId,
  name,
}: {
  artistId: number;
  name: string;
}) {
  const [open, setOpen] = useState(false),
    [previewOpen, setPreviewOpen] = useState(false),
    [uploading, setUploading] = useState(false),
    [caption, setCaption] = useState("");
  const [form, setForm] = useState({
    headline: "",
    description: "",
    published: false,
    links: [] as { label: string; url: string }[],
    presentation: emptyTexts(),
  });
  const [contact, setContact] = useState({ phone: "", email: "" });
  const [editing, setEditing] = useState<{
    slot: Slot | "work";
    image: string;
    title: string;
    payload?: { imageBase64: string; mimeType: Mime };
    expectedKey?: string;
    initialEdit?: CardImageEdit;
    caption?: string;
  }>();
  const initialized = useRef(false);
  const utils = trpc.useUtils();
  const query = trpc.studioRelations.card.useQuery(
    { artistId },
    { enabled: open }
  );
  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (query.isLoading || query.error || initialized.current) return;
    initialized.current = true;
    const card = query.data;
    setContact(card?.presentation?.contact ?? { phone: "", email: "" });
    const presentation = emptyTexts();
    for (const [key] of fields)
      presentation[key] = card?.presentation?.[key] ?? "";
    setForm({
      headline: card?.headline ?? "",
      description: card?.description ?? "",
      published: !!card?.published,
      links: card?.links ?? [],
      presentation,
    });
  }, [open, query.isLoading, query.error, query.data]);
  const refresh = () => utils.studioRelations.card.invalidate({ artistId });
  const onError = (e: { message: string }) => toast.error(e.message);
  const save = trpc.studioRelations.saveCard.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Cartão salvo.");
    },
    onError,
  });
  const upload = trpc.studioRelations.uploadWork.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Trabalho incluído.");
    },
    onError,
  });
  const remove = trpc.studioRelations.removeWork.useMutation({
    onSuccess: refresh,
    onError,
  });
  const reorder = trpc.studioRelations.reorderWorks.useMutation({
    onSuccess: refresh,
    onError,
  });
  const uploadMedia = trpc.studioRelations.uploadPresentationMedia.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Foto salva.");
    },
    onError,
  });
  const focal = trpc.studioRelations.updateMediaFocal.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Enquadramento salvo.");
    },
    onError,
  });
  const removeMedia = trpc.studioRelations.removePresentationMedia.useMutation({
    onSuccess: refresh,
    onError,
  });
  const publication = trpc.studioRelations.setCardPublication.useMutation({
    onSuccess: async (_, variables) => {
      setForm(current => ({ ...current, published: variables.published }));
      await refresh();
      toast.success(
        variables.published ? "Cartão publicado." : "Publicação pausada."
      );
    },
    onError,
  });
  const editMedia = trpc.studioRelations.editPresentationImage.useMutation({
    onSuccess: refresh,
  });
  const editWork = trpc.studioRelations.editWorkImage.useMutation({
    onSuccess: refresh,
  });
  const busy =
    publication.isPending ||
    editMedia.isPending ||
    editWork.isPending ||
    uploading ||
    save.isPending ||
    upload.isPending ||
    remove.isPending ||
    reorder.isPending ||
    uploadMedia.isPending ||
    focal.isPending ||
    removeMedia.isPending;
  const uploadSlot = async (slot: Slot, file: File) => {
    setUploading(true);
    try {
      const payload = await readImage(file);
      setEditing({
        slot,
        image: payload.imageBase64,
        title: slotNames[slot],
        payload,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível abrir a foto."
      );
    } finally {
      setUploading(false);
    }
  };
  const saveEdited = async (edit: CardImageEdit | null) => {
    if (!editing) return;
    if (editing.payload) {
      if (editing.slot === "work") {
        await upload.mutateAsync({
          artistId,
          caption: editing.caption ?? "",
          ...editing.payload,
          edit,
        });
        setCaption("");
      } else
        await uploadMedia.mutateAsync({
          artistId,
          slot: editing.slot,
          alt: slotNames[editing.slot],
          x: 50,
          y: 50,
          ...editing.payload,
          edit,
        });
    } else if (editing.expectedKey) {
      if (editing.slot === "work")
        await editWork.mutateAsync({
          artistId,
          expectedKey: editing.expectedKey,
          edit,
        });
      else
        await editMedia.mutateAsync({
          artistId,
          slot: editing.slot,
          expectedKey: editing.expectedKey,
          edit,
        });
      toast.success(
        edit ? "Ajustes da foto salvos." : "Foto original restaurada."
      );
    }
    setEditing(undefined);
  };
  const move = (index: number, delta: number) => {
    const expectedKeys = (query.data?.images ?? []).map(i => i.key);
    const keys = [...expectedKeys],
      to = index + delta;
    if (to < 0 || to >= keys.length) return;
    [keys[index], keys[to]] = [keys[to], keys[index]];
    reorder.mutate({ artistId, keys, expectedKeys });
  };
  let previewLinks: { label: string; url: string }[] = [];
  try {
    previewLinks = normalizeCardLinks(form.links);
  } catch {
    previewLinks = form.links.flatMap(l => {
      try {
        return normalizeCardLinks([l]);
      } catch {
        return [];
      }
    });
  }
  const previewPresentation = toPublicPresentation({
    ...query.data?.presentation,
    version: 1,
    ...form.presentation,
    contact,
  });
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const links = normalizeCardLinks(form.links);
      setForm(current => ({ ...current, links }));
      save.mutate({
        artistId,
        ...form,
        links,
        presentation: { ...form.presentation, contact },
      });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={e => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        Cartão virtual
      </Button>
      <Dialog
        open={open}
        onOpenChange={value => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent
          onClick={e => e.stopPropagation()}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
        >
          <DialogHeader>
            <DialogTitle>Cartão virtual · {name}</DialogTitle>
            <DialogDescription>
              Preencha o conteúdo. O sistema mantém o mesmo layout para todos os
              artistas.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Somente os dados escolhidos para este cartão serão públicos. O envio
            continua sendo escolhido em cada agendamento.
          </p>
          {query.error ? (
            <p role="alert">
              Não foi possível carregar o cartão. Feche e tente novamente.
            </p>
          ) : query.isLoading ? (
            <p role="status">Carregando…</p>
          ) : (
            <>
              <form onSubmit={handleSave} className="space-y-5">
                <fieldset disabled={busy} className="space-y-4">
                  <legend className="mb-3 text-lg font-semibold">
                    Apresentação e biografia
                  </legend>
                  <label className="block">
                    Título / identificação profissional
                    <Input
                      value={form.headline}
                      maxLength={160}
                      onChange={e =>
                        setForm({ ...form, headline: e.target.value })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.headline.length}/160
                    </span>
                  </label>
                  <label className="block">
                    Biografia
                    <Textarea
                      rows={6}
                      value={form.description}
                      maxLength={3000}
                      onChange={e =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.description.length}/3000
                    </span>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map(([key, label, max]) => (
                      <label key={key} className="block text-sm">
                        {label}
                        {key === "education" ||
                        key === "experience" ||
                        key === "specialties" ||
                        key === "techniques" ? (
                          <Textarea
                            rows={3}
                            maxLength={max}
                            value={form.presentation[key]}
                            onChange={e =>
                              setForm({
                                ...form,
                                presentation: {
                                  ...form.presentation,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                        ) : (
                          <Input
                            maxLength={max}
                            value={form.presentation[key]}
                            onChange={e =>
                              setForm({
                                ...form,
                                presentation: {
                                  ...form.presentation,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                        )}
                        <span className="text-xs text-muted-foreground">
                          {form.presentation[key].length}/{max} · opcional
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset disabled={busy} className="space-y-3">
                  <legend className="mb-3 text-lg font-semibold">
                    Redes sociais e links
                  </legend>
                  <p className="text-sm text-muted-foreground">
                    Aparecem apenas os links informados. Use o endereço completo
                    começando com https://.
                  </p>
                  {form.links.map((link, index) => (
                    <div
                      className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_2fr_auto]"
                      key={index}
                    >
                      <label className="min-w-0 text-sm">
                        Nome da rede (opcional)
                        <Input
                          maxLength={40}
                          value={link.label}
                          onChange={e =>
                            setForm({
                              ...form,
                              links: form.links.map((l, i) =>
                                i === index
                                  ? { ...l, label: e.target.value }
                                  : l
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="min-w-0 text-sm">
                        Link completo
                        <Input
                          inputMode="url"
                          type="text"
                          maxLength={500}
                          value={link.url}
                          placeholder="https://www.instagram.com/seuusuario"
                          onChange={e =>
                            setForm({
                              ...form,
                              links: form.links.map((l, i) =>
                                i === index ? { ...l, url: e.target.value } : l
                              ),
                            })
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            ...form,
                            links: form.links.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remover link
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={form.links.length >= 8}
                    onClick={() =>
                      setForm({
                        ...form,
                        links: [...form.links, { label: "", url: "" }],
                      })
                    }
                  >
                    Adicionar rede social
                  </Button>
                </fieldset>
                <fieldset
                  disabled={busy}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <legend className="font-semibold">Contato público</legend>
                  <p className="text-sm text-muted-foreground">
                    Informe somente os contatos que deseja divulgar e permitir
                    salvar no celular. Nenhum dado privado da sua conta será
                    incluído automaticamente.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      Telefone público
                      <Input
                        type="tel"
                        maxLength={40}
                        placeholder="(31) 99999-9999"
                        value={contact.phone}
                        onChange={e =>
                          setContact({ ...contact, phone: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      E-mail público
                      <Input
                        type="email"
                        maxLength={254}
                        value={contact.email}
                        onChange={e =>
                          setContact({ ...contact, email: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.published}
                    disabled={busy}
                    onChange={e =>
                      setForm({ ...form, published: e.target.checked })
                    }
                  />
                  Publicar cartão para disponibilizá-lo nos agendamentos
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={busy}>
                    {save.isPending ? "Salvando…" : "Salvar cartão"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setPreviewOpen(true)}
                  >
                    Ver prévia
                  </Button>
                  {query.data?.published === 1 && (
                    <a
                      className="break-all text-sm underline"
                      href={`/artista/${query.data.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir cartão público
                    </a>
                  )}
                </div>
              </form>
              {query.data && (
                <ArtistCardSharing
                  token={query.data.token}
                  published={query.data.published === 1}
                  busy={busy}
                  onPublication={published =>
                    publication.mutate({ artistId, published })
                  }
                  card={{
                    name: query.data.artistName || name,
                    photo: query.data.artistPhoto,
                    headline: query.data.headline,
                    description: query.data.description,
                    links: query.data.links,
                    images: query.data.images,
                    presentation: toPublicPresentation(query.data.presentation),
                  }}
                />
              )}
              <section className="mt-3 space-y-3 border-t pt-5">
                <h3 className="text-lg font-semibold">
                  Fotografias da apresentação
                </h3>
                <p className="text-sm text-muted-foreground">
                  JPG, PNG ou WebP de até 5 MB. As fotos, remoções e
                  enquadramentos são salvos imediatamente e atualizam um cartão
                  já publicado. Textos e contatos mudam ao usar “Salvar cartão”.
                  Você também pode pausar a publicação no painel acima.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  {(["cover", "about", "process"] as const).map(slot => (
                    <MediaSlot
                      key={`${slot}-${query.data?.presentation?.[slot]?.key ?? "empty"}`}
                      slot={slot}
                      media={query.data?.presentation?.[slot]}
                      busy={busy}
                      onUpload={uploadSlot}
                      onEdit={(slot, media) =>
                        setEditing({
                          slot,
                          image: media.original?.url ?? media.url,
                          title: slotNames[slot],
                          expectedKey: media.key,
                          initialEdit: media.edit ?? {
                            ...originalCardImageEdit,
                            appearance: media.appearance ?? "bw",
                          },
                        })
                      }
                      onRemove={(slot, key) =>
                        removeMedia.mutate({ artistId, slot, expectedKey: key })
                      }
                      onFocal={(slot, key, draft) =>
                        focal.mutate({
                          artistId,
                          slot,
                          expectedKey: key,
                          ...draft,
                        })
                      }
                    />
                  ))}
                </div>
              </section>
              <section className="space-y-3 border-t pt-5">
                <h3 className="text-lg font-semibold">
                  Portfólio · até 12 trabalhos
                </h3>
                <p className="text-sm text-muted-foreground">
                  Envie somente imagens autorizadas para divulgação. Escolha o
                  recorte, o zoom e a cor de cada imagem antes de salvar. A
                  inclusão, os ajustes, a ordem e a remoção são salvos
                  imediatamente.
                </p>
                <label className="block text-sm">
                  Legenda do próximo trabalho
                  <Input
                    maxLength={160}
                    value={caption}
                    disabled={busy}
                    onChange={e => setCaption(e.target.value)}
                  />
                </label>
                <Input
                  type="file"
                  aria-label="Enviar imagem do portfólio"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy || (query.data?.images.length ?? 0) >= 12}
                  onChange={async e => {
                    const input = e.currentTarget,
                      file = input.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const data = await readImage(file);
                      setEditing({
                        slot: "work",
                        image: data.imageBase64,
                        title: "Portfólio",
                        payload: data,
                        caption,
                      });
                    } catch (error) {
                      if (!(error instanceof Error) || !("data" in error))
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Não foi possível enviar a imagem."
                        );
                    } finally {
                      setUploading(false);
                      input.value = "";
                    }
                  }}
                />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {query.data?.images.map((image, index) => (
                    <figure
                      key={image.key}
                      className="min-w-0 rounded-lg border p-2"
                    >
                      <img
                        src={image.url}
                        alt={image.caption || "Trabalho do artista"}
                        className="aspect-[3/4] w-full rounded object-cover"
                        style={{
                          filter:
                            image.appearance === "bw" ? "grayscale(1)" : "none",
                        }}
                      />
                      <figcaption className="my-2 break-words text-xs">
                        {image.caption || `Trabalho ${index + 1}`}
                      </figcaption>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            setEditing({
                              slot: "work",
                              image: image.original?.url ?? image.url,
                              title: image.caption || `Trabalho ${index + 1}`,
                              expectedKey: image.key,
                              initialEdit: image.edit ?? originalCardImageEdit,
                            })
                          }
                        >
                          Recortar e ajustar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Mover trabalho ${index + 1} para antes`}
                          disabled={busy || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label={`Mover trabalho ${index + 1} para depois`}
                          disabled={
                            busy ||
                            index === (query.data?.images.length ?? 0) - 1
                          }
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            remove.mutate({ artistId, key: image.key })
                          }
                        >
                          Retirar
                        </Button>
                      </div>
                    </figure>
                  ))}
                </div>
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          onClick={e => e.stopPropagation()}
          className="max-h-[94dvh] w-[calc(100vw-24px)] overflow-y-auto p-0 sm:max-w-[1200px]"
        >
          <DialogHeader className="border-b bg-zinc-950 p-4 text-left">
            <DialogTitle>Prévia do cartão</DialogTitle>
            <DialogDescription>
              Inclui os textos ainda não salvos e as fotografias já enviadas.
              Feche a prévia e salve o cartão para publicar alterações de texto.
            </DialogDescription>
          </DialogHeader>
          <ArtistEditorialCard
            name={query.data?.artistName || name}
            photo={query.data?.artistPhoto}
            headline={form.headline}
            description={form.description}
            links={previewLinks}
            images={query.data?.images ?? []}
            presentation={previewPresentation}
            idPrefix={`preview-${artistId}`}
          />
        </DialogContent>
      </Dialog>
      {editing && (
        <CardImageEditor
          key={editing.image}
          {...editing}
          onCancel={() => setEditing(undefined)}
          onSave={saveEdited}
        />
      )}
    </>
  );
}
