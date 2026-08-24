import { trpc } from "@/lib/trpc";
import WeeklyAppointmentsWidget from "@/components/WeeklyAppointmentsWidget";
import RemindersWidget from "@/components/RemindersWidget";
import LowStockWidget from "@/components/LowStockWidget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, DollarSign, Cake, Eye, Plus } from "lucide-react";
import ConsumableWidget from "@/components/ConsumableWidget";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/SkeletonCard";
import { SkeletonTable } from "@/components/SkeletonTable";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: metrics, isLoading: metricsLoading } = trpc.dashboard.metrics.useQuery();
  const { data: topClients, isLoading: topClientsLoading } = trpc.dashboard.topClients.useQuery({ limit: 5 });
  const { data: birthdays, isLoading: birthdaysLoading } = trpc.dashboard.upcomingBirthdays.useQuery({ daysAhead: 30 });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getLoyaltyBadgeClass = (level: string) => {
    switch (level) {
      case "Ouro":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "Prata":
        return "bg-gray-400/10 text-gray-600 border-gray-400/20";
      case "Bronze":
      default:
        return "bg-amber-700/10 text-amber-700 border-amber-700/20";
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Visão geral do seu estúdio de tatuagem
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setLocation("/clients/new")} size="sm" className="sm:size-default">
            <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
            Novo Cliente
          </Button>
          <Button variant="outline" onClick={() => setLocation("/clients")} size="sm" className="sm:size-default">
            Ver Todos
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalClients || 0}</div>
                <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalAppointments || 0}</div>
                <p className="text-xs text-muted-foreground">Total de agendamentos</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">Em todas as transações</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aniversariantes</CardTitle>
            <Cake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.upcomingBirthdaysCount || 0}</div>
                <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Widgets */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Top 5 Clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clientes</CardTitle>
            <CardDescription>Clientes que mais gastaram no estúdio</CardDescription>
          </CardHeader>
          <CardContent>
            {topClientsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : topClients && topClients.length > 0 ? (
              <div className="space-y-3">
                {topClients.map((client, index) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/clients/${client.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(client.totalSpent)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getLoyaltyBadgeClass(client.loyaltyLevel)}>
                        {client.loyaltyLevel}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum cliente encontrado</p>
                <p className="text-sm mt-1">Comece adicionando seu primeiro cliente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aniversariantes */}
        <Card>
          <CardHeader>
            <CardTitle>Aniversariantes</CardTitle>
            <CardDescription>Próximos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {birthdaysLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : birthdays && birthdays.length > 0 ? (
              <div className="space-y-3">
                {birthdays.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/clients/${client.id}`)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                        <Cake className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{client.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {client.phone || "Sem telefone"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatDate(client.birthDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum aniversariante nos próximos 30 dias</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Widgets: Agenda da Semana · Lembretes · Alerta de Estoque · Insumos POD ── */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <WeeklyAppointmentsWidget />
        <RemindersWidget />
        <LowStockWidget />
        <ConsumableWidget />
      </div>
    </div>
  );
}
