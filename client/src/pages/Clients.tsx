import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Eye, Phone, Mail, Calendar, ArrowUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";

const PAGE_SIZE = 50;

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const isMobile = useIsMobile();

  // Debounce: só dispara a query 300ms após parar de digitar
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // volta para página 1 ao buscar
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: clients, isLoading } = trpc.clients.list.useQuery();
  const { data: searchResults, isLoading: searchLoading } = trpc.clients.search.useQuery(
    { term: debouncedSearch },
    { enabled: debouncedSearch.length > 0 }
  );

  // Lista paginada para exibição sem busca (evita renderizar 5k+ linhas)
  const allClients = useMemo(() => clients ?? [], [clients]);
  const paginatedClients = useMemo(
    () => allClients.slice(0, page * PAGE_SIZE),
    [allClients, page]
  );
  const hasMore = allClients.length > page * PAGE_SIZE;

  const displayClients = debouncedSearch.length > 0 ? (searchResults ?? []) : paginatedClients;
  const isSearching = searchTerm !== debouncedSearch || (debouncedSearch.length > 0 && searchLoading);

  // Infinite scroll: sentinela no final da lista
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && !isSearching && debouncedSearch.length === 0) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isLoading, isSearching, debouncedSearch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Gerencie todos os seus clientes em um só lugar
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => setLocation("/contacts/import-export")}>
            <ArrowUpDown className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Importar / Exportar</span>
          </Button>
          <Button onClick={() => setLocation("/clients/new")} size={isMobile ? "sm" : "default"}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10 sm:h-11"
        />
      </div>

      {/* Clients List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Lista de Clientes</CardTitle>
          <CardDescription>
            {debouncedSearch.length > 0
              ? `${displayClients?.length || 0} resultado(s) para "${debouncedSearch}"`
              : `${allClients.length} cliente(s) • exibindo ${displayClients?.length || 0}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {isLoading || isSearching ? (
            <div className="space-y-3 p-4 sm:p-0">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : displayClients && displayClients.length > 0 ? (
            <>
              {/* Mobile: cards empilhados */}
              <div className="sm:hidden divide-y divide-border">
                {displayClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 hover:bg-accent/30 active:bg-accent/50 transition-colors cursor-pointer touch-manipulation"
                    onClick={() => setLocation(`/clients/${client.id}`)}
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate text-sm">{client.name}</p>
                        <Badge variant="outline" className={`${getLoyaltyBadgeClass(client.loyaltyLevel)} text-xs shrink-0`}>
                          {client.loyaltyLevel}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {client.phone}
                          </span>
                        )}
                        {client.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[140px]">{client.email}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {client.appointmentCount} agend.
                        </span>
                        <span className="font-medium text-foreground">{formatCurrency(client.totalSpent)}</span>
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>

              {/* Desktop: tabela */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead className="text-right">Total Gasto</TableHead>
                      <TableHead className="text-center">Agendamentos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayClients.map((client) => (
                      <TableRow
                        key={client.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setLocation(`/clients/${client.id}`)}
                      >
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {client.email && (
                              <span className="text-sm text-muted-foreground">{client.email}</span>
                            )}
                            {client.phone && (
                              <span className="text-sm text-muted-foreground">{client.phone}</span>
                            )}
                            {!client.email && !client.phone && (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getLoyaltyBadgeClass(client.loyaltyLevel)}>
                            {client.loyaltyLevel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(client.totalSpent)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{client.appointmentCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setLocation(`/clients/${client.id}`); }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-12 px-4">
              <p className="text-muted-foreground text-base sm:text-lg">Nenhum cliente encontrado</p>
              <p className="text-sm text-muted-foreground mt-2">
                {debouncedSearch.length > 0
                  ? "Tente buscar com outros termos"
                  : "Comece adicionando seu primeiro cliente"}
              </p>
              {debouncedSearch.length === 0 && (
                <Button onClick={() => setLocation("/clients/new")} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cliente
                </Button>
              )}
            </div>
          )}
          {/* Sentinela de infinite scroll */}
          <div ref={sentinelRef} className="h-1" />
          {/* Spinner de carregamento ao chegar no final */}
          {hasMore && debouncedSearch.length === 0 && (
            <div className="flex justify-center py-3 text-xs text-muted-foreground gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Carregando mais clientes...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
