export interface FinancialTransactionExport {
  id: number;
  type: string;
  category: string;
  amount: number;
  paymentMethod: string;
  date: string | Date;
  description?: string | null;
}

export interface FinancialReportCsvData {
  period: string;
  summary: { totalRevenue: number; totalExpenses: number; balance: number; transactionCount: number };
  transactions: FinancialTransactionExport[];
  categoryBreakdown: Array<{ category: string; total: number; count: number }>;
  paymentMethodBreakdown: Array<{ paymentMethod: string; total: number; count: number }>;
}

const paymentLabels: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  transferencia: "Transferência",
};

const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const amountInReais = (amount: number) => (amount / 100).toFixed(2).replace(".", ",");
const formatDate = (value: string | Date) => new Date(value).toLocaleDateString("pt-BR");
const paymentLabel = (value: string) => paymentLabels[value] || value;
const typeLabel = (value: string) => value === "entrada" ? "Entrada" : "Saída";

export function buildFinancialReportCSV(data: FinancialReportCsvData) {
  const rows: unknown[][] = [
    ["tatuei.com — Relatório Financeiro"],
    ["Período", data.period],
    [],
    ["Resumo financeiro"],
    ["Métrica", "Valor (R$)"],
    ["Receita total", amountInReais(data.summary.totalRevenue)],
    ["Despesas totais", amountInReais(data.summary.totalExpenses)],
    ["Saldo", amountInReais(data.summary.balance)],
    ["Total de transações", data.summary.transactionCount],
    [],
    ["Receita por categoria"],
    ["Categoria", "Total (R$)", "Quantidade"],
    ...data.categoryBreakdown.map((item) => [item.category, amountInReais(item.total), item.count]),
    [],
    ["Receita por método de pagamento"],
    ["Método", "Total (R$)", "Quantidade"],
    ...data.paymentMethodBreakdown.map((item) => [paymentLabel(item.paymentMethod), amountInReais(item.total), item.count]),
    [],
    ["Transações detalhadas"],
    ["Data", "Tipo", "Categoria", "Método", "Valor (R$)", "Descrição"],
    ...data.transactions.map((transaction) => [
      formatDate(transaction.date),
      typeLabel(transaction.type),
      transaction.category,
      paymentLabel(transaction.paymentMethod),
      amountInReais(transaction.amount),
      transaction.description || "",
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(";")).join("\r\n")}`;
}

export function exportFinancialReportToCSV(data: FinancialReportCsvData) {
  const blob = new Blob([buildFinancialReportCSV(data)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-financeiro-${data.period.toLowerCase().replace(/\s+/g, "-")}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
