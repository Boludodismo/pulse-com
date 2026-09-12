import { TRPCError } from "@trpc/server";
import { clientPatchFromAnamnese } from "../shared/clientPersonal";
import { parseAnamneseExpiry } from "./anamneseTime";
import { anamneseExpiryForDatabase } from "./anamneseTime";
import { appointmentInstant, appointmentsOverlap } from "../shared/appointmentTime";
import { eq, desc, and, gte, lte, or, like, sql, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  clients, 
  appointments, 
  anamnesisRecords, 
  transactions, 
  clientNotes, 
  galleryImages,
  notificationLogs,
  studioSettings,
  artists,
  auditLogs,
  reportTemplates,
  calendars,
  anamneseRequests,
  anamneseSubmissions,
  studios,
  InsertClient,
  InsertAppointment,
  InsertAnamnesisRecord,
  InsertTransaction,
  InsertClientNote,
  InsertGalleryImage,
  InsertNotificationLog,
  InsertStudioSettings,
  InsertArtist,
  InsertAuditLog,
  InsertCalendar,
  InsertAnamneseRequest,
  InsertAnamneseSubmission,
  suppliers,
  materials,
  stockMovements,
  purchaseOrders,
  purchaseOrderItems,
  InsertSupplier,
  InsertMaterial,
  InsertStockMovement,
  InsertPurchaseOrder,
  InsertPurchaseOrderItem,
  appointmentReminders,
  InsertAppointmentReminder,
  AppointmentReminder,
  collaboratorRates,
  studioInvitations,
  userModulePermissions,
  integrationSchedules,
} from "../drizzle/schema";
import { ENV } from './_core/env';

// ============ DATE HELPERS ============
/** Converte Date | string | null para string ISO (YYYY-MM-DD HH:MM:SS) compatível com MySQL mode:'string' */
export function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (typeof d === 'string') return d;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Retorna a data local (sem conversão UTC) no formato MySQL DATETIME.
 * Usa o horário local do servidor para evitar deslocamento de fuso.
 */
export function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Formata Date | string | null para exibição no frontend */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR');
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function getIntegrationScheduleByTaskUid(taskUid: string) {
  const database = await getDb();
  if (!database) return null;
  return (await database.select().from(integrationSchedules)
    .where(eq(integrationSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0] ?? null;
}

export async function recordIntegrationScheduleRun(id: number, result: { error?: string | null }) {
  const database = await getDb();
  if (!database) return;
  await database.update(integrationSchedules).set({
    lastRunAt: toDateStr(new Date()),
    lastError: result.error ?? null,
    updatedAt: toDateStr(new Date()),
  }).where(eq(integrationSchedules.id, id));
}

// ============ USER HELPERS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = toDateStr(new Date(user.lastSignedIn));
      updateSet.lastSignedIn = toDateStr(new Date(user.lastSignedIn));
    }
    if (user.role !== undefined) {
      values.role = user.role;
      // Only update role in the DB if explicitly provided — never downgrade via upsert
      updateSet.role = user.role;
    }
    // Never set role in updateSet if not explicitly provided — preserves existing role (e.g. superadmin)

    if (!values.lastSignedIn) {
      values.lastSignedIn = toDateStr(new Date());
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = toDateStr(new Date());
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listAllUsers(studioId?: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list users: database not available");
    return [];
  }

  const result = await db.select().from(users).where(studioId ? eq(users.studioId, studioId) : undefined).orderBy(desc(users.createdAt));
  return result;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: { openId: string; name?: string; email?: string; role?: "superadmin" | "admin" | "collaborator"; studioId?: number | null; artistId?: number | null; passwordHash?: string }) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create user: database not available");
    return undefined;
  }

  const result = await db.insert(users).values({
    openId: data.openId,
    name: data.name ?? null,
    email: data.email ?? null,
    role: data.role ?? "collaborator",
    studioId: data.studioId ?? null,
    artistId: data.artistId ?? null,
    isActive: 1,
    passwordHash: data.passwordHash ?? null,
  });

  return result;
}

export async function updateUser(id: number, data: { name?: string; email?: string; role?: "superadmin" | "admin" | "collaborator"; studioId?: number | null; artistId?: number | null; isActive?: number; passwordHash?: string; lastSignedIn?: string }) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return undefined;
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.studioId !== undefined) updateData.studioId = data.studioId;
  if (data.artistId !== undefined) updateData.artistId = data.artistId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.lastSignedIn !== undefined) updateData.lastSignedIn = toDateStr(new Date(data.lastSignedIn));
  const result = await db.update(users).set(updateData).where(eq(users.id, id));;
  return result;
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete user: database not available");
    return undefined;
  }

  const result = await db.delete(users).where(eq(users.id, id));
  return result;
}

// ============ CLIENT HELPERS ============

export async function listClients(studioId?: number | null, artistId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(clients.isArchived, 0)];
  if (studioId !== null && studioId !== undefined) {
    conditions.push(eq(clients.studioId, studioId));
  }
  
  // Se artistId for fornecido (colaborador), filtra apenas seus clientes
  // Se for null (admin ou superadmin), retorna todos do estúdio
  if (artistId !== null && artistId !== undefined) {
    conditions.push(eq(clients.artistId, artistId));
  }
  
  const result = conditions.length > 0
    ? await db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.createdAt))
    : await db.select().from(clients).orderBy(desc(clients.createdAt));
  return result;
}

export async function searchClients(term: string, startDate?: Date, endDate?: Date, studioId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const searchTerm = `%${term}%`;
  
  const conditions = [
    eq(clients.isArchived, 0),
    or(
      like(clients.name, searchTerm),
      like(clients.email, searchTerm),
      like(clients.phone, searchTerm),
      sql`EXISTS (SELECT 1 FROM care_tags t WHERE t.client_id = ${clients.id} AND t.studio_id = ${clients.studioId} AND t.label LIKE ${searchTerm})`
    )
  ];
  if (studioId !== null && studioId !== undefined) {
    conditions.push(eq(clients.studioId, studioId));
  }
  
  // Adicionar filtro de período se fornecido
  if (startDate) {
    conditions.push(gte(clients.createdAt, toDateStr(startDate)));
  }
  if (endDate) {
    conditions.push(lte(clients.createdAt, toDateStr(endDate)));
  }
  
  const result = await db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(desc(clients.createdAt))
    .limit(10);
  
  return result;
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(clients).values(data);
  const insertId = Number(result[0].insertId);
  
  // Retorna o cliente criado
  const client = await getClientById(insertId);
  if (!client) throw new Error("Failed to retrieve created client");
  
  return client;
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(clients).set(data).where(eq(clients.id, id));
  return { success: true };
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(clients).where(eq(clients.id, id));
  return { success: true };
}

export async function updateClientLoyaltyLevel(id: number) {
  const db = await getDb();
  if (!db) return;
  
  const client = await getClientById(id);
  if (!client) return;
  
  let newLevel: "Bronze" | "Prata" | "Ouro" = "Bronze";
  
  if (client.totalSpent >= 100000 || client.appointmentCount >= 5) {
    newLevel = "Ouro";
  } else if (client.totalSpent >= 50000 || client.appointmentCount >= 3) {
    newLevel = "Prata";
  }
  
  if (newLevel !== client.loyaltyLevel) {
    await db.update(clients).set({ loyaltyLevel: newLevel }).where(eq(clients.id, id));
  }
}

// ============ APPOINTMENT HELPERS ============

export async function listAppointments(studioId?: number | null, artistId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  // Retorna agendamentos com clientName via join
  const baseQuery = db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      calendarId: appointments.calendarId,
      date: appointments.date,
      duration: appointments.duration,
      service: appointments.service,
      artist: appointments.artist,
      artistId: appointments.artistId,
      includeArtistCard: appointments.includeArtistCard,
      status: appointments.status,
      confirmationStatus: appointments.confirmationStatus,
      notes: appointments.notes,
      referenceImageUrl: appointments.referenceImageUrl,
      referenceImageKey: appointments.referenceImageKey,
      depositPaid: appointments.depositPaid,
      depositAmount: appointments.depositAmount,
      totalAmount: appointments.totalAmount,
      signalStatus: appointments.signalStatus,
      paymentStatus: appointments.paymentStatus,
      paymentMethod: appointments.paymentMethod,
      procedureType: appointments.procedureType,
      procedureTypeOther: appointments.procedureTypeOther,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      studioId: appointments.studioId,
      clientName: clients.name,
    })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id));

  if (studioId != null && artistId != null) {
    return await baseQuery
      .where(and(eq(appointments.studioId, studioId), eq(appointments.artistId, artistId)))
      .orderBy(desc(appointments.date));
  }
  if (studioId != null) {
    return await baseQuery
      .where(eq(appointments.studioId, studioId))
      .orderBy(desc(appointments.date));
  }
  return await baseQuery.orderBy(desc(appointments.date));
}

export async function getAppointmentsByClientId(clientId: number, studioId?: number | null, artistId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  const query = db
    .select()
    .from(appointments)
    .where(
      studioId != null && artistId != null
        ? and(eq(appointments.clientId, clientId), eq(appointments.studioId, studioId), eq(appointments.artistId, artistId))
        : studioId != null
          ? and(eq(appointments.clientId, clientId), eq(appointments.studioId, studioId))
          : eq(appointments.clientId, clientId),
    );

  return await query.orderBy(desc(appointments.date));
}

export async function getAppointmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  
  return result[0];
}

export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(appointments).values(data);
  const insertId = Number(result[0].insertId);
  
  // Incrementar appointmentCount do cliente
  await db
    .update(clients)
    .set({ appointmentCount: sql`${clients.appointmentCount} + 1` })
    .where(eq(clients.id, data.clientId));
  
  // Atualizar nível de fidelidade
  await updateClientLoyaltyLevel(data.clientId);
  
  // Retornar o agendamento criado
  const appointment = await db.select().from(appointments).where(eq(appointments.id, insertId)).limit(1);
  return appointment[0];
}

export async function updateAppointment(id: number, data: Partial<InsertAppointment>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(appointments).set(data).where(eq(appointments.id, id));
  return { success: true };
}

export async function deleteAppointment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(appointments).where(eq(appointments.id, id));
  return { success: true };
}

export async function checkAppointmentConflicts(
  artist: string,
  date: Date | string,
  duration: number,
  excludeId?: number,
  studioId?: number
) {
  const db = await getDb();
  if (!db) return { hasConflict: false, conflicts: [] };
  if (!studioId) throw new Error("Estúdio obrigatório para verificar disponibilidade.");
  const startTime = appointmentInstant(date);
  if (!Number.isFinite(startTime.getTime())) throw new Error("Data inválida.");
  const endTime = new Date(startTime.getTime() + duration * 60000);
  let query = db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientName: clients.name,
      date: appointments.date,
      duration: appointments.duration,
      service: appointments.service,
      artist: appointments.artist,
      status: appointments.status,
    })
    .from(appointments)
    .leftJoin(clients, and(eq(clients.id, appointments.clientId), eq(clients.studioId, appointments.studioId)))
    .where(
      and(
        eq(appointments.artist, artist),
        eq(appointments.studioId, studioId),
        lte(appointments.date, toDateStr(endTime)),
        sql`DATE_ADD(${appointments.date}, INTERVAL ${appointments.duration} MINUTE) > ${toDateStr(startTime)}`,
        ne(appointments.status, "cancelado") // Ignorar agendamentos cancelados
      )
    );
  const existingAppointments = await query;
  // Filtrar conflitos
  const conflicts = existingAppointments.filter(apt => {
    // Excluir o próprio agendamento ao editar
    if (excludeId && apt.id === excludeId) return false;
    return appointmentsOverlap(date, duration, apt.date, apt.duration);
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map(c => ({
      id: c.id,
      clientId: c.clientId,
      clientName: c.clientName,
      date: c.date,
      duration: c.duration,
      service: c.service,
      status: c.status,
    })),
  };
}

// ============ ANAMNESIS HELPERS ============

export async function getAllAnamnesis() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(anamnesisRecords)
    .orderBy(desc(anamnesisRecords.createdAt));
  
  return result;
}

/** Fontes de anamnese visíveis no tenant para a tela consolidada de riscos. */
export async function getRiskAlertSources(studioId: number, artistId: number | null) {
  const database = await getDb();
  if (!database) return { submissions: [], legacy: [] };

  const visibility = artistId == null
    ? eq(clients.studioId, studioId)
    : and(eq(clients.studioId, studioId), or(eq(clients.artistId, artistId), eq(appointments.artistId, artistId)));

  const submissions = await database.select({
    id: anamneseSubmissions.id,
    clientId: anamneseSubmissions.clientId,
    clientName: clients.name,
    appointmentId: anamneseSubmissions.appointmentId,
    payloadJson: anamneseSubmissions.payloadJson,
    createdAt: anamneseSubmissions.createdAt,
  }).from(anamneseSubmissions)
    .innerJoin(clients, eq(clients.id, anamneseSubmissions.clientId))
    .leftJoin(appointments, eq(appointments.id, anamneseSubmissions.appointmentId))
    .where(visibility)
    .orderBy(desc(anamneseSubmissions.createdAt));

  const legacy = await database.select({
    id: anamnesisRecords.id,
    clientId: anamnesisRecords.clientId,
    clientName: clients.name,
    appointmentId: anamnesisRecords.appointmentId,
    riskLevel: anamnesisRecords.riskLevel,
    riskFactors: anamnesisRecords.riskFactors,
    createdAt: anamnesisRecords.createdAt,
  }).from(anamnesisRecords)
    .innerJoin(clients, eq(clients.id, anamnesisRecords.clientId))
    .leftJoin(appointments, eq(appointments.id, anamnesisRecords.appointmentId))
    .where(visibility)
    .orderBy(desc(anamnesisRecords.createdAt));

  return { submissions, legacy };
}

export async function getAnamnesisByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(anamnesisRecords)
    .where(eq(anamnesisRecords.clientId, clientId))
    .orderBy(desc(anamnesisRecords.id));
  
  return result;
}

export async function getAnamnesisById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(anamnesisRecords)
    .where(eq(anamnesisRecords.id, id))
    .limit(1);
  
  return result[0] || null;
}

export async function createAnamnesis(data: InsertAnamnesisRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(anamnesisRecords).values(data);
  const insertId = Number(result[0].insertId);
  
  // Retornar o registro criado
  const anamnesis = await db.select().from(anamnesisRecords).where(eq(anamnesisRecords.id, insertId)).limit(1);
  return anamnesis[0];
}

// ============ TRANSACTION HELPERS ============

export async function listTransactions(studioId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  // Bug 8: filtrar por studioId quando fornecido
  if (studioId != null) {
    const result = await db.select().from(transactions)
      .where(eq(transactions.studioId, studioId))
      .orderBy(desc(transactions.date));
    return result;
  }
  const result = await db.select().from(transactions).orderBy(desc(transactions.date));
  return result;
}

export async function getTransactionsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.clientId, clientId))
    .orderBy(desc(transactions.date));
  
  return result;
}

export async function getTransactionsByDateRange(startDate: string, endDate: string, studioId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const startStr = startDate;
  const endStr = endDate;
  
  const result = await db
    .select()
    .from(transactions)
    .where(and(
      gte(transactions.date, startStr),
      lte(transactions.date, endStr),
      ...(studioId ? [eq(transactions.studioId, studioId)] : []),
    ))
    .orderBy(desc(transactions.date));
  
  return result;
}

export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transactions).values(data);
  const insertId = Number(result[0].insertId);
  
  // Se for entrada e tiver clientId, atualizar totalSpent
  if (data.type === "entrada" && data.clientId) {
    await db
      .update(clients)
      .set({ totalSpent: sql`${clients.totalSpent} + ${data.amount}` })
      .where(eq(clients.id, data.clientId));
    
    // Atualizar nível de fidelidade
    await updateClientLoyaltyLevel(data.clientId);
  }
  
  // Retornar a transação criada
  const transaction = await db.select().from(transactions).where(eq(transactions.id, insertId)).limit(1);
  return transaction[0];
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  
  return result[0];
}

export async function updateTransaction(id: number, data: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transactions).set(data).where(eq(transactions.id, id));
  return { success: true };
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(transactions).where(eq(transactions.id, id));
  return true;
}

// ============ CLIENT NOTES HELPERS ============

export async function getNotesByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(clientNotes)
    .where(eq(clientNotes.clientId, clientId))
    .orderBy(desc(clientNotes.createdAt));
  
  return result;
}

export async function createNote(data: InsertClientNote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(clientNotes).values(data);
  const insertId = Number(result[0].insertId);
  
  // Retornar a nota criada
  const note = await db.select().from(clientNotes).where(eq(clientNotes.id, insertId)).limit(1);
  return note[0];
}

export async function deleteNote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(clientNotes).where(eq(clientNotes.id, id));
  return { success: true };
}

// ============ GALLERY HELPERS ============

export async function getGalleryByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(galleryImages)
    .where(eq(galleryImages.clientId, clientId))
    .orderBy(desc(galleryImages.createdAt));
  
  return result;
}

export async function createGalleryImage(data: InsertGalleryImage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(galleryImages).values(data);
  const insertId = Number(result[0].insertId);
  
  // Retornar o registro criado
  const image = await db.select().from(galleryImages).where(eq(galleryImages.id, insertId)).limit(1);
  return image[0];
}

export async function deleteGalleryImage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(galleryImages).where(eq(galleryImages.id, id));
  return { success: true };
}

// ============ DASHBOARD HELPERS ============

function requireDashboardStudio(studioId: number) {
  if (!Number.isSafeInteger(studioId) || studioId <= 0) throw new TRPCError({code:'FORBIDDEN',message:'Selecione um estúdio para consultar o dashboard.'});
}

export async function getTopClients(limit: number, studioId: number) {
  requireDashboardStudio(studioId);
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(clients)
    .where(and(eq(clients.isArchived, 0), eq(clients.studioId, studioId)))
    .orderBy(desc(clients.totalSpent))
    .limit(limit);
  
  return result;
}

export async function getUpcomingBirthdays(daysAhead: number, studioId: number | null) {
  // null is reserved for the background birthday scheduler across studios.
  if (studioId !== null) requireDashboardStudio(studioId);
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);
  
  // Buscar todos os clientes com birthDate
  const allClients = await db
    .select()
    .from(clients)
    .where(and(eq(clients.isArchived, 0), sql`${clients.birthDate} IS NOT NULL`, studioId === null ? undefined : eq(clients.studioId, studioId)));
  
  // Filtrar clientes com aniversário nos próximos N dias
  const upcomingBirthdays = allClients.filter(client => {
    if (!client.birthDate) return false;
    
    const birthDate = new Date(client.birthDate);
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    
    // Se o aniversário já passou este ano, considerar o próximo ano
    if (thisYearBirthday < today) {
      thisYearBirthday.setFullYear(today.getFullYear() + 1);
    }
    
    return thisYearBirthday >= today && thisYearBirthday <= futureDate;
  });
  
  // Ordenar por data de aniversário
  upcomingBirthdays.sort((a, b) => {
    const aDate = new Date(a.birthDate!);
    const bDate = new Date(b.birthDate!);
    const aThisYear = new Date(today.getFullYear(), aDate.getMonth(), aDate.getDate());
    const bThisYear = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate());
    
    if (aThisYear < today) aThisYear.setFullYear(today.getFullYear() + 1);
    if (bThisYear < today) bThisYear.setFullYear(today.getFullYear() + 1);
    
    return aThisYear.getTime() - bThisYear.getTime();
  });
  
  return upcomingBirthdays;
}

export async function getDashboardMetrics(studioId: number) {
  requireDashboardStudio(studioId);
  const db = await getDb();
  if (!db) return {
    totalClients: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    upcomingBirthdaysCount: 0
  };
  
  // Total de clientes
  const clientsCount = await db.select({ count: sql<number>`count(*)` }).from(clients).where(and(eq(clients.isArchived, 0),eq(clients.studioId,studioId)));
  const totalClients = clientsCount[0]?.count || 0;
  
  // Total de agendamentos
  const appointmentsCount = await db.select({ count: sql<number>`count(*)` }).from(appointments).where(eq(appointments.studioId,studioId));
  const totalAppointments = appointmentsCount[0]?.count || 0;
  
  // Receita total (soma de todas as transações tipo "entrada")
  const revenueSum = await db
    .select({ sum: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.type, "entrada"),eq(transactions.studioId,studioId)));
  const totalRevenue = revenueSum[0]?.sum || 0;
  
  // Aniversariantes nos próximos 30 dias
  const birthdays = await getUpcomingBirthdays(30, studioId);
  const upcomingBirthdaysCount = birthdays.length;
  
  return {
    totalClients,
    totalAppointments,
    totalRevenue,
    upcomingBirthdaysCount
  };
}


// ============ REPORTS HELPERS ============

export async function getMonthlyRevenue(startDate: string, endDate: string, studioId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const startStr = startDate;
  const endStr = endDate;
  
  const result = await db
    .select({
      month: sql<string>`DATE_FORMAT(${transactions.date}, '%Y-%m')`,
      revenue: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'entrada' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expenses: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'saida' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, startStr),
        lte(transactions.date, endStr),
        ...(studioId ? [eq(transactions.studioId, studioId)] : []),
      )
    )
    .groupBy(sql`DATE_FORMAT(${transactions.date}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${transactions.date}, '%Y-%m')`);
  
  return result.map(r => ({
    month: r.month,
    revenue: Number(r.revenue),
    expenses: Number(r.expenses),
    profit: Number(r.revenue) - Number(r.expenses),
  }));
}

export async function getCategoryBreakdown(startDate: string, endDate: string, studioId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const startStr = startDate;
  const endStr = endDate;
  
  const result = await db
    .select({
      category: transactions.category,
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, "entrada"),
        gte(transactions.date, startStr),
        lte(transactions.date, endStr),
        ...(studioId ? [eq(transactions.studioId, studioId)] : []),
      )
    )
    .groupBy(transactions.category)
    .orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`));
  
  return result.map(r => ({
    category: r.category,
    total: Number(r.total),
    count: Number(r.count),
  }));
}

export async function getPaymentMethodBreakdown(startDate: string, endDate: string, studioId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      paymentMethod: transactions.paymentMethod,
      total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, "entrada"),
        gte(transactions.date, toDateStr(startDate)),
        lte(transactions.date, toDateStr(endDate)),
        ...(studioId ? [eq(transactions.studioId, studioId)] : []),
      )
    )
    .groupBy(transactions.paymentMethod)
    .orderBy(desc(sql`COALESCE(SUM(${transactions.amount}), 0)`));
  
  return result.map(r => ({
    paymentMethod: r.paymentMethod,
    total: Number(r.total),
    count: Number(r.count),
  }));
}

export async function getFinancialSummary(startDate: string, endDate: string, studioId?: number | null) {
  const db = await getDb();
  if (!db) return {
    totalRevenue: 0,
    totalExpenses: 0,
    balance: 0,
    transactionCount: 0,
  };
  
  const result = await db
    .select({
      revenue: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'entrada' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expenses: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'saida' THEN ${transactions.amount} ELSE 0 END), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, toDateStr(startDate)),
        lte(transactions.date, toDateStr(endDate)),
        ...(studioId ? [eq(transactions.studioId, studioId)] : []),
      )
    );
  
  const data = result[0];
  const totalRevenue = Number(data?.revenue || 0);
  const totalExpenses = Number(data?.expenses || 0);
  
  return {
    totalRevenue,
    totalExpenses,
    balance: totalRevenue - totalExpenses,
    transactionCount: Number(data?.count || 0),
  };
}

// ============ SEARCH FUNCTIONS ============
export async function searchAppointments(term: string, startDate?: Date, endDate?: Date, studioId?: number, artistId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  const searchTerm = `%${term}%`;
  
  const conditions = [
    or(
      like(appointments.service, searchTerm),
      like(appointments.artist, searchTerm),
      like(clients.name, searchTerm)
    )
  ];
  
  if (!studioId) return [];
  conditions.push(eq(appointments.studioId, studioId));
  if (artistId != null) conditions.push(eq(appointments.artistId, artistId));
  // Adicionar filtro de período se fornecido
  if (startDate) {
    conditions.push(gte(appointments.date, toDateStr(startDate)));
  }
  if (endDate) {
    conditions.push(lte(appointments.date, toDateStr(endDate)));
  }
  
  const result = await db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientName: clients.name,
      date: appointments.date,
      duration: appointments.duration,
      service: appointments.service,
      artist: appointments.artist,
      status: appointments.status,
    })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(appointments.date))
    .limit(10);

  return result;
}

export async function searchTransactions(term: string, startDate?: Date, endDate?: Date, studioId?: number, artistId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  const searchTerm = `%${term}%`;
  
  const conditions = [
    or(
      like(transactions.category, searchTerm),
      like(transactions.description, searchTerm),
      like(clients.name, searchTerm)
    )
  ];
  
  if (!studioId) return [];
  conditions.push(eq(transactions.studioId, studioId));
  if (artistId != null) conditions.push(sql`EXISTS (SELECT 1 FROM appointments a WHERE a.id = ${transactions.appointmentId} AND a.studioId = ${studioId} AND a.artistId = ${artistId})`);
  // Adicionar filtro de período se fornecido
  if (startDate) {
    conditions.push(gte(transactions.date, toDateStr(startDate)));
  }
  if (endDate) {
    conditions.push(lte(transactions.date, toDateStr(endDate)));
  }
  
  const result = await db
    .select({
      id: transactions.id,
      clientId: transactions.clientId,
      clientName: clients.name,
      type: transactions.type,
      category: transactions.category,
      description: transactions.description,
      amount: transactions.amount,
      paymentMethod: transactions.paymentMethod,
      date: transactions.date,
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date))
    .limit(10);

  return result;
}


// ============ NOTIFICATIONS FUNCTIONS ============
/**
 * Retorna agendamentos do DIA SEGUINTE (apenas), usando horário local do servidor.
 * Filtra apenas status 'agendado' ou 'confirmado' e exclui agendamentos
 * que já receberam lembrete com sucesso (via notificationLogs).
 */
export async function getUpcomingAppointments(studioId?: number | null, artistId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  // ── Calcular início e fim do DIA SEGUINTE em horário local ──────────────
  const now = new Date();

  // Início do dia seguinte: 00:00:00
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0
  );
  // Fim do dia seguinte: 23:59:59
  const tomorrowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    23, 59, 59
  );

  // ── Buscar IDs de agendamentos que já receberam lembrete com sucesso ─────
  const alreadySentRows = await db
    .select({ appointmentId: notificationLogs.appointmentId })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.type, "appointment_reminder"),
        eq(notificationLogs.status, "sent")
      )
    );
  const alreadySentIds = new Set(
    alreadySentRows
      .map((r) => r.appointmentId)
      .filter((id): id is number => id !== null)
  );

  const baseCondition = and(
    gte(appointments.date, toLocalDateStr(tomorrowStart)),
    lte(appointments.date, toLocalDateStr(tomorrowEnd)),
    or(
      eq(appointments.status, "agendado"),
      eq(appointments.status, "confirmado")
    )
  );
  const scopedCondition = studioId != null && artistId != null
    ? and(baseCondition, eq(appointments.studioId, studioId), eq(appointments.artistId, artistId))
    : studioId != null
      ? and(baseCondition, eq(appointments.studioId, studioId))
      : baseCondition;

  // ── Buscar agendamentos do dia seguinte ───────────────────────────────────
  const result = await db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
      date: appointments.date,
      duration: appointments.duration,
      service: appointments.service,
      artist: appointments.artist,
      artistId: appointments.artistId,
      studioId: appointments.studioId,
      status: appointments.status,
    })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(scopedCondition)
    .orderBy(appointments.date);

  // Filtrar os que já foram notificados com sucesso
  return result.filter((apt) => !alreadySentIds.has(apt.id));
}

export async function sendAppointmentReminders() {
  const db = await getDb();
  if (!db) return { success: false, sent: 0, failed: 0 };

  const upcomingAppointments = await getUpcomingAppointments();

  // Nenhum agendamento amanhã — nada a fazer
  if (upcomingAppointments.length === 0) {
    return { success: true, sent: 0, failed: 0, total: 0 };
  }

  // ── Montar UMA notificação consolidada com todos os agendamentos do dia seguinte ──
  const { notifyOwner } = await import("./_core/notification");

  // Data do dia seguinte formatada (usa o primeiro agendamento como referência)
  const firstDate = new Date(upcomingAppointments[0].date);
  const tomorrowFormatted = firstDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const title = `📅 ${upcomingAppointments.length} agendamento(s) amanhã — ${tomorrowFormatted}`;

  // Linha por agendamento: horário | cliente | serviço | artista
  const lines = upcomingAppointments.map((apt) => {
    const time = new Date(apt.date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `• ${time} — ${apt.clientName ?? "Cliente"} | ${apt.service} | ${apt.artist}`;
  });

  const message = `Resumo dos agendamentos de amanhã:\n\n${lines.join("\n")}`;

  let sent = 0;
  let failed = 0;

  try {
    const success = await notifyOwner({ title, content: message });
    const status = success ? "sent" : "failed";

    // Registrar um log por agendamento incluído no resumo
    for (const appointment of upcomingAppointments) {
      await db.insert(notificationLogs).values({
        type: "appointment_reminder",
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        title,
        message,
        status,
      });
    }

    if (success) {
      sent = upcomingAppointments.length;
    } else {
      failed = upcomingAppointments.length;
    }
  } catch (error) {
    console.error("[Scheduler] Erro ao enviar resumo de lembretes:", error);
    failed = upcomingAppointments.length;

    // Registrar falha para cada agendamento
    for (const appointment of upcomingAppointments) {
      try {
        await db.insert(notificationLogs).values({
          type: "appointment_reminder",
          appointmentId: appointment.id,
          clientId: appointment.clientId,
          title: "Erro ao enviar resumo de lembretes",
          message: `Erro: ${error}`,
          status: "failed",
        });
      } catch (_) { /* ignora erros de log */ }
    }
  }

  return { success: true, sent, failed, total: upcomingAppointments.length };
}

export async function getNotificationLogs(limit: number, studioId: number) {
  requireDashboardStudio(studioId);
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: notificationLogs.id,
      type: notificationLogs.type,
      appointmentId: notificationLogs.appointmentId,
      clientId: notificationLogs.clientId,
      clientName: clients.name,
      title: notificationLogs.title,
      message: notificationLogs.message,
      status: notificationLogs.status,
      sentAt: notificationLogs.sentAt,
    })
    .from(notificationLogs)
    .leftJoin(clients, eq(notificationLogs.clientId, clients.id))
    .leftJoin(appointments, eq(notificationLogs.appointmentId, appointments.id))
    .where(and(
      or(eq(clients.studioId,studioId),eq(appointments.studioId,studioId)),
      or(sql`${notificationLogs.clientId} IS NULL`,eq(clients.studioId,studioId)),
      or(sql`${notificationLogs.appointmentId} IS NULL`,eq(appointments.studioId,studioId)),
    ))
    .orderBy(desc(notificationLogs.sentAt))
    .limit(limit);

  return result;
}


/**
 * Busca agendamentos que devem receber lembrete WhatsApp automático.
 * Considera: daysBefore (quantos dias antes), tipo de lembrete (primeiro ou reenvio).
 * Filtra agendamentos que já receberam esse tipo de lembrete com sucesso.
 */
type WhatsAppLogType = "whatsapp_primary" | "whatsapp_resend";

export async function getAppointmentsForWhatsAppReminder(daysBefore: number, logType: WhatsAppLogType) {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  // Calcular o dia alvo (hoje + daysBefore)
  const targetStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysBefore, 0, 0, 0);
  const targetEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysBefore, 23, 59, 59);

  // IDs que já receberam esse tipo de lembrete com sucesso
  const alreadySentRows = await db
    .select({ appointmentId: notificationLogs.appointmentId })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.type, logType),
        eq(notificationLogs.status, "sent")
      )
    );
  const alreadySentIds = new Set(
    alreadySentRows.map((r) => r.appointmentId).filter((id): id is number => id !== null)
  );

  const result = await db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      date: appointments.date,
      service: appointments.service,
      artist: appointments.artist,
      status: appointments.status,
    })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(
      and(
        gte(appointments.date, toLocalDateStr(targetStart)),
        lte(appointments.date, toLocalDateStr(targetEnd)),
        or(
          eq(appointments.status, "agendado"),
          eq(appointments.status, "confirmado")
        )
      )
    )
    .orderBy(appointments.date);

  return result.filter((apt) => !alreadySentIds.has(apt.id));
}

/**
 * Registra um log de lembrete WhatsApp no notificationLogs.
 */
export async function logWhatsAppReminder({
  appointmentId,
  clientId,
  logType,
  message,
  status,
}: {
  appointmentId: number;
  clientId: number;
  logType: WhatsAppLogType;
  message: string;
  status: "sent" | "failed";
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notificationLogs).values({
    type: logType,
    appointmentId,
    clientId,
    title: `WhatsApp automático — ${logType}`,
    message,
    status,
  });
}

// ============ STUDIO SETTINGS FUNCTIONS ============
export async function getStudioSettings(studioId?: number | null) {
  const database = await getDb();
  if (!database) return null;
  // Legacy scheduled tasks may only use settings when exactly one studio exists.
  if (!studioId) {
    const tenants = await database.select({ id: studios.id }).from(studios).limit(2);
    if (tenants.length !== 1) return null;
    studioId = tenants[0].id;
  }
  const rows = await database.select().from(studioSettings).where(eq(studioSettings.studioId, studioId)).limit(1);
  return rows[0] ?? null;
}

export async function updateStudioSettings(settings: Partial<InsertStudioSettings>, studioId: number) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível");
  const { id: _id, studioId: _studioId, ...values } = settings;
  await database.transaction(async tx => {
    const owner = await tx.select({ id: studios.id }).from(studios).where(eq(studios.id, studioId)).for("update");
    if (!owner.length) throw new Error("Estúdio não encontrado");
    const existing = await tx.select({ id: studioSettings.id }).from(studioSettings).where(eq(studioSettings.studioId, studioId)).limit(1);
    if (existing.length) await tx.update(studioSettings).set(values).where(eq(studioSettings.studioId, studioId));
    else await tx.insert(studioSettings).values({ ...values, studioId });
    const identity = {
      name: values.studioName || undefined, phone: values.phone, email: values.email,
      address: values.address, city: values.city, state: values.state, zipCode: values.zipCode,
    };
    if (Object.values(identity).some(v => v !== undefined)) await tx.update(studios).set(identity).where(eq(studios.id, studioId));
  });
  return getStudioSettings(studioId);
}

// ============ ARTISTS FUNCTIONS ============
export async function listArtists(studioId?: number | null, artistId?: number | null) {
  const db = await getDb();
  if (!db) return [];

  if (studioId != null && artistId != null) {
    return await db.select().from(artists)
      .where(and(eq(artists.studioId, studioId), eq(artists.id, artistId)))
      .orderBy(artists.name);
  }
  if (studioId != null) {
    return await db.select().from(artists)
      .where(eq(artists.studioId, studioId))
      .orderBy(artists.name);
  }
  return await db.select().from(artists).orderBy(artists.name);
}

export async function getArtistById(id: number, studioId?: number | null) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(artists)
    .where(studioId != null ? and(eq(artists.id, id), eq(artists.studioId, studioId)) : eq(artists.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createArtist(artist: InsertArtist) {
  const db = await getDb();
  if (!db) {
    console.error('[createArtist] Database not available');
    throw new Error('Database not available');
  }

  try {
    const now = toDateStr(new Date());
    const [inserted] = await db.insert(artists).values({ ...artist, createdAt: now, updatedAt: now });
    console.log('[createArtist] Artist created with ID:', inserted.insertId);
    return await getArtistById(inserted.insertId);
  } catch (error) {
    console.error('[createArtist] Error creating artist:', error);
    throw error;
  }
}

export async function updateArtist(id: number, artist: Partial<InsertArtist>) {
  const db = await getDb();
  if (!db) return null;

  await db.update(artists)
    .set({ ...artist, updatedAt: toDateStr(new Date()) })
    .where(eq(artists.id, id));
  
  return await getArtistById(id);
}

export async function deleteArtist(id: number) {
  const db = await getDb();
  if (!db) return false;

  await db.delete(artists).where(eq(artists.id, id));
  return true;
}


// ============ AUDIT LOG FUNCTIONS ============
export async function createAuditLog(data: {
  userId: number;
  userName: string;
  action: "create" | "update" | "delete" | "activate" | "deactivate";
  entity: "user" | "client" | "appointment" | "transaction" | "artist" | "settings";
  entityId?: number;
  entityName?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create audit log: database not available");
    return undefined;
  }

  const result = await db.insert(auditLogs).values({
    userId: data.userId,
    userName: data.userName,
    action: data.action,
    entity: data.entity,
    entityId: data.entityId ?? null,
    entityName: data.entityName ?? null,
    details: data.details ? JSON.stringify(data.details) : null,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  });

  return result;
}

export async function listAuditLogs(filters?: {
  action?: string;
  entity?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list audit logs: database not available");
    return [];
  }

  let query = db.select().from(auditLogs);

  const conditions = [];

  if (filters?.action && filters.action !== "all") {
    conditions.push(eq(auditLogs.action, filters.action as any));
  }

  if (filters?.entity && filters.entity !== "all") {
    conditions.push(eq(auditLogs.entity, filters.entity as any));
  }

  if (filters?.startDate) {
    // Converter Date para string no formato YYYY-MM-DD HH:mm:ss
    const year = filters.startDate.getFullYear();
    const month = String(filters.startDate.getMonth() + 1).padStart(2, '0');
    const day = String(filters.startDate.getDate()).padStart(2, '0');
    const hours = String(filters.startDate.getHours()).padStart(2, '0');
    const minutes = String(filters.startDate.getMinutes()).padStart(2, '0');
    const seconds = String(filters.startDate.getSeconds()).padStart(2, '0');
    const startStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    conditions.push(gte(auditLogs.createdAt, startStr));
  }

  if (filters?.endDate) {
    // Converter Date para string no formato YYYY-MM-DD HH:mm:ss
    const year = filters.endDate.getFullYear();
    const month = String(filters.endDate.getMonth() + 1).padStart(2, '0');
    const day = String(filters.endDate.getDate()).padStart(2, '0');
    const hours = String(filters.endDate.getHours()).padStart(2, '0');
    const minutes = String(filters.endDate.getMinutes()).padStart(2, '0');
    const seconds = String(filters.endDate.getSeconds()).padStart(2, '0');
    const endStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    conditions.push(lte(auditLogs.createdAt, endStr));
  }

  if (filters?.userId) {
    conditions.push(eq(auditLogs.userId, filters.userId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  query = query.orderBy(desc(auditLogs.createdAt)) as any;

  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }

  const result = await query;
  return result;
}

export async function searchAuditLogs(term: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search audit logs: database not available");
    return [];
  }

  const result = await db
    .select()
    .from(auditLogs)
    .where(
      or(
        like(auditLogs.userName, `%${term}%`),
        like(auditLogs.entityName, `%${term}%`),
        like(auditLogs.details, `%${term}%`)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return result;
}

// ============ AUDIT STATISTICS HELPERS ============

export async function getAuditStatistics(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return {
    totalActions: 0,
    actionsLast24h: 0,
    mostActiveUser: null,
    mostModifiedEntity: null,
  };

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Total de ações
  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(auditLogs)
    .where(
      startDate && endDate
         ? and(
            gte(auditLogs.createdAt, toDateStr(startDate)),
            lte(auditLogs.createdAt, toDateStr(endDate))
          )
        : undefined
    );
  const totalActions = Number(totalResult[0]?.count || 0);

  // Ações nas últimas 24h
  const last24hResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, toDateStr(yesterday)));

  const actionsLast24h = Number(last24hResult[0]?.count || 0);

  // Usuário mais ativo
  const mostActiveUserResult = await db
    .select({
      userName: auditLogs.userName,
      count: sql<number>`COUNT(*)`,
    })
    .from(auditLogs)
    .where(
      startDate && endDate
           ? and(
            gte(auditLogs.createdAt, toDateStr(startDate)),
            lte(auditLogs.createdAt, toDateStr(endDate))
          )
        : undefined
    )
    .groupBy(auditLogs.userName)
    .orderBy(desc(sql`COUNT(*)`));
  const mostActiveUserstActiveUser = mostActiveUserResult[0]
    ? { name: mostActiveUserResult[0].userName, count: Number(mostActiveUserResult[0].count) }
    : null;

  // Entidade mais modificada
  const mostModifiedEntityResult = await db
    .select({
      entity: auditLogs.entity,
      count: sql<number>`COUNT(*)`,
    })
    .from(auditLogs)
    .where(
      startDate && endDate
                ? and(
            gte(auditLogs.createdAt, toDateStr(startDate)),
            lte(auditLogs.createdAt, toDateStr(endDate))
          )
        : undefined
    )
    .groupBy(auditLogs.entity)
    .orderBy(desc(sql`COUNT(*)`));
   const mostActiveUser = mostActiveUserResult[0]
    ? { name: mostActiveUserResult[0].userName, count: Number(mostActiveUserResult[0].count) }
    : null;
  const mostModifiedEntity = mostModifiedEntityResult[0]
    ? { entity: mostModifiedEntityResult[0].entity, count: Number(mostModifiedEntityResult[0].count) }
    : null;
  return {
    totalActions,
    actionsLast24h,
    mostActiveUser,
    mostModifiedEntity,
  };
}

export async function getAuditActionsByDay(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      date: sql<string>`DATE(${auditLogs.createdAt})`.as('date'),
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.createdAt, toDateStr(startDate)),
        lte(auditLogs.createdAt, toDateStr(endDate))
      )
    )
    .groupBy(sql`date`)
    .orderBy(sql`date`);

  return result.map(r => ({
    date: r.date,
    count: Number(r.count),
  }));
}

export async function getAuditActionsByType(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      action: auditLogs.action,
      count: sql<number>`COUNT(*)`,
    })
    .from(auditLogs)
    .where(
      startDate && endDate
         ? and(
            gte(auditLogs.createdAt, toDateStr(startDate)),
            lte(auditLogs.createdAt, toDateStr(endDate))
          )
        : undefined
    )
    .groupBy(auditLogs.action)
    .orderBy(desc(sql`COUNT(*)`));
  return result.map(r => ({
    action: r.action,
    count: Number(r.count),
  }));
}

export async function getAuditActionsByEntity(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      entity: auditLogs.entity,
      count: sql<number>`COUNT(*)`,
    })
    .from(auditLogs)
    .where(
      startDate && endDate
        ? and(
            gte(auditLogs.createdAt, toDateStr(startDate)),
            lte(auditLogs.createdAt, toDateStr(endDate))
          )
        : undefined
    )
    .groupBy(auditLogs.entity)
    .orderBy(desc(sql`COUNT(*)`));
  return result.map(r => ({
    entity: r.entity,
    count: Number(r.count),
  }));
}

export async function getTopActiveUsers(limit: number = 5, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      userName: auditLogs.userName,
      count: sql<number>`COUNT(*)`,
    })
    .from(auditLogs)
    .where(
      startDate && endDate
               ? and(
            gte(auditLogs.createdAt, toDateStr(startDate)),
            lte(auditLogs.createdAt, toDateStr(endDate))
          )
        : undefined
    )
    .groupBy(auditLogs.userName)
    .orderBy(desc(sql`COUNT(*)`));
  return result.map(r => ({
    userName: r.userName,
    count: Number(r.count),
  }));
}

export async function getAuditHeatmap(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      hour: sql<number>`HOUR(${auditLogs.createdAt})`.as('hour'),
      dayOfWeek: sql<number>`DAYOFWEEK(${auditLogs.createdAt})`.as('dayOfWeek'),
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(auditLogs)
    .where(
      startDate && endDate
        ? and(
            gte(auditLogs.createdAt, toDateStr(startDate)),
            lte(auditLogs.createdAt, toDateStr(endDate))
          )
        : undefined
    )
    .groupBy(sql`hour`, sql`dayOfWeek`)
    .orderBy(sql`dayOfWeek`, sql`hour`);

  return result.map(r => ({
    hour: Number(r.hour),
    dayOfWeek: Number(r.dayOfWeek),
    count: Number(r.count),
  }));
}


// ============ REPORT TEMPLATES HELPERS ============

export async function createReportTemplate(data: {
  userId: number;
  name: string;
  description?: string;
  includeSections: string[];
  sectionOrder: string[];
  logsLimit: number;
  usersLimit: number;
  reportTitle?: string;
  reportSubtitle?: string;
  primaryColor?: string;
  logoUrl?: string;
  logoKey?: string;
  footerText?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [result] = await db.insert(reportTemplates).values({
    userId: data.userId,
    name: data.name,
    description: data.description,
    includeSections: JSON.stringify(data.includeSections),
    sectionOrder: JSON.stringify(data.sectionOrder),
    logsLimit: data.logsLimit,
    usersLimit: data.usersLimit,
    reportTitle: data.reportTitle,
    reportSubtitle: data.reportSubtitle,
    primaryColor: data.primaryColor || "#8b5cf6",
    logoUrl: data.logoUrl,
    logoKey: data.logoKey,
    footerText: data.footerText,
  });

  return Number(result.insertId);
}

export async function listReportTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const templates = await db
    .select()
    .from(reportTemplates)
    .where(eq(reportTemplates.userId, userId))
    .orderBy(desc(reportTemplates.createdAt));

  return templates.map(t => ({
    ...t,
    includeSections: JSON.parse(t.includeSections),
    sectionOrder: JSON.parse(t.sectionOrder),
  }));
}

export async function getReportTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;

  const template = await db
    .select()
    .from(reportTemplates)
    .where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId)))
    .limit(1);

  if (template.length === 0) return null;

  return {
    ...template[0],
    includeSections: JSON.parse(template[0].includeSections),
    sectionOrder: JSON.parse(template[0].sectionOrder),
  };
}

export async function updateReportTemplate(
  id: number,
  userId: number,
  data: {
    name?: string;
    description?: string;
    includeSections?: string[];
    sectionOrder?: string[];
    logsLimit?: number;
    usersLimit?: number;
    reportTitle?: string;
    reportSubtitle?: string;
    primaryColor?: string;
    logoUrl?: string;
    logoKey?: string;
    footerText?: string;
  }
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.includeSections !== undefined) updateData.includeSections = JSON.stringify(data.includeSections);
  if (data.sectionOrder !== undefined) updateData.sectionOrder = JSON.stringify(data.sectionOrder);
  if (data.logsLimit !== undefined) updateData.logsLimit = data.logsLimit;
  if (data.usersLimit !== undefined) updateData.usersLimit = data.usersLimit;
  if (data.reportTitle !== undefined) updateData.reportTitle = data.reportTitle;
  if (data.reportSubtitle !== undefined) updateData.reportSubtitle = data.reportSubtitle;
  if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
  if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
  if (data.logoKey !== undefined) updateData.logoKey = data.logoKey;
  if (data.footerText !== undefined) updateData.footerText = data.footerText;

  await db
    .update(reportTemplates)
    .set(updateData)
    .where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId)));

  return true;
}

export async function deleteReportTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .delete(reportTemplates)
    .where(and(eq(reportTemplates.id, id), eq(reportTemplates.userId, userId)));

  return true;
}


// ========================================
// Calendar helpers
// ========================================

export async function createCalendar(calendar: InsertCalendar) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const [result] = await db.insert(calendars).values(calendar);
  return result.insertId;
}

export async function listCalendars(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  return await db.select().from(calendars).where(eq(calendars.userId, userId)).orderBy(calendars.name);
}

export async function getCalendarById(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const results = await db.select().from(calendars).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return results[0];
}

export async function updateCalendar(id: number, userId: number, updateData: Partial<InsertCalendar>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.update(calendars).set(updateData).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return true;
}

export async function deleteCalendar(id: number, userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.delete(calendars).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return true;
}

export async function toggleCalendarVisibility(id: number, userId: number, isVisible: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.update(calendars).set({ isVisible }).where(
    and(eq(calendars.id, id), eq(calendars.userId, userId))
  );
  return true;
}

// ============ ANAMNESE HELPERS ============

export async function createAnamneseRequest(data: InsertAnamneseRequest) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.insert(anamneseRequests).values({
    ...data,
    expiresAt: anamneseExpiryForDatabase(data.expiresAt),
  });
  return result[0].insertId;
}

export async function getAnamneseRequestByToken(token: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.select().from(anamneseRequests).where(eq(anamneseRequests.token, token));
  return result[0] || null;
}

export async function markAnamneseRequestCompleted(requestId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  await db.update(anamneseRequests).set({ completedAt: toDateStr(new Date()) }).where(eq(anamneseRequests.id, requestId));
}

export async function createAnamneseSubmission(data: InsertAnamneseSubmission) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.insert(anamneseSubmissions).values(data);
  return result[0].insertId;
}

export async function getAnamneseSubmissionsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const result = await db.select().from(anamneseSubmissions)
    .where(eq(anamneseSubmissions.clientId, clientId))
    .orderBy(desc(anamneseSubmissions.createdAt));
  return result;
}

export async function getAnamneseRequestsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  // LEFT JOIN com anamneseSubmissions para incluir payloadJson quando preenchido
  const result = await db
    .select({
      id: anamneseRequests.id,
      clientId: anamneseRequests.clientId,
      appointmentId: anamneseRequests.appointmentId,
      token: anamneseRequests.token,
      sentVia: anamneseRequests.sentVia,
      sentTo: anamneseRequests.sentTo,
      expiresAt: anamneseRequests.expiresAt,
      completedAt: anamneseRequests.completedAt,
      createdAt: anamneseRequests.createdAt,
      payloadJson: anamneseSubmissions.payloadJson,
      submissionId: anamneseSubmissions.id,
    })
    .from(anamneseRequests)
    .leftJoin(anamneseSubmissions, eq(anamneseSubmissions.requestId, anamneseRequests.id))
    .where(eq(anamneseRequests.clientId, clientId))
    .orderBy(desc(anamneseRequests.createdAt));
  return result;
}

// ============ STUDIO HELPERS ============

export async function listStudios() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(studios).where(eq(studios.isActive, 1));
  return result;
}

export async function getStudioById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(studios).where(eq(studios.id, id));
  return result.length > 0 ? result[0] : undefined;
}

export async function getFirstStudio() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(studios).where(eq(studios.isActive, 1)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ ARTIST REVENUE HELPERS ============
export async function getArtistRevenue(
  startDate: string,
  endDate: string,
  groupBy: 'week' | 'month' | 'bimonth' | 'year' = 'month',
  studioId: number | null = null
) {
  const db = await getDb();
  if (!db) return [];

  // Determinar o formato de agrupamento
  let dateFormat: string;
  switch (groupBy) {
    case 'week':
      dateFormat = '%Y-%u'; // Ano-Semana
      break;
    case 'bimonth':
      // Bimestral: agrupar por bimestre (1-2, 3-4, 5-6, etc.)
      dateFormat = '%Y-%m';
      break;
    case 'year':
      dateFormat = '%Y';
      break;
    case 'month':
    default:
      dateFormat = '%Y-%m';
  }

  // Query principal: receita por artista por período
  // Estratégia 1: via JOIN com appointments (quando appointmentId está preenchido)
  // Estratégia 2: via extração do nome do artista da descrição da transação
  const result = await db.execute(sql`
    SELECT 
      artist_name,
      period,
      SUM(appointment_count) as appointment_count,
      SUM(completed_count) as completed_count,
      SUM(revenue) as revenue,
      CASE WHEN SUM(appointment_count) > 0 THEN SUM(revenue) / SUM(appointment_count) ELSE 0 END as avg_ticket
    FROM (
      -- Via appointments com transações vinculadas
      SELECT 
        a.artist as artist_name,
        DATE_FORMAT(a.date, ${dateFormat}) as period,
        COUNT(DISTINCT a.id) as appointment_count,
        SUM(CASE WHEN a.status = 'concluido' THEN 1 ELSE 0 END) as completed_count,
        COALESCE(SUM(t.amount), 0) / 100.0 as revenue
      FROM appointments a
      INNER JOIN transactions t ON t.appointmentId = a.id AND t.type = 'entrada'
      WHERE a.date >= ${startDate}
        AND a.date <= ${endDate}
        AND (${studioId != null ? sql`a.studioId = ${studioId}` : sql`1=1`})
        AND a.artist IS NOT NULL
        AND a.artist != ''
      GROUP BY a.artist, DATE_FORMAT(a.date, ${dateFormat})
      
      UNION ALL
      
      -- Via transações sem appointmentId (extraindo artista da descrição)
      SELECT 
        SUBSTRING_INDEX(t.description, ' com ', -1) as artist_name,
        DATE_FORMAT(t.date, ${dateFormat}) as period,
        COUNT(t.id) as appointment_count,
        0 as completed_count,
        SUM(t.amount) / 100.0 as revenue
      FROM transactions t
      WHERE t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND (${studioId != null ? sql`t.studioId = ${studioId}` : sql`1=1`})
        AND t.type = 'entrada'
        AND t.appointmentId IS NULL
        AND t.description LIKE '% com %'
      GROUP BY SUBSTRING_INDEX(t.description, ' com ', -1), DATE_FORMAT(t.date, ${dateFormat})
    ) combined
    GROUP BY artist_name, period
    ORDER BY period ASC, revenue DESC
  `);

  const rows = (result[0] as unknown) as Array<{
    artist_name: string;
    period: string;
    appointment_count: number;
    completed_count: number;
    revenue: number;
    avg_ticket: number;
  }>;

  // Para bimestral, reagrupar os meses em bimestres
  if (groupBy === 'bimonth') {
    const bimonthMap = new Map<string, Map<string, { revenue: number; appointments: number; completed: number; avgTicket: number }>>();
    
    for (const row of rows) {
      const [year, month] = row.period.split('-');
      const monthNum = parseInt(month);
      const bimonth = Math.ceil(monthNum / 2);
      const bimonthKey = `${year}-B${bimonth}`;
      
      if (!bimonthMap.has(row.artist_name)) {
        bimonthMap.set(row.artist_name, new Map());
      }
      const artistMap = bimonthMap.get(row.artist_name)!;
      
      if (!artistMap.has(bimonthKey)) {
        artistMap.set(bimonthKey, { revenue: 0, appointments: 0, completed: 0, avgTicket: 0 });
      }
      const entry = artistMap.get(bimonthKey)!;
      entry.revenue += Number(row.revenue);
      entry.appointments += Number(row.appointment_count);
      entry.completed += Number(row.completed_count);
    }

    // Recalcular avg_ticket por bimestre
    const bimonthRows: typeof rows = [];
    for (const [artist, periods] of Array.from(bimonthMap.entries())) {
      for (const [period, data] of Array.from(periods.entries())) {
        bimonthRows.push({
          artist_name: artist,
          period,
          appointment_count: data.appointments,
          completed_count: data.completed,
          revenue: data.revenue,
          avg_ticket: data.appointments > 0 ? data.revenue / data.appointments : 0,
        });
      }
    }
    bimonthRows.sort((a, b) => a.period.localeCompare(b.period) || b.revenue - a.revenue);
    return formatArtistRevenueResult(bimonthRows, groupBy);
  }

  return formatArtistRevenueResult(rows, groupBy);
}

function formatArtistRevenueResult(
  rows: Array<{ artist_name: string; period: string; appointment_count: number; completed_count: number; revenue: number; avg_ticket: number }>,
  groupBy: string
) {
  // Agrupar por artista para totais
  const artistTotals = new Map<string, { totalRevenue: number; totalAppointments: number; periods: typeof rows }>();
  
  for (const row of rows) {
    if (!artistTotals.has(row.artist_name)) {
      artistTotals.set(row.artist_name, { totalRevenue: 0, totalAppointments: 0, periods: [] });
    }
    const artist = artistTotals.get(row.artist_name)!;
    artist.totalRevenue += Number(row.revenue);
    artist.totalAppointments += Number(row.appointment_count);
    artist.periods.push(row);
  }

  // Calcular total geral para percentuais
  let grandTotal = 0;
  for (const entry of Array.from(artistTotals.entries())) {
    grandTotal += entry[1].totalRevenue;
  }

  // Formatar resultado final
  const artistsList = Array.from(artistTotals.entries())
    .map(([name, data]) => ({
      name,
      totalRevenue: Math.round(data.totalRevenue * 100) / 100,
      totalAppointments: data.totalAppointments,
      percentage: grandTotal > 0 ? Math.round((data.totalRevenue / grandTotal) * 10000) / 100 : 0,
      avgTicket: data.totalAppointments > 0
        ? Math.round((data.totalRevenue / data.totalAppointments) * 100) / 100
        : 0,
      periods: data.periods.map(p => ({
        period: p.period,
        revenue: Math.round(Number(p.revenue) * 100) / 100,
        appointments: Number(p.appointment_count),
        completed: Number(p.completed_count),
        avgTicket: Math.round(Number(p.avg_ticket) * 100) / 100,
      })),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Coletar todos os períodos únicos
  const allPeriods = Array.from(new Set(rows.map(r => r.period))).sort();

  return {
    artists: artistsList,
    periods: allPeriods,
    grandTotal: Math.round(grandTotal * 100) / 100,
    groupBy,
  };
}

function requireStockStudio(studioId: number): number {
  if (!Number.isSafeInteger(studioId) || studioId <= 0) throw new TRPCError({ code: "FORBIDDEN", message: "Estúdio obrigatório." });
  return studioId;
}

async function assertStockSupplier(id: number, studioId: number) {
  if (!(await getSupplierById(id, studioId))) throw new TRPCError({ code: "NOT_FOUND", message: "Fornecedor não encontrado neste estúdio." });
}

// ============ FORNECEDORES ============

export async function listSuppliers(studioId: number, activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(suppliers.studioId, requireStockStudio(studioId)), ...(activeOnly ? [eq(suppliers.isActive, 1)] : [])];
  return db.select().from(suppliers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(suppliers.name);
}

export async function getSupplierById(id: number, studioId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.studioId, requireStockStudio(studioId))));
  return rows[0];
}

export async function createSupplier(data: Omit<InsertSupplier, 'id' | 'createdAt' | 'updatedAt' | 'studioId'> & { studioId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(suppliers).values({ ...data, studioId: requireStockStudio(data.studioId), createdAt: now, updatedAt: now });
  return result[0].insertId;
}

export async function updateSupplier(id: number, data: Partial<Omit<InsertSupplier, 'id' | 'createdAt' | 'studioId'>>, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(suppliers).set({ ...data, studioId: requireStockStudio(studioId), updatedAt: Date.now() }).where(and(eq(suppliers.id, id), eq(suppliers.studioId, requireStockStudio(studioId))));
  if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado neste estúdio." });
}

export async function deleteSupplier(id: number, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(suppliers).set({ isActive: 0 }).where(and(eq(suppliers.id, id), eq(suppliers.studioId, requireStockStudio(studioId))));
  if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado neste estúdio." });
}

// ============ MATERIAIS / ESTOQUE ============

export async function listMaterials(studioId: number, activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(materials.studioId, requireStockStudio(studioId)), ...(activeOnly ? [eq(materials.isActive, 1)] : [])];
  const rows = await db.select({
    id: materials.id,
    name: materials.name,
    category: materials.category,
    unit: materials.unit,
    currentStock: materials.currentStock,
    minStock: materials.minStock,
    avgPrice: materials.avgPrice,
    supplierId: materials.supplierId,
    supplierName: suppliers.name,
    notes: materials.notes,
    isActive: materials.isActive,
    createdAt: materials.createdAt,
    updatedAt: materials.updatedAt,
  })
    .from(materials)
    .leftJoin(suppliers, and(eq(suppliers.id, materials.supplierId), eq(suppliers.studioId, requireStockStudio(studioId))))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(materials.category, materials.name);
  return rows;
}

export async function getMaterialById(id: number, studioId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(materials).where(and(eq(materials.id, id), eq(materials.studioId, requireStockStudio(studioId))));
  return rows[0];
}

export async function createMaterial(data: Omit<InsertMaterial, 'id' | 'createdAt' | 'updatedAt' | 'studioId'> & { studioId: number }) {
  if (data.supplierId != null) await assertStockSupplier(data.supplierId, data.studioId);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(materials).values({ ...data, studioId: requireStockStudio(data.studioId), createdAt: now, updatedAt: now });
  return result[0].insertId;
}

export async function updateMaterial(id: number, data: Partial<Omit<InsertMaterial, 'id' | 'createdAt' | 'studioId'>>, studioId: number) {
  if (data.supplierId != null) await assertStockSupplier(data.supplierId, studioId);
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(materials).set({ ...data, studioId: requireStockStudio(studioId), updatedAt: Date.now() }).where(and(eq(materials.id, id), eq(materials.studioId, requireStockStudio(studioId))));
  if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado neste estúdio." });
}

export async function deleteMaterial(id: number, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(materials).set({ isActive: 0 }).where(and(eq(materials.id, id), eq(materials.studioId, requireStockStudio(studioId))));
  if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Registro não encontrado neste estúdio." });
}

export async function getLowStockMaterials(studioId: number) {
  const db = await getDb();
  if (!db) return [];
  // Busca materiais onde currentStock <= minStock e minStock > 0
  const rows = await db.select({
    id: materials.id,
    name: materials.name,
    category: materials.category,
    unit: materials.unit,
    currentStock: materials.currentStock,
    minStock: materials.minStock,
    supplierName: suppliers.name,
    supplierWhatsapp: suppliers.whatsapp,
  })
    .from(materials)
    .leftJoin(suppliers, and(eq(suppliers.id, materials.supplierId), eq(suppliers.studioId, requireStockStudio(studioId))))
    .where(and(
      eq(materials.studioId, requireStockStudio(studioId)),
      eq(materials.isActive, 1),
      sql`CAST(${materials.currentStock} AS DECIMAL(10,2)) <= CAST(${materials.minStock} AS DECIMAL(10,2))`,
      sql`CAST(${materials.minStock} AS DECIMAL(10,2)) > 0`
    ))
    .orderBy(materials.category, materials.name);
  return rows;
}

// ============ MOVIMENTAÇÕES DE ESTOQUE ============

export async function listStockMovements(studioId: number, materialId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [sql`EXISTS (SELECT 1 FROM ${materials} WHERE ${materials.id} = ${stockMovements.materialId} AND ${materials.studioId} = ${requireStockStudio(studioId)})`, ...(materialId ? [eq(stockMovements.materialId, materialId)] : [])];
  return db.select().from(stockMovements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}

export async function addStockMovement(data: {
  materialId: number;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  reason?: string;
  notes?: string;
  createdBy?: number;
}, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar estoque atual
  const mat = await getMaterialById(data.materialId, studioId);
  if (!mat) throw new TRPCError({ code: "NOT_FOUND", message: "Material não encontrado neste estúdio." });

  const previousStock = parseFloat(String(mat.currentStock)) || 0;
  let newStock: number;

  if (data.type === 'entrada') {
    newStock = previousStock + data.quantity;
  } else if (data.type === 'saida') {
    newStock = Math.max(0, previousStock - data.quantity);
  } else {
    // ajuste: quantity é o novo valor absoluto
    newStock = data.quantity;
  }

  // Inserir movimentação
  await db.insert(stockMovements).values({
    materialId: data.materialId,
    type: data.type,
    quantity: String(data.quantity),
    previousStock: String(previousStock),
    newStock: String(newStock),
    reason: data.reason,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: Date.now(),
  });

  // Atualizar estoque atual do material
  await db.update(materials)
    .set({ currentStock: String(newStock) })
    .where(and(eq(materials.id, data.materialId), eq(materials.studioId, requireStockStudio(studioId))));

  return { previousStock, newStock };
}

// ============ PEDIDOS DE ORÇAMENTO ============

export async function listPurchaseOrders(studioId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: purchaseOrders.id,
    supplierId: purchaseOrders.supplierId,
    supplierName: suppliers.name,
    supplierWhatsapp: suppliers.whatsapp,
    status: purchaseOrders.status,
    notes: purchaseOrders.notes,
    sentAt: purchaseOrders.sentAt,
    createdAt: purchaseOrders.createdAt,
  })
    .from(purchaseOrders)
    .leftJoin(suppliers, and(eq(suppliers.id, purchaseOrders.supplierId), eq(suppliers.studioId, requireStockStudio(studioId))))
    .where(eq(purchaseOrders.studioId, requireStockStudio(studioId)))
    .orderBy(desc(purchaseOrders.createdAt));
  return rows;
}

export async function getPurchaseOrderById(id: number, studioId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const order = await db.select({
    id: purchaseOrders.id,
    supplierId: purchaseOrders.supplierId,
    supplierName: suppliers.name,
    supplierWhatsapp: suppliers.whatsapp,
    supplierPhone: suppliers.phone,
    status: purchaseOrders.status,
    notes: purchaseOrders.notes,
    sentAt: purchaseOrders.sentAt,
    createdAt: purchaseOrders.createdAt,
  })
    .from(purchaseOrders)
    .leftJoin(suppliers, and(eq(suppliers.id, purchaseOrders.supplierId), eq(suppliers.studioId, requireStockStudio(studioId))))
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.studioId, requireStockStudio(studioId))));

  if (!order[0]) return undefined;

  const items = await db.select({
    id: purchaseOrderItems.id,
    materialId: purchaseOrderItems.materialId,
    materialName: materials.name,
    materialUnit: materials.unit,
    quantity: purchaseOrderItems.quantity,
    unitPrice: purchaseOrderItems.unitPrice,
    notes: purchaseOrderItems.notes,
  })
    .from(purchaseOrderItems)
    .leftJoin(materials, and(eq(materials.id, purchaseOrderItems.materialId), eq(materials.studioId, requireStockStudio(studioId))))
    .where(eq(purchaseOrderItems.orderId, id));

  return { ...order[0], items };
}

export async function createPurchaseOrder(data: {
  supplierId: number;
  notes?: string;
  createdBy?: number;
  items: { materialId: number; quantity: number; unitPrice?: number; notes?: string }[];
}, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await assertStockSupplier(data.supplierId, studioId);
  for (const item of data.items) {
    if (!(await getMaterialById(item.materialId, studioId))) throw new TRPCError({ code: "NOT_FOUND", message: "Material não encontrado neste estúdio." });
  }
  const result = await db.insert(purchaseOrders).values({
    studioId: requireStockStudio(studioId),
    supplierId: data.supplierId,
    notes: data.notes,
    createdBy: data.createdBy,
    status: 'rascunho',
  });
  const orderId = result[0].insertId;

  if (data.items.length > 0) {
    await db.insert(purchaseOrderItems).values(
      data.items.map(item => ({
        orderId,
        materialId: item.materialId,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice ?? 0),
        notes: item.notes,
      }))
    );
  }

  return orderId;
}

export async function updatePurchaseOrderStatus(id: number, status: 'rascunho' | 'enviado' | 'confirmado' | 'recebido' | 'cancelado', studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sentAt = status === 'enviado' ? Date.now() : undefined;
  const result = await db.update(purchaseOrders).set({
    status,
    updatedAt: Date.now(),
    ...(sentAt ? { sentAt } : {}),
  }).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.studioId, requireStockStudio(studioId))));
  if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado neste estúdio." });
}

export async function deletePurchaseOrder(id: number, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async tx => {
    const [order] = await tx.select({ id: purchaseOrders.id }).from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.studioId, requireStockStudio(studioId)))).for("update");
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado neste estúdio." });
    await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
    await tx.delete(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.studioId, studioId)));
  });
}

/** Gera a mensagem formatada para WhatsApp de um pedido de orçamento */
export function buildWhatsAppOrderMessage(order: {
  supplierName: string | null;
  notes?: string | null;
  items: { materialName: string | null; quantity: string; materialUnit: string | null; unitPrice: string; notes?: string | null }[];
}): string {
  const lines: string[] = [];
  lines.push('🛒 *PEDIDO DE ORÇAMENTO*');
  lines.push(`📋 Fornecedor: ${order.supplierName ?? 'N/A'}`);
  lines.push('');
  lines.push('*Itens solicitados:*');
  order.items.forEach((item, i) => {
    const qty = parseFloat(item.quantity);
    const price = parseFloat(item.unitPrice);
    const line = `${i + 1}. ${item.materialName ?? 'Item'} — ${qty} ${item.materialUnit ?? 'un'}`;
    lines.push(line + (price > 0 ? ` (R$ ${price.toFixed(2)}/un)` : ''));
    if (item.notes) lines.push(`   _${item.notes}_`);
  });
  if (order.notes) {
    lines.push('');
    lines.push(`📝 Observações: ${order.notes}`);
  }
  lines.push('');
  lines.push('Por favor, envie o orçamento com prazo de entrega. Obrigado! 🙏');
  return lines.join('\n');
}

// ============ ANAMNESE - EDIÇÃO E EXCLUSÃO ============

/** Atualiza o payloadJson de uma submissão de anamnese (via link público) */
export async function updateAnamneseSubmission(id: number, payloadJson: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(anamneseSubmissions)
    .set({ payloadJson })
    .where(eq(anamneseSubmissions.id, id));
}

/** Exclui uma submissão de anamnese (via link público) e reabre o request para reenvio */
export async function deleteAnamneseSubmission(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Buscar o requestId antes de excluir
  const [submission] = await db.select({ requestId: anamneseSubmissions.requestId })
    .from(anamneseSubmissions)
    .where(eq(anamneseSubmissions.id, id))
    .limit(1);
  await db.delete(anamneseSubmissions).where(eq(anamneseSubmissions.id, id));
  // Reabre o request (remove completedAt) para permitir novo preenchimento
  if (submission?.requestId) {
    await db.update(anamneseRequests)
      .set({ completedAt: null })
      .where(eq(anamneseRequests.id, submission.requestId));
  }
}

/** Atualiza uma ficha de anamnese manual (painel interno) */
export async function updateAnamnesisRecord(id: number, data: Partial<{
  hasAllergies: number;
  allergiesDetails: string;
  hasDiseases: number;
  diseasesDetails: string;
  usesMedication: number;
  medicationDetails: string;
  isPregnant: number;
  hasKeloid: number;
  acceptedTerms: number;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(anamnesisRecords).set(data).where(eq(anamnesisRecords.id, id));
}

/** Exclui uma ficha de anamnese manual (painel interno) */
export async function deleteAnamnesisRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(anamnesisRecords).where(eq(anamnesisRecords.id, id));
}

/** Busca uma submissão de anamnese por requestId (para pré-preencher o formulário público) */
export async function getAnamneseSubmissionByRequestId(requestId: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select()
    .from(anamneseSubmissions)
    .where(eq(anamneseSubmissions.requestId, requestId))
    .orderBy(desc(anamneseSubmissions.createdAt))
    .limit(1);
  return result ?? null;
}


// ============ APPOINTMENT REMINDERS (Lembretes Individuais) ============

/** Lista todos os lembretes de um agendamento específico */
export async function listRemindersByAppointment(appointmentId: number): Promise<AppointmentReminder[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(appointmentReminders)
    .where(eq(appointmentReminders.appointmentId, appointmentId))
    .orderBy(appointmentReminders.scheduledAt);
}

/** Cria um novo lembrete para um agendamento */
export async function createAppointmentReminder(data: InsertAppointmentReminder): Promise<AppointmentReminder | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(appointmentReminders).values(data);
  const id = (result as any).insertId as number;
  const [created] = await db.select().from(appointmentReminders).where(eq(appointmentReminders.id, id));
  return created ?? null;
}

/** Atualiza um lembrete existente */
export async function updateAppointmentReminder(
  id: number,
  data: Partial<InsertAppointmentReminder>,
  studioId: number
): Promise<AppointmentReminder | null> {
  const db = await getDb();
  if (!db) return null;
  const condition = reminderStudioCondition(id,studioId);
  const {scheduledAt,message,status} = data;
  const result = await db.update(appointmentReminders).set({scheduledAt,message,status}).where(condition);
  if (!result[0].affectedRows) throw new TRPCError({code:'NOT_FOUND',message:'Lembrete não encontrado neste estúdio.'});
  const [updated] = await db.select().from(appointmentReminders).where(condition);
  return updated ?? null;
}

/** Remove um lembrete */
export async function deleteAppointmentReminder(id: number, studioId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const result = await db.delete(appointmentReminders).where(reminderStudioCondition(id,studioId));
  if (!result[0].affectedRows) throw new TRPCError({code:'NOT_FOUND',message:'Lembrete não encontrado neste estúdio.'});
}

function reminderStudioCondition(id:number,studioId:number) {
  requireDashboardStudio(studioId);
  return and(eq(appointmentReminders.id,id),sql`EXISTS (SELECT 1 FROM ${appointments} WHERE ${appointments.id} = ${appointmentReminders.appointmentId} AND ${appointments.studioId} = ${studioId})`);
}

/**
 * Busca todos os lembretes pendentes cuja scheduledAt <= agora.
 * Usado pelo scheduler para disparar os lembretes no momento certo.
 */
export async function getPendingRemindersToSend(): Promise<Array<AppointmentReminder & {
  clientName: string | null;
  clientPhone: string | null;
  appointmentDate: string;
  service: string;
  artist: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  const now = toLocalDateStr(new Date());

  const rows = await db
    .select({
      id: appointmentReminders.id,
      appointmentId: appointmentReminders.appointmentId,
      scheduledAt: appointmentReminders.scheduledAt,
      message: appointmentReminders.message,
      status: appointmentReminders.status,
      sentAt: appointmentReminders.sentAt,
      createdAt: appointmentReminders.createdAt,
      updatedAt: appointmentReminders.updatedAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      appointmentDate: appointments.date,
      service: appointments.service,
      artist: appointments.artist,
    })
    .from(appointmentReminders)
    .leftJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointmentReminders.status, "pending"),
        lte(appointmentReminders.scheduledAt, now)
      )
    )
    .orderBy(appointmentReminders.scheduledAt);

  return rows as any;
}

/** Marca um lembrete como enviado */
export async function markReminderSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(appointmentReminders).set({
    status: "sent",
    sentAt: toDateStr(new Date()),
  }).where(eq(appointmentReminders.id, id));
}

/** Marca um lembrete como falhou */
export async function markReminderFailed(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(appointmentReminders).set({
    status: "failed",
  }).where(eq(appointmentReminders.id, id));
}

/** Lista todos os lembretes individuais pendentes (para exibir na tela de Notificações) */
export async function getAllPendingReminders(studioId: number): Promise<any[]> {
  requireDashboardStudio(studioId);
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: appointmentReminders.id,
      appointmentId: appointmentReminders.appointmentId,
      scheduledAt: appointmentReminders.scheduledAt,
      message: appointmentReminders.message,
      status: appointmentReminders.status,
      sentAt: appointmentReminders.sentAt,
      createdAt: appointmentReminders.createdAt,
      clientName: clients.name,
      clientPhone: clients.phone,
      appointmentDate: appointments.date,
      service: appointments.service,
      artist: appointments.artist,
    })
    .from(appointmentReminders)
    .leftJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(
      eq(appointmentReminders.status, "pending"),
      eq(appointments.studioId, studioId),
      eq(clients.studioId, studioId),
    ))
    .orderBy(appointmentReminders.scheduledAt);

  return rows as any[];
}

/** Reagenda para o instante local o lembrete pendente do estúdio para que a fila o entregue. */
export async function releasePendingReminderNow(id: number, studioId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const reminder = (await db.select({ id: appointmentReminders.id })
    .from(appointmentReminders)
    .innerJoin(appointments, eq(appointments.id, appointmentReminders.appointmentId))
    .where(and(
      eq(appointmentReminders.id, id),
      eq(appointmentReminders.status, "pending"),
      eq(appointments.studioId, studioId),
    ))
    .limit(1))[0];
  if (!reminder) return false;
  const now = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date()).replace(",", "");
  await db.update(appointmentReminders).set({ scheduledAt: now, status: "pending" })
    .where(and(reminderStudioCondition(id,studioId),eq(appointmentReminders.status,'pending')));
  return true;
}

/** Retorna agendamentos da semana atual (segunda-feira a domingo) no fuso America/Sao_Paulo */
export async function getWeeklyAppointments(studioId: number) {
  requireDashboardStudio(studioId);
  const db = await getDb();
  if (!db) return [];

  // Calcular início (segunda) e fim (domingo) da semana atual em SP
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dayOfWeek = now.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Formatar como "YYYY-MM-DD HH:MM:SS" para comparação com datetime do MySQL
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 00:00:00`;
  const fmtEnd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 23:59:59`;

  const rows = await db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      date: appointments.date,
      duration: appointments.duration,
      service: appointments.service,
      artist: appointments.artist,
      status: appointments.status,
      totalAmount: appointments.totalAmount,
    })
    .from(appointments)
    .leftJoin(clients, and(eq(clients.id, appointments.clientId),eq(clients.studioId,studioId)))
    .where(
      and(
        gte(appointments.date, fmt(monday)),
        eq(appointments.studioId, studioId),
        lte(appointments.date, fmtEnd(sunday))
      )
    )
    .orderBy(appointments.date);

  return rows;
}

// ===== PERCENTUAIS DOS COLABORADORES =====

export async function listCollaboratorRates(studioId: number) {
  const db = await getDb();
  if (!db) return [];
  // Buscar artistas ativos com seus percentuais
  const artistsList = await db
    .select()
    .from(artists)
    .where(and(eq(artists.studioId, studioId), eq(artists.active, 1)));

  const rates = await db
    .select()
    .from(collaboratorRates)
    .where(eq(collaboratorRates.studioId, studioId));

  return artistsList.map(artist => {
    const rate = rates.find(r => r.artistId === artist.id);
    return {
      artistId: artist.id,
      artistName: artist.name,
      specialty: artist.specialty,
      percentage: rate?.percentage ?? 50, // padrão 50%
      notes: rate?.notes ?? null,
      rateId: rate?.id ?? null,
    };
  });
}

export async function upsertCollaboratorRate(data: {
  studioId: number;
  artistId: number;
  percentage: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(collaboratorRates)
    .where(
      and(
        eq(collaboratorRates.studioId, data.studioId),
        eq(collaboratorRates.artistId, data.artistId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(collaboratorRates)
      .set({ percentage: data.percentage, notes: data.notes ?? null })
      .where(eq(collaboratorRates.id, existing[0].id));
    return { id: existing[0].id, updated: true };
  } else {
    const result = await db.insert(collaboratorRates).values({
      studioId: data.studioId,
      artistId: data.artistId,
      percentage: data.percentage,
      notes: data.notes ?? null,
    });
    return { id: (result as any)[0]?.insertId ?? 0, updated: false };
  }
}

// ===== RELATÓRIOS FINANCEIROS POR COLABORADOR =====

function getPeriodRange(period: string, referenceDate?: string): { start: string; end: string } {
  const ref = referenceDate ? new Date(referenceDate + 'T12:00:00') : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === 'daily') {
    const day = fmt(ref);
    return { start: `${day} 00:00:00`, end: `${day} 23:59:59` };
  }
  if (period === 'weekly') {
    const day = ref.getDay(); // 0=dom, 1=seg...
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: `${fmt(monday)} 00:00:00`, end: `${fmt(sunday)} 23:59:59` };
  }
  if (period === 'monthly') {
    const start = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-01`;
    const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const end = `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(lastDay)}`;
    return { start: `${start} 00:00:00`, end: `${end} 23:59:59` };
  }
  // annual
  return {
    start: `${ref.getFullYear()}-01-01 00:00:00`,
    end: `${ref.getFullYear()}-12-31 23:59:59`,
  };
}

export async function getCollaboratorReport(
  studioId: number,
  artistName: string,
  period: string,
  referenceDate?: string
) {
  const db = await getDb();
  if (!db) return null;

  const { start, end } = getPeriodRange(period, referenceDate);

  // Buscar agendamentos do artista no período
  const apts = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      service: appointments.service,
      clientId: appointments.clientId,
      totalAmount: appointments.totalAmount,
      depositAmount: appointments.depositAmount,
      depositPaid: appointments.depositPaid,
      paymentStatus: appointments.paymentStatus,
      paymentMethod: appointments.paymentMethod,
      signalStatus: appointments.signalStatus,
      status: appointments.status,
      clientName: clients.name,
    })
    .from(appointments)
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.studioId, studioId),
        eq(appointments.artist, artistName),
        gte(appointments.date, start),
        lte(appointments.date, end)
      )
    )
    .orderBy(appointments.date);

  // Buscar percentual do artista
  const artistRecord = await db
    .select()
    .from(artists)
    .where(and(eq(artists.studioId, studioId), eq(artists.name, artistName)))
    .limit(1);

  let percentage = 50;
  if (artistRecord.length > 0) {
    const rate = await db
      .select()
      .from(collaboratorRates)
      .where(
        and(
          eq(collaboratorRates.studioId, studioId),
          eq(collaboratorRates.artistId, artistRecord[0].id)
        )
      )
      .limit(1);
    if (rate.length > 0) percentage = rate[0].percentage;
  }

  const totalRevenue = apts.reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
  const paidRevenue = apts
    .filter(a => a.paymentStatus === 'pago')
    .reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
  const collaboratorEarnings = Math.round(totalRevenue * percentage / 100);
  const studioEarnings = totalRevenue - collaboratorEarnings;

  return {
    artistName,
    percentage,
    period,
    start: start.slice(0, 10),
    end: end.slice(0, 10),
    totalAppointments: apts.length,
    totalRevenue,       // em centavos
    paidRevenue,        // em centavos
    collaboratorEarnings, // em centavos
    studioEarnings,       // em centavos
    appointments: apts.map(a => ({
      ...a,
      totalAmountBRL: a.totalAmount ? (a.totalAmount / 100).toFixed(2) : '0.00',
      collaboratorAmountBRL: a.totalAmount
        ? ((a.totalAmount * percentage / 100) / 100).toFixed(2)
        : '0.00',
    })),
  };
}

export async function getCollaboratorsSummary(
  studioId: number,
  period: string,
  referenceDate?: string,
  artistId?: number | null,
) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = getPeriodRange(period, referenceDate);

  // Buscar artistas ativos
  const artistsList = await db
    .select()
    .from(artists)
    .where(and(eq(artists.studioId, studioId), eq(artists.active, 1)));

  const rates = await db
    .select()
    .from(collaboratorRates)
    .where(eq(collaboratorRates.studioId, studioId));

  // Buscar todos os agendamentos do período
  const apts = await db
    .select({
      artist: appointments.artist,
      totalAmount: appointments.totalAmount,
      paymentStatus: appointments.paymentStatus,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.studioId, studioId),
        gte(appointments.date, start),
        lte(appointments.date, end)
      )
    );

  const visibleArtists = artistId != null
    ? artistsList.filter((artist) => artist.id === artistId)
    : artistsList;

  return visibleArtists.map(artist => {
    const rate = rates.find(r => r.artistId === artist.id);
    const percentage = rate?.percentage ?? 50;
    const artistApts = apts.filter(a => a.artist === artist.name);
    const totalRevenue = artistApts.reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
    const paidRevenue = artistApts
      .filter(a => a.paymentStatus === 'pago')
      .reduce((sum, a) => sum + (a.totalAmount ?? 0), 0);
    const collaboratorEarnings = Math.round(totalRevenue * percentage / 100);
    const studioEarnings = totalRevenue - collaboratorEarnings;

    return {
      artistId: artist.id,
      artistName: artist.name,
      specialty: artist.specialty,
      percentage,
      totalAppointments: artistApts.length,
      totalRevenue,
      paidRevenue,
      collaboratorEarnings,
      studioEarnings,
      totalRevenueBRL: (totalRevenue / 100).toFixed(2),
      paidRevenueBRL: (paidRevenue / 100).toFixed(2),
      collaboratorEarningsBRL: (collaboratorEarnings / 100).toFixed(2),
      studioEarningsBRL: (studioEarnings / 100).toFixed(2),
    };
  });
}

/** Save the answer and its linked client's personal data atomically. */
export async function savePublicAnamnese(token: string, payload: Record<string, unknown>, expectedSubmissionId?: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  let patch: ReturnType<typeof clientPatchFromAnamnese>;
  try { patch = clientPatchFromAnamnese(payload); }
  catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Dados pessoais inválidos" }); }
  return database.transaction(async (tx) => {
    const [request] = await tx.select().from(anamneseRequests)
      .where(eq(anamneseRequests.token, token)).limit(1).for("update");
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Link inválido" });
    if (request.statusRequest === "cancelada" || request.statusRequest === "expirada" ||
        parseAnamneseExpiry(request.expiresAt).getTime() < Date.now()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Link expirado ou cancelado. Solicite um novo link ao estúdio." });
    }
    const [client] = await tx.select().from(clients).where(eq(clients.id, request.clientId)).limit(1).for("update");
    if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
    const [existing] = await tx.select().from(anamneseSubmissions)
      .where(eq(anamneseSubmissions.requestId, request.id)).limit(1);
    if (expectedSubmissionId !== undefined && existing?.id !== expectedSubmissionId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Ficha não pertence a este link" });
    }
    const payloadJson = JSON.stringify(payload);
    let submissionId: number;
    if (existing) {
      if (existing.clientId !== request.clientId) throw new TRPCError({ code: "BAD_REQUEST", message: "Vínculo da ficha inválido" });
      await tx.update(anamneseSubmissions).set({ payloadJson }).where(eq(anamneseSubmissions.id, existing.id));
      submissionId = existing.id;
    } else {
      const result = await tx.insert(anamneseSubmissions).values({
        requestId: request.id, clientId: request.clientId, appointmentId: request.appointmentId, payloadJson,
      });
      submissionId = result[0].insertId;
    }
    if (Object.keys(patch).length) await tx.update(clients).set(patch).where(eq(clients.id, request.clientId));
    await tx.update(anamneseRequests).set({
      completedAt: request.completedAt || toDateStr(new Date()), statusRequest: "preenchida",
    }).where(eq(anamneseRequests.id, request.id));
    return { submissionId, clientId: request.clientId, appointmentId: request.appointmentId };
  });
}
