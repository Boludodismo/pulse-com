import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ArtistRevenueChart } from "@/components/ArtistRevenueChart";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Calendar, Download, Package, User, ChevronDown, ChevronUp } from "lucide-react";
import { exportFinancialReportToPDF } from "@/lib/exportPDF";
import { toast } from "sonner";

const COLORS = ["#fb923c", "#f97316", "#ea580c", "#c2410c", "#92220c"];

export default function Reports() {
  const [period, setPeriod] = useState<string>("current-month");
  
  // Calcular datas com base no período selecionado
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (period) {
      case "current-month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case "last-3-months":
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case "last-6-months":
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case "last-12-months":
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case "current-year":
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    
    // CORREÇÃO TZ-2: enviar datas no formato local (YYYY-MM-DD HH:mm:ss)
    // O banco armazena strings locais; enviar ISO UTC causaria comparação incorreta
    const fmt = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    return { startDate: fmt(start), endDate: fmt(end) };
  }, [period]);

  const { data: summary, isLoading: summaryLoading } = trpc.reports.summary.useQuery({
    startDate,
    endDate,
  });

  const { data: monthlyData, isLoading: monthlyLoading } = trpc.reports.monthlyRevenue.useQuery({
    startDate,
    endDate,
  });

  const { data: categoryData, isLoading: categoryLoading } = trpc.reports.categoryBreakdown.useQuery({
    startDate,
    endDate,
  });

  const { data: paymentData, isLoading: paymentLoading } = trpc.reports.paymentMethodBreakdown.useQuery({
    startDate,
    endDate,
  });

  const { data: transactions, isLoading: transactionsLoading } = trpc.transactions.getByDateRange.useQuery({
    startDate,
    endDate,
  });

  // Extrair apenas 'YYYY-MM-DD' para o consumableReport
  const podStartDate = startDate.slice(0, 10);
  const podEndDate = endDate.slice(0, 10);

  const { data: consumableReport, isLoading: consumableLoading } = trpc.procedures.consumableReport.useQuery({
    startDate: podStartDate,
    endDate: podEndDate,
  });

  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  const isLoading = summaryLoading || monthlyLoading || categoryLoading || paymentLoading || transactionsLoading;

  // Formatar nomes de meses
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  };

  // Formatar moeda (valores armazenados em centavos no banco)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value / 100);
  };

  // Traduzir métodos de pagamento
  const translatePaymentMethod = (method: string) => {
    const translations: Record<string, string> = {
      dinheiro: "Dinheiro",
      pix: "PIX",
      credito: "Crédito",
      debito: "Débito",
      transferencia: "Transferência",
    };
    return translations[method] || method;
  };

  // Função de exportar PDF
  const handleExportPDF = () => {
    try {
      if (!summary || !transactions || !categoryData || !paymentData) {
        toast.error("Aguarde o carregamento dos dados.");
        return;
      }

      // Formatar nome do período
      const periodNames: Record<string, string> = {
        "current-month": "Mês Atual",
        "last-3-months": "Últimos 3 Meses",
        "last-6-months": "Últimos 6 Meses",
        "last-12-months": "Últimos 12 Meses",
        "current-year": "Ano Atual",
      };

      exportFinancialReportToPDF({
        period: periodNames[period] || period,
        summary,
        transactions,
        categoryBreakdown: categoryData,
        paymentMethodBreakdown: paymentData,
      });

      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório. Tente novamente.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios Financeiros</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Análise detalhada de receitas e despesas
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current-month">Mês Atual</SelectItem>
                <SelectItem value="last-3-months">Últimos 3 Meses</SelectItem>
                <SelectItem value="last-6-months">Últimos 6 Meses</SelectItem>
                <SelectItem value="last-12-months">Últimos 12 Meses</SelectItem>
                <SelectItem value="current-year">Ano Atual</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleExportPDF}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar </span>PDF
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-500">
                    {formatCurrency(summary?.totalRevenue || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary?.transactionCount || 0} transações
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-500">
                    {formatCurrency(summary?.totalExpenses || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saídas do período
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <>
                  <div className={`text-2xl font-bold ${(summary?.balance || 0) >= 0 ? 'text-primary' : 'text-red-500'}`}>
                    {formatCurrency(summary?.balance || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Receitas - Despesas
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Receita Mensal</CardTitle>
            <CardDescription>
              Evolução de receitas e despesas ao longo do tempo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : monthlyData && monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData.map(d => ({
                  ...d,
                  month: formatMonth(d.month),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#a855f7" name="Receita" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Despesas" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown Charts */}
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Receita por Categoria</CardTitle>
              <CardDescription>
                Distribuição de receitas por tipo de serviço
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoryLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : categoryData && categoryData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.category}: ${formatCurrency(entry.total)}`}
                        labelLine={false}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {categoryData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{item.category}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Receita por Método de Pagamento</CardTitle>
              <CardDescription>
                Distribuição de receitas por forma de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : paymentData && paymentData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={paymentData.map(d => ({
                          ...d,
                          paymentMethod: translatePaymentMethod(d.paymentMethod),
                        }))}
                        dataKey="total"
                        nameKey="paymentMethod"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.paymentMethod}: ${formatCurrency(entry.total)}`}
                        labelLine={false}
                      >
                        {paymentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {paymentData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span>{translatePaymentMethod(item.paymentMethod)}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Artist Revenue Analytics */}
        <div className="mt-2">
          <ArtistRevenueChart />
        </div>

        {/* Relatório de Insumos por Artista */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-violet-400" />
              Insumos por Artista
            </CardTitle>
            <CardDescription>Custo de materiais por artista no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            {consumableLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !consumableReport || consumableReport.byArtist.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                Nenhuma sessão POD registrada no período
              </div>
            ) : (
              <div className="space-y-3">
                {/* Totais */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total de Sessões</p>
                    <p className="text-2xl font-bold text-violet-400">{consumableReport.totalSessions}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Custo Total de Insumos</p>
                    <p className="text-2xl font-bold text-orange-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(consumableReport.totalCost)}
                    </p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                    <p className="text-xs text-muted-foreground">Média por Sessão</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {consumableReport.totalSessions > 0
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(consumableReport.totalCost / consumableReport.totalSessions)
                        : 'R$ 0,00'}
                    </p>
                  </div>
                </div>

                {/* Por artista */}
                {consumableReport.byArtist.map((artist) => (
                  <div key={artist.artistName} className="border border-border rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => setExpandedArtist(expandedArtist === artist.artistName ? null : artist.artistName)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                          <User className="h-4 w-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="font-medium">{artist.artistName}</p>
                          <p className="text-xs text-muted-foreground">{artist.sessions} sessões</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-orange-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(artist.totalCost)}
                          </p>
                          <p className="text-xs text-muted-foreground">em insumos</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-semibold text-emerald-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(artist.totalRevenue)}
                          </p>
                          <p className="text-xs text-muted-foreground">receita</p>
                        </div>
                        {expandedArtist === artist.artistName
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </div>
                    </button>

                    {expandedArtist === artist.artistName && (
                      <div className="px-4 pb-4 border-t border-border bg-muted/10">
                        <p className="text-xs text-muted-foreground mt-3 mb-2 font-medium uppercase tracking-wide">Insumos por categoria</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(artist.consumablesByCategory).map(([cat, data]) => {
                            const catLabels: Record<string, string> = {
                              ink: 'Tintas', cartridge: 'Cartuchos', disposable: 'Descartáveis',
                              liquid: 'Líquidos', protection: 'Proteção', stencil: 'Stencil',
                              aftercare: 'Pós-cuidado', other: 'Outros', outros: 'Outros',
                            };
                            return (
                              <div key={cat} className="bg-muted/30 rounded p-2">
                                <p className="text-xs text-muted-foreground">{catLabels[cat] ?? cat}</p>
                                <p className="text-sm font-medium">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.cost)}
                                </p>
                                <p className="text-xs text-muted-foreground">{data.qty.toFixed(1)} un.</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Margem bruta estimada</span>
                          <span className={`font-semibold ${
                            artist.totalRevenue - artist.totalCost >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(artist.totalRevenue - artist.totalCost)}
                            {artist.totalRevenue > 0 && (
                              <span className="text-xs ml-1">
                                ({((1 - artist.totalCost / artist.totalRevenue) * 100).toFixed(1)}%)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
