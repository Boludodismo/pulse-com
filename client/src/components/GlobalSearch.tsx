import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Search, User, Calendar, DollarSign, Loader2, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Calcular datas baseado no filtro selecionado
  const getDateRange = () => {
    if (periodFilter === "all") return { startDate: undefined, endDate: undefined };
    if (periodFilter === "custom") return { startDate: customStartDate, endDate: customEndDate };
    
    const now = new Date();
    const endDate = new Date();
    let startDate = new Date();
    
    switch (periodFilter) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { startDate, endDate };
  };

  const dateRange = getDateRange();

  const { data: results, isLoading } = trpc.search.global.useQuery(
    { 
      term: searchTerm,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
    {
      enabled: searchTerm.length >= 2,
      staleTime: 30000,
    }
  );

  // Calcular total de resultados
  const totalResults =
    (results?.clients.length || 0) +
    (results?.appointments.length || 0) +
    (results?.transactions.length || 0);

  // Resetar índice selecionado quando os resultados mudarem
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Resetar busca ao fechar
  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Navegar pelos resultados com teclado
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results || totalResults === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalResults);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalResults) % totalResults);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelectResult(selectedIndex);
      }
    },
    [results, totalResults, selectedIndex]
  );

  // Selecionar resultado
  const handleSelectResult = (index: number) => {
    if (!results) return;

    let currentIndex = 0;

    // Clientes
    if (index < results.clients.length) {
      const client = results.clients[index];
      setLocation(`/clients/${client?.id}`);
      onOpenChange(false);
      return;
    }
    currentIndex += results.clients.length;

    // Agendamentos
    if (index < currentIndex + results.appointments.length) {
      const appointment = results.appointments[index - currentIndex];
      setLocation(`/schedule`);
      onOpenChange(false);
      return;
    }
    currentIndex += results.appointments.length;

    // Transações
    if (index < currentIndex + results.transactions.length) {
      const transaction = results.transactions[index - currentIndex];
      if (transaction?.clientId) {
        setLocation(`/clients/${transaction.clientId}`);
      } else {
        setLocation(`/reports`);
      }
      onOpenChange(false);
      return;
    }
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    // Valores armazenados em centavos no banco
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  // Formatar data
  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  // Renderizar resultados
  const renderResults = () => {
    if (searchTerm.length < 2) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Digite pelo menos 2 caracteres para buscar
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (!results || totalResults === 0) {
      return (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Nenhum resultado encontrado
        </div>
      );
    }

    let currentIndex = 0;

    return (
      <div className="space-y-4">
        {/* Clientes */}
        {results.clients.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold text-muted-foreground">
              <User className="h-3 w-3" />
              CLIENTES ({results.clients.length})
            </div>
            <div className="space-y-1">
              {results.clients.map((client, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={`client-${client.id}`}
                    onClick={() => handleSelectResult(itemIndex)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition-colors",
                      selectedIndex === itemIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="font-medium">{client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {client.email || client.phone || "Sem contato"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Agendamentos */}
        {results.appointments.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold text-muted-foreground">
              <Calendar className="h-3 w-3" />
              AGENDAMENTOS ({results.appointments.length})
            </div>
            <div className="space-y-1">
              {results.appointments.map((appointment, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={`appointment-${appointment.id}`}
                    onClick={() => handleSelectResult(itemIndex)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition-colors",
                      selectedIndex === itemIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="font-medium">{appointment.service}</div>
                    <div className="text-xs text-muted-foreground">
                      {appointment.clientName} • {appointment.artist} •{" "}
                      {formatDate(appointment.date)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Transações */}
        {results.transactions.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2 px-3 text-xs font-semibold text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              TRANSAÇÕES ({results.transactions.length})
            </div>
            <div className="space-y-1">
              {results.transactions.map((transaction, idx) => {
                const itemIndex = currentIndex++;
                return (
                  <button
                    key={`transaction-${transaction.id}`}
                    onClick={() => handleSelectResult(itemIndex)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition-colors",
                      selectedIndex === itemIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{transaction.category}</div>
                      <div
                        className={cn(
                          "text-sm font-semibold",
                          transaction.type === "entrada"
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                      >
                        {transaction.type === "entrada" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {transaction.clientName || "Sem cliente"} •{" "}
                      {formatDate(transaction.date)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl p-0 mx-2 sm:mx-auto">
        <div className="border-b">
          <div className="flex items-center px-4 py-3">
            <Search className="mr-2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes, agendamentos ou transações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            <kbd className="ml-2 rounded border bg-muted px-2 py-1 text-xs text-muted-foreground">
              ESC
            </kbd>
          </div>
          
          {/* Filtros de Período */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="text-xs text-muted-foreground">Período:</span>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="year">Último ano</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            
            {periodFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <span className="text-xs text-muted-foreground">até</span>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {(customStartDate || customEndDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => {
                      setCustomStartDate(undefined);
                      setCustomEndDate(undefined);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
            
            {periodFilter !== "all" && periodFilter !== "custom" && (
              <span className="text-xs text-muted-foreground italic">
                Filtrando resultados
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[400px]">
          <div className="p-2">{renderResults()}</div>
        </ScrollArea>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          Use <kbd className="rounded border bg-muted px-1">↑</kbd>{" "}
          <kbd className="rounded border bg-muted px-1">↓</kbd> para navegar,{" "}
          <kbd className="rounded border bg-muted px-1">Enter</kbd> para
          selecionar
        </div>
      </DialogContent>
    </Dialog>
  );
}
