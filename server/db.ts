import { eq, desc, and, gte, lte, or, like, sql, ne, inArray } from "drizzle-orm";
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
  postSaleFollowups,
  salesLeads,
  waitlistEntries,
  InsertSalesLead,
  InsertWaitlistEntry,
  collaboratorRates,
  procedureKits,
  procedureKitItems,
  technicalProcedures,
	procedureConsumables,
	procedureEvents,
	catalogBrands,
	catalogProductLines,
	catalogVariants,
	supplierCatalogOfferings,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { POST_SALE_STAGES, type PostSaleStage } from "../shared/postSale";

// ============ DATE HELPERS ============
/** Converte Date | string | null para string ISO (YYYY-MM-DD HH:MM:SS) compatível com MySQL mode:'string' */
export function toDateStr(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (typeof d === 'string') {
    // Normalize ISO timestamps such as 2026-08-24T18:00:00.000Z to the
    // DATETIME/TIMESTAMP representation expected by MySQL.
    return d.includes('T') ? d.slice(0, 19).replace('T', ' ') : d;
  }
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
      const normalizedLastSignedIn = toDateStr(user.lastSignedIn);
      values.lastSignedIn = normalizedLastSignedIn;
      updateSet.lastSignedIn = normalizedLastSignedIn;
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

export async function listAllUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot list users: database not available");
    return [];
  }

  const result = await db.select().from(users).orderBy(desc(users.createdAt));
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
  if (data.lastSignedIn !== undefined) {
    updateData.lastSignedIn = toDateStr(data.lastSignedIn);
  }
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
  
  const conditions = [];
  
  // Filtrar por studioId (obrigatório exceto para superadmin)
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

export async function searchClients(term: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const searchTerm = `%${term}%`;
  
  const conditions = [
    or(
      like(clients.name, searchTerm),
      like(clients.email, searchTerm),
      like(clients.phone, searchTerm)
    )
  ];
  
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

export async function listAppointments(studioId?: number | null) {
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
      status: appointments.status,
      confirmationStatus: appointments.confirmationStatus,
      confirmationDelayMinutes: appointments.confirmationDelayMinutes,
      confirmationAttention: appointments.confirmationAttention,
      notes: appointments.notes,
      referenceImageUrl: appointments.referenceImageUrl,
      referenceImageKey: appointments.referenceImageKey,
      depositPaid: appointments.depositPaid,
      depositAmount: appointments.depositAmount,
      totalAmount: appointments.totalAmount,
      signalStatus: appointments.signalStatus,
      paymentStatus: appointments.paymentStatus,
      paymentMethod: appointments.paymentMethod,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      studioId: appointments.studioId,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
    })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id));

  if (studioId != null) {
    return await baseQuery
      .where(eq(appointments.studioId, studioId))
      .orderBy(desc(appointments.date));
  }
  return await baseQuery.orderBy(desc(appointments.date));
}

export async function getAppointmentsByClientId(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(appointments)
    .where(eq(appointments.clientId, clientId))
    .orderBy(desc(appointments.date));
  
  return result;
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

// ============ PÓS-VENDA AUTOMÁTICO ============

function addDaysAtTen(dateValue: string, days: number) {
  const base = new Date(dateValue.replace(" ", "T"));
  base.setDate(base.getDate() + days);
  base.setHours(10, 0, 0, 0);
  return toLocalDateStr(base);
}

export async function syncPostSaleFollowupsForAppointment(appointment: typeof appointments.$inferSelect) {
  const database = await getDb();
  if (!database) return;

  if (appointment.status !== "concluido") {
    await database.update(postSaleFollowups)
      .set({ status: "cancelled" })
      .where(and(
        eq(postSaleFollowups.appointmentId, appointment.id),
        inArray(postSaleFollowups.status, ["scheduled", "due", "postponed", "failed"]),
      ));
    return;
  }

  const existing = await database.select().from(postSaleFollowups)
    .where(eq(postSaleFollowups.appointmentId, appointment.id));
  const now = toLocalDateStr(new Date());

  for (const item of POST_SALE_STAGES) {
    const scheduledAt = addDaysAtTen(appointment.date, item.days);
    const status = scheduledAt <= now ? "due" as const : "scheduled" as const;
    const found = existing.find((row) => row.stage === item.stage);
    if (found) {
      if (!["sent", "completed"].includes(found.status)) {
        await database.update(postSaleFollowups).set({
          clientId: appointment.clientId,
          artistId: appointment.artistId,
          studioId: appointment.studioId,
          scheduledAt,
          status,
          lastError: null,
        }).where(eq(postSaleFollowups.id, found.id));
      }
    } else {
      await database.insert(postSaleFollowups).values({
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        artistId: appointment.artistId,
        studioId: appointment.studioId,
        stage: item.stage,
        scheduledAt,
        status,
        deliveryMode: "manual",
      });
    }
  }
}

export async function refreshDuePostSaleFollowups() {
  const database = await getDb();
  if (!database) return;
  await database.update(postSaleFollowups).set({ status: "due" }).where(and(
    inArray(postSaleFollowups.status, ["scheduled", "postponed"]),
    lte(postSaleFollowups.scheduledAt, toLocalDateStr(new Date())),
  ));
}

export async function listPostSaleFollowups(studioId?: number | null) {
  const database = await getDb();
  if (!database) return [];
  await refreshDuePostSaleFollowups();
  const query = database.select({
    id: postSaleFollowups.id,
    appointmentId: postSaleFollowups.appointmentId,
    clientId: postSaleFollowups.clientId,
    artistId: postSaleFollowups.artistId,
    studioId: postSaleFollowups.studioId,
    stage: postSaleFollowups.stage,
    scheduledAt: postSaleFollowups.scheduledAt,
    status: postSaleFollowups.status,
    deliveryMode: postSaleFollowups.deliveryMode,
    message: postSaleFollowups.message,
    sentAt: postSaleFollowups.sentAt,
    completedAt: postSaleFollowups.completedAt,
    lastError: postSaleFollowups.lastError,
    clientName: clients.name,
    clientPhone: clients.phone,
    clientEmail: clients.email,
    appointmentDate: appointments.date,
    artistName: appointments.artist,
    service: appointments.service,
  }).from(postSaleFollowups)
    .leftJoin(clients, eq(postSaleFollowups.clientId, clients.id))
    .leftJoin(appointments, eq(postSaleFollowups.appointmentId, appointments.id));
  const condition = studioId != null
    ? and(eq(postSaleFollowups.studioId, studioId), ne(postSaleFollowups.status, "cancelled"))
    : ne(postSaleFollowups.status, "cancelled");
  return await query.where(condition).orderBy(postSaleFollowups.scheduledAt);
}

export async function getPostSaleFollowup(id: number) {
  const rows = await listPostSaleFollowups();
  return rows.find((row) => row.id === id);
}

export async function updatePostSaleFollowup(id: number, data: {
  status?: "scheduled" | "due" | "sent" | "completed" | "postponed" | "cancelled" | "failed";
  deliveryMode?: "manual" | "automatic";
  scheduledAt?: string;
  message?: string | null;
  sentAt?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  await database.update(postSaleFollowups).set(data).where(eq(postSaleFollowups.id, id));
  return { success: true };
}

export async function listDueAutomaticPostSaleFollowups() {
  const database = await getDb();
  if (!database) return [];
  await refreshDuePostSaleFollowups();
  return await database.select({
    id: postSaleFollowups.id,
    appointmentId: postSaleFollowups.appointmentId,
    clientId: postSaleFollowups.clientId,
    stage: postSaleFollowups.stage,
    message: postSaleFollowups.message,
    clientName: clients.name,
    clientPhone: clients.phone,
    artistName: appointments.artist,
    service: appointments.service,
  }).from(postSaleFollowups)
    .leftJoin(clients, eq(postSaleFollowups.clientId, clients.id))
    .leftJoin(appointments, eq(postSaleFollowups.appointmentId, appointments.id))
    .where(and(eq(postSaleFollowups.status, "due"), eq(postSaleFollowups.deliveryMode, "automatic")));
}

export async function backfillPostSaleFollowups() {
  const database = await getDb();
  if (!database) return;
  const completed = await database.select().from(appointments)
    .where(eq(appointments.status, "concluido"));
  for (const appointment of completed) {
    await syncPostSaleFollowupsForAppointment(appointment);
  }
}

export async function checkAppointmentConflicts(
  artist: string,
  date: Date | string,
  duration: number,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) return { hasConflict: false, conflicts: [] };
  // Calcular horário de início e fim do novo agendamento
  const startTime = new Date(typeof date === 'string' ? date : date);
  const endTime = new Date(startTime.getTime() + duration * 60000); // duration em minutos
  // Buscar todos os agendamentos do mesmo artista no mesmo dia
  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTime);
  dayEnd.setHours(23, 59, 59, 999);
  let query = db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      date: appointments.date,
      duration: appointments.duration,
      service: appointments.service,
      artist: appointments.artist,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.artist, artist),
        gte(appointments.date, toDateStr(dayStart)),
        lte(appointments.date, toDateStr(dayEnd)),
        ne(appointments.status, "cancelado") // Ignorar agendamentos cancelados
      )
    );
  const existingAppointments = await query;
  // Filtrar conflitos
  const conflicts = existingAppointments.filter(apt => {
    // Excluir o próprio agendamento ao editar
    if (excludeId && apt.id === excludeId) return false;
    const aptStart = new Date(apt.date);
    const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);

    // Verificar sobreposição de intervalos
    // Há conflito se: (startTime < aptEnd) && (endTime > aptStart)
    return startTime < aptEnd && endTime > aptStart;
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map(c => ({
      id: c.id,
      clientId: c.clientId,
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

export async function getTransactionsByDateRange(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  
  const startStr = startDate;
  const endStr = endDate;
  
  const result = await db
    .select()
    .from(transactions)
    .where(and(gte(transactions.date, startStr), lte(transactions.date, endStr)))
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

export async function getTopClients(limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.totalSpent))
    .limit(limit);
  
  return result;
}

export async function getUpcomingBirthdays(daysAhead: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);
  
  // Buscar todos os clientes com birthDate
  const allClients = await db
    .select()
    .from(clients)
    .where(sql`${clients.birthDate} IS NOT NULL`);
  
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

export async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return {
    totalClients: 0,
    totalAppointments: 0,
    totalRevenue: 0,
    upcomingBirthdaysCount: 0
  };
  
  // Total de clientes
  const clientsCount = await db.select({ count: sql<number>`count(*)` }).from(clients);
  const totalClients = clientsCount[0]?.count || 0;
  
  // Total de agendamentos
  const appointmentsCount = await db.select({ count: sql<number>`count(*)` }).from(appointments);
  const totalAppointments = appointmentsCount[0]?.count || 0;
  
  // Receita total (soma de todas as transações tipo "entrada")
  const revenueSum = await db
    .select({ sum: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(eq(transactions.type, "entrada"));
  const totalRevenue = revenueSum[0]?.sum || 0;
  
  // Aniversariantes nos próximos 30 dias
  const birthdays = await getUpcomingBirthdays(30);
  const upcomingBirthdaysCount = birthdays.length;
  
  return {
    totalClients,
    totalAppointments,
    totalRevenue,
    upcomingBirthdaysCount
  };
}


// ============ REPORTS HELPERS ============

export async function getMonthlyRevenue(startDate: string, endDate: string) {
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
        lte(transactions.date, endStr)
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

export async function getCategoryBreakdown(startDate: string, endDate: string) {
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
        lte(transactions.date, endStr)
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

export async function getPaymentMethodBreakdown(startDate: string, endDate: string) {
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
        lte(transactions.date, toDateStr(endDate))
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

export async function getFinancialSummary(startDate: string, endDate: string) {
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
        lte(transactions.date, toDateStr(endDate))
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
export async function searchAppointments(term: string, startDate?: Date, endDate?: Date) {
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

export async function searchTransactions(term: string, startDate?: Date, endDate?: Date) {
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
export async function getUpcomingAppointments() {
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
      status: appointments.status,
    })
    .from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(
      and(
        gte(appointments.date, toLocalDateStr(tomorrowStart)),
        lte(appointments.date, toLocalDateStr(tomorrowEnd)),
        or(
          eq(appointments.status, "agendado"),
          eq(appointments.status, "confirmado")
        )
      )
    )
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

export async function getNotificationLogs(limit: number = 50) {
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
    .orderBy(desc(notificationLogs.sentAt))
    .limit(limit);

  return result;
}

/** Registra a resposta pública do cliente e alimenta a Central de Notificações. */
export async function logAppointmentResponse({
  appointmentId,
  clientId,
  clientName,
  artistName,
  responseLabel,
}: {
  appointmentId: number;
  clientId: number;
  clientName: string;
  artistName: string;
  responseLabel: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  await db.insert(notificationLogs).values({
    type: "appointment_response",
    appointmentId,
    clientId,
    title: `Resposta de ${clientName}`,
    message: `${clientName} respondeu \"${responseLabel}\" ao agendamento com ${artistName}.`,
    status: "sent",
  });
}

/** Registra a decisão do estúdio sobre atraso/reagendamento na ficha do cliente. */
export async function logAppointmentDecision({
  appointmentId,
  clientId,
  clientName,
  artistName,
  decisionLabel,
}: {
  appointmentId: number;
  clientId: number;
  clientName: string;
  artistName: string;
  decisionLabel: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  await db.insert(notificationLogs).values({
    type: "appointment_response",
    appointmentId,
    clientId,
    title: `Decisão sobre ${clientName}`,
    message: `${artistName || "O estúdio"}: ${decisionLabel}`,
    status: "sent",
  });
}

/** Linha do tempo das respostas de confirmação exibida na ficha do cliente. */
export async function getAppointmentResponseHistory(clientId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: notificationLogs.id,
      appointmentId: notificationLogs.appointmentId,
      title: notificationLogs.title,
      message: notificationLogs.message,
      sentAt: notificationLogs.sentAt,
    })
    .from(notificationLogs)
    .where(and(
      eq(notificationLogs.clientId, clientId),
      eq(notificationLogs.type, "appointment_response"),
    ))
    .orderBy(desc(notificationLogs.sentAt));
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
export async function getStudioSettings() {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(studioSettings).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateStudioSettings(settings: Partial<InsertStudioSettings>) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getStudioSettings();
  
  if (existing) {
    await db.update(studioSettings)
      .set({ ...settings, updatedAt: toDateStr(new Date()) })
      .where(eq(studioSettings.id, existing.id));
    
    const updated = await getStudioSettings();
    return updated;
  } else {
    const [inserted] = await db.insert(studioSettings).values(settings);
    const newSettings = await getStudioSettings();
    return newSettings;
  }
}

// ============ OPERAÇÃO COMERCIAL ============

export async function listSalesLeads(studioId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: salesLeads.id,
    studioId: salesLeads.studioId,
    clientId: salesLeads.clientId,
    appointmentId: salesLeads.appointmentId,
    artistId: salesLeads.artistId,
    name: salesLeads.name,
    phone: salesLeads.phone,
    email: salesLeads.email,
    service: salesLeads.service,
    description: salesLeads.description,
    estimatedValue: salesLeads.estimatedValue,
    stage: salesLeads.stage,
    nextFollowupAt: salesLeads.nextFollowupAt,
    lostReason: salesLeads.lostReason,
    notes: salesLeads.notes,
    createdAt: salesLeads.createdAt,
    updatedAt: salesLeads.updatedAt,
    artistName: artists.name,
  }).from(salesLeads)
    .leftJoin(artists, eq(salesLeads.artistId, artists.id))
    .where(eq(salesLeads.studioId, studioId))
    .orderBy(desc(salesLeads.updatedAt));
}

export async function createSalesLead(data: InsertSalesLead) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(salesLeads).values(data);
  return { id: result.insertId };
}

export async function updateSalesLead(id: number, studioId: number, data: Partial<InsertSalesLead>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(salesLeads)
    .set({ ...data, updatedAt: toLocalDateStr(new Date()) })
    .where(and(eq(salesLeads.id, id), eq(salesLeads.studioId, studioId)));
  return { success: true };
}

export async function deleteSalesLead(id: number, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(salesLeads).where(and(eq(salesLeads.id, id), eq(salesLeads.studioId, studioId)));
  return { success: true };
}

export async function listWaitlistEntries(studioId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select({
    id: waitlistEntries.id,
    studioId: waitlistEntries.studioId,
    clientId: waitlistEntries.clientId,
    artistId: waitlistEntries.artistId,
    service: waitlistEntries.service,
    preferredDays: waitlistEntries.preferredDays,
    preferredPeriods: waitlistEntries.preferredPeriods,
    minDuration: waitlistEntries.minDuration,
    maxDuration: waitlistEntries.maxDuration,
    priority: waitlistEntries.priority,
    status: waitlistEntries.status,
    notes: waitlistEntries.notes,
    createdAt: waitlistEntries.createdAt,
    updatedAt: waitlistEntries.updatedAt,
    clientName: clients.name,
    clientPhone: clients.phone,
    clientEmail: clients.email,
    artistName: artists.name,
  }).from(waitlistEntries)
    .leftJoin(clients, eq(waitlistEntries.clientId, clients.id))
    .leftJoin(artists, eq(waitlistEntries.artistId, artists.id))
    .where(eq(waitlistEntries.studioId, studioId))
    .orderBy(desc(waitlistEntries.priority), desc(waitlistEntries.updatedAt));
}

export async function createWaitlistEntry(data: InsertWaitlistEntry) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(waitlistEntries).values(data);
  return { id: result.insertId };
}

export async function updateWaitlistEntry(id: number, studioId: number, data: Partial<InsertWaitlistEntry>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(waitlistEntries)
    .set({ ...data, updatedAt: toLocalDateStr(new Date()) })
    .where(and(eq(waitlistEntries.id, id), eq(waitlistEntries.studioId, studioId)));
  return { success: true };
}

export async function deleteWaitlistEntry(id: number, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(waitlistEntries).where(and(eq(waitlistEntries.id, id), eq(waitlistEntries.studioId, studioId)));
  return { success: true };
}

export async function getTodayOperations(studioId: number) {
  const db = await getDb();
  if (!db) return {
    appointments: [], followups: [], postSale: [],
    summary: { appointmentsToday: 0, pendingConfirmation: 0, pendingPayments: 0, delayedAttention: 0, leadsDue: 0, postSaleDue: 0 },
  };

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const startStr = toLocalDateStr(start);
  const endStr = toLocalDateStr(end);

  const todayAppointments = await db.select({
    id: appointments.id,
    clientId: appointments.clientId,
    clientName: clients.name,
    clientPhone: clients.phone,
    date: appointments.date,
    duration: appointments.duration,
    service: appointments.service,
    artist: appointments.artist,
    artistId: appointments.artistId,
    status: appointments.status,
    confirmationStatus: appointments.confirmationStatus,
    confirmationDelayMinutes: appointments.confirmationDelayMinutes,
    confirmationAttention: appointments.confirmationAttention,
    depositPaid: appointments.depositPaid,
    signalStatus: appointments.signalStatus,
    paymentStatus: appointments.paymentStatus,
    totalAmount: appointments.totalAmount,
  }).from(appointments)
    .leftJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(
      eq(appointments.studioId, studioId),
      gte(appointments.date, startStr),
      lte(appointments.date, endStr),
      ne(appointments.status, "cancelado"),
    ))
    .orderBy(appointments.date);

  const followups = await db.select({
    id: salesLeads.id,
    name: salesLeads.name,
    phone: salesLeads.phone,
    service: salesLeads.service,
    stage: salesLeads.stage,
    nextFollowupAt: salesLeads.nextFollowupAt,
    estimatedValue: salesLeads.estimatedValue,
  }).from(salesLeads).where(and(
    eq(salesLeads.studioId, studioId),
    lte(salesLeads.nextFollowupAt, endStr),
    ne(salesLeads.stage, "scheduled"),
    ne(salesLeads.stage, "lost"),
    ne(salesLeads.stage, "archived"),
  )).orderBy(salesLeads.nextFollowupAt);

  const postSale = await db.select({
    id: postSaleFollowups.id,
    clientName: clients.name,
    clientPhone: clients.phone,
    stage: postSaleFollowups.stage,
    scheduledAt: postSaleFollowups.scheduledAt,
    status: postSaleFollowups.status,
    message: postSaleFollowups.message,
  }).from(postSaleFollowups)
    .leftJoin(clients, eq(postSaleFollowups.clientId, clients.id))
    .where(and(
      eq(postSaleFollowups.studioId, studioId),
      lte(postSaleFollowups.scheduledAt, endStr),
      inArray(postSaleFollowups.status, ["scheduled", "due", "postponed", "failed"]),
    ))
    .orderBy(postSaleFollowups.scheduledAt);

  return {
    appointments: todayAppointments,
    followups,
    postSale,
    summary: {
      appointmentsToday: todayAppointments.length,
      pendingConfirmation: todayAppointments.filter(item => item.confirmationStatus === "pendente").length,
      pendingPayments: todayAppointments.filter(item => item.paymentStatus !== "pago").length,
      delayedAttention: todayAppointments.filter(item => item.confirmationStatus === "atraso" || item.confirmationAttention === "pending").length,
      leadsDue: followups.length,
      postSaleDue: postSale.length,
    },
  };
}

function parsePreferenceList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map(item => item.trim()).filter(Boolean);
  }
}

export async function getWaitlistSuggestions(studioId: number) {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const until = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const releasedSlots = await db.select({
    id: appointments.id,
    date: appointments.date,
    duration: appointments.duration,
    service: appointments.service,
    artist: appointments.artist,
    artistId: appointments.artistId,
  }).from(appointments).where(and(
    eq(appointments.studioId, studioId),
    eq(appointments.status, "cancelado"),
    gte(appointments.date, toLocalDateStr(now)),
    lte(appointments.date, toLocalDateStr(until)),
  )).orderBy(appointments.date);

  const entries = await listWaitlistEntries(studioId);
  const activeEntries = entries.filter(entry => entry.status === "active" || entry.status === "contacted");
  const dayTokens = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

  return releasedSlots.map(slot => {
    const date = new Date(slot.date.replace(" ", "T"));
    const day = dayTokens[date.getDay()];
    const hour = date.getHours();
    const period = hour < 12 ? "manha" : hour < 18 ? "tarde" : "noite";

    const matches = activeEntries.map(entry => {
      const preferredDays = parsePreferenceList(entry.preferredDays);
      const preferredPeriods = parsePreferenceList(entry.preferredPeriods);
      const artistCompatible = !entry.artistId || entry.artistId === slot.artistId;
      const durationCompatible = slot.duration >= entry.minDuration && slot.duration <= entry.maxDuration;
      const dayCompatible = preferredDays.length === 0 || preferredDays.includes(day);
      const periodCompatible = preferredPeriods.length === 0 || preferredPeriods.includes(period);
      const score = (artistCompatible ? 40 : 0) + (durationCompatible ? 30 : 0) +
        (dayCompatible ? 20 : 0) + (periodCompatible ? 10 : 0) + entry.priority;
      return { ...entry, score, artistCompatible, durationCompatible, dayCompatible, periodCompatible };
    }).filter(match => match.artistCompatible && match.durationCompatible)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { ...slot, matches };
  });
}

// ============ ARTISTS FUNCTIONS ============
export async function listArtists() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(artists).orderBy(artists.name);
}

export async function getArtistById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createArtist(artist: InsertArtist) {
  const db = await getDb();
  if (!db) {
    console.error('[createArtist] Database not available');
    throw new Error('Database not available');
  }

  try {
    console.log('[createArtist] Creating artist with data:', artist);
    const [inserted] = await db.insert(artists).values(artist);
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
  const result = await db.insert(anamneseRequests).values(data);
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

export async function createStudio(data: {
  name: string;
  email?: string | null;
  masterKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(studios).values({
    name: data.name,
    email: data.email ?? null,
    masterKey: data.masterKey,
    isActive: 1,
  });
  const studioId = Number(result[0].insertId);
  const studio = await getStudioById(studioId);
  if (!studio) throw new Error("Failed to retrieve created studio");
  return studio;
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

// ============ FORNECEDORES ============

export async function listSuppliers(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = activeOnly ? [eq(suppliers.isActive, 1)] : [];
  return db.select().from(suppliers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(suppliers.name);
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(suppliers).where(eq(suppliers.id, id));
  return rows[0];
}

export async function createSupplier(data: Omit<InsertSupplier, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(suppliers).values({ ...data, createdAt: now, updatedAt: now });
  return result[0].insertId;
}

export async function updateSupplier(id: number, data: Partial<Omit<InsertSupplier, 'id' | 'createdAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ ...data, updatedAt: Date.now() }).where(eq(suppliers.id, id));
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suppliers).set({ isActive: 0 }).where(eq(suppliers.id, id));
}

// ============ CATÁLOGO TÉCNICO E PORTFÓLIO DE FORNECEDORES ============

export type CatalogSearchInput = {
  query?: string;
  category?: string;
  brandId?: number;
  lineId?: number;
  formats?: string[];
  needleCount?: number;
  needleDiameter?: number;
  taper?: string;
  supplierId?: number;
  limit?: number;
};

export async function listCatalogBrands() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(catalogBrands)
    .where(eq(catalogBrands.isActive, 1))
    .orderBy(catalogBrands.name);
}

export async function listCatalogProductLines(brandId?: number, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(catalogProductLines.isActive, 1)];
  if (brandId) conditions.push(eq(catalogProductLines.brandId, brandId));
  if (category) conditions.push(eq(catalogProductLines.category, category));
  return db.select({
    id: catalogProductLines.id,
    brandId: catalogProductLines.brandId,
    name: catalogProductLines.name,
    category: catalogProductLines.category,
    description: catalogProductLines.description,
    brandName: catalogBrands.name,
  })
    .from(catalogProductLines)
    .innerJoin(catalogBrands, eq(catalogBrands.id, catalogProductLines.brandId))
    .where(and(...conditions))
    .orderBy(catalogBrands.name, catalogProductLines.name);
}

export async function searchCatalogVariants(input: CatalogSearchInput = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(catalogVariants.isActive, 1),
    eq(catalogProductLines.isActive, 1),
    eq(catalogBrands.isActive, 1),
  ];

  if (input.category) conditions.push(eq(catalogVariants.category, input.category));
  if (input.brandId) conditions.push(eq(catalogBrands.id, input.brandId));
  if (input.lineId) conditions.push(eq(catalogProductLines.id, input.lineId));
  if (input.formats?.length) conditions.push(inArray(catalogVariants.format, input.formats));
  if (input.needleCount !== undefined) conditions.push(eq(catalogVariants.needleCount, input.needleCount));
  if (input.needleDiameter !== undefined) conditions.push(eq(catalogVariants.needleDiameter, String(input.needleDiameter)));
  if (input.taper) conditions.push(eq(catalogVariants.taper, input.taper));

  const tokens = (input.query ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[,]/g, ".")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);

  for (const token of tokens) {
    conditions.push(sql`LOWER(CONCAT_WS(' ',
      ${catalogBrands.name}, ${catalogProductLines.name}, ${catalogVariants.name},
      ${catalogVariants.sku}, ${catalogVariants.format}, ${catalogVariants.needleCount},
      ${catalogVariants.needleDiameter}, ${catalogVariants.taper}, ${catalogVariants.packageQuantity},
      ${catalogVariants.packageUnit}, ${catalogVariants.application}
    )) LIKE ${`%${token}%`}`);
  }

  const variants = await db.select({
    id: catalogVariants.id,
    lineId: catalogVariants.lineId,
    name: catalogVariants.name,
    sku: catalogVariants.sku,
    category: catalogVariants.category,
    format: catalogVariants.format,
    needleCount: catalogVariants.needleCount,
    needleDiameter: catalogVariants.needleDiameter,
    taper: catalogVariants.taper,
    packageQuantity: catalogVariants.packageQuantity,
    packageUnit: catalogVariants.packageUnit,
    application: catalogVariants.application,
    evidenceStatus: catalogVariants.evidenceStatus,
    sourceUrl: catalogVariants.sourceUrl,
    notes: catalogVariants.notes,
    sortOrder: catalogVariants.sortOrder,
    lineName: catalogProductLines.name,
    brandId: catalogBrands.id,
    brandName: catalogBrands.name,
  })
    .from(catalogVariants)
    .innerJoin(catalogProductLines, eq(catalogProductLines.id, catalogVariants.lineId))
    .innerJoin(catalogBrands, eq(catalogBrands.id, catalogProductLines.brandId))
    .where(and(...conditions))
    .orderBy(catalogBrands.name, catalogProductLines.name, catalogVariants.format, catalogVariants.needleCount, catalogVariants.needleDiameter, catalogVariants.sortOrder)
    .limit(Math.min(input.limit ?? 100, 200));

  const offeringRows = await db.select({
    id: supplierCatalogOfferings.id,
    supplierId: supplierCatalogOfferings.supplierId,
    supplierName: suppliers.name,
    supplierPhone: suppliers.phone,
    supplierWhatsapp: suppliers.whatsapp,
    brandId: supplierCatalogOfferings.brandId,
    lineId: supplierCatalogOfferings.lineId,
    variantId: supplierCatalogOfferings.variantId,
    sourceUrl: supplierCatalogOfferings.sourceUrl,
    evidenceStatus: supplierCatalogOfferings.evidenceStatus,
    lastVerifiedAt: supplierCatalogOfferings.lastVerifiedAt,
    notes: supplierCatalogOfferings.notes,
  })
    .from(supplierCatalogOfferings)
    .innerJoin(suppliers, eq(suppliers.id, supplierCatalogOfferings.supplierId))
    .where(and(eq(supplierCatalogOfferings.isActive, 1), eq(suppliers.isActive, 1)));

  const supplierFilteredVariants = input.supplierId
    ? variants.filter((variant) => offeringRows.some((offering) => offering.supplierId === input.supplierId && (
      offering.variantId === variant.id ||
      (!offering.variantId && offering.lineId === variant.lineId) ||
      (!offering.variantId && !offering.lineId && offering.brandId === variant.brandId)
    )))
    : variants;

  return supplierFilteredVariants.map((variant) => {
    const offers = offeringRows
      .filter((offering) => (
        offering.variantId === variant.id ||
        (!offering.variantId && offering.lineId === variant.lineId) ||
        (!offering.variantId && !offering.lineId && offering.brandId === variant.brandId)
      ))
      .map((offering) => ({
        ...offering,
        matchLevel: offering.variantId === variant.id ? "item" : offering.lineId === variant.lineId ? "linha" : "marca",
      }));
    return { ...variant, suppliers: offers };
  });
}

export async function getCatalogVariantById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select({
    id: catalogVariants.id,
    lineId: catalogVariants.lineId,
    name: catalogVariants.name,
    sku: catalogVariants.sku,
    category: catalogVariants.category,
    format: catalogVariants.format,
    needleCount: catalogVariants.needleCount,
    needleDiameter: catalogVariants.needleDiameter,
    taper: catalogVariants.taper,
    packageQuantity: catalogVariants.packageQuantity,
    packageUnit: catalogVariants.packageUnit,
    application: catalogVariants.application,
    evidenceStatus: catalogVariants.evidenceStatus,
    sourceUrl: catalogVariants.sourceUrl,
    notes: catalogVariants.notes,
    lineName: catalogProductLines.name,
    brandId: catalogBrands.id,
    brandName: catalogBrands.name,
  })
    .from(catalogVariants)
    .innerJoin(catalogProductLines, eq(catalogProductLines.id, catalogVariants.lineId))
    .innerJoin(catalogBrands, eq(catalogBrands.id, catalogProductLines.brandId))
    .where(and(eq(catalogVariants.id, id), eq(catalogVariants.isActive, 1)))
    .limit(1);
  return rows[0];
}

export async function listSupplierCatalogOfferings(supplierId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: supplierCatalogOfferings.id,
    supplierId: supplierCatalogOfferings.supplierId,
    brandId: supplierCatalogOfferings.brandId,
    brandName: catalogBrands.name,
    lineId: supplierCatalogOfferings.lineId,
    lineName: catalogProductLines.name,
    variantId: supplierCatalogOfferings.variantId,
    variantName: catalogVariants.name,
    variantSku: catalogVariants.sku,
    sourceUrl: supplierCatalogOfferings.sourceUrl,
    evidenceStatus: supplierCatalogOfferings.evidenceStatus,
    lastVerifiedAt: supplierCatalogOfferings.lastVerifiedAt,
    notes: supplierCatalogOfferings.notes,
  })
    .from(supplierCatalogOfferings)
    .innerJoin(catalogBrands, eq(catalogBrands.id, supplierCatalogOfferings.brandId))
    .leftJoin(catalogProductLines, eq(catalogProductLines.id, supplierCatalogOfferings.lineId))
    .leftJoin(catalogVariants, eq(catalogVariants.id, supplierCatalogOfferings.variantId))
    .where(and(eq(supplierCatalogOfferings.supplierId, supplierId), eq(supplierCatalogOfferings.isActive, 1)))
    .orderBy(catalogBrands.name, catalogProductLines.name, catalogVariants.name);
}

export async function createSupplierCatalogOffering(data: {
  supplierId: number;
  brandId: number;
  lineId?: number;
  variantId?: number;
  sourceUrl?: string;
  evidenceStatus: 'item' | 'marca' | 'pendente';
  lastVerifiedAt?: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(supplierCatalogOfferings).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return result[0].insertId;
}

export async function deactivateSupplierCatalogOffering(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(supplierCatalogOfferings).set({ isActive: 0, updatedAt: Date.now() }).where(eq(supplierCatalogOfferings.id, id));
}

// ============ MATERIAIS / ESTOQUE ============

export async function listMaterials(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = activeOnly ? [eq(materials.isActive, 1)] : [];
  const rows = await db.select({
    id: materials.id,
    name: materials.name,
    category: materials.category,
    unit: materials.unit,
    currentStock: materials.currentStock,
    minStock: materials.minStock,
    avgPrice: materials.avgPrice,
    supplierId: materials.supplierId,
	  catalogVariantId: materials.catalogVariantId,
    supplierName: suppliers.name,
    notes: materials.notes,
    isActive: materials.isActive,
    createdAt: materials.createdAt,
    updatedAt: materials.updatedAt,
  })
    .from(materials)
    .leftJoin(suppliers, eq(suppliers.id, materials.supplierId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(materials.category, materials.name);
  return rows;
}

export async function getMaterialById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(materials).where(eq(materials.id, id));
  return rows[0];
}

export async function createMaterial(data: Omit<InsertMaterial, 'id' | 'createdAt' | 'updatedAt'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(materials).values({ ...data, createdAt: now, updatedAt: now });
  return result[0].insertId;
}

export async function updateMaterial(id: number, data: Partial<Omit<InsertMaterial, 'id' | 'createdAt'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(materials).set({ ...data, updatedAt: Date.now() }).where(eq(materials.id, id));
}

export async function deleteMaterial(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(materials).set({ isActive: 0 }).where(eq(materials.id, id));
}

export async function getLowStockMaterials() {
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
    .leftJoin(suppliers, eq(suppliers.id, materials.supplierId))
    .where(and(
      eq(materials.isActive, 1),
      sql`CAST(${materials.currentStock} AS DECIMAL(10,2)) <= CAST(${materials.minStock} AS DECIMAL(10,2))`,
      sql`CAST(${materials.minStock} AS DECIMAL(10,2)) > 0`
    ))
    .orderBy(materials.category, materials.name);
  return rows;
}

// ============ MOVIMENTAÇÕES DE ESTOQUE ============

export async function listStockMovements(materialId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = materialId ? [eq(stockMovements.materialId, materialId)] : [];
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar estoque atual
  const mat = await getMaterialById(data.materialId);
  if (!mat) throw new Error("Material não encontrado");

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
    .where(eq(materials.id, data.materialId));

  return { previousStock, newStock };
}

// ============ KITS DE PROCEDIMENTO ============

type ProcedureKitItemInput = {
  materialId: number;
  quantity: string;
  unit: string;
};

type ProcedureKitInput = {
  studioId: number;
  name: string;
  description?: string;
  category: string;
  items: ProcedureKitItemInput[];
};

export async function listProcedureKits(studioId = 1) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(procedureKits)
    .where(and(eq(procedureKits.studioId, studioId), eq(procedureKits.isActive, 1)))
    .orderBy(procedureKits.category, procedureKits.name);
}

export async function getProcedureKitById(id: number, studioId = 1) {
  const db = await getDb();
  if (!db) return undefined;
  const [kit] = await db.select()
    .from(procedureKits)
    .where(and(eq(procedureKits.id, id), eq(procedureKits.studioId, studioId), eq(procedureKits.isActive, 1)))
    .limit(1);
  if (!kit) return undefined;
  const items = await db.select({
    id: procedureKitItems.id,
    materialId: procedureKitItems.materialId,
    materialName: materials.name,
    materialCategory: materials.category,
    materialUnit: materials.unit,
    currentStock: materials.currentStock,
    avgPrice: materials.avgPrice,
    quantity: procedureKitItems.quantity,
    unit: procedureKitItems.unit,
  })
    .from(procedureKitItems)
    .innerJoin(materials, eq(materials.id, procedureKitItems.materialId))
    .where(eq(procedureKitItems.kitId, id))
    .orderBy(materials.name);
  return { ...kit, items };
}

export async function createProcedureKit(data: ProcedureKitInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  return db.transaction(async (tx) => {
    const [result] = await tx.insert(procedureKits).values({
      studioId: data.studioId,
      name: data.name,
      description: data.description,
      category: data.category,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    });
    const kitId = Number(result.insertId);
    await tx.insert(procedureKitItems).values(data.items.map((item) => ({
      kitId,
      materialId: item.materialId,
      quantity: item.quantity,
      unit: item.unit,
    })));
    return kitId;
  });
}

export async function updateProcedureKit(id: number, studioId: number, data: Omit<ProcedureKitInput, "studioId">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const [kit] = await tx.select().from(procedureKits)
      .where(and(eq(procedureKits.id, id), eq(procedureKits.studioId, studioId), eq(procedureKits.isActive, 1)))
      .limit(1);
    if (!kit) throw new Error("Kit não encontrado");
    await tx.update(procedureKits).set({
      name: data.name,
      description: data.description,
      category: data.category,
      updatedAt: Date.now(),
    }).where(eq(procedureKits.id, id));
    await tx.delete(procedureKitItems).where(eq(procedureKitItems.kitId, id));
    await tx.insert(procedureKitItems).values(data.items.map((item) => ({
      kitId: id,
      materialId: item.materialId,
      quantity: item.quantity,
      unit: item.unit,
    })));
    return { success: true };
  });
}

export async function deleteProcedureKit(id: number, studioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(procedureKits).set({ isActive: 0, updatedAt: Date.now() })
    .where(and(eq(procedureKits.id, id), eq(procedureKits.studioId, studioId)));
  return { success: true };
}

function kitConsumableCategory(category: string | null): "ink" | "cartridge" | "disposable" | "liquid" | "protection" | "stencil" | "aftercare" | "other" {
  const normalized = (category || "").toLowerCase();
  if (normalized.includes("tinta")) return "ink";
  if (normalized.includes("agulha") || normalized.includes("cartucho")) return "cartridge";
  if (normalized.includes("higiene") || normalized.includes("descart")) return "disposable";
  if (normalized.includes("proteção") || normalized.includes("protecao")) return "protection";
  if (normalized.includes("líquido") || normalized.includes("liquido")) return "liquid";
  if (normalized.includes("cuidado") || normalized.includes("after")) return "aftercare";
  if (normalized.includes("papel") || normalized.includes("stencil")) return "stencil";
  return "other";
}

function kitConsumableUnit(unit: string | null): "drop" | "ml" | "unit" | "pair" | "gram" | "portion" | "roll_fraction" {
  const normalized = (unit || "").toLowerCase();
  if (normalized === "ml" || normalized === "l") return "ml";
  if (normalized === "g" || normalized === "kg") return "gram";
  if (normalized === "par") return "pair";
  if (normalized === "rolo" || normalized === "m") return "roll_fraction";
  return "unit";
}

export async function applyProcedureKitToProcedure(data: {
  kitId: number;
  procedureId: number;
  studioId: number;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const [kit] = await tx.select().from(procedureKits)
      .where(and(eq(procedureKits.id, data.kitId), eq(procedureKits.studioId, data.studioId), eq(procedureKits.isActive, 1)))
      .limit(1);
    if (!kit) throw new Error("Kit não encontrado");
    const [procedure] = await tx.select().from(technicalProcedures)
      .where(and(eq(technicalProcedures.id, data.procedureId), eq(technicalProcedures.studioId, data.studioId)))
      .limit(1);
    if (!procedure) throw new Error("Procedimento não encontrado");
    const items = await tx.select({
      materialId: procedureKitItems.materialId,
      quantity: procedureKitItems.quantity,
      kitUnit: procedureKitItems.unit,
      materialName: materials.name,
      materialCategory: materials.category,
      materialUnit: materials.unit,
      currentStock: materials.currentStock,
      avgPrice: materials.avgPrice,
    })
      .from(procedureKitItems)
      .innerJoin(materials, eq(materials.id, procedureKitItems.materialId))
      .where(eq(procedureKitItems.kitId, data.kitId));
    if (!items.length) throw new Error("O kit não possui insumos");

    const parsedItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const currentStock = Number(item.currentStock || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Quantidade inválida para ${item.materialName}`);
      if (currentStock < quantity) throw new Error(`Estoque insuficiente para ${item.materialName}`);
      return { ...item, quantity, currentStock, avgPrice: Number(item.avgPrice || 0) };
    });

    for (const item of parsedItems) {
      const newStock = item.currentStock - item.quantity;
      await tx.insert(stockMovements).values({
        materialId: item.materialId,
        type: "saida",
        quantity: String(item.quantity),
        previousStock: String(item.currentStock),
        newStock: String(newStock),
        reason: `Kit de procedimento: ${kit.name}`,
        createdBy: data.createdBy,
        createdAt: Date.now(),
      });
      await tx.update(materials).set({ currentStock: String(newStock), updatedAt: Date.now() })
        .where(eq(materials.id, item.materialId));
      const unit = kitConsumableUnit(item.materialUnit || item.kitUnit);
      await tx.insert(procedureConsumables).values({
        procedureId: data.procedureId,
        inventoryItemId: item.materialId,
        category: kitConsumableCategory(item.materialCategory),
        name: item.materialName,
        unit,
        quantity: String(item.quantity),
        estimatedUnitCost: String(item.avgPrice),
        estimatedTotalCost: String(item.avgPrice * item.quantity),
        notes: `Aplicado pelo kit ${kit.name}`,
      });
    }

    await tx.insert(procedureEvents).values({
      procedureId: data.procedureId,
      eventType: "consumable_added",
      payload: JSON.stringify({ kitId: kit.id, kitName: kit.name, itemCount: parsedItems.length }),
      createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    });
    return { success: true, kitId: kit.id, kitName: kit.name, itemCount: parsedItems.length };
  });
}

// ============ PEDIDOS DE ORÇAMENTO ============

export async function listPurchaseOrders() {
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
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .orderBy(desc(purchaseOrders.createdAt));
  return rows;
}

export async function getPurchaseOrderById(id: number) {
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
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(eq(purchaseOrders.id, id));

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
    .leftJoin(materials, eq(materials.id, purchaseOrderItems.materialId))
    .where(eq(purchaseOrderItems.orderId, id));

  return { ...order[0], items };
}

export async function createPurchaseOrder(data: {
  supplierId: number;
  notes?: string;
  createdBy?: number;
  items: { materialId: number; quantity: number; unitPrice?: number; notes?: string }[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(purchaseOrders).values({
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

export async function updatePurchaseOrderStatus(id: number, status: 'rascunho' | 'enviado' | 'confirmado' | 'recebido' | 'cancelado') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sentAt = status === 'enviado' ? Date.now() : undefined;
  await db.update(purchaseOrders).set({
    status,
    updatedAt: Date.now(),
    ...(sentAt ? { sentAt } : {}),
  }).where(eq(purchaseOrders.id, id));
}

export async function deletePurchaseOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.orderId, id));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
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
  data: Partial<InsertAppointmentReminder>
): Promise<AppointmentReminder | null> {
  const db = await getDb();
  if (!db) return null;
  await db.update(appointmentReminders).set(data).where(eq(appointmentReminders.id, id));
  const [updated] = await db.select().from(appointmentReminders).where(eq(appointmentReminders.id, id));
  return updated ?? null;
}

/** Remove um lembrete */
export async function deleteAppointmentReminder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(appointmentReminders).where(eq(appointmentReminders.id, id));
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
export async function getAllPendingReminders(): Promise<any[]> {
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
    .where(eq(appointmentReminders.status, "pending"))
    .orderBy(appointmentReminders.scheduledAt);

  return rows as any[];
}

/** Retorna agendamentos da semana atual (segunda-feira a domingo) no fuso America/Sao_Paulo */
export async function getWeeklyAppointments() {
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
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        gte(appointments.date, fmt(monday)),
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
  referenceDate?: string
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

  return artistsList.map(artist => {
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
