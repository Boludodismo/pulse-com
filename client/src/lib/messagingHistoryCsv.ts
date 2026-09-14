export type MessageHistoryCsvRow = {
  createdAt: string | Date;
  sentAt?: string | Date | null;
  integrationName: string;
  recipientName?: string | null;
  recipientPhoneMasked: string;
  message: string;
  deliveryStatus: string;
  attemptCount: number;
  maxAttempts: number;
  eventStatus?: string | null;
  error?: string | null;
};

const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const formatDateTime = (value: string | Date) => new Date(value).toLocaleString("pt-BR");

export function buildMessageHistoryCSV(rows: MessageHistoryCsvRow[]) {
  const header = ["Data", "Integração", "Destinatário", "Telefone", "Mensagem", "Status", "Tentativas", "Auditoria", "Erro"];
  const body = rows.map((row) => [
    formatDateTime(row.sentAt ?? row.createdAt),
    row.integrationName,
    row.recipientName ?? "",
    row.recipientPhoneMasked,
    row.message,
    row.deliveryStatus,
    `${row.attemptCount}/${row.maxAttempts || 5}`,
    row.eventStatus ?? "",
    row.error ?? "",
  ]);
  return `\uFEFF${[header, ...body].map((line) => line.map(cell).join(";")).join("\r\n")}`;
}

export function downloadMessageHistoryCSV(rows: MessageHistoryCsvRow[]) {
  const blob = new Blob([buildMessageHistoryCSV(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `historico-mensagens-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
