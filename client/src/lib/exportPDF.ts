import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Transaction {
  id: number;
  type: string;
  category: string;
  amount: number;
  paymentMethod: string;
  date: string | Date;
  description?: string | null;
}

interface Summary {
  totalRevenue: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

interface PaymentMethodBreakdown {
  paymentMethod: string;
  total: number;
  count: number;
}

interface ExportData {
  period: string;
  summary: Summary;
  transactions: Transaction[];
  categoryBreakdown: CategoryBreakdown[];
  paymentMethodBreakdown: PaymentMethodBreakdown[];
}

const formatCurrency = (value: number): string => {
  // Valores armazenados em centavos no banco
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
};

const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString("pt-BR");
};

const translateType = (type: string): string => {
  return type === "entrada" ? "Entrada" : "Saída";
};

const translatePaymentMethod = (method: string): string => {
  const translations: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    credito: "Crédito",
    debito: "Débito",
    transferencia: "Transferência",
  };
  return translations[method] || method;
};

export function exportFinancialReportToPDF(data: ExportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Cabeçalho
  doc.setFontSize(22);
  doc.setTextColor(249, 115, 22); // Laranja
  doc.text("POD CRM", pageWidth / 2, yPosition, { align: "center" });

  yPosition += 8;
  doc.setFontSize(16);
  doc.setTextColor(100, 100, 100);
  doc.text("Relatório Financeiro", pageWidth / 2, yPosition, { align: "center" });

  yPosition += 6;
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Período: ${data.period}`, pageWidth / 2, yPosition, { align: "center" });

  yPosition += 10;

  // Linha separadora
  doc.setDrawColor(249, 115, 22);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 10;

  // Resumo Financeiro
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Resumo Financeiro", 20, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);

  const summaryData = [
    ["Receita Total", formatCurrency(data.summary.totalRevenue)],
    ["Despesas Totais", formatCurrency(data.summary.totalExpenses)],
    ["Saldo", formatCurrency(data.summary.balance)],
    ["Total de Transações", data.summary.transactionCount.toString()],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [["Métrica", "Valor"]],
    body: summaryData,
    theme: "grid",
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 20, right: 20 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Breakdown por Categoria
  if (data.categoryBreakdown.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Receita por Categoria", 20, yPosition);
    yPosition += 8;

    const categoryData = data.categoryBreakdown.map((item) => [
      item.category,
      formatCurrency(item.total),
      item.count.toString(),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Categoria", "Total", "Quantidade"]],
      body: categoryData,
      theme: "grid",
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Breakdown por Método de Pagamento
  if (data.paymentMethodBreakdown.length > 0) {
    if (yPosition > 220) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Receita por Método de Pagamento", 20, yPosition);
    yPosition += 8;

    const paymentData = data.paymentMethodBreakdown.map((item) => [
      translatePaymentMethod(item.paymentMethod),
      formatCurrency(item.total),
      item.count.toString(),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Método", "Total", "Quantidade"]],
      body: paymentData,
      theme: "grid",
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: 20, right: 20 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // Transações Detalhadas
  if (data.transactions.length > 0) {
    doc.addPage();
    yPosition = 20;

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Transações Detalhadas", 20, yPosition);
    yPosition += 8;

    const transactionData = data.transactions.map((tx) => [
      formatDate(tx.date),
      translateType(tx.type),
      tx.category,
      translatePaymentMethod(tx.paymentMethod),
      formatCurrency(tx.amount),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["Data", "Tipo", "Categoria", "Método", "Valor"]],
      body: transactionData,
      theme: "striped",
      headStyles: {
        fillColor: [249, 115, 22],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      margin: { left: 20, right: 20 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30, halign: "right" },
      },
    });
  }

  // Rodapé em todas as páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Gerar nome do arquivo
  const fileName = `relatorio-financeiro-${data.period.toLowerCase().replace(/\s+/g, "-")}.pdf`;

  // Salvar PDF
  doc.save(fileName);
}
