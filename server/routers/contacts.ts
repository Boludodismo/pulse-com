/**
 * Router de Importação e Exportação de Contatos
 * Suporta CSV e Excel (.xlsx)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { parseCsvRfc4180 } from "../legacyAnamnesisImport";
import {
  consolidateClientDuplicates,
  normalizeDate,
  normalizeDocument,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  previewClientDeduplication,
} from "../clientDeduplication";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Cabeçalhos canônicos do template de importação */
export const CONTACT_HEADERS = [
  "nome",
  "email",
  "telefone",
  "instagram",
  "data_nascimento",
  "genero",
  "tipo_documento",
  "numero_documento",
  "cep",
  "rua",
  "numero",
  "complemento",
  "referencia",
  "bairro",
  "cidade",
  "estado",
  "pais",
];

/** Mapeamento de aliases de colunas para o campo canônico */
const COLUMN_ALIASES: Record<string, string> = {
  // nome
  nome: "nome", name: "nome", "nome completo": "nome", "full name": "nome",
  // email
  email: "email", "e-mail": "email", "e mail": "email",
  // telefone
  telefone: "telefone", phone: "telefone", celular: "telefone", whatsapp: "telefone",
  "telefone/whatsapp": "telefone", "celular/whatsapp": "telefone",
  // instagram
  instagram: "instagram", "@instagram": "instagram", "instagram/tiktok": "instagram",
  // data_nascimento
  data_nascimento: "data_nascimento", nascimento: "data_nascimento",
  "data de nascimento": "data_nascimento", birthday: "data_nascimento",
  birthdate: "data_nascimento", "data nasc": "data_nascimento",
  // genero
  genero: "genero", "gênero": "genero", gender: "genero", sexo: "genero",
  // tipo_documento
  tipo_documento: "tipo_documento", "tipo documento": "tipo_documento",
  "tipo de documento": "tipo_documento", doctype: "tipo_documento",
  // numero_documento
  numero_documento: "numero_documento", cpf: "numero_documento",
  passaporte: "numero_documento", passport: "numero_documento",
  "número documento": "numero_documento", "numero documento": "numero_documento",
  // endereço
  cep: "cep", "código postal": "cep", "codigo postal": "cep",
  rua: "rua", logradouro: "rua", street: "rua", endereço: "rua",
  endereco: "rua",
  numero: "numero", "número": "numero", "nº": "numero",
  complemento: "complemento", complement: "complemento",
  referencia: "referencia", "referência": "referencia", reference: "referencia",
  bairro: "bairro", neighborhood: "bairro",
  cidade: "cidade", city: "cidade",
  estado: "estado", state: "estado", uf: "estado",
  pais: "pais", "país": "pais", country: "pais",
};

function normalizeHeader(h: string): string {
  const clean = h.toLowerCase().trim().replace(/[_\-\s]+/g, " ");
  return COLUMN_ALIASES[clean] ?? COLUMN_ALIASES[h.toLowerCase().trim()] ?? "";
}

function normalizeGender(v: string): "Homem" | "Mulher" | "Outros" | undefined {
  const l = v.toLowerCase().trim();
  if (["homem", "masculino", "m", "male", "man"].includes(l)) return "Homem";
  if (["mulher", "feminino", "f", "female", "woman"].includes(l)) return "Mulher";
  if (["outros", "outro", "other", "nb", "não-binário", "nao-binario"].includes(l)) return "Outros";
  return undefined;
}

function normalizeDocType(v: string): "cpf" | "passport" {
  const l = v.toLowerCase().trim();
  if (["passport", "passaporte"].includes(l)) return "passport";
  return "cpf";
}

function normalizeBirthDate(v: string): string | null {
  if (!v) return null;
  // Aceitar DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const clean = v.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  // DD/MM/YYYY
  const ddmmyyyy = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  // DD-MM-YYYY
  const ddmmyyyy2 = clean.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (ddmmyyyy2) return `${ddmmyyyy2[3]}-${ddmmyyyy2[2]}-${ddmmyyyy2[1]}`;
  // Datas legadas do Google Sheets podem chegar com ano em 2 dígitos.
  const shortYear = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})$/);
  if (shortYear) {
    const year = Number(shortYear[3]);
    const fullYear = year <= new Date().getFullYear() % 100 ? 2000 + year : 1900 + year;
    return `${fullYear}-${shortYear[2].padStart(2, "0")}-${shortYear[1].padStart(2, "0")}`;
  }
  return null;
}

/** Converte array de objetos para CSV string */
function toCSV(rows: Record<string, string>[], headers: string[]): string {
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const headerRow = headers.map(escape).join(",");
  const dataRows = rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(","));
  return [headerRow, ...dataRows].join("\r\n");
}

/** Converte array de objetos para base64 de XLSX */
async function toXLSX(rows: Record<string, string>[], headers: string[]): Promise<string> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf).toString("base64");
}

/** Parseia CSV string para array de objetos com cabeçalhos normalizados */
function parseCSV(content: string): Record<string, string>[] {
  const parsed = parseCsvRfc4180(content);
  if (parsed.length < 2) return [];
  const rawHeaders = parsed[0];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  const rows: Record<string, string>[] = [];
  for (const values of parsed.slice(1)) {
    const row: Record<string, string> = {};
    normalizedHeaders.forEach((h, idx) => {
      if (h) row[h] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

/** Parseia XLSX base64 para array de objetos com cabeçalhos normalizados */
async function parseXLSX(base64: string): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buf = Buffer.from(base64, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return raw.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const canon = normalizeHeader(k);
      if (canon) normalized[canon] = String(v ?? "");
    }
    return normalized;
  });
}

// ─── Router ────────────────────────────────────────────────────────────────

export const contactsRouter = router({
  /** Exportar todos os contatos como CSV (retorna string) */
  exportCSV: protectedProcedure.query(async ({ ctx }) => {
    const allClients = await db.listClients(ctx.user.studioId ?? null);
    const rows = allClients.map((c) => ({
      nome: c.name ?? "",
      email: c.email ?? "",
      telefone: c.phone ?? "",
      instagram: c.instagram ?? "",
      data_nascimento: c.birthDate ? c.birthDate.slice(0, 10) : "",
      genero: c.gender ?? "",
      tipo_documento: c.docType ?? "cpf",
      numero_documento: c.docNumber ?? "",
      cep: c.cep ?? "",
      rua: c.street ?? "",
      numero: (c as any).number ?? "",
      complemento: c.complement ?? "",
      referencia: (c as any).reference ?? "",
      bairro: c.neighborhood ?? "",
      cidade: c.city ?? "",
      estado: c.state ?? "",
      pais: c.country ?? "Brasil",
    }));
    return { csv: toCSV(rows, CONTACT_HEADERS), count: rows.length };
  }),

  /** Exportar todos os contatos como Excel (retorna base64) */
  exportXLSX: protectedProcedure.query(async ({ ctx }) => {
    const allClients = await db.listClients(ctx.user.studioId ?? null);
    const rows = allClients.map((c) => ({
      nome: c.name ?? "",
      email: c.email ?? "",
      telefone: c.phone ?? "",
      instagram: c.instagram ?? "",
      data_nascimento: c.birthDate ? c.birthDate.slice(0, 10) : "",
      genero: c.gender ?? "",
      tipo_documento: c.docType ?? "cpf",
      numero_documento: c.docNumber ?? "",
      cep: c.cep ?? "",
      rua: c.street ?? "",
      numero: (c as any).number ?? "",
      complemento: c.complement ?? "",
      referencia: (c as any).reference ?? "",
      bairro: c.neighborhood ?? "",
      cidade: c.city ?? "",
      estado: c.state ?? "",
      pais: c.country ?? "Brasil",
    }));
    const xlsx = await toXLSX(rows, CONTACT_HEADERS);
    return { xlsx, count: rows.length };
  }),

  /** Baixar template CSV vazio */
  downloadTemplate: protectedProcedure
    .input(z.object({ format: z.enum(["csv", "xlsx"]) }))
    .query(async ({ input }) => {
      const example = [{
        nome: "João Silva",
        email: "joao@email.com",
        telefone: "11999990000",
        instagram: "@joaosilva",
        data_nascimento: "1990-05-15",
        genero: "Homem",
        tipo_documento: "cpf",
        numero_documento: "000.000.000-00",
        cep: "01310-100",
        rua: "Av. Paulista",
        numero: "1000",
        complemento: "Apto 10",
        referencia: "Próximo ao metrô",
        bairro: "Bela Vista",
        cidade: "São Paulo",
        estado: "SP",
        pais: "Brasil",
      }];
      if (input.format === "xlsx") {
        const xlsx = await toXLSX(example, CONTACT_HEADERS);
        return { format: "xlsx", data: xlsx };
      }
      return { format: "csv", data: toCSV(example, CONTACT_HEADERS) };
    }),

  /** Preview de importação: parseia o arquivo e retorna os dados sem salvar */
  previewImport: protectedProcedure
    .input(z.object({
      format: z.enum(["csv", "xlsx"]),
      content: z.string(), // CSV string ou base64 XLSX
    }))
    .mutation(async ({ input }) => {
      let rows: Record<string, string>[];
      if (input.format === "xlsx") {
        rows = await parseXLSX(input.content);
      } else {
        rows = parseCSV(input.content);
      }

      // Detectar colunas presentes
      const detectedColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

      // Validar e preparar preview (primeiros 5)
      const preview = rows.slice(0, 5).map((row, i) => ({
        row: i + 1,
        nome: row.nome || "",
        email: row.email || "",
        telefone: row.telefone || "",
        instagram: row.instagram || "",
        valid: !!row.nome,
        issues: !row.nome ? ["Nome obrigatório"] : [],
      }));

      const validCount = rows.filter((r) => !!r.nome).length;
      const invalidCount = rows.length - validCount;

      return {
        totalRows: rows.length,
        validCount,
        invalidCount,
        detectedColumns,
        preview,
      };
    }),

  /** Importar contatos: parseia e salva no banco */
  importContacts: protectedProcedure
    .input(z.object({
      format: z.enum(["csv", "xlsx"]),
      content: z.string(),
      skipDuplicates: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      let rows: Record<string, string>[];
      if (input.format === "xlsx") {
        rows = await parseXLSX(input.content);
      } else {
        rows = parseCSV(input.content);
      }

      // Determinar studioId
      let studioId = ctx.user.studioId;
      if (!studioId) {
        if (ctx.user.role === "superadmin") {
          const firstStudio = await db.getFirstStudio();
          if (!firstStudio) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Nenhum estúdio cadastrado." });
          studioId = firstStudio.id;
        } else {
          throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a um estúdio." });
        }
      }

      // O modo seguro não descarta a linha repetida: ele completa o cadastro já existente.
      const existingClients = await db.listClients(studioId);
      const results = { imported: 0, updated: 0, skipped: 0, errors: 0, errorDetails: [] as string[] };

      for (const row of rows) {
        if (!row.nome?.trim()) {
          results.errors++;
          continue;
        }

        try {
          const birthDate = normalizeBirthDate(row.data_nascimento ?? "");
          const prepared = {
            studioId,
            artistId: ctx.user.artistId ?? null,
            name: row.nome.trim(),
            email: row.email?.trim() || null,
            phone: row.telefone?.trim() || null,
            instagram: row.instagram?.trim() || null,
            birthDate: birthDate ?? null,
            gender: normalizeGender(row.genero ?? ""),
            docType: normalizeDocType(row.tipo_documento ?? "cpf"),
            docNumber: row.numero_documento?.trim() || null,
            cep: row.cep?.trim() || null,
            street: row.rua?.trim() || null,
            number: row.numero?.trim() || null,
            complement: row.complemento?.trim() || null,
            reference: row.referencia?.trim() || null,
            neighborhood: row.bairro?.trim() || null,
            city: row.cidade?.trim() || null,
            state: row.estado?.trim() || null,
            country: row.pais?.trim() || "Brasil",
          } as any;

          const rowName = normalizePersonName(prepared.name);
          const rowPhone = normalizePhone(prepared.phone);
          const rowEmail = normalizeEmail(prepared.email);
          const rowDocument = normalizeDocument(prepared.docNumber);
          const rowBirthDate = normalizeDate(prepared.birthDate);
          const duplicate = input.skipDuplicates ? existingClients.find((client) => {
            if (normalizePersonName(client.name) !== rowName) return false;
            return Boolean(
              (rowPhone && rowPhone === normalizePhone(client.phone))
              || (rowEmail && rowEmail === normalizeEmail(client.email))
              || (rowDocument && rowDocument === normalizeDocument(client.docNumber))
              || (rowBirthDate && rowBirthDate === normalizeDate(client.birthDate))
            );
          }) : undefined;

          if (duplicate) {
            const fillMissing = Object.fromEntries(Object.entries(prepared).filter(([key, value]) => {
              if (["studioId", "name"].includes(key)) return false;
              return value !== null && value !== "" && !String((duplicate as any)[key] ?? "").trim();
            }));
            if (Object.keys(fillMissing).length) {
              await db.updateClient(duplicate.id, fillMissing as any);
              Object.assign(duplicate, fillMissing);
              results.updated++;
            } else {
              results.skipped++;
            }
          } else {
            const created = await db.createClient(prepared);
            existingClients.push(created);
            results.imported++;
          }
        } catch (e: any) {
          results.errors++;
          results.errorDetails.push(`Linha "${row.nome}": ${e.message}`);
        }
      }

      return results;
    }),

  /** Analisa duplicidades sem alterar dados. */
  previewDuplicates: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem consolidar cadastros." });
    }
    let studioId = ctx.user.studioId;
    if (!studioId && ctx.user.role === "superadmin") studioId = (await db.getFirstStudio())?.id ?? null;
    if (!studioId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Estúdio não identificado." });
    return previewClientDeduplication(studioId);
  }),

  /** Consolida cadastros seguros e transfere todo o histórico ao registro principal. */
  consolidateDuplicates: protectedProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem consolidar cadastros." });
      }
      let studioId = ctx.user.studioId;
      if (!studioId && ctx.user.role === "superadmin") studioId = (await db.getFirstStudio())?.id ?? null;
      if (!studioId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Estúdio não identificado." });
      return consolidateClientDuplicates(studioId);
    }),

  /** Limpar contatos de teste (sem telefone E sem email E sem agendamentos) */
  clearTestContacts: protectedProcedure
    .input(z.object({ confirm: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem limpar dados de teste." });
      }

      const studioId = ctx.user.studioId;
      const allClients = await db.listClients(studioId ?? null);

      let deleted = 0;
      for (const c of allClients) {
        // Critério: sem telefone E sem email E sem agendamentos
        const hasContact = c.phone || c.email;
        if (!hasContact && c.appointmentCount === 0) {
          await db.deleteClient(c.id);
          deleted++;
        }
      }

      return { deleted };
    }),
});
