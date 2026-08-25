import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Download, Upload, FileSpreadsheet, FileText, CheckCircle,
  XCircle, AlertTriangle, Trash2, Users, ArrowLeft, Info,
  RefreshCw, HeartPulse,
} from "lucide-react";
import { useLocation } from "wouter";
import { LegacyAnamnesisImport } from "@/components/LegacyAnamnesisImport";

// ─── Helpers ────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, "UTF-8");
  });
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function ContactsImportExport() {
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado de importação
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFormat, setImportFormat] = useState<"csv" | "xlsx">("csv");
  const [importContent, setImportContent] = useState<string>("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    validCount: number;
    invalidCount: number;
    detectedColumns: string[];
    preview: Array<{ row: number; nome: string; email: string; telefone: string; instagram: string; valid: boolean; issues: string[] }>;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: number;
    errorDetails: string[];
  } | null>(null);

  // Estado de limpeza
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDedupeConfirm, setShowDedupeConfirm] = useState(false);

  // Queries de exportação (lazy)
  const exportCSVQuery = trpc.contacts.exportCSV.useQuery(undefined, { enabled: false });
  const exportXLSXQuery = trpc.contacts.exportXLSX.useQuery(undefined, { enabled: false });

  // Template
  const templateCSVQuery = trpc.contacts.downloadTemplate.useQuery({ format: "csv" }, { enabled: false });
  const templateXLSXQuery = trpc.contacts.downloadTemplate.useQuery({ format: "xlsx" }, { enabled: false });
  const duplicatePreview = trpc.contacts.previewDuplicates.useQuery();

  // Mutations
  const previewMutation = trpc.contacts.previewImport.useMutation({
    onSuccess: (data) => setPreviewData(data),
    onError: (e) => toast.error(`Erro ao analisar arquivo: ${e.message}`),
  });

  const importMutation = trpc.contacts.importContacts.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      toast.success(`${data.imported} novos e ${data.updated} cadastros atualizados.`);
    },
    onError: (e) => toast.error(`Erro na importação: ${e.message}`),
  });

  const clearMutation = trpc.contacts.clearTestContacts.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deleted} contatos de teste removidos.`);
      setShowClearConfirm(false);
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const dedupeMutation = trpc.contacts.consolidateDuplicates.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.mergedClients} cadastro(s) duplicado(s) consolidado(s).`);
      setShowDedupeConfirm(false);
      duplicatePreview.refetch();
      utils.clients.list.invalidate();
    },
    onError: (e) => toast.error(`Erro ao consolidar: ${e.message}`),
  });

  const utils = trpc.useUtils();

  // ─── Handlers ───────────────────────────────────────────────────────────

  async function handleExportCSV() {
    const result = await exportCSVQuery.refetch();
    if (result.data) {
      downloadBlob(result.data.csv, `contatos_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8;");
      toast.success(`${result.data.count} contatos exportados.`);
    }
  }

  async function handleExportXLSX() {
    const result = await exportXLSXQuery.refetch();
    if (result.data) {
      downloadBase64(result.data.xlsx, `contatos_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${result.data.count} contatos exportados.`);
    }
  }

  async function handleDownloadTemplate(format: "csv" | "xlsx") {
    if (format === "csv") {
      const result = await templateCSVQuery.refetch();
      if (result.data) downloadBlob(result.data.data, "template_contatos.csv", "text/csv;charset=utf-8;");
    } else {
      const result = await templateXLSXQuery.refetch();
      if (result.data) downloadBase64(result.data.data, "template_contatos.xlsx");
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setPreviewData(null);
    setImportResult(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    const fmt: "csv" | "xlsx" = ext === "xlsx" ? "xlsx" : "csv";
    setImportFormat(fmt);

    let content: string;
    if (fmt === "xlsx") {
      content = await fileToBase64(file);
    } else {
      content = await fileToText(file);
    }
    setImportContent(content);

    // Preview automático
    previewMutation.mutate({ format: fmt, content });
  }

  function handleImport() {
    if (!importContent) return;
    importMutation.mutate({ format: importFormat, content: importContent, skipDuplicates });
  }

  function handleReset() {
    setImportFile(null);
    setImportContent("");
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/clients")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Importar / Exportar Contatos</h1>
            <p className="text-muted-foreground text-sm">Gerencie seus contatos em CSV ou Excel</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/clients")}>
            <Users className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Ver Clientes</span>
          </Button>
        </div>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="export">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Exportar</span>
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Importar</span>
            </TabsTrigger>
            <TabsTrigger value="manage">
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Gerenciar</span>
            </TabsTrigger>
            <TabsTrigger value="history">
              <HeartPulse className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4">
            <LegacyAnamnesisImport />
          </TabsContent>

          {/* ── ABA: EXPORTAR ── */}
          <TabsContent value="export" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Exporte todos os seus contatos cadastrados no sistema para CSV ou Excel. Os arquivos incluem nome, e-mail, telefone, Instagram, data de nascimento, endereço e mais.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* CSV */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5 text-green-500" />
                    Exportar CSV
                  </CardTitle>
                  <CardDescription>
                    Formato universal, compatível com qualquer planilha ou sistema de contatos (Google Contacts, Outlook, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {["Google Contacts", "Outlook", "iCloud", "Excel", "LibreOffice"].map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleExportCSV}
                    disabled={exportCSVQuery.isFetching}
                  >
                    {exportCSVQuery.isFetching ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Baixar CSV
                  </Button>
                </CardContent>
              </Card>

              {/* Excel */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileSpreadsheet className="h-5 w-5 text-blue-500" />
                    Exportar Excel (.xlsx)
                  </CardTitle>
                  <CardDescription>
                    Planilha formatada para Microsoft Excel, Google Sheets ou LibreOffice Calc com todas as colunas organizadas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {["Microsoft Excel", "Google Sheets", "LibreOffice"].map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleExportXLSX}
                    disabled={exportXLSXQuery.isFetching}
                  >
                    {exportXLSXQuery.isFetching ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Baixar Excel
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Template */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Template de Importação</CardTitle>
                <CardDescription>
                  Baixe o modelo com as colunas corretas para preencher e importar seus contatos externos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate("csv")}>
                    <FileText className="h-4 w-4 mr-2 text-green-500" />
                    Template CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate("xlsx")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-blue-500" />
                    Template Excel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  O template inclui um exemplo de linha para facilitar o preenchimento. Remova o exemplo antes de importar.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ABA: IMPORTAR ── */}
          <TabsContent value="import" className="space-y-4 mt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Importe contatos de qualquer sistema. O arquivo deve ter uma linha de cabeçalho. Colunas reconhecidas automaticamente: <strong>nome, email, telefone, instagram, data_nascimento, genero, cpf, endereço</strong> e variações em inglês/português.
              </AlertDescription>
            </Alert>

            {/* Upload */}
            {!importResult && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Selecionar Arquivo</CardTitle>
                  <CardDescription>CSV (.csv) ou Excel (.xlsx)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {importFile ? importFile.name : "Clique para selecionar ou arraste o arquivo"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">CSV ou Excel (.xlsx) — máx. 10 MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  {importFile && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {importFormat === "xlsx" ? (
                          <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-green-500" />
                        )}
                        <span className="font-medium">{importFile.name}</span>
                        <Badge variant="outline" className="text-xs">{importFormat.toUpperCase()}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleReset}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Opções */}
                  {importFile && (
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        id="skipDuplicates"
                        checked={skipDuplicates}
                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="skipDuplicates" className="cursor-pointer">
                        Atualizar cadastros existentes sem criar duplicatas
                      </label>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Preview */}
            {previewMutation.isPending && (
              <Card>
                <CardContent className="py-8 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Analisando arquivo...</p>
                </CardContent>
              </Card>
            )}

            {previewData && !importResult && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Análise do Arquivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Resumo */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/40">
                      <p className="text-2xl font-bold">{previewData.totalRows}</p>
                      <p className="text-xs text-muted-foreground">Total de linhas</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-500/10">
                      <p className="text-2xl font-bold text-green-600">{previewData.validCount}</p>
                      <p className="text-xs text-muted-foreground">Válidos</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-500/10">
                      <p className="text-2xl font-bold text-red-500">{previewData.invalidCount}</p>
                      <p className="text-xs text-muted-foreground">Inválidos</p>
                    </div>
                  </div>

                  {/* Colunas detectadas */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Colunas detectadas</p>
                    <div className="flex flex-wrap gap-1">
                      {previewData.detectedColumns.map((col) => (
                        <Badge key={col} variant="secondary" className="text-xs">{col}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Preview de linhas */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Primeiras linhas</p>
                    <div className="space-y-2">
                      {previewData.preview.map((row) => (
                        <div
                          key={row.row}
                          className={`flex items-center gap-2 p-2 rounded-lg text-sm ${row.valid ? "bg-muted/30" : "bg-red-500/10"}`}
                        >
                          {row.valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{row.nome || "(sem nome)"}</span>
                            {row.email && <span className="text-muted-foreground ml-2 text-xs">{row.email}</span>}
                            {row.telefone && <span className="text-muted-foreground ml-2 text-xs">{row.telefone}</span>}
                          </div>
                          {row.issues.length > 0 && (
                            <span className="text-xs text-red-500">{row.issues.join(", ")}</span>
                          )}
                        </div>
                      ))}
                      {previewData.totalRows > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          ... e mais {previewData.totalRows - 5} linha(s)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botão importar */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1"
                      onClick={handleImport}
                      disabled={importMutation.isPending || previewData.validCount === 0}
                    >
                      {importMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Importar {previewData.validCount} contato(s)
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resultado */}
            {importResult && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Importação Concluída
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-lg bg-green-500/10">
                      <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                      <p className="text-xs text-muted-foreground">Importados</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-500/10">
                      <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                      <p className="text-xs text-muted-foreground">Atualizados</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                      <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                      <p className="text-xs text-muted-foreground">Ignorados</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-500/10">
                      <p className="text-2xl font-bold text-red-500">{importResult.errors}</p>
                      <p className="text-xs text-muted-foreground">Erros</p>
                    </div>
                  </div>

                  {importResult.errorDetails.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Detalhes dos erros</p>
                      {importResult.errorDetails.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{e}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        utils.clients.list.invalidate();
                        setLocation("/clients");
                      }}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Ver Clientes
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Nova Importação
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── ABA: GERENCIAR ── */}
          <TabsContent value="manage" className="space-y-4 mt-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta seção permite remover contatos de teste gerados automaticamente pelo sistema. <strong>Esta ação é irreversível.</strong>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Consolidar Cadastros Duplicados
                </CardTitle>
                <CardDescription>
                  Une somente registros com o mesmo nome e um identificador compatível. Telefone, nascimento, endereço, anamneses, agendamentos e histórico são preservados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-3 text-center">
                    <p className="text-2xl font-bold">{duplicatePreview.data?.duplicateGroups ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Grupos encontrados</p>
                  </div>
                  <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                    <p className="text-2xl font-bold text-orange-600">{duplicatePreview.data?.duplicateClients ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Cópias a consolidar</p>
                  </div>
                </div>
                {!showDedupeConfirm ? (
                  <Button
                    onClick={() => setShowDedupeConfirm(true)}
                    disabled={duplicatePreview.isLoading || !duplicatePreview.data?.duplicateClients}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Consolidar com segurança
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Alert className="border-orange-500/50 bg-orange-500/10">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <AlertDescription>
                        Confirme para transferir todo o histórico às fichas principais e remover somente as cópias identificadas.
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button onClick={() => dedupeMutation.mutate({ confirm: true })} disabled={dedupeMutation.isPending}>
                        {dedupeMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                        Confirmar consolidação
                      </Button>
                      <Button variant="outline" onClick={() => setShowDedupeConfirm(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  Remover Contatos de Teste
                </CardTitle>
                <CardDescription>
                  Remove contatos que não possuem telefone, e-mail e nenhum agendamento associado — critério típico de dados fictícios gerados para demonstração.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
                  <p className="font-medium">Critério de remoção:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      Sem telefone cadastrado
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      Sem e-mail cadastrado
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                      Sem nenhum agendamento
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Contatos reais com agendamentos nunca serão removidos, mesmo sem telefone ou e-mail.
                  </p>
                </div>

                {!showClearConfirm ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover Contatos de Teste
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Alert className="border-red-500/50 bg-red-500/10">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <AlertDescription className="text-red-700 dark:text-red-400">
                        <strong>Atenção:</strong> Esta ação é permanente e não pode ser desfeita. Tem certeza?
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => clearMutation.mutate({ confirm: true })}
                        disabled={clearMutation.isPending}
                      >
                        {clearMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Confirmar Remoção
                      </Button>
                      <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
