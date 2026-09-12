export const INBOX_MODULE_LABELS = {
  intelligent_inbox: "Central Inteligente",
  inbox_conversations: "Central: conversas",
  inbox_summaries: "Central: resumos",
  inbox_priorities: "Central: prioridades",
  inbox_opportunities: "Central: oportunidades",
  inbox_settings: "Central: integração",
  inbox_suggestions: "Central: respostas sugeridas",
} as const;
export const INBOX_MODULES = [
  "intelligent_inbox",
  "inbox_conversations",
  "inbox_summaries",
  "inbox_priorities",
  "inbox_opportunities",
  "inbox_settings",
  "inbox_suggestions",
] as const;
export type InboxModule = (typeof INBOX_MODULES)[number];
export const INBOX_CLASSIFICATIONS = [
  "needs_reply",
  "quote_request",
  "waiting_information",
  "reschedule",
  "cancellation",
  "reference_received",
  "high_purchase_intent",
  "complaint",
  "resolved",
  "follow_up",
  "new_customer",
  "returning_customer",
  "other",
] as const;
export const INBOX_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const INBOX_INTENTS = [
  "LOW_INTENT",
  "MEDIUM_INTENT",
  "HIGH_INTENT",
  "READY_TO_CLOSE",
  "UNKNOWN",
] as const;
export const INBOX_MESSAGE_TYPES = [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "location",
  "quick_reply",
  "button",
  "flow_event",
  "external_media",
] as const;
export const INBOX_ACTORS = [
  "customer",
  "attendant",
  "automation",
  "ai",
] as const;
export const INBOX_EVENTS = [
  "integration_connected",
  "integration_disconnected",
  "message_received",
  "conversation_created",
  "summary_generated",
  "analysis_generated",
  "sync_started",
  "sync_completed",
  "sync_failed",
  "ai_request_failed",
  "webhook_failed",
] as const;
export const INBOX_METRICS = [
  ["moved", "Atendimentos com movimentação"],
  ["needsReply", "Aguardando resposta"],
  ["quotes", "Novos orçamentos"],
  ["reschedules", "Reagendamentos"],
  ["cancellations", "Cancelamentos"],
  ["waitingInformation", "Clientes aguardando informação"],
  ["references", "Referências recebidas"],
  ["opportunities", "Possíveis fechamentos"],
  ["complaints", "Reclamações"],
  ["highPriority", "Prioridade alta"],
  ["resolved", "Resolvidos"],
] as const;
export type InboxMetric = (typeof INBOX_METRICS)[number][0];
export const emptyInboxMetrics = () =>
  Object.fromEntries(INBOX_METRICS.map(([key]) => [key, 0])) as Record<
    InboxMetric,
    number
  >;
