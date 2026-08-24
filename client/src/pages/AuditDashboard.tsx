import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, TrendingUp, Users, Database, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ReportTemplateModal from "@/components/ReportTemplateModal";

const COLORS = ["#f97316", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];

const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  update: "Editar",
  delete: "Excluir",
  activate: "Ativar",
  deactivate: "Desativar",
};

const ENTITY_LABELS: Record<string, string> = {
  user: "Usuários",
  client: "Clientes",
  appointment: "Agendamentos",
  transaction: "Transações",
};

export default function AuditDashboard() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [isExporting, setIsExporting] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const exportPDFMutation = trpc.audit.exportPDF.useMutation();

  // Calcular datas baseadas no período
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(period));
    return { startDate: start, endDate: end };
  }, [period]);

  // Buscar dados
  const { data: statistics } = trpc.audit.statistics.useQuery({ startDate, endDate });
  const { data: actionsByDay } = trpc.audit.actionsByDay.useQuery({ startDate, endDate });
  const { data: actionsByType } = trpc.audit.actionsByType.useQuery({ startDate, endDate });
  const { data: actionsByEntity } = trpc.audit.actionsByEntity.useQuery({ startDate, endDate });
  const { data: topUsers } = trpc.audit.topActiveUsers.useQuery({ limit: 5, startDate, endDate });

  // Preparar dados para gráficos
  const lineChartData = useMemo(() => {
    if (!actionsByDay) return [];
    return actionsByDay.map(item => ({
      date: new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ações: item.count,
    }));
  }, [actionsByDay]);

  const barChartData = useMemo(() => {
    if (!actionsByType) return [];
    return actionsByType.map(item => ({
      action: ACTION_LABELS[item.action] || item.action,
      count: item.count,
    }));
  }, [actionsByType]);

  const pieChartData = useMemo(() => {
    if (!actionsByEntity) return [];
    return actionsByEntity.map(item => ({
      name: ENTITY_LABELS[item.entity] || item.entity,
      value: item.count,
    }));
  }, [actionsByEntity]);

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Auditoria</h1>
          <p className="text-muted-foreground mt-1">
            Visualize métricas e padrões de atividade do sistema
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowTemplateModal(true)}
            disabled={isExporting}
            variant="outline"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          
          <Select value={period} onValueChange={(value: "7" | "30" | "90") => setPeriod(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ações</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.totalActions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Últimas 24h</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.actionsLast24h || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ações registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuário Mais Ativo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {statistics?.mostActiveUser?.name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statistics?.mostActiveUser?.count || 0} ações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entidade Mais Modificada</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.mostModifiedEntity?.entity 
                ? ENTITY_LABELS[statistics.mostModifiedEntity.entity] || statistics.mostModifiedEntity.entity
                : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {statistics?.mostModifiedEntity?.count || 0} modificações
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de Linha - Ações por Dia */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Atividade ao Longo do Tempo</CardTitle>
            <CardDescription>
              Número de ações registradas por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ações" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Distribuição por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo de Ação</CardTitle>
            <CardDescription>
              Quantidade de cada tipo de operação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="action" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Distribuição por Entidade */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Entidade</CardTitle>
            <CardDescription>
              Proporção de ações por tipo de dado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Top Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Usuários Mais Ativos</CardTitle>
          <CardDescription>
            Usuários com maior número de ações registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topUsers && topUsers.length > 0 ? (
              topUsers.map((user, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{user.userName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{user.count}</p>
                    <p className="text-xs text-muted-foreground">ações</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhum dado disponível para o período selecionado
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

    <ReportTemplateModal
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        onExport={async (config) => {
          setIsExporting(true);
          try {
            // Gerar PDF com template personalizado (dados são buscados no backend)
            const result = await exportPDFMutation.mutateAsync({
              startDate,
              endDate,
              logsLimit: config.logsLimit,
              usersLimit: config.usersLimit,
              template: {
                includeSections: config.includeSections,
                reportTitle: config.reportTitle,
                reportSubtitle: config.reportSubtitle,
                primaryColor: config.primaryColor,
                footerText: config.footerText,
              },
            });

            // Converter base64 para blob e fazer download
            const byteCharacters = atob(result.pdf);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: "application/pdf" });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success("Relatório exportado com sucesso!");
          } catch (error) {
            console.error("Erro ao exportar PDF:", error);
            toast.error("Erro ao exportar relatório");
          } finally {
            setIsExporting(false);
          }
        }}
      />
    </>
  );
}
