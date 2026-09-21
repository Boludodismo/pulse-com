import { importTestInventory } from "../inventoryTestImport";
import { resolveProcedureArtist } from "../procedureArtist";
import { appointmentKitsRouter } from "./appointmentKits";
import { createHash } from "node:crypto";
import { inventoryMaterialRegistrations } from "../../drizzle/appointmentKitSchema";
import { syncMaterialRegistrationNotices } from "../materialRegistrationNotices";
import { inventoryLoans } from "../../drizzle/inventoryWorkflowSchema";
import { inventoryLoansRouter } from "./inventoryLoans";
import { inventoryNoticesRouter } from "../inventoryNotices";
import { assertNotLoanStock, assertNoPendingLoan } from "../inventoryWorkflowDb";
import { forecastAppointmentMaterial, materialForecast, queueCriticalForecastAlerts } from "../inventoryForecast";
export { runCriticalInventoryForecastCycle } from "../inventoryForecast";
import { isStudioDate, stockProjection, units, quantity as workflowQuantity } from "../inventoryWorkflowRules";
import {materialDescription} from "../../shared/materialDescription";
import { TECHNICAL_CATALOG_2026, canAddCatalogItemToOperationalStock } from "../../shared/technicalCatalog2026";
import { assertOwnArtist, canUseMaterial, isInventoryManager, requireInventoryArtist, requireMaterialForArtist, requireOwnedMaterial, type InventoryDatabase, type InventoryContext } from "../inventoryAccess";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, lte, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import {
  appointmentPlannedMaterials,
  appointments,
  artists,
  clients,
  inventoryKitItems,
  inventoryKits,
  materialCatalogCategories,
  materialCatalogItems,
  procedureInventoryConsumptions,
  procedurePauses,
  procedureColorSamples,
  procedureInkRecipes,
  procedureInkRecipeItems,
  technicalProcedures,
  tenantInventoryMovements,
  tenantMaterials,
  inventoryBatches,
  suppliers,
  studioMaterialArtists,
  studios,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { hasModulePermission, type SaasModule } from "../saas";
import { router, superAdminProcedure, tenantProcedure } from "../_core/trpc";
import { sendAndLog } from "../messaging/service";
import { normalizeBrazilianPhone } from "../messaging/phone";

const quantitySchema = z.string().regex(/^\d{1,9}(?:\.\d{1,3})?$/, "Informe uma quantidade positiva com até três casas decimais.");
const costSchema = z.string().regex(/^\d{1,8}(?:\.\d{1,4})?$/, "Informe um custo não negativo com até quatro casas decimais.");
const dateTimeSchema = z.string().datetime({ offset: true }).optional();

const SESSION_CUP_CAPACITY_ML = { P: 0.5, M: 1, G: 2, GG: 4 } as const;
type SessionCupSize = keyof typeof SESSION_CUP_CAPACITY_ML;

function recipeStockQuantity(unit: string, drops: number, dropsPerMl: number) {
  const normalized = unit.trim().toLowerCase();
  const estimatedMl = drops / dropsPerMl;
  if (normalized === "ml" || normalized.includes("mililit")) {
    return { quantity: estimatedMl.toFixed(3), estimatedMl };
  }
  if (
    normalized === "drop" ||
    normalized === "drops" ||
    normalized === "gt" ||
    normalized.includes("gota")
  ) {
    return { quantity: drops.toFixed(3), estimatedMl };
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Para usar pigmentos em receitas, configure a unidade do material como ml ou gotas.",
  });
}

function nextSessionCode(prefix: "C" | "M", previous?: string | null) {
  const parsed = previous?.match(/(\d+)$/);
  const next = parsed ? Number(parsed[1]) + 1 : 1;
  return prefix + String(next).padStart(2, "0");
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function decimalToScaled(value: string, decimals: number): number {
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * (10 ** decimals) + Number((fraction + "0".repeat(decimals)).slice(0, decimals));
}

function scaledToDecimal(value: number, decimals: number): string {
  const divisor = 10 ** decimals;
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / divisor)}.${String(absolute % divisor).padStart(decimals, "0")}`;
}

const calculateProjectedStock = stockProjection;

function incrementFixedDecimal(value: string, decimals: number): string {
  const digits = value.replace(".", "").split("");
  let carry = 1;
  for (let index = digits.length - 1; index >= 0 && carry; index -= 1) {
    const next = Number(digits[index]) + carry;
    digits[index] = String(next % 10);
    carry = next >= 10 ? 1 : 0;
  }
  if (carry) digits.unshift("1");
  const separator = digits.length - decimals;
  return `${digits.slice(0, separator).join("") || "0"}.${digits.slice(separator).join("").padStart(decimals, "0")}`;
}

function multiplyQuantityByCost(quantity: string, unitCost: string): string {
  const left = String(decimalToScaled(quantity, 3));
  const right = String(decimalToScaled(unitCost, 4));
  const accumulator = Array(left.length + right.length).fill(0) as number[];
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      accumulator[i + j + 1] += Number(left[i]) * Number(right[j]);
    }
  }
  for (let i = accumulator.length - 1; i > 0; i -= 1) {
    accumulator[i - 1] += Math.floor(accumulator[i] / 10);
    accumulator[i] %= 10;
  }
  const digits = accumulator.join("").replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(8, "0");
  const integer = padded.slice(0, -7) || "0";
  const fraction = padded.slice(-7);
  const truncated = `${integer}.${fraction.slice(0, 4)}`;
  return Number(fraction[4]) >= 5 ? incrementFixedDecimal(truncated, 4) : truncated;
}

function insertId(result: unknown): number | undefined {
  return (Array.isArray(result) ? result[0] : result)?.insertId;
}

function isAffected(result: unknown) {
  const raw = result as { affectedRows?: number; rowsAffected?: number } | [{ affectedRows?: number }];
  if (Array.isArray(raw)) return (raw[0]?.affectedRows ?? 0) === 1;
  return (raw.affectedRows ?? raw.rowsAffected ?? 0) === 1;
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return database;
}

async function requireModule(ctx: { user: { id: number; role: string }; studioId: number }, module: SaasModule, write = false) {
  if (ctx.user.role === "superadmin" || ctx.user.role === "admin") return;
  const allowed = await hasModulePermission({ userId: ctx.user.id, studioId: ctx.studioId, module, write });
  if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: `Você não possui permissão para ${write ? "alterar" : "consultar"} este módulo.` });
}

async function requireProcedure(database: Awaited<ReturnType<typeof requireDatabase>>, procedureId: number, ctx: InventoryContext) {
  const procedure = (await database.select().from(technicalProcedures).where(and(
    eq(technicalProcedures.id, procedureId),
    eq(technicalProcedures.studioId, ctx.studioId),
  )).limit(1))[0];
  if (!procedure) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão POD não encontrada nesta empresa." });
  const resolved = await resolveProcedureArtist(database, procedure);
  assertOwnArtist(ctx, resolved.artistId ?? null);
  return { ...procedure, ...resolved };
}

function calculateTiming(startedAt: string | null, finishedAt: string | null, pauses: Array<{ startedAt: string; endedAt: string | null }>) {
  const start = startedAt ? new Date(startedAt).getTime() : Date.now();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const pausedMilliseconds = pauses.reduce((total, pause) => {
    const pauseStart = new Date(pause.startedAt).getTime();
    const pauseEnd = pause.endedAt ? new Date(pause.endedAt).getTime() : Date.now();
    return total + Math.max(0, pauseEnd - pauseStart);
  }, 0);
  const totalMinutes = Math.max(0, Math.floor((end - start) / 60_000));
  return {
    totalMinutes,
    pausedMinutes: Math.floor(pausedMilliseconds / 60_000),
    effectiveMinutes: Math.max(0, Math.floor((end - start - pausedMilliseconds) / 60_000)),
  };
}

export const podSaasRouter = router({
  catalog: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      await requireModule(ctx, "stock");
      const database = await requireDatabase();
      const categories = await database.select().from(materialCatalogCategories)
        .where(eq(materialCatalogCategories.isActive, 1)).orderBy(asc(materialCatalogCategories.name));
      const items = await database.select().from(materialCatalogItems)
        .where(eq(materialCatalogItems.isActive, 1)).orderBy(asc(materialCatalogItems.name));
      return { categories, items };
    }),

    createCategory: superAdminProcedure.input(z.object({
      code: z.string().trim().toLowerCase().regex(/^[a-z0-9_\-]{2,80}$/),
      name: z.string().trim().min(2).max(120),
      icon: z.string().trim().max(80).optional(),
      description: z.string().trim().max(2_000).optional(),
    })).mutation(async ({ input }) => {
      const database = await requireDatabase();
      const existing = (await database.select({ id: materialCatalogCategories.id }).from(materialCatalogCategories)
        .where(eq(materialCatalogCategories.code, input.code)).limit(1))[0];
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma categoria com este código." });
      const inserted = await database.insert(materialCatalogCategories).values({
        code: input.code,
        name: input.name,
        icon: input.icon ?? null,
        description: input.description ?? null,
        isActive: 1,
      });
      return { id: insertId(inserted) };
    }),

    createItem: superAdminProcedure.input(z.object({
      categoryId: z.number().int().positive(),
      code: z.string().trim().toLowerCase().regex(/^[a-z0-9_\-]{2,120}$/),
      name: z.string().trim().min(2).max(255),
      subcategory: z.string().trim().max(120).optional(),
      configuration: z.string().trim().max(120).optional(),
      diameter: z.string().trim().max(40).optional(),
      needleCount: z.number().int().min(1).max(1000).nullable().optional(),
      gauge: z.string().trim().max(20).nullable().optional(),
      taper: z.string().trim().max(80).nullable().optional(),
      packageQuantity: z.number().int().min(1).max(100000).nullable().optional(),
      purchaseUnit: z.string().trim().max(50).nullable().optional(),

      defaultUnit: z.string().trim().min(1).max(50),
      technicalSpecification: z.string().trim().max(4_000).optional(),
      icon: z.string().trim().max(80).optional(),
    })).mutation(async ({ input }) => {
      const database = await requireDatabase();
      const category = (await database.select({ id: materialCatalogCategories.id }).from(materialCatalogCategories)
        .where(and(eq(materialCatalogCategories.id, input.categoryId), eq(materialCatalogCategories.isActive, 1))).limit(1))[0];
      if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria global não encontrada ou inativa." });
      const existing = (await database.select({ id: materialCatalogItems.id }).from(materialCatalogItems)
        .where(eq(materialCatalogItems.code, input.code)).limit(1))[0];
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um item de catálogo com este código." });
      const inserted = await database.insert(materialCatalogItems).values({
        ...input,
        subcategory: input.subcategory ?? null,
        configuration: input.configuration ?? null,
        diameter: input.diameter ?? null,
        technicalSpecification: input.technicalSpecification ?? null,
        icon: input.icon ?? null,
        isActive: 1,
      });
      return { id: insertId(inserted) };
    }),

    setItemActive: superAdminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const database = await requireDatabase();
        const result = await database.update(materialCatalogItems).set({ isActive: input.isActive ? 1 : 0 })
          .where(eq(materialCatalogItems.id, input.id));
        if (!isAffected(result)) throw new TRPCError({ code: "NOT_FOUND", message: "Item de catálogo não encontrado." });
        return { id: input.id, isActive: input.isActive };
      }),
  }),

  inventory: router({
    importTestCatalog: tenantProcedure.input(z.object({artistId:z.number().int().positive(),profile:z.literal("session").optional(),offset:z.number().int().min(0).max(TECHNICAL_CATALOG_2026.length-1)})).mutation(async ({ctx,input})=>{
      await requireModule(ctx,"stock",true);
      return importTestInventory(await requireDatabase(),ctx,input);
    }),
    loans: inventoryLoansRouter,
    notices: inventoryNoticesRouter,
    list: tenantProcedure.input(z.object({ artistId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
      await requireModule(ctx, "stock");
      const database = await requireDatabase();
      const artistId = input?.artistId ?? (isInventoryManager(ctx) ? null : ctx.artistId);
      assertOwnArtist(ctx, artistId);
      if (artistId) await requireInventoryArtist(database, ctx.studioId, artistId);
      const allocations = await database.select().from(studioMaterialArtists).where(eq(studioMaterialArtists.studioId, ctx.studioId));
      const materials = await database.select().from(tenantMaterials).where(and(eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.isActive, 1))).orderBy(asc(tenantMaterials.name));
      const loans = await database.select({ id: inventoryLoans.id, receivedMaterialId: inventoryLoans.receivedMaterialId, lenderArtistId: inventoryLoans.lenderArtistId }).from(inventoryLoans).where(eq(inventoryLoans.studioId, ctx.studioId));
      return materials.map(material => ({ ...material, loan: loans.find(l => l.receivedMaterialId === material.id) ?? null, suppliedTo: allocations.filter(a => a.tenantMaterialId === material.id).map(a => a.artistId) }))
        .filter(material => artistId == null || canUseMaterial(material.ownerArtistId, material.suppliedTo, artistId));
    }),

    movements: tenantProcedure.input(z.object({ tenantMaterialId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireModule(ctx, "stock");
      const database = await requireDatabase();
      await requireOwnedMaterial(database, ctx, input.tenantMaterialId);
      return database.select().from(tenantInventoryMovements).where(and(eq(tenantInventoryMovements.studioId, ctx.studioId), eq(tenantInventoryMovements.tenantMaterialId, input.tenantMaterialId))).orderBy(desc(tenantInventoryMovements.createdAt)).limit(100);
    }),

    setSuppliedArtists: tenantProcedure.input(z.object({ tenantMaterialId: z.number().int().positive(), artistIds: z.array(z.number().int().positive()).max(500) })).mutation(async ({ ctx, input }) => {
      if (!isInventoryManager(ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador do estúdio pode definir o fornecimento." });
      const database = await requireDatabase();
      return database.transaction(async tx => {
        const material = (await tx.select().from(tenantMaterials).where(and(eq(tenantMaterials.id, input.tenantMaterialId), eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.isActive, 1))).limit(1).for("update"))[0];
        if (!material || material.ownerArtistId != null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um material do estoque do estúdio." });
        const artistIds = Array.from(new Set(input.artistIds));
        for (const id of artistIds) await requireInventoryArtist(tx as unknown as InventoryDatabase, ctx.studioId, id);
        await tx.delete(studioMaterialArtists).where(and(eq(studioMaterialArtists.studioId, ctx.studioId), eq(studioMaterialArtists.tenantMaterialId, material.id)));
        if (artistIds.length) await tx.insert(studioMaterialArtists).values(artistIds.map(artistId => ({ studioId: ctx.studioId, tenantMaterialId: material.id, artistId })));
        return { artistIds };
      });
    }),

    create: tenantProcedure.input(z.object({
      registrationKey: z.string().uuid().optional(),
      suppliedArtistId: z.number().int().positive().optional(),
      ownerArtistId: z.number().int().positive().nullable().default(null),
      technicalCatalogIndex: z.number().int().min(0).max(TECHNICAL_CATALOG_2026.length - 1).optional(),
      catalogItemId: z.number().int().positive().optional(),
      name: z.string().trim().min(2).max(255).optional(),
      category: z.string().trim().max(120).optional(),
      unit: z.string().trim().min(1).max(50).optional(),
      brand: z.string().trim().max(120).optional(),
      line: z.string().trim().max(120).optional(),
      model: z.string().trim().max(120).optional(),
      configuration: z.string().trim().max(120).optional(),
      diameter: z.string().trim().max(40).optional(),
      needleCount: z.number().int().min(1).max(1000).nullable().optional(),
      gauge: z.string().trim().max(20).nullable().optional(),
      taper: z.string().trim().max(80).nullable().optional(),
      packageQuantity: z.number().int().min(1).max(100000).nullable().optional(),
      purchaseUnit: z.string().trim().max(50).nullable().optional(),

      currentQuantity: quantitySchema,
      minimumQuantity: quantitySchema.default("0"),
      unitCost: costSchema,
      lot: z.string().trim().max(120).optional(),
      expiresAt: dateTimeSchema,
      notes: z.string().trim().max(4_000).optional(),
    }).superRefine((input, refinement) => {
      if (!input.catalogItemId && input.technicalCatalogIndex == null && !input.name) refinement.addIssue({ code: "custom", message: "Selecione um item do catálogo ou informe o nome do material.", path: ["name"] });
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const technical = input.technicalCatalogIndex == null ? undefined : TECHNICAL_CATALOG_2026[input.technicalCatalogIndex];
      if (technical && !canAddCatalogItemToOperationalStock(technical)) throw new TRPCError({ code: "BAD_REQUEST", message: "Este item está bloqueado no catálogo técnico." });
      if (technical && input.catalogItemId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione apenas um catálogo." });
      const database = await requireDatabase();
      assertOwnArtist(ctx, input.ownerArtistId);
      if (input.ownerArtistId) await requireInventoryArtist(database, ctx.studioId, input.ownerArtistId);
      if (input.suppliedArtistId) {
        if (!isInventoryManager(ctx) || input.ownerArtistId != null) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador pode disponibilizar materiais do estúdio para o artista." });
        await requireInventoryArtist(database, ctx.studioId, input.suppliedArtistId);
      }
      return database.transaction(async (tx) => {
      const payloadHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      if (input.registrationKey) {
        // Serialize only keyed registrations within this studio, including retries.
        await tx.select({id:studios.id}).from(studios).where(eq(studios.id,ctx.studioId)).limit(1).for("update");
        const [registration] = await tx.select().from(inventoryMaterialRegistrations).where(and(eq(inventoryMaterialRegistrations.studioId,ctx.studioId),eq(inventoryMaterialRegistrations.registrationKey,input.registrationKey))).limit(1);
        if (registration) {
          if (registration.payloadHash !== payloadHash) throw new TRPCError({code:"CONFLICT",message:"Este cadastro já foi salvo com outros dados. Atualize os materiais antes de continuar."});
          await requireOwnedMaterial(tx as unknown as InventoryDatabase,ctx,registration.tenantMaterialId);
          return {id:registration.tenantMaterialId};
        }
      }
      const catalogItem = input.catalogItemId ? (await tx.select().from(materialCatalogItems).where(and(
        eq(materialCatalogItems.id, input.catalogItemId),
        eq(materialCatalogItems.isActive, 1),
      )).limit(1))[0] : null;
      if (input.catalogItemId && !catalogItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item de catálogo não encontrado." });

      const inserted = await tx.insert(tenantMaterials).values({
        studioId: ctx.studioId,
        ownerArtistId: input.ownerArtistId,
        catalogItemId: catalogItem?.id ?? null,
        name: technical?.name ?? catalogItem?.name ?? input.name!,
        category: technical?.category ?? input.category ?? catalogItem?.subcategory ?? null,
        unit: technical?.baseUnit ?? input.unit ?? catalogItem?.defaultUnit ?? "unidade",
        brand: technical?.brandName ?? input.brand ?? null,
        line: technical?.lineName ?? input.line ?? null,
        model: technical?.sku ?? input.model ?? null,
        configuration: technical?.format ?? input.configuration ?? catalogItem?.configuration ?? null,
        diameter: technical?.needleDiameter != null ? String(technical.needleDiameter) : input.diameter ?? catalogItem?.diameter ?? null,
        currentQuantity: scaledToDecimal(decimalToScaled(input.currentQuantity, 3), 3),
        minimumQuantity: scaledToDecimal(decimalToScaled(input.minimumQuantity, 3), 3),
        unitCost: scaledToDecimal(decimalToScaled(input.unitCost, 4), 4),
        needleCount: technical?.needleCount ?? input.needleCount ?? null,
        gauge: input.gauge ?? null, taper: technical?.taper ?? input.taper ?? null,
        packageQuantity: technical?.unitsPerPackage ?? input.packageQuantity ?? null,
        purchaseUnit: technical?.purchaseUnit ?? input.purchaseUnit ?? null,
        supplierId: null,
        lot: input.lot ?? null,
        expiresAt: input.expiresAt ? input.expiresAt.slice(0, 19).replace("T", " ") : null,
        notes: technical ? JSON.stringify({ catalog: "2026-09-07", ...technical }) : input.notes ?? null,
        createdByUserId: ctx.user.id,
      });
      const materialId = insertId(inserted);
      if (!materialId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o material do estoque." });
      if (input.suppliedArtistId) await tx.insert(studioMaterialArtists).values({studioId:ctx.studioId,tenantMaterialId:materialId,artistId:input.suppliedArtistId});
      if (input.registrationKey) await tx.insert(inventoryMaterialRegistrations).values({studioId:ctx.studioId,registrationKey:input.registrationKey,payloadHash,tenantMaterialId:materialId,createdByUserId:ctx.user.id});
      await tx.insert(tenantInventoryMovements).values({
        studioId: ctx.studioId,
        tenantMaterialId: materialId,
        type: "entrada",
        quantity: scaledToDecimal(decimalToScaled(input.currentQuantity, 3), 3),
        previousQuantity: "0.000",
        newQuantity: scaledToDecimal(decimalToScaled(input.currentQuantity, 3), 3),
        sourceType: "tenant_material",
        sourceId: materialId,
        reason: "Saldo inicial",
        createdByUserId: ctx.user.id,
      });
      return { id: materialId };
      });
    }),

    batches: tenantProcedure.input(z.object({tenantMaterialId:z.number().int().positive(),artistId:z.number().int().positive().optional()})).query(async({ctx,input})=>{
      await requireModule(ctx,"stock");const d=await requireDatabase();
      const material=(await d.select().from(tenantMaterials).where(and(eq(tenantMaterials.id,input.tenantMaterialId),eq(tenantMaterials.studioId,ctx.studioId))).limit(1))[0];
      if(!material)throw new TRPCError({code:"NOT_FOUND",message:"Material não encontrado."});
      if(!isInventoryManager(ctx))await requireMaterialForArtist(d,ctx,material,input.artistId??ctx.artistId??null);
      return d.select().from(inventoryBatches).where(and(eq(inventoryBatches.studioId,ctx.studioId),eq(inventoryBatches.tenantMaterialId,material.id))).orderBy(asc(inventoryBatches.expiresAt),asc(inventoryBatches.id));
    }),
    receive: tenantProcedure.input(z.object({tenantMaterialId:z.number().int().positive(),receiptKey:z.string().uuid(),supplierId:z.number().int().positive(),lot:z.string().trim().min(1).max(120),expiresAt:z.string().date().optional(),quantity:quantitySchema.refine(v=>Number(v)>0),unitCost:costSchema})).mutation(async({ctx,input})=>{
      await requireModule(ctx,"stock",true);const d=await requireDatabase();
      return d.transaction(async tx=>{
        const material=(await tx.select().from(tenantMaterials).where(and(eq(tenantMaterials.id,input.tenantMaterialId),eq(tenantMaterials.studioId,ctx.studioId),eq(tenantMaterials.isActive,1))).limit(1).for("update"))[0];
        if(!material)throw new TRPCError({code:"NOT_FOUND",message:"Material não encontrado."});assertOwnArtist(ctx,material.ownerArtistId);
        await assertNotLoanStock(tx, ctx.studioId, material.id);
        const existing=(await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.studioId,ctx.studioId),eq(inventoryBatches.receiptKey,input.receiptKey))).limit(1))[0];
        if(existing){if(existing.tenantMaterialId!==material.id||Number(existing.receivedQuantity)!==Number(input.quantity)||Number(existing.unitCost)!==Number(input.unitCost)||existing.lot!==input.lot||existing.supplierId!==input.supplierId||existing.expiresAt?.slice(0,10)!==input.expiresAt)throw new TRPCError({code:"CONFLICT",message:"Recebimento já utilizado."});return {id:existing.id,alreadyReceived:true};}
        const supplier=(await tx.select().from(suppliers).where(and(eq(suppliers.id,input.supplierId),eq(suppliers.studioId,ctx.studioId),eq(suppliers.isActive,1))).limit(1))[0];
        if(!supplier)throw new TRPCError({code:"BAD_REQUEST",message:"Selecione um fornecedor ativo deste estúdio."});
        const previous=decimalToScaled(material.currentQuantity,3),quantity=decimalToScaled(input.quantity,3),next=previous+quantity;
        if(next>999999999999)throw new TRPCError({code:"BAD_REQUEST",message:"Saldo acima do limite permitido."});
        const batch=await tx.insert(inventoryBatches).values({studioId:ctx.studioId,tenantMaterialId:material.id,nameSnapshot:material.name,unitSnapshot:material.unit,technicalSnapshot:materialDescription(material),receiptKey:input.receiptKey,lot:input.lot,supplierId:supplier.id,supplierName:supplier.name,expiresAt:input.expiresAt?input.expiresAt+" 23:59:59":null,receivedQuantity:input.quantity,remainingQuantity:input.quantity,unitCost:input.unitCost,receivedAt:nowSql(),createdByUserId:ctx.user.id});
        const id=insertId(batch)!;
        await tx.update(tenantMaterials).set({currentQuantity:scaledToDecimal(next,3)}).where(and(eq(tenantMaterials.id,material.id),eq(tenantMaterials.studioId,ctx.studioId)));
        await tx.insert(tenantInventoryMovements).values({studioId:ctx.studioId,tenantMaterialId:material.id,type:"entrada",quantity:input.quantity,previousQuantity:material.currentQuantity,newQuantity:scaledToDecimal(next,3),sourceType:"inventory_batch",sourceId:id,reason:`Recebimento do lote ${input.lot}`,createdByUserId:ctx.user.id});
        return {id,alreadyReceived:false};
      });
    }),
    adjustBalance: tenantProcedure.input(z.object({
      tenantMaterialId: z.number().int().positive(),
      newQuantity: quantitySchema,
      reason: z.string().trim().min(2).max(255),
      notes: z.string().trim().max(4_000).optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      return database.transaction(async (tx) => {
        const material = (await tx.select().from(tenantMaterials).where(and(
          eq(tenantMaterials.id, input.tenantMaterialId),
          eq(tenantMaterials.studioId, ctx.studioId),
          eq(tenantMaterials.isActive, 1),
        )).limit(1).for("update"))[0];
        if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "Material do estoque não encontrado nesta empresa." });
        assertOwnArtist(ctx, material.ownerArtistId);
        await assertNotLoanStock(tx, ctx.studioId, material.id);
        const previousQuantity = decimalToScaled(material.currentQuantity, 3);
        const newQuantity = decimalToScaled(input.newQuantity, 3);
        const batches=await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.studioId,ctx.studioId),eq(inventoryBatches.tenantMaterialId,material.id)));
        const tracked=batches.reduce((sum,b)=>sum+decimalToScaled(b.remainingQuantity,3),0);
        if(newQuantity<tracked)throw new TRPCError({code:"BAD_REQUEST",message:"O saldo não pode ficar abaixo da quantidade dos lotes recebidos. Confira os consumos e recebimentos."});
        const persistedPreviousQuantity = scaledToDecimal(previousQuantity, 3);
        const persistedNewQuantity = scaledToDecimal(newQuantity, 3);
        const update = await tx.update(tenantMaterials).set({ currentQuantity: persistedNewQuantity }).where(and(
          eq(tenantMaterials.id, material.id),
          eq(tenantMaterials.studioId, ctx.studioId),
          eq(tenantMaterials.currentQuantity, persistedPreviousQuantity),
        ));
        if (!isAffected(update)) throw new TRPCError({ code: "CONFLICT", message: "O estoque foi atualizado por outra operação. Atualize a tela e tente novamente." });
        await tx.insert(tenantInventoryMovements).values({
          studioId: ctx.studioId,
          tenantMaterialId: material.id,
          type: "ajuste",
          quantity: scaledToDecimal(Math.abs(newQuantity - previousQuantity), 3),
          previousQuantity: persistedPreviousQuantity,
          newQuantity: persistedNewQuantity,
          sourceType: "inventory_adjustment",
          sourceId: material.id,
          reason: input.reason,
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id,
        });
        return { id: material.id, previousQuantity: persistedPreviousQuantity, newQuantity: persistedNewQuantity };
      });
    }),

    updateDetails: tenantProcedure.input(z.object({
      tenantMaterialId: z.number().int().positive(),
      name: z.string().trim().min(2).max(255),
      category: z.string().trim().max(120).optional(),
      unit: z.string().trim().min(1).max(50),
      brand: z.string().trim().max(120).optional(),
      line: z.string().trim().max(120).optional(),
      model: z.string().trim().max(120).optional(),
      configuration: z.string().trim().max(120).optional(),
      diameter: z.string().trim().max(40).optional(),
      needleCount: z.number().int().min(1).max(1000).nullable().optional(),
      gauge: z.string().trim().max(20).nullable().optional(),
      taper: z.string().trim().max(80).nullable().optional(),
      packageQuantity: z.number().int().min(1).max(100000).nullable().optional(),
      purchaseUnit: z.string().trim().max(50).nullable().optional(),

      minimumQuantity: quantitySchema,
      unitCost: costSchema,
      lot: z.string().trim().max(120).optional(),
      expiresAt: dateTimeSchema,
      notes: z.string().trim().max(4_000).optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      return database.transaction(async tx=>{
      const existing=(await tx.select().from(tenantMaterials).where(and(eq(tenantMaterials.id,input.tenantMaterialId),eq(tenantMaterials.studioId,ctx.studioId),eq(tenantMaterials.isActive,1))).limit(1).for("update"))[0];
      if(!existing)throw new TRPCError({code:"NOT_FOUND",message:"Material não encontrado."});assertOwnArtist(ctx,existing.ownerArtistId);
      await assertNoPendingLoan(tx, ctx.studioId, existing.id);
      if(existing.unit!==input.unit){
        const batches=await tx.select({id:inventoryBatches.id}).from(inventoryBatches).where(and(eq(inventoryBatches.studioId,ctx.studioId),eq(inventoryBatches.tenantMaterialId,existing.id))).limit(1);
        if(Number(existing.currentQuantity)>0||batches.length)throw new TRPCError({code:"BAD_REQUEST",message:"Não altere a unidade de um material com saldo ou lotes recebidos. Cadastre uma variante com a nova unidade."});
      }
      const { tenantMaterialId, expiresAt, ...fields } = input;
      const result = await tx.update(tenantMaterials).set({
        ...fields,
        category: fields.category ?? null,
        brand: fields.brand ?? null,
        line: fields.line ?? null,
        model: fields.model ?? null,
        configuration: fields.configuration ?? null,
        diameter: fields.diameter ?? null,
        lot: fields.lot ?? null,
        expiresAt: expiresAt ? expiresAt.slice(0, 19).replace("T", " ") : null,
        notes: fields.notes ?? null,
      }).where(and(eq(tenantMaterials.id, tenantMaterialId), eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.isActive, 1)));
      if (!isAffected(result)) throw new TRPCError({ code: "NOT_FOUND", message: "Material do estoque não encontrado nesta empresa." });
      return { id: tenantMaterialId };
      });
    }),

    archive: tenantProcedure.input(z.object({ tenantMaterialId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      await requireOwnedMaterial(database, ctx, input.tenantMaterialId);
      await assertNoPendingLoan(database, ctx.studioId, input.tenantMaterialId);
      const result = await database.update(tenantMaterials).set({ isActive: 0 }).where(and(
        eq(tenantMaterials.id, input.tenantMaterialId),
        eq(tenantMaterials.studioId, ctx.studioId),
        eq(tenantMaterials.isActive, 1),
      ));
      if (!isAffected(result)) throw new TRPCError({ code: "NOT_FOUND", message: "Material do estoque não encontrado ou já arquivado." });
      return { id: input.tenantMaterialId, isActive: false };
    }),
  }),

  planning: router({
    clientKit: appointmentKitsRouter,
    preview: tenantProcedure.input(z.object({ artistId: z.number().int().positive(), date: z.string().refine(isStudioDate, "Informe uma data válida para a sessão."), items: z.array(z.object({ tenantMaterialId: z.number().int().positive(), quantity: quantitySchema.refine(v => Number(v) > 0) })).max(100) })).query(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments"); const database = await requireDatabase(); assertOwnArtist(ctx, input.artistId);
      const grouped = new Map<number, string[]>();
      for (const item of input.items) grouped.set(item.tenantMaterialId, [...(grouped.get(item.tenantMaterialId) ?? []), item.quantity]);
      const rows = [];
      for (const [id, demand] of Array.from(grouped)) {
        const row = await materialForecast(database, ctx.studioId, input.date, id, demand, input.artistId);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Material não encontrado." });
        await requireMaterialForArtist(database, ctx, row.material, input.artistId);
        rows.push(row);
      }
      return rows;
    }),
    updateQuantity: tenantProcedure.input(z.object({ plannedMaterialId: z.number().int().positive(), expectedQuantity: quantitySchema, quantity: quantitySchema.refine(v => Number(v) > 0) })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments", true); const database = await requireDatabase();
      const planned = await database.transaction(async tx => {
        const [row] = await tx.select({ planned: getTableColumns(appointmentPlannedMaterials), artistId: appointments.artistId, status: appointments.status }).from(appointmentPlannedMaterials).innerJoin(appointments, and(eq(appointments.id, appointmentPlannedMaterials.appointmentId), eq(appointments.studioId, ctx.studioId))).where(and(eq(appointmentPlannedMaterials.id, input.plannedMaterialId), eq(appointmentPlannedMaterials.studioId, ctx.studioId))).limit(1).for("update");
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Material previsto não encontrado." });
        assertOwnArtist(ctx, row.artistId);
        if (row.planned.status !== "planejado" || ["cancelado", "concluido"].includes(row.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "O planejamento já foi encerrado." });
        if (units(row.planned.quantityPlanned) !== units(input.expectedQuantity)) throw new TRPCError({ code: "CONFLICT", message: "A quantidade mudou. Atualize a tela e tente novamente." });
        await tx.update(appointmentPlannedMaterials).set({ quantityPlanned: workflowQuantity(units(input.quantity)) }).where(eq(appointmentPlannedMaterials.id, row.planned.id));
        return row.planned;
      });
      await syncMaterialRegistrationNotices(database, ctx.studioId, planned.appointmentId);
      if (planned.tenantMaterialId) await queueCriticalForecastAlerts(database, ctx.studioId, planned.appointmentId, planned.tenantMaterialId);
      return { id: planned.id };
    }),
    kits: router({
      list: tenantProcedure.query(async ({ ctx }) => {
        await requireModule(ctx, "appointments"); const database = await requireDatabase();
        const kits = await database.select().from(inventoryKits).where(and(eq(inventoryKits.studioId, ctx.studioId), eq(inventoryKits.isActive, 1))).orderBy(asc(inventoryKits.name));
        const items = await database.select({ id: inventoryKitItems.id, kitId: inventoryKitItems.kitId, tenantMaterialId: inventoryKitItems.tenantMaterialId, quantity: inventoryKitItems.quantity, materialName: tenantMaterials.name, unit: tenantMaterials.unit }).from(inventoryKitItems).innerJoin(tenantMaterials, and(eq(tenantMaterials.id, inventoryKitItems.tenantMaterialId), eq(tenantMaterials.studioId, ctx.studioId))).where(eq(inventoryKitItems.studioId, ctx.studioId));
        return kits.map(kit => ({ ...kit, items: items.filter(item => item.kitId === kit.id) }));
      }),
      create: tenantProcedure.input(z.object({ name: z.string().trim().min(2).max(160), description: z.string().trim().max(500).optional(), items: z.array(z.object({ tenantMaterialId: z.number().int().positive(), quantity: quantitySchema })).min(1).max(100) })).mutation(async ({ ctx, input }) => {
        await requireModule(ctx, "appointments", true); const database = await requireDatabase(); const deduplicated = new Map<number, string>(); input.items.forEach(item => deduplicated.set(item.tenantMaterialId, item.quantity));
        return database.transaction(async tx => {
          for (const tenantMaterialId of Array.from(deduplicated.keys())) { const material = (await tx.select({ id: tenantMaterials.id }).from(tenantMaterials).where(and(eq(tenantMaterials.id, tenantMaterialId), eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.isActive, 1))).limit(1))[0]; if (!material) throw new TRPCError({ code: "BAD_REQUEST", message: "Um material do kit não está disponível nesta empresa." }); }
          const inserted = await tx.insert(inventoryKits).values({ studioId: ctx.studioId, name: input.name, description: input.description ?? null, createdByUserId: ctx.user.id }); const kitId = insertId(inserted); if (!kitId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar o kit." });
          await tx.insert(inventoryKitItems).values(Array.from(deduplicated, ([tenantMaterialId, quantity]) => ({ studioId: ctx.studioId, kitId, tenantMaterialId, quantity: scaledToDecimal(decimalToScaled(quantity, 3), 3) }))); return { id: kitId };
        });
      }),
      archive: tenantProcedure.input(z.object({ kitId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireModule(ctx, "appointments", true); const database = await requireDatabase(); const result = await database.update(inventoryKits).set({ isActive: 0 }).where(and(eq(inventoryKits.id, input.kitId), eq(inventoryKits.studioId, ctx.studioId), eq(inventoryKits.isActive, 1))); if (!isAffected(result)) throw new TRPCError({ code: "NOT_FOUND", message: "Kit não encontrado." }); return { id: input.kitId }; }),
    }),
    forecast: tenantProcedure.input(z.object({ appointmentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments"); const database = await requireDatabase();
      const appointment = (await database.select({ artistId: appointments.artistId }).from(appointments).where(and(eq(appointments.id, input.appointmentId), eq(appointments.studioId, ctx.studioId))).limit(1))[0];
      if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
      assertOwnArtist(ctx, appointment.artistId);
      const planned = await database.select({ tenantMaterialId: appointmentPlannedMaterials.tenantMaterialId }).from(appointmentPlannedMaterials).where(and(eq(appointmentPlannedMaterials.studioId, ctx.studioId), eq(appointmentPlannedMaterials.appointmentId, input.appointmentId), eq(appointmentPlannedMaterials.status, "planejado")));
      const ids = Array.from(new Set(planned.map(item => item.tenantMaterialId).filter((id): id is number => id != null)));
      return Promise.all(ids.map(id => forecastAppointmentMaterial(database, ctx.studioId, input.appointmentId, id))).then(rows => rows.filter(Boolean));
    }),
    listByAppointment: tenantProcedure.input(z.object({ appointmentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments");
      const database = await requireDatabase();
      const appointment = (await database.select({ id: appointments.id, artistId: appointments.artistId }).from(appointments).where(and(
        eq(appointments.id, input.appointmentId), eq(appointments.studioId, ctx.studioId),
      )).limit(1))[0];
      if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado nesta empresa." });
      assertOwnArtist(ctx, appointment.artistId);
      return database.select().from(appointmentPlannedMaterials).where(and(
        eq(appointmentPlannedMaterials.studioId, ctx.studioId),
        eq(appointmentPlannedMaterials.appointmentId, input.appointmentId),
      )).orderBy(desc(appointmentPlannedMaterials.createdAt));
    }),

    add: tenantProcedure.input(z.object({
      appointmentId: z.number().int().positive(),
      tenantMaterialId: z.number().int().positive().optional(),
      catalogItemId: z.number().int().positive().optional(),
      quantityPlanned: quantitySchema.refine(v => Number(v) > 0),
    }).superRefine((input, refinement) => {
      if (!input.tenantMaterialId && !input.catalogItemId) refinement.addIssue({ code: "custom", message: "Selecione um material do estoque ou do catálogo.", path: ["tenantMaterialId"] });
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments", true);
      const database = await requireDatabase();
      const appointment = (await database.select({ id: appointments.id, artistId: appointments.artistId, status: appointments.status }).from(appointments).where(and(
        eq(appointments.id, input.appointmentId), eq(appointments.studioId, ctx.studioId),
      )).limit(1))[0];
      if (!appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado nesta empresa." });
      assertOwnArtist(ctx, appointment.artistId);
      if (["cancelado", "concluido"].includes(appointment.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "O agendamento já foi encerrado." });
      const material = input.tenantMaterialId ? (await database.select().from(tenantMaterials).where(and(
        eq(tenantMaterials.id, input.tenantMaterialId), eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.isActive, 1),
      )).limit(1))[0] : null;
      if (input.tenantMaterialId && !material) throw new TRPCError({ code: "NOT_FOUND", message: "Material do estoque não encontrado nesta empresa." });
      if (material) await requireMaterialForArtist(database, ctx, material, appointment.artistId);
      const catalogItem = input.catalogItemId ? (await database.select().from(materialCatalogItems).where(and(
        eq(materialCatalogItems.id, input.catalogItemId), eq(materialCatalogItems.isActive, 1),
      )).limit(1))[0] : null;
      if (input.catalogItemId && !catalogItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item de catálogo não encontrado." });
      const inserted = await database.insert(appointmentPlannedMaterials).values({
        studioId: ctx.studioId,
        appointmentId: input.appointmentId,
        tenantMaterialId: material?.id ?? null,
        catalogItemId: catalogItem?.id ?? material?.catalogItemId ?? null,
        nameSnapshot: material?.name ?? catalogItem!.name,
        unitSnapshot: material?.unit ?? catalogItem!.defaultUnit,
        quantityPlanned: scaledToDecimal(decimalToScaled(input.quantityPlanned, 3), 3),
        createdByUserId: ctx.user.id,
      });
      const id = insertId(inserted);
      const forecast = material ? await queueCriticalForecastAlerts(database, ctx.studioId, appointment.id, material.id) : null;
      return { id, forecast: forecast ? { projectedQuantity: forecast.projectedQuantity, minimumQuantity: Number(forecast.material.minimumQuantity), critical: forecast.critical, materialName: forecast.material.name, unit: forecast.material.unit } : null };
    }),

    markUnused: tenantProcedure.input(z.object({ plannedMaterialId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "appointments", true);
      const database = await requireDatabase();
      const [planned] = await database.select({ artistId: appointments.artistId, appointmentId: appointments.id }).from(appointmentPlannedMaterials).innerJoin(appointments, and(eq(appointments.id, appointmentPlannedMaterials.appointmentId), eq(appointments.studioId, ctx.studioId))).where(and(eq(appointmentPlannedMaterials.id, input.plannedMaterialId), eq(appointmentPlannedMaterials.studioId, ctx.studioId))).limit(1);
      if (!planned) throw new TRPCError({ code: "NOT_FOUND", message: "Material previsto não encontrado." });
      assertOwnArtist(ctx, planned.artistId);
      const result = await database.update(appointmentPlannedMaterials).set({ status: "nao_utilizado" }).where(and(
        eq(appointmentPlannedMaterials.id, input.plannedMaterialId),
        eq(appointmentPlannedMaterials.studioId, ctx.studioId),
        eq(appointmentPlannedMaterials.status, "planejado"),
      ));
      if (!isAffected(result)) throw new TRPCError({ code: "NOT_FOUND", message: "Material previsto não encontrado ou já tratado." });
      await syncMaterialRegistrationNotices(database, ctx.studioId, planned.appointmentId);
      return { id: input.plannedMaterialId, status: "nao_utilizado" as const };
    }),
  }),

  session: router({
    clientMaterials:tenantProcedure.input(z.object({clientId:z.number().int().positive()})).query(async({ctx,input})=>{
      await requireModule(ctx,"clients");await requireModule(ctx,"pod");const d=await requireDatabase();
      const client=(await d.select({id:clients.id}).from(clients).where(and(eq(clients.id,input.clientId),eq(clients.studioId,ctx.studioId))).limit(1))[0];
      if(!client)throw new TRPCError({code:"NOT_FOUND",message:"Cliente não encontrado."});
      if(!isInventoryManager(ctx)&&!ctx.artistId)throw new TRPCError({code:"FORBIDDEN",message:"Artista não vinculado."});
      return d.select({...getTableColumns(procedureInventoryConsumptions),artistName:artists.name,loanId:inventoryLoans.id,lenderArtistId:inventoryLoans.lenderArtistId}).from(procedureInventoryConsumptions).leftJoin(inventoryLoans,and(eq(inventoryLoans.receivedMaterialId,procedureInventoryConsumptions.tenantMaterialId),eq(inventoryLoans.studioId,ctx.studioId))).leftJoin(artists,and(eq(artists.id,procedureInventoryConsumptions.artistId),eq(artists.studioId,ctx.studioId))).where(and(eq(procedureInventoryConsumptions.studioId,ctx.studioId),eq(procedureInventoryConsumptions.clientId,input.clientId),isInventoryManager(ctx)?undefined:eq(procedureInventoryConsumptions.artistId,ctx.artistId!))).orderBy(desc(procedureInventoryConsumptions.consumedAt));
    }),

    create: tenantProcedure.input(z.object({
      clientId: z.number().int().positive(),
      appointmentId: z.number().int().positive().optional(),
      artistId: z.number().int().positive().optional(),
      title: z.string().trim().min(2).max(255).optional(),
      description: z.string().trim().max(4_000).optional(),
      bodyLocation: z.string().trim().max(100).optional(),
      tattooStyle: z.string().trim().max(100).optional(),
      chargedAmount: z.number().int().min(0).optional(),
      referenceImageUrl: z.string().url().max(500).optional(),
      referenceImageKey: z.string().trim().max(500).optional(),
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      const database = await requireDatabase();
      const client = (await database.select({ id: clients.id }).from(clients).where(and(
        eq(clients.id, input.clientId), eq(clients.studioId, ctx.studioId),
      )).limit(1))[0];
      if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado nesta empresa." });

      const appointment = input.appointmentId ? (await database.select().from(appointments).where(and(
        eq(appointments.id, input.appointmentId), eq(appointments.studioId, ctx.studioId),
      )).limit(1))[0] : null;
      if (input.appointmentId && !appointment) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado nesta empresa." });
      if (appointment && appointment.clientId !== input.clientId) throw new TRPCError({ code: "BAD_REQUEST", message: "O agendamento selecionado pertence a outro cliente." });
      if (appointment?.artistId && input.artistId && appointment.artistId !== input.artistId) throw new TRPCError({ code: "BAD_REQUEST", message: "O artista informado não corresponde ao agendamento." });

      const resolvedArtistId = input.artistId ?? appointment?.artistId ?? ctx.artistId ?? null;
      assertOwnArtist(ctx, resolvedArtistId);
      const artist = resolvedArtistId ? (await database.select().from(artists).where(and(
        eq(artists.id, resolvedArtistId), eq(artists.studioId, ctx.studioId),
      )).limit(1))[0] : null;
      if (resolvedArtistId && !artist) throw new TRPCError({ code: "NOT_FOUND", message: "Artista não encontrado nesta empresa." });

      const inserted = await database.insert(technicalProcedures).values({
        studioId: ctx.studioId,
        clientId: input.clientId,
        appointmentId: appointment?.id ?? null,
        artistId: artist?.id ?? null,
        artistName: artist?.name ?? appointment?.artist ?? null,
        title: input.title ?? appointment?.service ?? "Sessão POD",
        description: input.description ?? null,
        bodyLocation: input.bodyLocation ?? null,
        tattooStyle: input.tattooStyle ?? null,
        chargedAmount: input.chargedAmount ?? appointment?.totalAmount ?? 0,
        status: "em_andamento",
        startedAt: nowSql(),
        referenceImageUrl: appointment?.referenceImageUrl ?? input.referenceImageUrl ?? null,
        referenceImageKey: appointment?.referenceImageKey ?? input.referenceImageKey ?? null,
      });
      return { id: insertId(inserted) };
    }),

    get: tenantProcedure.input(z.object({ procedureId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await requireModule(ctx, "pod");
      const database = await requireDatabase();
      const procedure = await requireProcedure(database, input.procedureId, ctx);
      const pauses = await database.select().from(procedurePauses).where(and(
        eq(procedurePauses.procedureId, procedure.id), eq(procedurePauses.studioId, ctx.studioId),
      )).orderBy(asc(procedurePauses.startedAt));
      const consumptions = await database.select().from(procedureInventoryConsumptions).where(and(
        eq(procedureInventoryConsumptions.procedureId, procedure.id), eq(procedureInventoryConsumptions.studioId, ctx.studioId),
      )).orderBy(desc(procedureInventoryConsumptions.consumedAt));
      const plannedMaterials = procedure.appointmentId ? await database.select().from(appointmentPlannedMaterials).where(and(
        eq(appointmentPlannedMaterials.studioId, ctx.studioId), eq(appointmentPlannedMaterials.appointmentId, procedure.appointmentId),
      )) : [];
      return { procedure, pauses, consumptions, plannedMaterials, timing: calculateTiming(procedure.startedAt, procedure.finishedAt, pauses) };
    }),

    startPause: tenantProcedure.input(z.object({ procedureId: z.number().int().positive(), reason: z.string().trim().max(120).optional() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      const database = await requireDatabase();
      const procedure = await requireProcedure(database, input.procedureId, ctx);
      if (procedure.status === "finalizado") throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível pausar uma sessão finalizada." });
      const openPause = (await database.select({ id: procedurePauses.id }).from(procedurePauses).where(and(
        eq(procedurePauses.procedureId, procedure.id), eq(procedurePauses.studioId, ctx.studioId), isNull(procedurePauses.endedAt),
      )).limit(1))[0];
      if (openPause) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma pausa aberta nesta sessão." });
      const startedAt = nowSql();
      const inserted = await database.insert(procedurePauses).values({ studioId: ctx.studioId, procedureId: procedure.id, artistId: procedure.artistId, startedAt, reason: input.reason ?? null });
      await database.update(technicalProcedures).set({ status: "pausado", pausedAt: startedAt }).where(and(eq(technicalProcedures.id, procedure.id), eq(technicalProcedures.studioId, ctx.studioId)));
      return { id: insertId(inserted), startedAt };
    }),

    resumePause: tenantProcedure.input(z.object({ procedureId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      const database = await requireDatabase();
      const procedure = await requireProcedure(database, input.procedureId, ctx);
      const openPause = (await database.select().from(procedurePauses).where(and(
        eq(procedurePauses.procedureId, procedure.id), eq(procedurePauses.studioId, ctx.studioId), isNull(procedurePauses.endedAt),
      )).limit(1))[0];
      if (!openPause) throw new TRPCError({ code: "NOT_FOUND", message: "Não há pausa aberta nesta sessão." });
      const endedAt = nowSql();
      await database.update(procedurePauses).set({ endedAt }).where(and(eq(procedurePauses.id, openPause.id), eq(procedurePauses.studioId, ctx.studioId), isNull(procedurePauses.endedAt)));
      await database.update(technicalProcedures).set({ status: "em_andamento", pausedAt: null }).where(and(eq(technicalProcedures.id, procedure.id), eq(technicalProcedures.studioId, ctx.studioId)));
      return { id: openPause.id, endedAt };
    }),

    consume: tenantProcedure.input(z.object({
      procedureId: z.number().int().positive(),
      tenantMaterialId: z.number().int().positive(),
      plannedMaterialId: z.number().int().positive().optional(),
      batchId: z.number().int().positive().optional(),
      quantity: quantitySchema.refine((value) => decimalToScaled(value, 3) > 0, "A quantidade deve ser maior que zero."),
    })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      return database.transaction(async (tx) => {
        const procedure = await requireProcedure(tx as unknown as Awaited<ReturnType<typeof requireDatabase>>, input.procedureId, ctx);
        if (procedure.status === "finalizado") throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível consumir materiais em uma sessão finalizada." });
        const material = (await tx.select().from(tenantMaterials).where(and(
          eq(tenantMaterials.id, input.tenantMaterialId), eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.isActive, 1),
        )).limit(1).for("update"))[0];
        if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "Material do estoque não encontrado nesta empresa." });
        await requireMaterialForArtist(tx as unknown as InventoryDatabase, ctx, material, procedure.artistId);
        const quantity = decimalToScaled(input.quantity, 3);
        const previousQuantity = decimalToScaled(material.currentQuantity, 3);
        if (previousQuantity < quantity) throw new TRPCError({ code: "BAD_REQUEST", message: "Saldo insuficiente para confirmar este consumo." });
        const newQuantity = previousQuantity - quantity;
        const batches=await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.studioId,ctx.studioId),eq(inventoryBatches.tenantMaterialId,material.id))).for("update");
        const batch=input.batchId?batches.find(b=>b.id===input.batchId):undefined;
        if(input.batchId&&!batch)throw new TRPCError({code:"BAD_REQUEST",message:"Lote não pertence a este material e estúdio."});
        const available=batch?decimalToScaled(batch.remainingQuantity,3):previousQuantity-batches.reduce((sum,b)=>sum+decimalToScaled(b.remainingQuantity,3),0);
        if(available<quantity)throw new TRPCError({code:"BAD_REQUEST",message:batch?"Saldo insuficiente neste lote.":"Selecione o lote recebido que foi utilizado."});
        const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
        const expiry=batch?.expiresAt??(!batch?material.expiresAt:null);
        if(expiry&&String(expiry).slice(0,10)<today)throw new TRPCError({code:"BAD_REQUEST",message:"Este lote está vencido. Selecione outro material."});
        const cost=batch?.unitCost??material.unitCost;
        if(batch)await tx.update(inventoryBatches).set({remainingQuantity:scaledToDecimal(available-quantity,3)}).where(and(eq(inventoryBatches.id,batch.id),eq(inventoryBatches.studioId,ctx.studioId)));


        let plannedMaterial: typeof appointmentPlannedMaterials.$inferSelect | undefined;
        if (input.plannedMaterialId) {
          plannedMaterial = (await tx.select().from(appointmentPlannedMaterials).where(and(
            eq(appointmentPlannedMaterials.id, input.plannedMaterialId),
            eq(appointmentPlannedMaterials.studioId, ctx.studioId),
            eq(appointmentPlannedMaterials.status, "planejado"),
          )).limit(1))[0];
          if (!plannedMaterial || !procedure.appointmentId || plannedMaterial.appointmentId !== procedure.appointmentId) throw new TRPCError({ code: "BAD_REQUEST", message: "O material previsto não pertence ao agendamento desta sessão." });
          if (!plannedMaterial.tenantMaterialId) throw new TRPCError({ code: "BAD_REQUEST", message: "Vincule o material pendente ao estoque na aba Materiais / POD antes de registrar o consumo deste item." });
          if (plannedMaterial.tenantMaterialId && plannedMaterial.tenantMaterialId !== material.id) throw new TRPCError({ code: "BAD_REQUEST", message: "O material consumido não corresponde ao material previsto." });
        }

        const unitCost = decimalToScaled(cost, 4);
        const totalCost = multiplyQuantityByCost(input.quantity, cost);
        const persistedPreviousQuantity = scaledToDecimal(previousQuantity, 3);
        const persistedNewQuantity = scaledToDecimal(newQuantity, 3);
        const stockUpdate = await tx.update(tenantMaterials).set({ currentQuantity: persistedNewQuantity }).where(and(
          eq(tenantMaterials.id, material.id), eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.currentQuantity, persistedPreviousQuantity),
        ));
        if (!isAffected(stockUpdate)) throw new TRPCError({ code: "CONFLICT", message: "O estoque foi atualizado por outra operação. Atualize a sessão e tente novamente." });

        const consumption = await tx.insert(procedureInventoryConsumptions).values({
          procedureId: procedure.id,
          studioId: ctx.studioId,
          appointmentId: procedure.appointmentId,
          clientId: procedure.clientId,
          artistId: procedure.artistId,
          tenantMaterialId: material.id,
          plannedMaterialId: plannedMaterial?.id ?? null,
          nameSnapshot: batch?.nameSnapshot??material.name,
          unitSnapshot: batch?.unitSnapshot??material.unit,
          quantity: scaledToDecimal(quantity, 3),
          unitCostSnapshot: scaledToDecimal(unitCost, 4),
          totalCostSnapshot: totalCost,
          batchId: batch?.id??null,
          supplierNameSnapshot: batch?.supplierName??null,
          technicalSnapshot: batch?.technicalSnapshot??materialDescription(material),
          lotSnapshot: batch?.lot??material.lot,
          expiresAtSnapshot: batch?batch.expiresAt:material.expiresAt,
          consumedAt: nowSql(),
          createdByUserId: ctx.user.id,
        });
        const consumptionId = insertId(consumption);
        if (!consumptionId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar o consumo." });
        await tx.insert(tenantInventoryMovements).values({
          studioId: ctx.studioId,
          tenantMaterialId: material.id,
          type: "consumo",
          quantity: scaledToDecimal(quantity, 3),
          previousQuantity: persistedPreviousQuantity,
          newQuantity: persistedNewQuantity,
          sourceType: "procedure_consumption",
          sourceId: consumptionId,
          reason: `Consumo na sessão POD #${procedure.id}`,
          createdByUserId: ctx.user.id,
        });
        if (plannedMaterial) await tx.update(appointmentPlannedMaterials).set({ status: "consumido" }).where(and(eq(appointmentPlannedMaterials.id, plannedMaterial.id), eq(appointmentPlannedMaterials.studioId, ctx.studioId), eq(appointmentPlannedMaterials.status, "planejado")));
        return { id: consumptionId, remainingQuantity: persistedNewQuantity };
      });
    }),

    revertConsumption: tenantProcedure.input(z.object({ consumptionId: z.number().int().positive(), reason: z.string().trim().min(2).max(255) })).mutation(async ({ ctx, input }) => {
      await requireModule(ctx, "pod", true);
      await requireModule(ctx, "stock", true);
      const database = await requireDatabase();
      return database.transaction(async (tx) => {
        const consumption = (await tx.select().from(procedureInventoryConsumptions).where(and(
          eq(procedureInventoryConsumptions.id, input.consumptionId), eq(procedureInventoryConsumptions.studioId, ctx.studioId),
        )).limit(1))[0];
        if (!consumption) throw new TRPCError({ code: "NOT_FOUND", message: "Consumo não encontrado nesta empresa." });
        assertOwnArtist(ctx, consumption.artistId);
        if (consumption.status === "revertido") return { id: consumption.id, status: "revertido" as const, alreadyReverted: true };
        const material = (await tx.select().from(tenantMaterials).where(and(
          eq(tenantMaterials.id, consumption.tenantMaterialId), eq(tenantMaterials.studioId, ctx.studioId),
        )).limit(1))[0];
        if (!material) throw new TRPCError({ code: "NOT_FOUND", message: "O material original não existe mais nesta empresa." });
        const previousQuantity = decimalToScaled(material.currentQuantity, 3);
        const restoredQuantity = previousQuantity + decimalToScaled(consumption.quantity, 3);
        const persistedPreviousQuantity = scaledToDecimal(previousQuantity, 3);
        const persistedRestoredQuantity = scaledToDecimal(restoredQuantity, 3);
        const stockUpdate = await tx.update(tenantMaterials).set({ currentQuantity: persistedRestoredQuantity }).where(and(
          eq(tenantMaterials.id, material.id), eq(tenantMaterials.studioId, ctx.studioId), eq(tenantMaterials.currentQuantity, persistedPreviousQuantity),
        ));
        if (!isAffected(stockUpdate)) throw new TRPCError({ code: "CONFLICT", message: "O estoque foi atualizado por outra operação. Atualize a sessão e tente novamente." });
        if(consumption.batchId){
          const batch=(await tx.select().from(inventoryBatches).where(and(eq(inventoryBatches.id,consumption.batchId),eq(inventoryBatches.studioId,ctx.studioId),eq(inventoryBatches.tenantMaterialId,material.id))).limit(1).for("update"))[0];
          if(!batch)throw new TRPCError({code:"CONFLICT",message:"Lote original não encontrado; nenhuma quantidade foi alterada."});
          await tx.update(inventoryBatches).set({remainingQuantity:scaledToDecimal(decimalToScaled(batch.remainingQuantity,3)+decimalToScaled(consumption.quantity,3),3)}).where(eq(inventoryBatches.id,batch.id));
        }
        const reversalUpdate = await tx.update(procedureInventoryConsumptions).set({ status: "revertido", reversedAt: nowSql(), reversalReason: input.reason, reversedByUserId: ctx.user.id }).where(and(
          eq(procedureInventoryConsumptions.id, consumption.id), eq(procedureInventoryConsumptions.studioId, ctx.studioId), eq(procedureInventoryConsumptions.status, "consumido"),
        ));
        if (!isAffected(reversalUpdate)) throw new TRPCError({ code: "CONFLICT", message: "Este consumo já foi revertido por outra operação." });
        await tx.insert(tenantInventoryMovements).values({
          studioId: ctx.studioId,
          tenantMaterialId: material.id,
          type: "reversao",
          quantity: scaledToDecimal(decimalToScaled(consumption.quantity, 3), 3),
          previousQuantity: persistedPreviousQuantity,
          newQuantity: persistedRestoredQuantity,
          sourceType: "procedure_consumption_reversal",
          sourceId: consumption.id,
          reason: input.reason,
          createdByUserId: ctx.user.id,
        });
        return { id: consumption.id, status: "revertido" as const, alreadyReverted: false };
      });
    }),
  }),
});

export const podSaasInternals = { calculateTiming, decimalToScaled, scaledToDecimal, multiplyQuantityByCost, calculateProjectedStock };
