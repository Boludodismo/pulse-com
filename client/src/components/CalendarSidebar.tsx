import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CalendarSidebarProps {
  visibleCalendars: number[];
  onToggleCalendar: (id: number) => void;
}

export function CalendarSidebar({ visibleCalendars, onToggleCalendar }: CalendarSidebarProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#f97316",
  });

  // Buscar calendários
  const { data: calendars = [], refetch } = trpc.calendars.list.useQuery();

  // Mutations
  const createMutation = trpc.calendars.create.useMutation({
    onSuccess: () => {
      toast.success("Calendário criado!");
      refetch();
      setIsCreateOpen(false);
      setFormData({ name: "", description: "", color: "#f97316" });
    },
    onError: (error) => {
      toast.error(`Erro ao criar: ${error.message}`);
    },
  });

  const updateMutation = trpc.calendars.update.useMutation({
    onSuccess: () => {
      toast.success("Calendário atualizado!");
      refetch();
      setIsEditOpen(false);
      setEditingCalendar(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.calendars.delete.useMutation({
    onSuccess: () => {
      toast.success("Calendário excluído!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      color: formData.color,
      isVisible: 1,
    });
  };

  const handleUpdate = () => {
    if (!editingCalendar) return;
    updateMutation.mutate({
      id: editingCalendar.id,
      name: formData.name,
      description: formData.description,
      color: formData.color,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este calendário?")) {
      deleteMutation.mutate({ id });
    }
  };

  const openEdit = (calendar: any) => {
    setEditingCalendar(calendar);
    setFormData({
      name: calendar.name,
      description: calendar.description || "",
      color: calendar.color,
    });
    setIsEditOpen(true);
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Calendários</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Calendário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Trabalho, Pessoal, etc."
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>
              <div>
                <Label htmlFor="color">Cor</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#f97316"
                  />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">
                Criar Calendário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {calendars.map((calendar) => (
          <div
            key={calendar.id}
            className="flex items-center gap-2 p-2 rounded hover:bg-gray-800 group"
          >
            <Checkbox
              checked={visibleCalendars.includes(calendar.id)}
              onCheckedChange={() => onToggleCalendar(calendar.id)}
            />
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: calendar.color }}
            />
            <span className="flex-1 text-sm text-gray-200 truncate">{calendar.name}</span>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => openEdit(calendar)}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                onClick={() => handleDelete(calendar.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Calendário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-color">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={handleUpdate} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
