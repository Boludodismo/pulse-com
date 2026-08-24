/**
 * googleSheetsSync.ts
 *
 * Módulo de sincronização assíncrona (fire-and-forget) entre o POD CRM
 * e uma planilha Google Sheets via Google Apps Script Web App.
 *
 * Estratégia: usa GET com o payload serializado como parâmetro ?dados=
 * para contornar a restrição do Google Apps Script que bloqueia POST
 * de servidores externos (Cloud Run / Autoscale).
 *
 * Variáveis de ambiente necessárias:
 *   GOOGLE_SHEETS_WEBHOOK_URL  — URL /exec do Google Apps Script
 *   GOOGLE_SHEETS_SYNC_SECRET  — secret compartilhado com o script
 */

export interface SyncResult {
  ok: boolean;
  error?: string;
}

function isConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.GOOGLE_SHEETS_SYNC_SECRET);
}

/**
 * Dispara a sincronização de forma assíncrona (fire-and-forget).
 * Usa GET com o payload serializado como parâmetro ?dados= para contornar
 * a restrição do Google Apps Script que bloqueia POST de servidores externos.
 */
function fireAndForget(payload: Record<string, unknown>, label: string): void {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL ?? "";
  const syncSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET ?? "";

  if (!isConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[Google Sheets Sync] Integração não configurada — pulando sync de ${label}`);
    }
    return;
  }

  // O Google Apps Script bloqueia POST de IPs de servidor externo.
  // A solução é enviar via GET com o JSON codificado no parâmetro ?dados=
  const body = JSON.stringify({ ...payload, secret: syncSecret });
  const url = `${webhookUrl}?dados=${encodeURIComponent(body)}`;

  fetch(url, { method: "GET" })
    .then((res) => res.json())
    .then((data) => console.log(`[Google Sheets Sync] ${label} sincronizado:`, data))
    .catch((err) => console.error(`[Google Sheets Sync] Erro ao sincronizar ${label}:`, err));
}

/**
 * Versão assíncrona que aguarda o resultado e retorna {ok, error}.
 * Use esta versão quando precisar exibir feedback visual ao usuário.
 */
async function fireAndAwait(
  payload: Record<string, unknown>,
  label: string
): Promise<SyncResult> {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL ?? "";
  const syncSecret = process.env.GOOGLE_SHEETS_SYNC_SECRET ?? "";

  if (!isConfigured()) {
    return { ok: false, error: "Integração com Google Sheets não configurada" };
  }

  try {
    const body = JSON.stringify({ ...payload, secret: syncSecret });
    const url = `${webhookUrl}?dados=${encodeURIComponent(body)}`;
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(15_000) });
    const data = await res.json() as { sucesso?: boolean; erro?: string };
    if (data?.sucesso === true) {
      return { ok: true };
    }
    return { ok: false, error: data?.erro ?? "Resposta inesperada do Google Sheets" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google Sheets Sync] Erro ao sincronizar ${label}:`, message);
    return { ok: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────────────────────────────────────

export interface ClienteSyncPayload {
  id: number;
  name: string;
  nickname?: string | null;
  phone?: string | null;
  ddi?: string | null;
  email?: string | null;
  instagram?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status?: string | null;
  acceptsWhatsapp?: boolean | null;
  acceptsPromotions?: boolean | null;
  notes?: string | null;
  createdAt?: Date | number | null;
}

export async function syncClientToSheetsAsync(client: ClienteSyncPayload): Promise<SyncResult> {
  const phone = String(client.phone ?? "").replace(/\D/g, "");
  const birthDate = client.birthDate ?? "";
  const [day, month] = birthDate.split("/");

  return fireAndAwait(
    {
      tipo: "cliente",
      cliente_id: String(client.id),
      nome_completo: client.name ?? "",
      nome_preferido: client.nickname ?? "",
      telefone_whatsapp: phone,
      ddi: client.ddi ?? "55",
      email: client.email ?? "",
      instagram: client.instagram ?? "",
      cpf_rg: client.cpf ?? "",
      data_nascimento: birthDate,
      dia_aniversario: day ?? "",
      mes_aniversario: month ?? "",
      endereco: client.address ?? "",
      numero: client.addressNumber ?? "",
      complemento: client.addressComplement ?? "",
      bairro: client.neighborhood ?? "",
      cidade: client.city ?? "",
      uf: client.state ?? "",
      pais: client.country ?? "Brasil",
      status_cliente: client.status ?? "ativo",
      aceita_whatsapp: client.acceptsWhatsapp ? "sim" : "nao",
      aceita_promocoes: client.acceptsPromotions ? "sim" : "nao",
      observacoes: client.notes ?? "",
    },
    `cliente #${client.id}`
  );
}

export function syncClientToSheets(client: ClienteSyncPayload): void {
  const phone = String(client.phone ?? "").replace(/\D/g, "");
  const birthDate = client.birthDate ?? "";
  const [day, month] = birthDate.split("/");

  fireAndForget(
    {
      tipo: "cliente",
      cliente_id: String(client.id),
      nome_completo: client.name ?? "",
      nome_preferido: client.nickname ?? "",
      telefone_whatsapp: phone,
      ddi: client.ddi ?? "55",
      email: client.email ?? "",
      instagram: client.instagram ?? "",
      cpf_rg: client.cpf ?? "",
      data_nascimento: birthDate,
      dia_aniversario: day ?? "",
      mes_aniversario: month ?? "",
      endereco: client.address ?? "",
      numero: client.addressNumber ?? "",
      complemento: client.addressComplement ?? "",
      bairro: client.neighborhood ?? "",
      cidade: client.city ?? "",
      uf: client.state ?? "",
      pais: client.country ?? "Brasil",
      status_cliente: client.status ?? "ativo",
      aceita_whatsapp: client.acceptsWhatsapp ? "sim" : "nao",
      aceita_promocoes: client.acceptsPromotions ? "sim" : "nao",
      observacoes: client.notes ?? "",
    },
    `cliente #${client.id}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENDAMENTOS
// ─────────────────────────────────────────────────────────────────────────────

export interface AgendamentoSyncPayload {
  id: number;
  clientId?: number | null;
  clientName?: string | null;
  clientPhone?: string | null;
  artistName?: string | null;
  startTime?: Date | number | null;
  service?: string | null;
  bodyLocation?: string | null;
  status?: string | null;
  depositPaid?: boolean | null;
  depositAmount?: number | null;
  totalPrice?: number | null;
  depositPaymentMethod?: string | null;
  notes?: string | null;
}

export async function syncAppointmentToSheetsAsync(appt: AgendamentoSyncPayload): Promise<SyncResult> {
  const startDate = appt.startTime ? new Date(appt.startTime) : null;
  const dataAgendamento = startDate ? startDate.toLocaleDateString("pt-BR") : "";
  const horaAgendamento = startDate
    ? startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";
  const dataHoraIso = startDate ? startDate.toISOString() : "";

  return fireAndAwait(
    {
      tipo: "agendamento",
      agendamento_id: String(appt.id),
      cliente_id: appt.clientId ? String(appt.clientId) : "",
      nome_cliente: appt.clientName ?? "",
      telefone_whatsapp: String(appt.clientPhone ?? "").replace(/\D/g, ""),
      profissional: appt.artistName ?? "",
      data_agendamento: dataAgendamento,
      hora_agendamento: horaAgendamento,
      data_hora_iso: dataHoraIso,
      servico: appt.service ?? "",
      local_corpo: appt.bodyLocation ?? "",
      status_agendamento: appt.status ?? "agendado",
      sinal_pago: appt.depositPaid ? "sim" : "nao",
      valor_sinal: String(appt.depositAmount ?? 0),
      valor_total: String(appt.totalPrice ?? 0),
      forma_pagamento_sinal: appt.depositPaymentMethod ?? "",
      observacoes: appt.notes ?? "",
    },
    `agendamento #${appt.id}`
  );
}

export function syncAppointmentToSheets(appt: AgendamentoSyncPayload): void {
  const startDate = appt.startTime ? new Date(appt.startTime) : null;
  const dataAgendamento = startDate
    ? startDate.toLocaleDateString("pt-BR")
    : "";
  const horaAgendamento = startDate
    ? startDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";
  const dataHoraIso = startDate ? startDate.toISOString() : "";

  fireAndForget(
    {
      tipo: "agendamento",
      agendamento_id: String(appt.id),
      cliente_id: appt.clientId ? String(appt.clientId) : "",
      nome_cliente: appt.clientName ?? "",
      telefone_whatsapp: String(appt.clientPhone ?? "").replace(/\D/g, ""),
      profissional: appt.artistName ?? "",
      data_agendamento: dataAgendamento,
      hora_agendamento: horaAgendamento,
      data_hora_iso: dataHoraIso,
      servico: appt.service ?? "",
      local_corpo: appt.bodyLocation ?? "",
      status_agendamento: appt.status ?? "agendado",
      sinal_pago: appt.depositPaid ? "sim" : "nao",
      valor_sinal: String(appt.depositAmount ?? 0),
      valor_total: String(appt.totalPrice ?? 0),
      forma_pagamento_sinal: appt.depositPaymentMethod ?? "",
      observacoes: appt.notes ?? "",
    },
    `agendamento #${appt.id}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANAMNESE (ficha criada pelo profissional)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnamnesisSyncPayload {
  id: number;
  clientId?: number | null;
  appointmentId?: number | null;
  clientName?: string | null;
  artistName?: string | null;
  tattooValue?: number | null;
  tattooDescription?: string | null;
  bodyLocation?: string | null;
  authorizationSigned?: boolean | null;
  riskLevel?: string | null;
  hasImportantNote?: boolean | null;
  notesSummary?: string | null;
  createdAt?: Date | number | null;
}

export function syncAnamnesisToSheets(anam: AnamnesisSyncPayload): void {
  const createdAt = anam.createdAt ? new Date(anam.createdAt) : new Date();

  fireAndForget(
    {
      tipo: "anamnese",
      anamnese_id: String(anam.id),
      cliente_id: anam.clientId ? String(anam.clientId) : "",
      agendamento_id: anam.appointmentId ? String(anam.appointmentId) : "",
      nome_cliente: anam.clientName ?? "",
      profissional: anam.artistName ?? "",
      data_preenchimento: createdAt.toLocaleDateString("pt-BR"),
      valor_tatuagem: String(anam.tattooValue ?? 0),
      descricao_arte: anam.tattooDescription ?? "",
      local_corpo: anam.bodyLocation ?? "",
      autorizacao_procedimento: anam.authorizationSigned ? "sim" : "nao",
      risk_level: anam.riskLevel ?? "baixo",
      tem_observacao_importante: anam.hasImportantNote ? "sim" : "nao",
      observacoes_resumidas: anam.notesSummary ?? "",
      dados_sensiveis_exportados: "nao",
    },
    `anamnese #${anam.id}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBMISSÃO DE ANAMNESE (preenchida pelo cliente via link)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnamnesisSubmissionSyncPayload {
  id: number;
  clientId?: number | null;
  appointmentId?: number | null;
  clientName?: string | null;
  artistName?: string | null;
  tattooValue?: number | null;
  tattooDescription?: string | null;
  bodyLocation?: string | null;
  authorizationSigned?: boolean | null;
  riskLevel?: string | null;
  hasImportantNote?: boolean | null;
  notesSummary?: string | null;
  submittedAt?: Date | number | null;
}

export async function syncAnamnesisSubmissionToSheetsAsync(sub: AnamnesisSubmissionSyncPayload): Promise<SyncResult> {
  const submittedAt = sub.submittedAt ? new Date(sub.submittedAt) : new Date();

  return fireAndAwait(
    {
      tipo: "anamnese",
      anamnese_id: `SUB-${sub.id}`,
      cliente_id: sub.clientId ? String(sub.clientId) : "",
      agendamento_id: sub.appointmentId ? String(sub.appointmentId) : "",
      nome_cliente: sub.clientName ?? "",
      profissional: sub.artistName ?? "",
      data_preenchimento: submittedAt.toLocaleDateString("pt-BR"),
      valor_tatuagem: String(sub.tattooValue ?? 0),
      descricao_arte: sub.tattooDescription ?? "",
      local_corpo: sub.bodyLocation ?? "",
      autorizacao_procedimento: sub.authorizationSigned ? "sim" : "nao",
      risk_level: sub.riskLevel ?? "baixo",
      tem_observacao_importante: sub.hasImportantNote ? "sim" : "nao",
      observacoes_resumidas: sub.notesSummary ?? "",
      dados_sensiveis_exportados: "nao",
    },
    `submissão de anamnese #${sub.id}`
  );
}

export function syncAnamnesisSubmissionToSheets(sub: AnamnesisSubmissionSyncPayload): void {
  const submittedAt = sub.submittedAt ? new Date(sub.submittedAt) : new Date();

  fireAndForget(
    {
      tipo: "anamnese",
      anamnese_id: `SUB-${sub.id}`,
      cliente_id: sub.clientId ? String(sub.clientId) : "",
      agendamento_id: sub.appointmentId ? String(sub.appointmentId) : "",
      nome_cliente: sub.clientName ?? "",
      profissional: sub.artistName ?? "",
      data_preenchimento: submittedAt.toLocaleDateString("pt-BR"),
      valor_tatuagem: String(sub.tattooValue ?? 0),
      descricao_arte: sub.tattooDescription ?? "",
      local_corpo: sub.bodyLocation ?? "",
      autorizacao_procedimento: sub.authorizationSigned ? "sim" : "nao",
      risk_level: sub.riskLevel ?? "baixo",
      tem_observacao_importante: sub.hasImportantNote ? "sim" : "nao",
      observacoes_resumidas: sub.notesSummary ?? "",
      dados_sensiveis_exportados: "nao",
    },
    `submissão de anamnese #${sub.id}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTOQUE (materiais)
// ─────────────────────────────────────────────────────────────────────────────

export interface MaterialSyncPayload {
  id: number;
  category?: string | null;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  description?: string | null;
  currentStock?: number | null;
  unit?: string | null;
  minStock?: number | null;
  criticalStock?: number | null;
  preferredSupplier?: string | null;
  notes?: string | null;
}

function calcStockStatus(
  current: number,
  critical: number,
  min: number
): string {
  if (current <= critical) return "critico";
  if (current <= min) return "baixo";
  return "normal";
}

export async function syncMaterialToSheetsAsync(mat: MaterialSyncPayload): Promise<SyncResult> {
  const current = mat.currentStock ?? 0;
  const critical = mat.criticalStock ?? 0;
  const min = mat.minStock ?? 0;

  return fireAndAwait(
    {
      tipo: "estoque",
      item_id: String(mat.id),
      categoria: mat.category ?? "",
      marca: mat.brand ?? "",
      modelo: mat.model ?? "",
      cor: mat.color ?? "",
      descricao: mat.description ?? "",
      quantidade_atual: String(current),
      unidade: mat.unit ?? "un",
      quantidade_minima: String(min),
      quantidade_critica: String(critical),
      status_estoque: calcStockStatus(current, critical, min),
      fornecedor_preferencial: mat.preferredSupplier ?? "",
      observacoes: mat.notes ?? "",
    },
    `material #${mat.id}`
  );
}

export function syncMaterialToSheets(mat: MaterialSyncPayload): void {
  const current = mat.currentStock ?? 0;
  const critical = mat.criticalStock ?? 0;
  const min = mat.minStock ?? 0;

  fireAndForget(
    {
      tipo: "estoque",
      item_id: String(mat.id),
      categoria: mat.category ?? "",
      marca: mat.brand ?? "",
      modelo: mat.model ?? "",
      cor: mat.color ?? "",
      descricao: mat.description ?? "",
      quantidade_atual: String(current),
      unidade: mat.unit ?? "un",
      quantidade_minima: String(min),
      quantidade_critica: String(critical),
      status_estoque: calcStockStatus(current, critical, min),
      fornecedor_preferencial: mat.preferredSupplier ?? "",
      observacoes: mat.notes ?? "",
    },
    `material #${mat.id}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOVIMENTAÇÕES DE ESTOQUE
// ─────────────────────────────────────────────────────────────────────────────

export interface StockMovementSyncPayload {
  id: number;
  materialId?: number | null;
  appointmentId?: number | null;
  movementType?: string | null;
  quantity?: number | null;
  unit?: string | null;
  reason?: string | null;
  responsible?: string | null;
  createdAt?: Date | number | null;
}

export async function syncStockMovementToSheetsAsync(mov: StockMovementSyncPayload): Promise<SyncResult> {
  const createdAt = mov.createdAt ? new Date(mov.createdAt) : new Date();

  return fireAndAwait(
    {
      tipo: "movimentacao_estoque",
      movimento_id: String(mov.id),
      item_id: mov.materialId ? String(mov.materialId) : "",
      agendamento_id: mov.appointmentId ? String(mov.appointmentId) : "",
      tipo_movimento: mov.movementType ?? "ajuste",
      quantidade: String(mov.quantity ?? 0),
      unidade: mov.unit ?? "un",
      motivo: mov.reason ?? "",
      responsavel: mov.responsible ?? "",
      data_movimento: createdAt.toLocaleDateString("pt-BR"),
    },
    `movimentação #${mov.id}`
  );
}

export function syncStockMovementToSheets(mov: StockMovementSyncPayload): void {
  const createdAt = mov.createdAt ? new Date(mov.createdAt) : new Date();

  fireAndForget(
    {
      tipo: "movimentacao_estoque",
      movimento_id: String(mov.id),
      item_id: mov.materialId ? String(mov.materialId) : "",
      agendamento_id: mov.appointmentId ? String(mov.appointmentId) : "",
      tipo_movimento: mov.movementType ?? "ajuste",
      quantidade: String(mov.quantity ?? 0),
      unidade: mov.unit ?? "un",
      motivo: mov.reason ?? "",
      responsavel: mov.responsible ?? "",
      data_movimento: createdAt.toLocaleDateString("pt-BR"),
    },
    `movimentação #${mov.id}`
  );
}
