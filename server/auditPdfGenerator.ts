import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditStats {
  totalActions: number;
  actionsLast24h: number;
  mostActiveUser: { name: string | null; count: number } | null;
  mostModifiedEntity: { entity: string; count: number } | null;
}

interface ActionByDay {
  date: string;
  count: number;
}

interface ActionByType {
  action: string;
  count: number;
}

interface ActionByEntity {
  entity: string;
  count: number;
}

interface TopUser {
  userName: string | null;
  count: number;
}

interface AuditLog {
  id: number;
  userName: string | null;
  action: string;
  entity: string;
  entityName: string | null;
  createdAt: string | Date;
}

interface TemplateConfig {
  includeSections?: string[];
  reportTitle?: string;
  reportSubtitle?: string;
  primaryColor?: string;
  footerText?: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Edição",
  delete: "Exclusão",
  activate: "Ativação",
  deactivate: "Desativação",
};

const ENTITY_LABELS: Record<string, string> = {
  user: "Usuários",
  client: "Clientes",
  appointment: "Agendamentos",
  transaction: "Transações",
};

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [139, 92, 246];
}

export async function generateAuditPDF(data: {
  startDate: string | Date;
  endDate: string | Date;
  statistics: AuditStats;
  actionsByDay: ActionByDay[];
  actionsByType: ActionByType[];
  actionsByEntity: ActionByEntity[];
  topUsers: TopUser[];
  recentLogs: AuditLog[];
  template?: TemplateConfig;
}): Promise<Buffer> {
  const doc = new jsPDF();
  let yPosition = 20;

  // Configurações do template
  const template = data.template || {};
  const includeSections = template.includeSections || [
    "metrics",
    "actionsByType",
    "actionsByEntity",
    "topUsers",
    "actionsByDay",
    "recentLogs",
  ];
  const primaryColor = template.primaryColor || "#8b5cf6";
  const primaryRgb = hexToRgb(primaryColor);

  // Cabeçalho
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(
    template.reportTitle || "Relatório de Auditoria",
    105,
    yPosition,
    { align: "center" }
  );
  
  yPosition += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  if (template.reportSubtitle) {
    doc.text(template.reportSubtitle, 105, yPosition, { align: "center" });
    yPosition += 5;
  }
  
  doc.text(
    `Período: ${format(data.startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(data.endDate, "dd/MM/yyyy", { locale: ptBR })}`,
    105,
    yPosition,
    { align: "center" }
  );
  
  yPosition += 5;
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    105,
    yPosition,
    { align: "center" }
  );

  yPosition += 15;

  // Seção de Métricas
  if (includeSections.includes("metrics")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Métricas Principais", 14, yPosition);
    yPosition += 8;

    const metricsData = [
      ["Total de Ações", data.statistics.totalActions.toString()],
      ["Ações nas Últimas 24h", data.statistics.actionsLast24h.toString()],
      [
        "Usuário Mais Ativo",
        data.statistics.mostActiveUser
          ? `${data.statistics.mostActiveUser.name || "N/A"} (${data.statistics.mostActiveUser.count} ações)`
          : "N/A",
      ],
      [
        "Entidade Mais Modificada",
        data.statistics.mostModifiedEntity
          ? `${ENTITY_LABELS[data.statistics.mostModifiedEntity.entity] || data.statistics.mostModifiedEntity.entity} (${data.statistics.mostModifiedEntity.count} modificações)`
          : "N/A",
      ],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [["Métrica", "Valor"]],
      body: metricsData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Seção de Distribuição por Tipo de Ação
  if (includeSections.includes("actionsByType")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Distribuição por Tipo de Ação", 14, yPosition);
    yPosition += 8;

    const actionTypeData = data.actionsByType.map((item) => [
      ACTION_LABELS[item.action] || item.action,
      item.count.toString(),
      `${((item.count / data.statistics.totalActions) * 100).toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Tipo de Ação", "Quantidade", "Percentual"]],
      body: actionTypeData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Seção de Distribuição por Entidade
  if (includeSections.includes("actionsByEntity")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Distribuição por Entidade", 14, yPosition);
    yPosition += 8;

    const entityData = data.actionsByEntity.map((item) => [
      ENTITY_LABELS[item.entity] || item.entity,
      item.count.toString(),
      `${((item.count / data.statistics.totalActions) * 100).toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Entidade", "Quantidade", "Percentual"]],
      body: entityData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Seção de Top Usuários
  if (includeSections.includes("topUsers")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Top Usuários Mais Ativos", 14, yPosition);
    yPosition += 8;

    const topUsersData = data.topUsers.map((user, index) => [
      (index + 1).toString(),
      user.userName || "N/A",
      user.count.toString(),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["#", "Usuário", "Ações"]],
      body: topUsersData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Seção de Atividade ao Longo do Tempo
  if (includeSections.includes("actionsByDay")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Atividade ao Longo do Tempo", 14, yPosition);
    yPosition += 8;

    const activityData = data.actionsByDay.map((item) => [
      format(new Date(item.date), "dd/MM/yyyy", { locale: ptBR }),
      item.count.toString(),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Data", "Ações"]],
      body: activityData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 9 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Seção de Logs Recentes
  if (includeSections.includes("recentLogs")) {
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Logs de Auditoria Recentes", 14, yPosition);
    yPosition += 8;

    const logsData = data.recentLogs.map((log) => [
      format(new Date(log.createdAt), "dd/MM HH:mm", { locale: ptBR }),
      log.userName || "N/A",
      ACTION_LABELS[log.action] || log.action,
      ENTITY_LABELS[log.entity] || log.entity,
      log.entityName || "-",
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Data/Hora", "Usuário", "Ação", "Entidade", "Nome"]],
      body: logsData,
      theme: "grid",
      headStyles: { fillColor: primaryRgb },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 45 },
      },
    });
  }

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    const footerY = doc.internal.pageSize.height - 10;
    
    if (template.footerText) {
      doc.text(template.footerText, 14, footerY);
    }
    
    doc.text(
      `Página ${i} de ${pageCount}`,
      105,
      footerY,
      { align: "center" }
    );
  }

  // Converter para buffer
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  return pdfBuffer;
}
