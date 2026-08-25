import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, FileText, User, Calendar } from "lucide-react";
import { useLocation } from "wouter";

export default function RiskAlerts() {
  const [, setLocation] = useLocation();
  const [filterLevel, setFilterLevel] = useState<string>("all");

  // Buscar todas as fichas de anamnese com risco
  const { data: allAnamnesis, isLoading } = trpc.anamnesis.getRiskAlerts.useQuery();

  // Filtrar por nível de risco
  const filteredAnamnesis = allAnamnesis?.filter((record) => {
    if (filterLevel === "all") return true;
    return record.riskLevel === filterLevel;
  }) || [];

  // Contar por nível de risco
  const criticalCount = allAnamnesis?.filter(r => r.riskLevel === "critical").length || 0;
  const highCount = allAnamnesis?.filter(r => r.riskLevel === "high").length || 0;
  const mediumCount = allAnamnesis?.filter(r => r.riskLevel === "medium").length || 0;
  const lowCount = allAnamnesis?.filter(r => r.riskLevel === "low").length || 0;

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/50";
      case "high":
        return "bg-orange-500/10 text-orange-500 border-orange-500/50";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/50";
      default:
        return "bg-green-500/10 text-green-500 border-green-500/50";
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case "critical":
        return "🚨 Bloqueio preventivo";
      case "high":
        return "⚠️ Risco Alto";
      case "medium":
        return "⚠️ Risco Médio";
      default:
        return "✅ Baixo Risco";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alertas de Risco</h1>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Alertas de Risco</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Triagem operacional de condições autodeclaradas e histórico de atenção
        </p>
      </div>

      {/* Resumo de Riscos */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Bloqueio preventivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{criticalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Não prosseguir automaticamente</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Risco Alto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">{highCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Avaliação cuidadosa</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Risco Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">{mediumCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Monitoramento</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-green-500" />
              Baixo Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{lowCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Sem fator autodeclarado</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fichas de Anamnese</CardTitle>
              <CardDescription>
                {filteredAnamnesis.length} ficha(s) encontrada(s)
              </CardDescription>
            </div>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="critical">Risco Crítico</SelectItem>
                <SelectItem value="high">Risco Alto</SelectItem>
                <SelectItem value="medium">Risco Médio</SelectItem>
                <SelectItem value="low">Baixo Risco</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAnamnesis.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhuma ficha encontrada com este nível de risco
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAnamnesis.map((record) => {
                let riskFactors: any[] = [];
                try { riskFactors = record.riskFactors ? JSON.parse(record.riskFactors) : []; } catch {}

                return (
                  <Card key={record.id} className="border-l-4" style={{
                    borderLeftColor: 
                      record.riskLevel === "critical" ? "rgb(239, 68, 68)" :
                      record.riskLevel === "high" ? "rgb(249, 115, 22)" :
                      record.riskLevel === "medium" ? "rgb(234, 179, 8)" :
                      "rgb(34, 197, 94)"
                  }}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={getRiskBadgeClass(record.riskLevel)}
                            >
                              {getRiskLabel(record.riskLevel)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Preenchido em {formatDate(record.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{record.clientName}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {record.source === "public_link" ? "Ficha via link" : "Ficha manual"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/clients/${record.clientId}`)}
                          >
                            <User className="h-4 w-4 mr-2" />
                            Ver Cliente
                          </Button>
                          {record.source === "manual" && (
                            <Button variant="outline" size="sm" onClick={() => window.open(`/anamnese/view/${record.id}`, '_blank')}>
                              <FileText className="h-4 w-4 mr-2" /> Ver Ficha
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Fatores de Risco */}
                      {riskFactors.length > 0 && (
                        <div className="mt-4 p-4 bg-accent/50 rounded-lg">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Fatores de Risco Identificados
                          </h4>
                          <div className="space-y-2">
                            {riskFactors.map((factor: any, index: number) => (
                              <div key={index} className="flex items-start gap-2 text-sm">
                                <span className="font-medium text-muted-foreground min-w-[100px]">
                                  {factor.category}:
                                </span>
                                <span>
                                  {factor.description}
                                  {factor.guidance && <span className="block text-muted-foreground mt-1">Conduta sugerida: {factor.guidance}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Esta triagem usa informações declaradas pelo cliente e serve como apoio operacional. Não substitui avaliação, diagnóstico ou liberação de profissional de saúde.
      </p>
    </div>
  );
}
