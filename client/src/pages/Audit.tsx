import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Download, Eye, FileText, Calendar, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Audit() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { data: logs, isLoading } = trpc.audit.list.useQuery({
    action: actionFilter !== "all" ? actionFilter : undefined,
    entity: entityFilter !== "all" ? entityFilter : undefined,
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    limit: 1000,
  });

  const { data: searchResults } = trpc.audit.search.useQuery(
    { term: searchTerm },
    { enabled: searchTerm.length > 2 }
  );

  const displayLogs = searchTerm.length > 2 ? searchResults : logs;

  const getActionBadge = (action: string) => {
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      create: { variant: "default", label: "Criação", color: "bg-green-600" },
      update: { variant: "secondary", label: "Edição", color: "bg-blue-600" },
      delete: { variant: "destructive", label: "Exclusão", color: "bg-red-600" },
      activate: { variant: "default", label: "Ativação", color: "bg-emerald-600" },
      deactivate: { variant: "outline", label: "Desativação", color: "bg-orange-600" },
    };
    const config = variants[action] || variants.update;
    return (
      <Badge variant={config.variant} className={action === "activate" ? config.color : ""}>
        {config.label}
      </Badge>
    );
  };

  const getEntityBadge = (entity: string) => {
    const labels: Record<string, string> = {
      user: "Usuário",
      client: "Cliente",
      appointment: "Agendamento",
      transaction: "Transação",
      artist: "Artista",
      settings: "Configurações",
    };
    return <Badge variant="outline">{labels[entity] || entity}</Badge>;
  };

  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  const handleExportCSV = () => {
    if (!displayLogs || displayLogs.length === 0) {
      toast.error("Nenhum log para exportar");
      return;
    }

    const headers = ["Data/Hora", "Usuário", "Ação", "Entidade", "Nome da Entidade", "IP"];
    const rows = displayLogs.map((log) => [
      format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      log.userName,
      log.action,
      log.entity,
      log.entityName || "-",
      log.ipAddress || "-",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_${format(new Date(), "yyyy-MM-dd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Logs exportados com sucesso!");
  };

  const renderDetails = (details: string | null) => {
    if (!details) return null;

    try {
      const parsed = JSON.parse(details);

      if (parsed.before && parsed.after) {
        // Mostrar diff para updates
        return (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Antes:</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(parsed.before, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Depois:</h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(parsed.after, null, 2)}
              </pre>
            </div>
            {parsed.changes && (
              <div>
                <h4 className="font-semibold mb-2">Mudanças:</h4>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(parsed.changes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        );
      } else {
        // Mostrar dados completos para creates e deletes
        return (
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      }
    } catch {
      return <p className="text-muted-foreground">Detalhes não disponíveis</p>;
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Auditoria do Sistema</h1>
          <p className="text-muted-foreground">Registro completo de todas as ações realizadas no sistema</p>
        </div>
        <Button onClick={() => navigate("/audit/dashboard")} variant="outline">
          <BarChart3 className="mr-2 h-4 w-4" />
          Ver Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>Histórico de ações dos administradores</CardDescription>
            </div>
            <Button onClick={handleExportCSV} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Edição</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="activate">Ativação</SelectItem>
                <SelectItem value="deactivate">Desativação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
                <SelectItem value="appointment">Agendamento</SelectItem>
                <SelectItem value="transaction">Transação</SelectItem>
                <SelectItem value="artist">Artista</SelectItem>
                <SelectItem value="settings">Configurações</SelectItem>
              </SelectContent>
            </Select>
            <div>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Data inicial"
              />
            </div>
            <div>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Data final"
              />
            </div>
          </div>

          {/* Tabela de logs */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : displayLogs && displayLogs.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{log.userName}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>{getEntityBadge(log.entity)}</TableCell>
                      <TableCell>{log.entityName || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ipAddress || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(log)} title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum log de auditoria encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log de Auditoria</DialogTitle>
            <DialogDescription>Informações completas sobre a ação realizada</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data/Hora</Label>
                  <p className="text-sm font-mono">
                    {format(new Date(selectedLog.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <Label>Usuário</Label>
                  <p className="text-sm">{selectedLog.userName}</p>
                </div>
                <div>
                  <Label>Ação</Label>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <Label>Entidade</Label>
                  <div className="mt-1">{getEntityBadge(selectedLog.entity)}</div>
                </div>
                <div>
                  <Label>Nome da Entidade</Label>
                  <p className="text-sm">{selectedLog.entityName || "-"}</p>
                </div>
                <div>
                  <Label>ID da Entidade</Label>
                  <p className="text-sm font-mono">{selectedLog.entityId || "-"}</p>
                </div>
                <div>
                  <Label>Endereço IP</Label>
                  <p className="text-sm font-mono">{selectedLog.ipAddress || "-"}</p>
                </div>
                <div>
                  <Label>User Agent</Label>
                  <p className="text-xs truncate" title={selectedLog.userAgent}>
                    {selectedLog.userAgent || "-"}
                  </p>
                </div>
              </div>
              <div>
                <Label>Detalhes da Ação</Label>
                <div className="mt-2">{renderDetails(selectedLog.details)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
