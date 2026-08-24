import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Stethoscope,
  Plus,
  Search,
  Clock,
  User,
  MapPin,
  Trash2,
  Eye,
  Filter,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  em_andamento: { label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  pausado: { label: "Pausado", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  finalizado: { label: "Finalizado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  retorno: { label: "Retorno", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  retoque: { label: "Retoque", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
};

export default function ProcedureList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Buscar todos os clientes para cruzar com procedimentos
  const clientsQuery = trpc.clients.list.useQuery();
  const utils = trpc.useUtils();

  // Buscar procedimentos por cliente — como não há endpoint global, usamos listByClient para cada cliente
  // Mas como isso seria N+1, usaremos uma abordagem diferente: buscar via clientId = 0 não existe
  // O ideal é ter um endpoint global — por ora, vamos listar os clientes e permitir navegação

  const deleteMutation = trpc.procedures.delete.useMutation({
    onSuccess: () => {
      toast.success("Procedimento excluído com sucesso.");
      utils.procedures.listByClient.invalidate();
      setDeleteId(null);
    },
    onError: (err) => {
      toast.error("Erro ao excluir: " + err.message);
      setDeleteId(null);
    },
  });

  const clients = clientsQuery.data ?? [];
  const filteredClients = clients.filter((c) =>
    search === "" ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search))
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Stethoscope className="w-6 h-6 text-primary" />
              POD Session
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Prontuários técnicos de execução de tatuagem
            </p>
          </div>
          <Button
            onClick={() => navigate("/procedures/new")}
            className="gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Novo Procedimento
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Instrução */}
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="py-4 px-5 flex items-start gap-3">
            <Stethoscope className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Como usar:</span> Acesse o perfil de um cliente e clique em{" "}
              <strong>Prontuário Técnico</strong> para criar e gerenciar sessões de tatuagem com timer, insumos e fotos. Ou clique em{" "}
              <strong>Novo Procedimento</strong> para iniciar diretamente.
            </div>
          </CardContent>
        </Card>

        {/* Lista de clientes com procedimentos */}
        {clientsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm mt-1">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.slice(0, 30).map((client) => (
              <ClientProcedureCard
                key={client.id}
                client={client}
                statusFilter={statusFilter}
                onNavigate={navigate}
                onDelete={setDeleteId}
              />
            ))}
          </div>
        )}

        {filteredClients.length > 30 && (
          <p className="text-center text-sm text-muted-foreground">
            Mostrando 30 de {filteredClients.length} clientes. Use a busca para filtrar.
          </p>
        )}
      </div>

      {/* Confirmar exclusão */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir procedimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os insumos, imagens e eventos do procedimento serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// ─── Sub-componente: card de cliente com seus procedimentos ─────────────────

function ClientProcedureCard({
  client,
  statusFilter,
  onNavigate,
  onDelete,
}: {
  client: { id: number; name: string; phone?: string | null; instagram?: string | null };
  statusFilter: string;
  onNavigate: (path: string) => void;
  onDelete: (id: number) => void;
}) {
  const proceduresQuery = trpc.procedures.listByClient.useQuery(
    { clientId: client.id },
    { staleTime: 30_000 }
  );

  const procedures = (proceduresQuery.data ?? []).filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  );

  if (!proceduresQuery.isLoading && procedures.length === 0 && statusFilter !== "all") {
    return null;
  }

  return (
    <Card className="hover:border-primary/40 transition-colors cursor-default">
      <CardContent className="p-4 space-y-3">
        {/* Header do cliente */}
        <div
          className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onNavigate(`/clients/${client.id}`)}
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{client.name}</p>
            {client.phone && (
              <p className="text-xs text-muted-foreground truncate">{client.phone}</p>
            )}
          </div>
        </div>

        {/* Procedimentos */}
        {proceduresQuery.isLoading ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : procedures.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum procedimento</p>
        ) : (
          <div className="space-y-2">
            {procedures.slice(0, 3).map((p) => {
              const statusInfo = STATUS_LABELS[p.status] ?? STATUS_LABELS.em_andamento;
              return (
                <div key={p.id} className="flex items-center gap-2 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </Badge>
                      {p.bodyLocation && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {p.bodyLocation}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => onNavigate(`/procedures/${p.id}`)}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => onDelete(p.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {procedures.length > 3 && (
              <p className="text-[10px] text-muted-foreground">
                +{procedures.length - 3} procedimentos
              </p>
            )}
          </div>
        )}

        {/* Botão ver perfil */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={() => onNavigate(`/clients/${client.id}?tab=procedures`)}
        >
          <User className="w-3 h-3" />
          Ver prontuário completo
        </Button>
      </CardContent>
    </Card>
  );
}
