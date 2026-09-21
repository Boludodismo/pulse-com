import { createHash } from "node:crypto";
import type {
  Connection,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";
import { TRPCError } from "@trpc/server";
import {
  mergeFields,
  duplicateReasons,
  type MergeField,
} from "../../shared/clientDuplicates";
import { normalizeBrazilianPhone } from "../messaging/phone";

type Row = Record<string, any>;
type Relation = {
  table: string;
  column: string;
  studio: string | null;
  engine: string;
  rows: Row[];
};
export type MergeInput = {
  targetId: number;
  sourceId: number;
  choices: Partial<Record<MergeField, number>>;
};
export const relationLabels: Record<string, string> = {
  anamnese_requests: "Solicitações de anamnese",
  anamnese_submissions: "Respostas de anamnese",
  anamnesisRecords: "Fichas de anamnese",
  appointments: "Agendamentos",
  clientNotes: "Anotações",
  galleryImages: "Fotos",
  notificationLogs: "Histórico de notificações",
  transactions: "Lançamentos financeiros",
  technical_procedures: "Sessões",
  procedure_inventory_consumptions: "Materiais, lotes e validades",
  procedure_color_samples: "Cores de referência",
  procedure_ink_recipes: "Receitas de cores",
  procedure_ink_recipe_results: "Resultados das misturas",
  procedure_visual_layers: "Camadas da referência",
  message_queue: "Histórico de mensagens",
  integration_contacts: "Consentimentos de WhatsApp",
  care_events: "Acompanhamentos",
  care_sessions: "Histórico de atendimentos",
  care_tags: "Etiquetas",
  inbox_conversations: "Conversas",
  quote_proposals: "Orçamentos",
  client_import_records: "Registros importados",
};
const retained = new Set(["crm_client_archive_20260908"]);
const q = (s: string) => "`" + s.replaceAll("`", "``") + "`";
export async function rows(
  c: Connection,
  sql: string,
  params: any[] = []
): Promise<Row[]> {
  return (await c.execute<RowDataPacket[]>(sql, params))[0];
}
function conflict(message: string): never {
  throw new TRPCError({ code: "CONFLICT", message });
}
export function assertMergeActor(role: string, studioId?: number | null) {
  if (!["admin", "superadmin"].includes(role) || !studioId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "A revisão de duplicados exige um administrador com empresa ativa.",
    });
}
export function mergeStudio(
  user: { role: string; studioId?: number | null },
  requested?: number
) {
  const studioId =
    user.role === "superadmin" ? (requested ?? user.studioId) : user.studioId;
  assertMergeActor(user.role, studioId);
  return studioId as number;
}
export function resolvedFields(clients: Row[], input: MergeInput) {
  const result: Row = {};
  for (const field of Object.keys(mergeFields) as MergeField[]) {
    const id = input.choices[field] ?? input.targetId;
    if (![input.targetId, input.sourceId].includes(id))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Escolha dados apenas dos dois cadastros revisados.",
      });
    const owner = clients.find(client => Number(client.id) === id)!;
    result[field] = owner[field];
    if (field === "docNumber") result.docType = owner.docType;
  }
  return result;
}
export function consentPlan(
  clients: Row[],
  contacts: Row[],
  targetId: number,
  phone?: string | null
) {
  let normalized = "";
  try {
    if (phone) normalized = normalizeBrazilianPhone(phone);
  } catch {}
  const target = contacts.find(c => Number(c.client_id) === targetId);
  const keep =
    !!normalized &&
    !!target &&
    clients.every(client =>
      contacts.some(
        c =>
          Number(c.client_id) === Number(client.id) &&
          Number(c.has_whatsapp_opt_in) === 1 &&
          !c.opted_out_at &&
          c.normalized_phone === normalized &&
          c.integration_id === target.integration_id
      )
    );
  return {
    keep,
    message: keep
      ? "A autorização do principal será mantida: os dois cadastros têm autorização ativa para o mesmo telefone e integração."
      : "O cadastro unificado ficará sem autorização de WhatsApp. Revise a autorização do cliente no botão Mensagens após a união. Os registros anteriores ficarão na auditoria.",
  };
}

export async function loadMerge(
  c: Connection,
  studioId: number,
  input: MergeInput
) {
  if (input.targetId === input.sourceId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione dois cadastros diferentes.",
    });
  const ids = [input.targetId, input.sourceId].sort((a, b) => a - b);
  const clients = await rows(
    c,
    "SELECT * FROM clients WHERE studioId=? AND id IN (?,?) ORDER BY id FOR UPDATE",
    [studioId, ...ids]
  );
  if (
    clients.length !== 2 ||
    clients.some(client => Number(client.isArchived) !== 0)
  )
    conflict(
      "Um cadastro foi arquivado, unificado ou não pertence a esta empresa. Atualize a lista."
    );
  const fields = resolvedFields(clients, input),
    blockers: string[] = [];
  const columns = await rows(
    c,
    `SELECT c.TABLE_NAME AS tableName,c.COLUMN_NAME AS columnName,t.ENGINE AS engine,
    (SELECT s.COLUMN_NAME FROM information_schema.COLUMNS s WHERE s.TABLE_SCHEMA=c.TABLE_SCHEMA AND s.TABLE_NAME=c.TABLE_NAME AND s.COLUMN_NAME IN ('studioId','studio_id') LIMIT 1) AS studioColumn
    FROM information_schema.COLUMNS c JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME
    WHERE c.TABLE_SCHEMA=DATABASE() AND (c.COLUMN_NAME IN ('clientId','client_id','customer_id') OR EXISTS
    (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE k WHERE k.TABLE_SCHEMA=c.TABLE_SCHEMA AND k.TABLE_NAME=c.TABLE_NAME AND k.COLUMN_NAME=c.COLUMN_NAME AND k.REFERENCED_TABLE_NAME='clients'))
    ORDER BY c.TABLE_NAME,c.COLUMN_NAME`
  );
  const relations: Relation[] = [];
  for (const col of columns) {
    if (retained.has(col.tableName)) continue;
    const data = await rows(
      c,
      `SELECT * FROM ${q(col.tableName)} WHERE ${q(col.columnName)} IN (?,?) ORDER BY ${q(col.columnName)} FOR UPDATE`,
      ids
    );
    data.sort((a, b) => Number(a.id) - Number(b.id));
    const rel = {
      table: col.tableName,
      column: col.columnName,
      studio: col.studioColumn,
      engine: col.engine,
      rows: data,
    };
    relations.push(rel);
    if (data.length && !relationLabels[rel.table])
      blockers.push(
        `Existe um vínculo que precisa de suporte antes da união: ${rel.table}.`
      );
    if (
      data.length &&
      (rel.engine !== "InnoDB" || data.some(r => r.id == null))
    )
      blockers.push(
        `O histórico ${rel.table} precisa ser preparado para uma união segura.`
      );
    if (rel.studio && data.some(r => Number(r[rel.studio!]) !== studioId))
      blockers.push(
        `Foi encontrado um vínculo de outra empresa em ${rel.table}. É necessário revisar antes de unir.`
      );
  }
  const lookup = (table: string) =>
    relations.find(r => r.table === table)?.rows || [];
  if (
    lookup("technical_procedures").some(r =>
      ["em_andamento", "pausado"].includes(r.status)
    )
  )
    blockers.push(
      "Finalize as sessões em andamento ou pausadas destes cadastros antes de unir."
    );
  const jobs = await rows(
    c,
    "SELECT * FROM integration_jobs WHERE studio_id=? AND status IN ('pending','processing','retry') ORDER BY id FOR UPDATE",
    [studioId]
  );
  const queueIds = new Set(lookup("message_queue").map(r => Number(r.id)));
  const linkedJobs = jobs.filter(job => {
    try {
      const p = JSON.parse(job.payload);
      return (
        ids.includes(Number(p.clientId)) ||
        queueIds.has(Number(p.messageQueueId))
      );
    } catch {
      return true;
    }
  });
  if (linkedJobs.length)
    blockers.push(
      "Há mensagens ou sincronizações em processamento ou na fila. Aguarde ou resolva esses envios na central de mensagens e atualize a prévia."
    );
  const consent = consentPlan(
    clients,
    lookup("integration_contacts"),
    input.targetId,
    fields.phone
  );
  const consentRecords = clients.map(client => {
    const contact = lookup("integration_contacts").find(
      r => Number(r.client_id) === Number(client.id)
    );
    return {
      clientId: Number(client.id),
      phone: contact?.normalized_phone || null,
      status: contact?.opted_out_at
        ? "Revogado"
        : Number(contact?.has_whatsapp_opt_in) === 1
          ? "Autorizado"
          : "Sem autorização",
      source: contact?.opt_in_source || null,
      date: contact?.opted_out_at || contact?.opt_in_at || null,
    };
  });
  const counters = {
    totalSpent: clients.reduce((sum, c) => sum + Number(c.totalSpent), 0),
    appointmentCount: clients.reduce(
      (sum, c) => sum + Number(c.appointmentCount),
      0
    ),
  };
  if (
    Object.values(counters).some(
      n => !Number.isSafeInteger(n) || n > 2147483647
    )
  )
    blockers.push(
      "Os totais excedem o limite do cadastro. Solicite a revisão antes da união."
    );
  const snapshot = {
    studioId,
    input,
    clients,
    fields,
    relations,
    linkedJobs,
    consent,
    counters,
  };
  const serialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(serialized) > 10000000)
    blockers.push(
      "Este histórico é grande demais para a revisão online. Solicite uma revisão assistida."
    );
  const hash = createHash("sha256").update(serialized).digest("hex");
  const counts = relations
    .filter(r => r.rows.length)
    .map(r => ({
      table: r.table,
      label: relationLabels[r.table] || r.table,
      principal: r.rows.filter(row => Number(row[r.column]) === input.targetId)
        .length,
      origem: r.rows.filter(row => Number(row[r.column]) === input.sourceId)
        .length,
    }));
  const pendingMessages = lookup("message_queue").filter(
    r => r.status === "pendente"
  ).length;
  const pendingCare = lookup("care_events").filter(
    r => r.status === "pending"
  ).length;
  return {
    snapshot,
    serialized,
    preview: {
      hash,
      clients,
      fields,
      counts,
      blockers,
      consent,
      consentRecords,
      counters,
      pendingMessages,
      pendingCare,
      ...duplicateReasons(clients[0] as any, clients[1] as any),
    },
  };
}

export async function confirmMerge(
  c: Connection,
  studioId: number,
  actorId: number,
  input: MergeInput,
  expectedHash: string
) {
  await c.beginTransaction();
  try {
    // The studio lock serializes double clicks and two managers merging overlapping pairs.
    await rows(c, "SELECT id FROM studios WHERE id=? FOR UPDATE", [studioId]);
    const previous = await rows(
      c,
      "SELECT id,result_json FROM client_merge_audits WHERE studio_id=? AND preview_hash=?",
      [studioId, expectedHash]
    );
    if (previous.length) {
      await c.commit();
      return {
        ...JSON.parse(previous[0].result_json),
        auditId: previous[0].id,
        repeated: true,
      };
    }
    const plan = await loadMerge(c, studioId, input);
    if (plan.preview.hash !== expectedHash)
      conflict(
        "Os dados mudaram desde a prévia. Revise novamente antes de confirmar."
      );
    if (plan.preview.blockers.length) conflict(plan.preview.blockers.join(" "));
    const { fields, counters, relations, consent } = plan.snapshot;
    const changes: Row[] = [];
    for (const rel of relations) {
      if (!rel.rows.length) continue;
      if (rel.table === "integration_contacts") {
        for (const row of rel.rows) {
          if (Number(row.client_id) === input.targetId && consent.keep)
            continue;
          await c.execute(
            "UPDATE integration_contacts SET has_whatsapp_opt_in=0,opted_out_at=COALESCE(opted_out_at,UTC_TIMESTAMP()) WHERE id=? AND studio_id=?",
            [row.id, studioId]
          );
        }
        continue; // Keep external subscriber identities on their original records; audit contains all evidence.
      }
      if (rel.table === "care_tags") {
        // INSERT/NOT EXISTS uses the database collation, including case/accent equivalence.
        await c.execute(
          `INSERT INTO care_tags(studio_id,client_id,label) SELECT ?,?,s.label FROM care_tags s
          WHERE s.studio_id=? AND s.client_id=? AND NOT EXISTS
          (SELECT 1 FROM care_tags t WHERE t.studio_id=? AND t.client_id=? AND t.label=s.label)`,
          [
            studioId,
            input.targetId,
            studioId,
            input.sourceId,
            studioId,
            input.targetId,
          ]
        );
        await c.execute(
          "DELETE FROM care_tags WHERE studio_id=? AND client_id=?",
          [studioId, input.sourceId]
        );
        continue;
      }
      if (rel.table === "message_queue")
        await c.execute(
          "UPDATE message_queue SET status='cancelada',errorMessage='União de cadastros: revisar antes de reagendar.' WHERE clientId IN (?,?) AND studio_id=? AND status='pendente'",
          [input.targetId, input.sourceId, studioId]
        );
      if (rel.table === "care_events")
        await c.execute(
          "UPDATE care_events SET status='cancelled' WHERE client_id IN (?,?) AND studio_id=? AND status='pending'",
          [input.targetId, input.sourceId, studioId]
        );
      const moved = rel.rows.filter(
        row => Number(row[rel.column]) === input.sourceId
      );
      if (!moved.length) continue;
      const preserveTimestamps = ["updatedAt", "updated_at"]
        .filter(key => Object.hasOwn(moved[0], key))
        .map(key => `,${q(key)}=${q(key)}`)
        .join("");
      const [result] = await c.execute<ResultSetHeader>(
        `UPDATE ${q(rel.table)} SET ${q(rel.column)}=?${preserveTimestamps} WHERE ${q(rel.column)}=?${rel.studio ? ` AND ${q(rel.studio)}=?` : ""}`,
        [input.targetId, input.sourceId, ...(rel.studio ? [studioId] : [])]
      );
      if (result.affectedRows !== moved.length)
        conflict(
          "O histórico mudou durante a união. Nenhuma alteração foi aplicada."
        );
      changes.push({ table: rel.table, ids: moved.map(r => r.id) });
    }
    const loyaltyLevel =
      counters.totalSpent >= 100000 || counters.appointmentCount >= 5
        ? "Ouro"
        : counters.totalSpent >= 50000 || counters.appointmentCount >= 3
          ? "Prata"
          : "Bronze";
    const after = { ...fields, ...counters, loyaltyLevel };
    await c.execute(
      `UPDATE clients SET ${Object.keys(after)
        .map(k => `${q(k)}=?`)
        .join(",")} WHERE id=? AND studioId=?`,
      [...Object.values(after), input.targetId, studioId]
    );
    await c.execute(
      "UPDATE clients SET isArchived=1,totalSpent=0,appointmentCount=0 WHERE id=? AND studioId=?",
      [input.sourceId, studioId]
    );
    const result = {
      targetId: input.targetId,
      sourceId: input.sourceId,
      after,
      changes,
      consent,
      counts: plan.preview.counts,
      pendingMessages: plan.preview.pendingMessages,
      pendingCare: plan.preview.pendingCare,
    };
    const [audit] = await c.execute<ResultSetHeader>(
      "INSERT INTO client_merge_audits(studio_id,actor_id,target_id,source_id,preview_hash,before_json,result_json) VALUES(?,?,?,?,?,?,?)",
      [
        studioId,
        actorId,
        input.targetId,
        input.sourceId,
        expectedHash,
        plan.serialized,
        JSON.stringify(result),
      ]
    );
    await c.commit();
    return { ...result, auditId: audit.insertId, repeated: false };
  } catch (error) {
    await c.rollback();
    throw error;
  }
}
