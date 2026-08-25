import { and, eq, inArray, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { Client, InsertClient } from "../drizzle/schema";
import {
  anamneseRequests,
  anamneseSubmissions,
  anamnesisRecords,
  anamnesisRiskHistory,
  appointments,
  clientNotes,
  clients,
  galleryImages,
  legacyImportRows,
  messageQueue,
  notificationLogs,
  postSaleFollowups,
  salesLeads,
  technicalProcedures,
  transactions,
  waitlistEntries,
} from "../drizzle/schema";
import { getDb } from "./db";

export type DuplicateGroup = {
  survivorId: number;
  duplicateIds: number[];
  clientIds: number[];
  name: string;
  reasons: string[];
  conflicts: string[];
};

const MERGE_FIELDS = [
  "artistId", "email", "phone", "birthDate", "instagram", "cep", "street",
  "number", "complement", "reference", "neighborhood", "city", "state",
  "country", "gender", "docType", "docNumber",
] as const satisfies readonly (keyof Client)[];

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizePersonName(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  if (!digits) return "";
  const withoutCountry = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return withoutCountry.length >= 8 ? withoutCountry : "";
}

export function normalizeEmail(value: unknown) {
  return text(value).toLowerCase();
}

export function normalizeDocument(value: unknown) {
  const normalized = text(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.length >= 7 ? normalized : "";
}

export function normalizeDate(value: unknown) {
  const raw = text(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

function matchingReasons(a: Client, b: Client) {
  if (a.studioId !== b.studioId) return [];
  const sameName = normalizePersonName(a.name) === normalizePersonName(b.name);
  if (!sameName || !normalizePersonName(a.name)) return [];

  const reasons: string[] = [];
  const documentA = normalizeDocument(a.docNumber);
  const documentB = normalizeDocument(b.docNumber);
  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  const birthA = normalizeDate(a.birthDate);
  const birthB = normalizeDate(b.birthDate);

  if (documentA && documentA === documentB) reasons.push("documento");
  if (emailA && emailA === emailB) reasons.push("e-mail");
  if (phoneA && phoneA === phoneB) reasons.push("telefone");
  if (birthA && birthA === birthB) reasons.push("data de nascimento");
  return reasons;
}

function completeness(client: Client) {
  return MERGE_FIELDS.reduce((score, field) => score + (text(client[field]) ? 1 : 0), 0);
}

function survivorScore(client: Client) {
  // Registros operacionais já utilizados sempre prevalecem sobre uma linha recém-importada.
  return (client.appointmentCount ?? 0) * 1_000_000
    + Math.min(client.totalSpent ?? 0, 999_999)
    + completeness(client) * 100
    - client.id / 1_000_000;
}

function valuesConflict(field: keyof Client, left: unknown, right: unknown) {
  if (!text(left) || !text(right)) return false;
  if (field === "email") return normalizeEmail(left) !== normalizeEmail(right);
  if (field === "phone") return normalizePhone(left) !== normalizePhone(right);
  if (field === "docNumber") return normalizeDocument(left) !== normalizeDocument(right);
  if (field === "birthDate") return normalizeDate(left) !== normalizeDate(right);
  return text(left).toLowerCase() !== text(right).toLowerCase();
}

export function findDuplicateGroups(records: Client[]): DuplicateGroup[] {
  const parent = records.map((_, index) => index);
  const reasonsByPair = new Map<string, string[]>();
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const unite = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const reasons = matchingReasons(records[i], records[j]);
      if (!reasons.length) continue;
      unite(i, j);
      reasonsByPair.set(`${i}:${j}`, reasons);
    }
  }

  const buckets = new Map<number, number[]>();
  records.forEach((_, index) => {
    const root = find(index);
    buckets.set(root, [...(buckets.get(root) ?? []), index]);
  });

  return Array.from(buckets.values()).filter((indexes: number[]) => indexes.length > 1).map((indexes: number[]) => {
    const members = indexes.map((index) => records[index]);
    const survivor = [...members].sort((a, b) => survivorScore(b) - survivorScore(a))[0];
    const reasons = new Set<string>();
    const conflicts = new Set<string>();

    for (let x = 0; x < indexes.length; x += 1) {
      for (let y = x + 1; y < indexes.length; y += 1) {
        for (const reason of reasonsByPair.get(`${Math.min(indexes[x], indexes[y])}:${Math.max(indexes[x], indexes[y])}`) ?? []) reasons.add(reason);
      }
    }
    for (const member of members) {
      if (member.id === survivor.id) continue;
      for (const field of MERGE_FIELDS) {
        if (valuesConflict(field, survivor[field], member[field])) conflicts.add(field);
      }
    }

    return {
      survivorId: survivor.id,
      duplicateIds: members.filter((member) => member.id !== survivor.id).map((member) => member.id),
      clientIds: members.map((member) => member.id),
      name: survivor.name,
      reasons: Array.from(reasons),
      conflicts: Array.from(conflicts),
    };
  });
}

function buildMergedClient(survivor: Client, duplicates: Client[]): Partial<InsertClient> {
  const merged: Record<string, unknown> = {};
  for (const field of MERGE_FIELDS) {
    const current = survivor[field];
    if (text(current)) continue;
    const candidate = duplicates.map((item) => item[field]).find((value) => text(value));
    if (candidate !== undefined) merged[field] = candidate;
  }
  return merged as Partial<InsertClient>;
}

const CLIENT_RELATIONS = [
  anamneseRequests,
  anamneseSubmissions,
  anamnesisRiskHistory,
  anamnesisRecords,
  appointments,
  clientNotes,
  galleryImages,
  notificationLogs,
  transactions,
  postSaleFollowups,
  legacyImportRows,
  salesLeads,
  waitlistEntries,
  technicalProcedures,
  messageQueue,
] as const;

export async function previewClientDeduplication(studioId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const records = await database.select().from(clients).where(eq(clients.studioId, studioId));
  const groups = findDuplicateGroups(records);
  return {
    groups,
    duplicateGroups: groups.length,
    duplicateClients: groups.reduce((sum, group) => sum + group.duplicateIds.length, 0),
  };
}

type Database = MySql2Database<Record<string, unknown>>;

export async function consolidateClientDuplicates(studioId?: number, databaseOverride?: Database) {
  const database = databaseOverride ?? await getDb();
  if (!database) throw new Error("Database not available");
  const records = studioId
    ? await database.select().from(clients).where(eq(clients.studioId, studioId))
    : await database.select().from(clients);
  const byId = new Map(records.map((record) => [record.id, record]));
  const groups = findDuplicateGroups(records);

  let mergedClients = 0;
  for (const group of groups) {
    const survivor = byId.get(group.survivorId);
    const duplicates = group.duplicateIds.map((id) => byId.get(id)).filter(Boolean) as Client[];
    if (!survivor || !duplicates.length) continue;

    await database.transaction(async (tx) => {
      for (const table of CLIENT_RELATIONS) {
        await tx.update(table).set({ clientId: survivor.id }).where(inArray(table.clientId, group.duplicateIds));
      }

      const mergedData = buildMergedClient(survivor, duplicates);
      const [appointmentTotals] = await tx.select({ count: sql<number>`count(*)` })
        .from(appointments).where(eq(appointments.clientId, survivor.id));
      const [financialTotals] = await tx.select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(and(eq(transactions.clientId, survivor.id), eq(transactions.type, "entrada")));
      const appointmentCount = Number(appointmentTotals?.count ?? 0);
      const totalSpent = Number(financialTotals?.total ?? 0);
      const loyaltyLevel = totalSpent >= 100000 || appointmentCount >= 5
        ? "Ouro" : totalSpent >= 50000 || appointmentCount >= 3 ? "Prata" : "Bronze";

      await tx.update(clients).set({
        ...mergedData,
        appointmentCount,
        totalSpent,
        loyaltyLevel,
      }).where(eq(clients.id, survivor.id));
      await tx.delete(clients).where(inArray(clients.id, group.duplicateIds));
    });
    mergedClients += group.duplicateIds.length;
  }

  return { duplicateGroups: groups.length, mergedClients, groups };
}
