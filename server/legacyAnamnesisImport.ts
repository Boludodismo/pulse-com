import { createHash, randomBytes } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  anamneseRequests,
  anamneseSubmissions,
  anamnesisRiskHistory,
  artists,
  clients,
  legacyImportBatches,
  legacyImportRows,
  postSaleFollowups,
} from "../drizzle/schema";
import { calculatePublicAnamneseRisk } from "./riskAssessment";
import { getDb, toDateStr } from "./db";

type CsvRecord = Record<string, string>;

export type LegacyPreview = {
  totalRows: number;
  selectedRows: number;
  excludedRows: number;
  estimatedUniqueClients: number;
  sourceArtists: Array<{ name: string; count: number; selected: boolean }>;
  riskCounts: Record<"low" | "medium" | "high" | "critical", number>;
  warnings: string[];
  fileHash: string;
};

const HEADER = {
  name: "Nome completo",
  timestamp: "Carimbo de data/hora",
  artist: "Qual o nome do profissional que irá fazer sua tatuagem?",
  value: "Qual o valor da sua tatuagem?",
  dob: "Data de nascimento",
  document: "CPF/ RG",
  email: "E-mail",
  address: "Endereço: RUA/ NUMERO/ BAIRRO",
  phone: "Número de telefone",
  instagram: "Instagram/ Redes sociais",
  description: "Descreva a arte e o local do corpo que vai realizar a sua tatuagem.",
  medicalTreatment: "Está em tratamento médico?",
  medicalTreatmentDetail: "Se sim, especifique",
  recentSurgery: "Cirurgia recente?",
  recentSurgeryDetail: "Se sim, descreva",
  diabetes: "Diabetes?",
  pregnant: "É gestante?",
  pregnantWeeks: "Se sim, quantas semanas?",
  hypertension: "Possui hipo/hipertensão arterial?",
  keloid: "Possui alguma cicatriz com queloide?",
  acidUse: "Faz uso de algum acido no local a ser tatuado?",
  vitiligo: "Possui Vitiligo?",
  pacemaker: "É portador de Marcapasso?",
  cardiopathy: "Possui cardiopatia?",
  anemia: "Possui Anemia?",
  transmissible: "Alguma doença transmissível?",
  transmissibleDetail: "Se sim, especifique qual é",
  circulatory: "Possui disturbio circulatório?",
  epilepsy: "Tem histórico de convulsão/ epilepsia?",
  epilepsyDetail: "Especifique se sim",
  hemophilia: "Tem hemofilia?",
  healing: "Algum problema de cicatrização?",
  healingDetail: "Caso tenha, descreva por favor.",
  tanned: "Está com a pele bronzeada?",
  emotional: "Tem Depressão/ Pânico/ Ansiedade?",
  ate: "Alimentou-se nas ultimas 24h?",
  additional: "Existe algum problema que julga ser necessário informar ao profissional?",
  consent: "Autorizo a realização do procedimento e o registro fotográfico",
  formDate: "Data do preenchimento da ficha de anamnese",
  location: "CIDADE/ ESTADO/ PAIS",
} as const;

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function canonicalHeader(value: string) {
  return normalized(value.replace(/\r?\n/g, " ").replace(/\s*:\s*/g, ": "));
}

export function parseCsvRfc4180(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = content.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  if (quoted) throw new Error("CSV inválido: campo entre aspas não foi encerrado.");
  return rows;
}

function recordsFromCsv(content: string): CsvRecord[] {
  const rows = parseCsvRfc4180(content);
  if (rows.length < 2) throw new Error("O CSV não possui registros para importar.");
  const headers = rows[0].map(canonicalHeader);
  const required = [HEADER.name, HEADER.artist, HEADER.email, HEADER.description].map(canonicalHeader);
  const missing = required.filter((key) => !headers.includes(key));
  if (missing.length) throw new Error("O arquivo não corresponde ao formulário de anamnese esperado.");
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()])));
}

function read(record: CsvRecord, header: string) {
  const target = canonicalHeader(header);
  const exact = record[target];
  if (exact !== undefined) return exact;
  const partial = Object.entries(record).find(([key]) => key.startsWith(target));
  return partial?.[1] ?? "";
}

function yesNo(value: string) {
  const answer = normalized(value);
  if (!answer) return "nao";
  if (answer.startsWith("sim") || ["yes", "true", "1"].includes(answer)) return "sim";
  if (answer.includes("nao sei") || answer.includes("não sei")) return "nao_sei";
  return "nao";
}

function cleanAdditional(value: string) {
  const answer = normalized(value).replace(/[.!?]/g, "");
  return ["", "nao", "nenhum", "nenhuma", "nada", "n/a", "na"].includes(answer) ? "" : value.trim();
}

function parseBrazilianDate(value: string): string | null {
  const clean = value.trim();
  let match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")} 10:00:00`;
  match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")} 10:00:00`;
  return null;
}

function parseTimestamp(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return parseBrazilianDate(value);
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")} ${match[4].padStart(2, "0")}:${match[5]}:${match[6] ?? "00"}`;
}

function parseAddress(value: string) {
  const raw = value.trim();
  const parts = raw.split(/\s*(?:,|\/|\n)\s*/).filter(Boolean);
  if (parts.length >= 3) return { street: parts[0], number: parts[1], neighborhood: parts[2], complement: parts.slice(3).join(", ") };
  return { street: raw, number: "", neighborhood: "", complement: "" };
}

function parseLocation(value: string) {
  const parts = value.trim().split(/\s*(?:\/|,|\n)\s*/).filter(Boolean);
  return { city: parts[0] ?? "", state: parts[1] ?? "", country: parts.slice(2).join(" / ") || "Brasil" };
}

function documentType(value: string): "cpf" | "rg" | "other" {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return "cpf";
  if (digits.length >= 7 && digits.length <= 10) return "rg";
  return "other";
}

function rowPayload(record: CsvRecord) {
  const address = parseAddress(read(record, HEADER.address));
  const location = parseLocation(read(record, HEADER.location));
  return {
    client_name: read(record, HEADER.name),
    client_dob: read(record, HEADER.dob),
    client_cpf_rg: read(record, HEADER.document),
    client_email: read(record, HEADER.email),
    client_street: address.street,
    client_number: address.number,
    client_neighborhood: address.neighborhood,
    client_complement: address.complement,
    client_city: location.city,
    client_state: location.state,
    client_country: location.country,
    client_phone: read(record, HEADER.phone),
    client_instagram: read(record, HEADER.instagram),
    tattoo_artist: read(record, HEADER.artist),
    tattoo_value: read(record, HEADER.value),
    tattoo_description: read(record, HEADER.description),
    health_medical_treatment: yesNo(read(record, HEADER.medicalTreatment)),
    health_medical_treatment_detail: read(record, HEADER.medicalTreatmentDetail),
    health_recent_surgery: yesNo(read(record, HEADER.recentSurgery)),
    health_recent_surgery_detail: read(record, HEADER.recentSurgeryDetail),
    health_diabetes: yesNo(read(record, HEADER.diabetes)),
    health_pregnant: yesNo(read(record, HEADER.pregnant)),
    health_pregnant_detail: read(record, HEADER.pregnantWeeks),
    health_hypertension: yesNo(read(record, HEADER.hypertension)),
    health_keloid: yesNo(read(record, HEADER.keloid)),
    health_acid_use: yesNo(read(record, HEADER.acidUse)),
    health_vitiligo: yesNo(read(record, HEADER.vitiligo)),
    health_pacemaker: yesNo(read(record, HEADER.pacemaker)),
    health_cardiopathy: yesNo(read(record, HEADER.cardiopathy)),
    health_anemia: yesNo(read(record, HEADER.anemia)),
    health_transmissible_disease: yesNo(read(record, HEADER.transmissible)),
    health_transmissible_disease_detail: read(record, HEADER.transmissibleDetail),
    health_circulatory_disorder: yesNo(read(record, HEADER.circulatory)),
    health_epilepsy: yesNo(read(record, HEADER.epilepsy)),
    health_epilepsy_detail: read(record, HEADER.epilepsyDetail),
    health_hemophilia: yesNo(read(record, HEADER.hemophilia)),
    health_healing_problem: yesNo(read(record, HEADER.healing)),
    health_healing_problem_detail: read(record, HEADER.healingDetail),
    health_tanned_skin: yesNo(read(record, HEADER.tanned)),
    health_depression_anxiety: yesNo(read(record, HEADER.emotional)),
    health_ate_last_24h: yesNo(read(record, HEADER.ate)),
    health_additional_info: cleanAdditional(read(record, HEADER.additional)),
    consent_terms: yesNo(read(record, HEADER.consent)) === "sim",
    consent_date: read(record, HEADER.formDate),
    legacy_full_address: read(record, HEADER.address),
    legacy_location: read(record, HEADER.location),
    legacy_form_timestamp: read(record, HEADER.timestamp),
    legacy_source: "Google Forms — Anamnese 2024",
  };
}

function identityKey(payload: ReturnType<typeof rowPayload>) {
  const doc = payload.client_cpf_rg.replace(/\D/g, "");
  const email = normalized(payload.client_email);
  const phone = payload.client_phone.replace(/\D/g, "");
  return doc.length >= 7 ? `doc:${doc}` : email ? `email:${email}` : `phone:${phone}`;
}

function rowFingerprint(record: CsvRecord) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

export function nextAnnualFollowup(referenceDate: string, now = new Date()) {
  const [year, month, day] = referenceDate.slice(0, 10).split("-").map(Number);
  let anniversaryYears = Math.max(1, now.getFullYear() - year);
  let date = new Date(now.getFullYear(), month - 1, day, 10, 0, 0);
  if (date.getTime() <= now.getTime()) {
    date = new Date(now.getFullYear() + 1, month - 1, day, 10, 0, 0);
    anniversaryYears += 1;
  }
  return { scheduledAt: toDateStr(date), anniversaryYears };
}

function selectedRecords(content: string, selectedArtists: string[]) {
  const selected = new Set(selectedArtists.map(normalized));
  return recordsFromCsv(content).filter((record) => selected.has(normalized(read(record, HEADER.artist))));
}

export function previewLegacyAnamnesisCsv(content: string, selectedArtists: string[]): LegacyPreview {
  const records = recordsFromCsv(content);
  const artistCounts = new Map<string, { display: string; count: number }>();
  for (const record of records) {
    const display = read(record, HEADER.artist).trim() || "(sem artista)";
    const key = normalized(display);
    const current = artistCounts.get(key) ?? { display, count: 0 };
    current.count += 1;
    artistCounts.set(key, current);
  }
  const selected = new Set(selectedArtists.map(normalized));
  const rows = records.filter((record) => selected.has(normalized(read(record, HEADER.artist))));
  const identities = new Set(rows.map((record) => identityKey(rowPayload(record))));
  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  let missingPhone = 0;
  let invalidDate = 0;
  let consentDenied = 0;
  for (const record of rows) {
    const payload = rowPayload(record);
    riskCounts[calculatePublicAnamneseRisk(payload).riskLevel] += 1;
    if (!payload.client_phone.replace(/\D/g, "")) missingPhone += 1;
    if (!parseBrazilianDate(read(record, HEADER.formDate)) && !parseTimestamp(read(record, HEADER.timestamp))) invalidDate += 1;
    if (!payload.consent_terms) consentDenied += 1;
  }
  const warnings = [
    "A data histórica será marcada como informada/inferida e poderá ser corrigida no perfil do cliente.",
    "Nenhum agendamento ou lançamento financeiro será criado.",
  ];
  if (missingPhone) warnings.push(`${missingPhone} ficha(s) sem telefone completo.`);
  if (invalidDate) warnings.push(`${invalidDate} ficha(s) sem data histórica reconhecível.`);
  if (consentDenied) warnings.push(`${consentDenied} ficha(s) sem aceite registrado; serão preservadas com alerta.`);
  return {
    totalRows: records.length,
    selectedRows: rows.length,
    excludedRows: records.length - rows.length,
    estimatedUniqueClients: identities.size,
    sourceArtists: Array.from(artistCounts.entries()).map(([key, item]) => ({ name: item.display, count: item.count, selected: selected.has(key) })).sort((a, b) => b.count - a.count),
    riskCounts,
    warnings,
    fileHash: createHash("sha256").update(content).digest("hex"),
  };
}

export async function importLegacyAnamnesisCsv(input: {
  content: string;
  fileName: string;
  selectedArtists: string[];
  targetArtistId: number;
  studioId: number;
  userId: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const preview = previewLegacyAnamnesisCsv(input.content, input.selectedArtists);
  if (!preview.selectedRows) throw new Error("Nenhuma ficha corresponde aos artistas selecionados.");
  const [targetArtist] = await database.select().from(artists).where(and(eq(artists.id, input.targetArtistId), eq(artists.studioId, input.studioId))).limit(1);
  if (!targetArtist) throw new Error("Artista de destino não pertence a este estúdio.");
  const existingBatch = await database.select({ id: legacyImportBatches.id }).from(legacyImportBatches).where(and(
    eq(legacyImportBatches.studioId, input.studioId),
    eq(legacyImportBatches.targetArtistId, input.targetArtistId),
    eq(legacyImportBatches.fileHash, preview.fileHash),
  )).limit(1);
  if (existingBatch.length) throw new Error("Este mesmo arquivo já foi importado para o artista selecionado.");

  const [batchInsert] = await database.insert(legacyImportBatches).values({
    studioId: input.studioId,
    targetArtistId: input.targetArtistId,
    createdByUserId: input.userId,
    fileName: input.fileName.slice(0, 255),
    fileHash: preview.fileHash,
    selectedArtistsJson: JSON.stringify(input.selectedArtists),
    totalRows: preview.selectedRows,
  });
  const batchId = Number(batchInsert.insertId);
  const records = selectedRecords(input.content, input.selectedArtists);
  const allClients = await database.select().from(clients).where(eq(clients.studioId, input.studioId));
  const byDoc = new Map<string, number>();
  const byEmail = new Map<string, number>();
  const byPhone = new Map<string, number>();
  for (const client of allClients) {
    const doc = (client.docNumber ?? "").replace(/\D/g, "");
    const email = normalized(client.email ?? "");
    const phone = (client.phone ?? "").replace(/\D/g, "");
    if (doc.length >= 7) byDoc.set(doc, client.id);
    if (email) byEmail.set(email, client.id);
    if (phone.length >= 8) byPhone.set(phone, client.id);
  }
  const existingRows = await database.select({ fingerprint: legacyImportRows.fingerprint }).from(legacyImportRows).where(eq(legacyImportRows.studioId, input.studioId));
  const fingerprints = new Set(existingRows.map((row) => row.fingerprint));
  let importedRows = 0, skippedRows = 0, errorRows = 0, createdClients = 0, updatedClients = 0;

  try {
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const payload = rowPayload(record);
      const fingerprint = rowFingerprint(record);
      if (fingerprints.has(fingerprint)) {
        skippedRows += 1;
        await database.insert(legacyImportRows).values({ batchId, studioId: input.studioId, sourceRowNumber: index + 2, fingerprint: createHash("sha256").update(`${fingerprint}:${batchId}`).digest("hex"), status: "skipped", issuesJson: JSON.stringify(["Ficha já importada anteriormente."]) });
        continue;
      }
      try {
        const docDigits = payload.client_cpf_rg.replace(/\D/g, "");
        const emailKey = normalized(payload.client_email);
        const phoneDigits = payload.client_phone.replace(/\D/g, "");
        const candidates = new Set<number>();
        if (docDigits.length >= 7 && byDoc.has(docDigits)) candidates.add(byDoc.get(docDigits)!);
        if (emailKey && byEmail.has(emailKey)) candidates.add(byEmail.get(emailKey)!);
        if (phoneDigits.length >= 8 && byPhone.has(phoneDigits)) candidates.add(byPhone.get(phoneDigits)!);
        if (candidates.size > 1) throw new Error("Documento, e-mail e telefone apontam para clientes diferentes; revisão manual necessária.");
        let clientId = Array.from(candidates)[0];
        const address = parseAddress(payload.legacy_full_address);
        const location = parseLocation(payload.legacy_location);
        const birthDate = parseBrazilianDate(payload.client_dob);
        if (!clientId) {
          const [inserted] = await database.insert(clients).values({
            studioId: input.studioId, artistId: input.targetArtistId, name: payload.client_name || "Cliente sem nome",
            email: payload.client_email || null, phone: payload.client_phone || null, birthDate,
            instagram: payload.client_instagram || null, street: address.street || null, number: address.number || null,
            neighborhood: address.neighborhood || null, complement: address.complement || null,
            city: location.city || null, state: location.state || null, country: location.country || "Brasil",
            docType: documentType(payload.client_cpf_rg), docNumber: payload.client_cpf_rg || null,
          });
          clientId = Number(inserted.insertId);
          createdClients += 1;
          if (docDigits.length >= 7) byDoc.set(docDigits, clientId);
          if (emailKey) byEmail.set(emailKey, clientId);
          if (phoneDigits.length >= 8) byPhone.set(phoneDigits, clientId);
        } else {
          const current = allClients.find((client) => client.id === clientId);
          const updates: Record<string, unknown> = { artistId: current?.artistId ?? input.targetArtistId };
          if (!current?.email && payload.client_email) updates.email = payload.client_email;
          if (!current?.phone && payload.client_phone) updates.phone = payload.client_phone;
          if (!current?.birthDate && birthDate) updates.birthDate = birthDate;
          if (!current?.instagram && payload.client_instagram) updates.instagram = payload.client_instagram;
          if (!current?.street && address.street) updates.street = address.street;
          if (!current?.number && address.number) updates.number = address.number;
          if (!current?.neighborhood && address.neighborhood) updates.neighborhood = address.neighborhood;
          if (!current?.complement && address.complement) updates.complement = address.complement;
          if (!current?.city && location.city) updates.city = location.city;
          if (!current?.state && location.state) updates.state = location.state;
          if (!current?.docNumber && payload.client_cpf_rg) { updates.docNumber = payload.client_cpf_rg; updates.docType = documentType(payload.client_cpf_rg); }
          if (Object.keys(updates).length > 1 || (current && !current.artistId)) {
            await database.update(clients).set(updates).where(eq(clients.id, clientId));
            updatedClients += 1;
          }
        }

        const submittedAt = parseTimestamp(read(record, HEADER.timestamp)) ?? toDateStr(new Date());
        const procedureDate = parseBrazilianDate(read(record, HEADER.formDate)) ?? submittedAt;
        const [requestInsert] = await database.insert(anamneseRequests).values({
          clientId, token: `legacy-${randomBytes(24).toString("hex")}`, sentVia: "email", sentTo: payload.client_email || "importacao-historica@local.invalid",
          expiresAt: "2099-12-31 23:59:59", completedAt: submittedAt, statusRequest: "preenchida", createdAt: submittedAt,
          source: "legacy_csv", importBatchId: batchId, originalArtistName: payload.tattoo_artist, procedureDate, procedureDateStatus: "inferred",
        });
        const requestId = Number(requestInsert.insertId);
        const assessment = calculatePublicAnamneseRisk(payload);
        const [submissionInsert] = await database.insert(anamneseSubmissions).values({
          requestId, clientId, payloadJson: JSON.stringify(payload), riskLevel: assessment.riskLevel,
          riskFactors: JSON.stringify(assessment.riskFactors), riskVersion: "2026.1", createdAt: submittedAt,
        });
        const submissionId = Number(submissionInsert.insertId);
        await database.insert(anamnesisRiskHistory).values({
          studioId: input.studioId, clientId, submissionId, source: "legacy_csv", eventType: "created",
          riskLevel: assessment.riskLevel, riskFactors: JSON.stringify(assessment.riskFactors), riskVersion: "2026.1", createdAt: submittedAt,
        });
        const annual = nextAnnualFollowup(procedureDate);
        const [followupInsert] = await database.insert(postSaleFollowups).values({
          appointmentId: null, anamnesisSubmissionId: submissionId, clientId, artistId: input.targetArtistId,
          studioId: input.studioId, stage: "anniversary_365d", scheduledAt: annual.scheduledAt,
          status: "scheduled", deliveryMode: "manual", source: "legacy_anamnesis", referenceDate: procedureDate,
          serviceSnapshot: payload.tattoo_description, artistNameSnapshot: targetArtist.name, anniversaryYears: annual.anniversaryYears,
        });
        await database.insert(legacyImportRows).values({
          batchId, studioId: input.studioId, sourceRowNumber: index + 2, fingerprint, clientId, requestId,
          submissionId, followupId: Number(followupInsert.insertId), status: "imported", rawPayloadJson: JSON.stringify(payload),
        });
        fingerprints.add(fingerprint);
        importedRows += 1;
      } catch (error) {
        errorRows += 1;
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        await database.insert(legacyImportRows).values({
          batchId, studioId: input.studioId, sourceRowNumber: index + 2,
          fingerprint: createHash("sha256").update(`${fingerprint}:error:${batchId}`).digest("hex"), status: "error", issuesJson: JSON.stringify([message]),
        });
      }
    }
    await database.update(legacyImportBatches).set({ status: "completed", importedRows, skippedRows, errorRows, createdClients, updatedClients, completedAt: toDateStr(new Date()) }).where(eq(legacyImportBatches.id, batchId));
    return { batchId, importedRows, skippedRows, errorRows, createdClients, updatedClients };
  } catch (error) {
    await database.update(legacyImportBatches).set({ status: "failed", importedRows, skippedRows, errorRows: errorRows + 1, createdClients, updatedClients, completedAt: toDateStr(new Date()) }).where(eq(legacyImportBatches.id, batchId));
    throw error;
  }
}

export async function listLegacyImportBatches(studioId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(legacyImportBatches).where(eq(legacyImportBatches.studioId, studioId));
}

export async function confirmLegacyProcedureDate(input: { requestId: number; studioId: number; procedureDate: string }) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const [request] = await database.select({
    id: anamneseRequests.id,
    source: anamneseRequests.source,
    clientStudioId: clients.studioId,
    submissionId: anamneseSubmissions.id,
  }).from(anamneseRequests)
    .leftJoin(clients, eq(anamneseRequests.clientId, clients.id))
    .leftJoin(anamneseSubmissions, eq(anamneseSubmissions.requestId, anamneseRequests.id))
    .where(eq(anamneseRequests.id, input.requestId)).limit(1);
  if (!request || request.clientStudioId !== input.studioId || request.source !== "legacy_csv") throw new Error("Ficha histórica não encontrada.");
  const date = parseBrazilianDate(input.procedureDate) ?? (input.procedureDate.match(/^\d{4}-\d{2}-\d{2}$/) ? `${input.procedureDate} 10:00:00` : null);
  if (!date) throw new Error("Data inválida.");
  await database.update(anamneseRequests).set({ procedureDate: date, procedureDateStatus: "confirmed" }).where(eq(anamneseRequests.id, input.requestId));
  if (request.submissionId) {
    const annual = nextAnnualFollowup(date);
    await database.update(postSaleFollowups).set({ referenceDate: date, scheduledAt: annual.scheduledAt, anniversaryYears: annual.anniversaryYears, status: "scheduled" })
      .where(and(eq(postSaleFollowups.anamnesisSubmissionId, request.submissionId), eq(postSaleFollowups.stage, "anniversary_365d")));
  }
  return { success: true };
}
