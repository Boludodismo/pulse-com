import { ENV } from "../_core/env";
import { emptyInboxMetrics } from "../../shared/intelligentInbox";
/** Explicitly fail closed even if the env flag is accidentally set in this scaffold release. */
export function inboxStatus() {
  return {
    requestedEnabled: ENV.intelligentInboxEnabled,
    operational: false as const,
    status: "not_configured" as const,
    phase: "scaffold" as const,
    botConversaConnected: false,
    aiConnected: false,
    webhookActive: false,
    syncActive: false,
    summaryJobActive: false,
  };
}
export function emptyInboxDashboard() {
  return {
    status: inboxStatus(),
    metrics: emptyInboxMetrics(),
    period: null,
    lastProcessedAt: null,
  };
}
export function disabledInboxOperation() {
  return {
    accepted: false as const,
    reason: "not_configured" as const,
    message:
      "Integração não configurada. Recurso preparado para ativação futura.",
  };
}
