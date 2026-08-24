import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Save, FileDown, Trash2 } from "lucide-react";

interface TemplateConfig {
  includeSections: string[];
  logsLimit: number;
  usersLimit: number;
  reportTitle: string;
  reportSubtitle: string;
  primaryColor: string;
  footerText: string;
}

interface ReportTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (config: TemplateConfig) => void;
}

const SECTIONS = [
  { id: "metrics", label: "Métricas Principais", description: "Total de ações, últimas 24h, usuário mais ativo" },
  { id: "actionsByType", label: "Distribuição por Tipo", description: "Gráfico de ações por tipo (criar, editar, excluir)" },
  { id: "actionsByEntity", label: "Distribuição por Entidade", description: "Gráfico de ações por entidade (clientes, agendamentos, etc)" },
  { id: "topUsers", label: "Top Usuários", description: "Ranking de usuários mais ativos" },
  { id: "actionsByDay", label: "Atividade Temporal", description: "Gráfico de ações ao longo do tempo" },
  { id: "recentLogs", label: "Logs Recentes", description: "Tabela detalhada dos últimos logs" },
];

export default function ReportTemplateModal({ open, onOpenChange, onExport }: ReportTemplateModalProps) {
  const [config, setConfig] = useState<TemplateConfig>({
    includeSections: ["metrics", "actionsByType", "actionsByEntity", "topUsers", "actionsByDay", "recentLogs"],
    logsLimit: 20,
    usersLimit: 5,
    reportTitle: "Relatório de Auditoria",
    reportSubtitle: "",
    primaryColor: "#f97316",
    footerText: "",
  });

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  const { data: templates, refetch: refetchTemplates } = trpc.reportTemplates.list.useQuery(undefined, {
    enabled: open,
  });

  const createTemplateMutation = trpc.reportTemplates.create.useMutation();
  const updateTemplateMutation = trpc.reportTemplates.update.useMutation();
  const deleteTemplateMutation = trpc.reportTemplates.delete.useMutation();

  const handleSectionToggle = (sectionId: string) => {
    setConfig(prev => ({
      ...prev,
      includeSections: prev.includeSections.includes(sectionId)
        ? prev.includeSections.filter(id => id !== sectionId)
        : [...prev.includeSections, sectionId],
    }));
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }

    try {
      if (selectedTemplateId) {
        await updateTemplateMutation.mutateAsync({
          id: selectedTemplateId,
          name: templateName,
          description: templateDescription,
          includeSections: config.includeSections,
          sectionOrder: config.includeSections,
          logsLimit: config.logsLimit,
          usersLimit: config.usersLimit,
          reportTitle: config.reportTitle,
          reportSubtitle: config.reportSubtitle,
          primaryColor: config.primaryColor,
          footerText: config.footerText,
        });
        toast.success("Template atualizado com sucesso!");
      } else {
        await createTemplateMutation.mutateAsync({
          name: templateName,
          description: templateDescription,
          includeSections: config.includeSections,
          sectionOrder: config.includeSections,
          logsLimit: config.logsLimit,
          usersLimit: config.usersLimit,
          reportTitle: config.reportTitle,
          reportSubtitle: config.reportSubtitle,
          primaryColor: config.primaryColor,
          footerText: config.footerText,
        });
        toast.success("Template salvo com sucesso!");
      }
      refetchTemplates();
      setTemplateName("");
      setTemplateDescription("");
      setSelectedTemplateId(null);
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template");
    }
  };

  const handleLoadTemplate = async (templateId: number) => {
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      setConfig({
        includeSections: template.includeSections,
        logsLimit: template.logsLimit,
        usersLimit: template.usersLimit,
        reportTitle: template.reportTitle || "Relatório de Auditoria",
        reportSubtitle: template.reportSubtitle || "",
        primaryColor: template.primaryColor || "#f97316",
        footerText: template.footerText || "",
      });
      setTemplateName(template.name);
      setTemplateDescription(template.description || "");
      setSelectedTemplateId(templateId);
      toast.success("Template carregado!");
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;

    try {
      await deleteTemplateMutation.mutateAsync({ id: templateId });
      toast.success("Template excluído com sucesso!");
      refetchTemplates();
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
        setTemplateName("");
        setTemplateDescription("");
      }
    } catch (error) {
      console.error("Erro ao excluir template:", error);
      toast.error("Erro ao excluir template");
    }
  };

  const handleExport = () => {
    onExport(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar Relatório</DialogTitle>
          <DialogDescription>
            Configure as seções, limites e aparência do relatório antes de exportar
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="sections" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sections">Seções</TabsTrigger>
            <TabsTrigger value="limits">Limites</TabsTrigger>
            <TabsTrigger value="visual">Visual</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="sections" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>Selecione as seções a incluir no relatório:</Label>
              {SECTIONS.map(section => (
                <div key={section.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox
                    id={section.id}
                    checked={config.includeSections.includes(section.id)}
                    onCheckedChange={() => handleSectionToggle(section.id)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={section.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {section.label}
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="limits" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="logsLimit">Quantidade de Logs</Label>
                <Select
                  value={config.logsLimit.toString()}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, logsLimit: parseInt(value) }))}
                >
                  <SelectTrigger id="logsLimit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 logs</SelectItem>
                    <SelectItem value="20">20 logs</SelectItem>
                    <SelectItem value="50">50 logs</SelectItem>
                    <SelectItem value="100">100 logs</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Número de logs recentes a exibir na seção de logs detalhados
                </p>
              </div>

              <div>
                <Label htmlFor="usersLimit">Quantidade de Usuários no Ranking</Label>
                <Select
                  value={config.usersLimit.toString()}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, usersLimit: parseInt(value) }))}
                >
                  <SelectTrigger id="usersLimit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Top 5</SelectItem>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="20">Top 20</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Número de usuários a exibir no ranking de mais ativos
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="visual" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="reportTitle">Título do Relatório</Label>
                <Input
                  id="reportTitle"
                  value={config.reportTitle}
                  onChange={(e) => setConfig(prev => ({ ...prev, reportTitle: e.target.value }))}
                  placeholder="Relatório de Auditoria"
                />
              </div>

              <div>
                <Label htmlFor="reportSubtitle">Subtítulo (opcional)</Label>
                <Input
                  id="reportSubtitle"
                  value={config.reportSubtitle}
                  onChange={(e) => setConfig(prev => ({ ...prev, reportSubtitle: e.target.value }))}
                  placeholder="Descrição adicional do relatório"
                />
              </div>

              <div>
                <Label htmlFor="primaryColor">Cor Primária</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-20 h-10"
                  />
                  <Input
                    value={config.primaryColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                    placeholder="#f97316"
                    className="flex-1"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Cor usada nos cabeçalhos das tabelas
                </p>
              </div>

              <div>
                <Label htmlFor="footerText">Texto do Rodapé (opcional)</Label>
                <Textarea
                  id="footerText"
                  value={config.footerText}
                  onChange={(e) => setConfig(prev => ({ ...prev, footerText: e.target.value }))}
                  placeholder="Texto personalizado para o rodapé de todas as páginas"
                  rows={3}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label>Templates Salvos</Label>
                {templates && templates.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          selectedTemplateId === template.id ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-sm text-muted-foreground">{template.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoadTemplate(template.id)}
                          >
                            Carregar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    Nenhum template salvo ainda
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <Label>Salvar Configuração Atual</Label>
                <div className="space-y-3 mt-2">
                  <div>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Nome do template"
                    />
                  </div>
                  <div>
                    <Textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Descrição (opcional)"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={!templateName.trim() || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    className="w-full"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {selectedTemplateId ? "Atualizar Template" : "Salvar como Template"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
