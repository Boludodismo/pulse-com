import { useState } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Instagram, Phone, Palette } from "lucide-react";

// Paleta de cores sugeridas para artistas
const PRESET_COLORS = [
  "#FF6B6B", "#FF9F43", "#FECA57", "#48DBFB", "#1DD1A1",
  "#54A0FF", "#5F27CD", "#C44569", "#F8B739", "#10AC84",
  "#EE5A24", "#009432", "#0652DD", "#9980FA", "#ED4C67",
  "#B53471", "#12CBC4", "#FDA7DF", "#D980FA", "#C4E538",
];

interface ArtistForm {
  name: string;
  email: string;
  phone: string;
  instagram: string;
  specialty: string;
  bio: string;
  color: string;
  active: number;
}

const emptyForm: ArtistForm = {
  name: "",
  email: "",
  phone: "",
  instagram: "",
  specialty: "",
  bio: "",
  color: "",
  active: 1,
};

export default function Artists() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ArtistForm>(emptyForm);

  const { data: artists = [] } = trpc.artists.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.artists.create.useMutation({
    onSuccess: () => {
      toast.success("Artista cadastrado com sucesso!");
      utils.artists.list.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateMutation = trpc.artists.update.useMutation({
    onSuccess: () => {
      toast.success("Artista atualizado com sucesso!");
      utils.artists.list.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const deleteMutation = trpc.artists.delete.useMutation({
    onSuccess: () => {
      toast.success("Artista removido!");
      utils.artists.list.invalidate();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (artist: typeof artists[0]) => {
    setEditingId(artist.id);
    setForm({
      name: artist.name,
      email: artist.email || "",
      phone: artist.phone || "",
      instagram: artist.instagram || "",
      specialty: artist.specialty || "",
      bio: artist.bio || "",
      color: (artist as any).color || "",
      active: artist.active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome do artista é obrigatório");
      return;
    }
    const payload = {
      ...form,
      color: form.color || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Tem certeza que deseja remover o artista "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const toggleActive = (artist: typeof artists[0]) => {
    updateMutation.mutate({ id: artist.id, active: artist.active === 1 ? 0 : 1 });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palette className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            Artistas
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Gerencie os artistas do estúdio e suas cores no calendário
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 w-full sm:w-auto text-xs sm:text-sm">
          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
          Novo Artista
        </Button>
      </div>

      {/* Tabela */}
      {artists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Palette className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Nenhum artista cadastrado</p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            Clique em "Novo Artista" para começar
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm">Nome</TableHead>
                <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Especialidade</TableHead>
                <TableHead className="hidden md:table-cell text-xs sm:text-sm">Cor no Calendário</TableHead>
                <TableHead className="hidden lg:table-cell text-xs sm:text-sm">Contato</TableHead>
                <TableHead className="text-xs sm:text-sm">Status</TableHead>
                <TableHead className="text-right text-xs sm:text-sm">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {artists.map((artist) => {
                const artistColor = (artist as any).color;
                return (
                  <TableRow
                    key={artist.id}
                    className="cursor-pointer hover:bg-accent/30 transition-colors"
                    onClick={() => openEdit(artist)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: artistColor ? `${artistColor}22` : undefined,
                            border: artistColor ? `2px solid ${artistColor}` : undefined,
                          }}
                        >
                          <span
                            className="text-sm font-semibold"
                            style={{ color: artistColor || undefined }}
                          >
                            {artist.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{artist.name}</p>
                          {artist.email && (
                            <p className="text-xs text-muted-foreground">{artist.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {artist.specialty || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {artistColor ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-4 w-4 rounded-full border border-border shadow-sm"
                            style={{ backgroundColor: artistColor }}
                          />
                          <span className="text-xs text-muted-foreground font-mono hidden lg:inline">{artistColor}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Automática</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col gap-1">
                        {artist.phone && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {artist.phone}
                          </span>
                        )}
                        {artist.instagram && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Instagram className="h-3 w-3" /> @{artist.instagram.replace(/^@/, "")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={artist.active === 1 ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); toggleActive(artist); }}
                      >
                        {artist.active === 1 ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); openEdit(artist); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(artist.id, artist.name); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Artista" : "Novo Artista"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Nome completo do artista"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="specialty">Especialidade</Label>
                <Input
                  id="specialty"
                  placeholder="Ex: Realismo, Blackwork..."
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="artista@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instagram">Instagram</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <Input
                    id="instagram"
                    className="pl-7"
                    placeholder="usuario"
                    value={form.instagram.replace(/^@/, "")}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  />
                </div>
              </div>

              {/* Seletor de cor personalizada */}
              <div className="col-span-2 space-y-2">
                <Label>Cor no Calendário Visual</Label>
                <div className="space-y-3">
                  {/* Paleta de cores pré-definidas */}
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary"
                        style={{
                          backgroundColor: color,
                          borderColor: form.color === color ? "white" : "transparent",
                          boxShadow: form.color === color ? `0 0 0 2px ${color}` : undefined,
                        }}
                        onClick={() => setForm({ ...form, color })}
                        title={color}
                      />
                    ))}
                    {/* Botão para limpar cor */}
                    <button
                      type="button"
                      className="h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground/60 hover:border-muted-foreground transition-colors text-xs"
                      onClick={() => setForm({ ...form, color: "" })}
                      title="Sem cor personalizada (automática)"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Input hex manual + preview */}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-full border border-border flex-shrink-0"
                      style={{ backgroundColor: form.color || "#888888", opacity: form.color ? 1 : 0.3 }}
                    />
                    <Input
                      placeholder="#FF6B6B (opcional)"
                      value={form.color}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          setForm({ ...form, color: val });
                        }
                      }}
                      className="font-mono text-sm h-8 max-w-[140px]"
                      maxLength={7}
                    />
                    <span className="text-xs text-muted-foreground">
                      {form.color ? "Cor personalizada" : "Automática (paleta padrão)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="bio">Bio / Descrição</Label>
                <Textarea
                  id="bio"
                  placeholder="Breve descrição do artista, estilo, experiência..."
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "Salvar Alterações" : "Cadastrar Artista"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
