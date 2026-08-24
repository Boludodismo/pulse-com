/**
 * Gerador de arquivos iCalendar (.ics) para agendamentos de tatuagem
 * Segue o padrão RFC 5545
 */

interface AnamnesisData {
  hasAllergies: number | boolean;
  allergiesDetails?: string | null;
  hasDiseases: number | boolean;
  diseasesDetails?: string | null;
  usesMedication: number | boolean;
  medicationDetails?: string | null;
  isPregnant: number | boolean;
  hasKeloid: number | boolean;
  riskLevel?: string | null;
  observations?: string | null;
}

interface AppointmentData {
  id: number;
  date: string; // "YYYY-MM-DD HH:mm:ss"
  duration: number; // minutos
  service: string;
  artist: string;
  notes?: string | null;
  status: string;
  signalStatus?: string | null;
  paymentStatus?: string | null;
  totalAmount?: number | null;
  depositAmount?: number | null;
}

interface ClientData {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface StudioData {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
}

interface IcsOptions {
  appointment: AppointmentData;
  client: ClientData;
  studio?: StudioData | null;
  anamnesis?: AnamnesisData | null;
  anamnesisLink?: string | null;
  confirmationLink?: string | null;
  baseUrl: string;
}

/**
 * Escapa caracteres especiais para o formato iCalendar
 */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/**
 * Dobra linhas longas conforme RFC 5545 (máx 75 octetos por linha)
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

/**
 * Converte data "YYYY-MM-DD HH:mm:ss" para formato iCalendar UTC "YYYYMMDDTHHmmssZ"
 */
function toIcsDateTime(dateStr: string): string {
  // Trata a data como horário local de Brasília (UTC-3)
  const [datePart, timePart] = dateStr.split(" ");
  const [year, month, day] = datePart.split("-");
  const [hour, minute, second] = (timePart || "00:00:00").split(":");

  // Converte para UTC adicionando 3 horas (Brasília = UTC-3)
  const localDate = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second || "0")
  );
  // Ajuste para UTC-3 → UTC
  const utcDate = new Date(localDate.getTime() + 3 * 60 * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${utcDate.getUTCFullYear()}${pad(utcDate.getUTCMonth() + 1)}${pad(utcDate.getUTCDate())}T${pad(utcDate.getUTCHours())}${pad(utcDate.getUTCMinutes())}${pad(utcDate.getUTCSeconds())}Z`;
}

/**
 * Formata valor monetário em reais
 */
function formatCurrency(value?: number | null): string {
  if (!value) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

/**
 * Constrói a descrição completa do evento com dados do agendamento e anamnese
 */
function buildDescription(opts: IcsOptions): string {
  const { appointment, client, studio, anamnesis, anamnesisLink, confirmationLink } = opts;

  const lines: string[] = [];

  // === DADOS DO AGENDAMENTO ===
  lines.push("📋 DADOS DO AGENDAMENTO");
  lines.push("─────────────────────────────");
  lines.push(`Cliente: ${client.name}`);
  if (client.phone) lines.push(`Telefone: ${client.phone}`);
  if (client.email) lines.push(`E-mail: ${client.email}`);
  lines.push(`Serviço: ${appointment.service}`);
  lines.push(`Artista: ${appointment.artist}`);
  lines.push(`Duração: ${appointment.duration} minutos`);

  const statusMap: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    reagendado: "Reagendado",
  };
  lines.push(`Status: ${statusMap[appointment.status] || appointment.status}`);

  if (appointment.signalStatus) {
    const signalMap: Record<string, string> = {
      aguardando_sinal: "⏳ Aguardando Sinal",
      sinal_confirmado: "✅ Sinal Confirmado",
    };
    lines.push(`Sinal: ${signalMap[appointment.signalStatus] || appointment.signalStatus}`);
  }

  if (appointment.totalAmount) {
    lines.push(`Valor Total: ${formatCurrency(appointment.totalAmount)}`);
  }
  if (appointment.depositAmount) {
    lines.push(`Entrada/Sinal: ${formatCurrency(appointment.depositAmount)}`);
  }

  if (appointment.paymentStatus) {
    const payMap: Record<string, string> = {
      pendente: "💰 Pagamento Pendente",
      pago: "✅ Pago",
    };
    lines.push(`Pagamento: ${payMap[appointment.paymentStatus] || appointment.paymentStatus}`);
  }

  if (appointment.notes) {
    lines.push("");
    lines.push("📝 OBSERVAÇÕES DO AGENDAMENTO");
    lines.push("─────────────────────────────");
    lines.push(appointment.notes);
  }

  // === DADOS DO ESTÚDIO ===
  if (studio) {
    lines.push("");
    lines.push("🏠 ESTÚDIO");
    lines.push("─────────────────────────────");
    if (studio.name) lines.push(`Nome: ${studio.name}`);
    if (studio.address) lines.push(`Endereço: ${studio.address}`);
    if (studio.phone) lines.push(`Telefone: ${studio.phone}`);
  }

  // === ANAMNESE ===
  if (anamnesis) {
    lines.push("");
    lines.push("🩺 FICHA DE ANAMNESE");
    lines.push("─────────────────────────────");

    const hasRisk =
      anamnesis.hasAllergies ||
      anamnesis.hasDiseases ||
      anamnesis.usesMedication ||
      anamnesis.isPregnant ||
      anamnesis.hasKeloid;

    if (hasRisk) {
      lines.push("⚠️ ATENÇÃO: Cliente possui informações de saúde relevantes!");
      lines.push("");
    }

    if (anamnesis.hasAllergies) {
      lines.push("⚠️ ALERGIAS: SIM");
      if (anamnesis.allergiesDetails) {
        lines.push(`   Detalhes: ${anamnesis.allergiesDetails}`);
      }
    }

    if (anamnesis.hasDiseases) {
      lines.push("⚠️ DOENÇAS/CONDIÇÕES: SIM");
      if (anamnesis.diseasesDetails) {
        lines.push(`   Detalhes: ${anamnesis.diseasesDetails}`);
      }
    }

    if (anamnesis.usesMedication) {
      lines.push("⚠️ USO DE MEDICAMENTOS: SIM");
      if (anamnesis.medicationDetails) {
        lines.push(`   Detalhes: ${anamnesis.medicationDetails}`);
      }
    }

    if (anamnesis.isPregnant) {
      lines.push("⚠️ GESTANTE: SIM");
    }

    if (anamnesis.hasKeloid) {
      lines.push("⚠️ TENDÊNCIA A QUELÓIDE: SIM");
    }

    if (!hasRisk) {
      lines.push("✅ Sem contraindicações registradas");
    }

    if (anamnesis.riskLevel) {
      const riskMap: Record<string, string> = {
        low: "🟢 Baixo",
        medium: "🟡 Médio",
        high: "🔴 Alto",
      };
      lines.push(`Nível de Risco: ${riskMap[anamnesis.riskLevel] || anamnesis.riskLevel}`);
    }

    if (anamnesis.observations) {
      lines.push("");
      lines.push("📌 OBSERVAÇÕES DA ANAMNESE (DESTAQUE):");
      lines.push(`>>> ${anamnesis.observations} <<<`);
    }
  }

  // === LINKS ===
  lines.push("");
  lines.push("🔗 LINKS");
  lines.push("─────────────────────────────");

  if (anamnesisLink) {
    lines.push(`Ficha de Anamnese: ${anamnesisLink}`);
  } else {
    lines.push(`Ficha de Anamnese: Não preenchida`);
  }

  if (confirmationLink) {
    lines.push(`Link de Confirmação (enviar ao cliente): ${confirmationLink}`);
  }

  lines.push(`Ver Agendamento no Sistema: ${opts.baseUrl}/clients/${opts.client.id}`);

  return lines.join("\\n");
}

/**
 * Gera o conteúdo do arquivo .ics
 */
export function generateIcs(opts: IcsOptions): string {
  const { appointment, client } = opts;

  const dtStart = toIcsDateTime(appointment.date);

  // Calcular horário de fim
  const startDate = new Date(
    parseInt(appointment.date.slice(0, 4)),
    parseInt(appointment.date.slice(5, 7)) - 1,
    parseInt(appointment.date.slice(8, 10)),
    parseInt(appointment.date.slice(11, 13)),
    parseInt(appointment.date.slice(14, 16)),
    0
  );
  const endDate = new Date(startDate.getTime() + appointment.duration * 60 * 1000 + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtEnd = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}${pad(endDate.getUTCSeconds())}Z`;

  // UID único para o evento
  const uid = `appointment-${appointment.id}@tatuei.com`;

  // Timestamp de criação
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  // Título do evento
  const summary = icsEscape(`${appointment.service} — ${client.name} (${appointment.artist})`);

  // Descrição completa
  const description = buildDescription(opts);

  // Localização
  const location = opts.studio?.address
    ? icsEscape(opts.studio.address)
    : opts.studio?.name
    ? icsEscape(opts.studio.name)
    : "";

  // Alarme 24h antes
  const alarm24h = [
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Lembrete: ${icsEscape(appointment.service)} com ${icsEscape(client.name)} amanhã`,
    "END:VALARM",
  ].join("\r\n");

  // Alarme 2h antes
  const alarm2h = [
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Em 2 horas: ${icsEscape(appointment.service)} com ${icsEscape(client.name)}`,
    "END:VALARM",
  ].join("\r\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//POD CRM Tatuagem//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:POD CRM - Agendamentos",
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    foldLine(`DTSTAMP:${dtstamp}`),
    foldLine(`DTSTART:${dtStart}`),
    foldLine(`DTEND:${dtEnd}`),
    foldLine(`SUMMARY:${summary}`),
    foldLine(`DESCRIPTION:${description}`),
    ...(location ? [foldLine(`LOCATION:${location}`)] : []),
    foldLine(`URL:${opts.baseUrl}/clients/${client.id}`),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    alarm24h,
    alarm2h,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

/**
 * Gera o link para adicionar ao Google Calendar
 */
export function generateGoogleCalendarUrl(opts: IcsOptions): string {
  const { appointment, client } = opts;

  const dtStart = toIcsDateTime(appointment.date).replace("Z", "");
  // Calcular fim
  const startDate = new Date(
    parseInt(appointment.date.slice(0, 4)),
    parseInt(appointment.date.slice(5, 7)) - 1,
    parseInt(appointment.date.slice(8, 10)),
    parseInt(appointment.date.slice(11, 13)),
    parseInt(appointment.date.slice(14, 16)),
    0
  );
  const endDate = new Date(startDate.getTime() + appointment.duration * 60 * 1000 + 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtEnd = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}${pad(endDate.getUTCSeconds())}`;

  const title = encodeURIComponent(`${appointment.service} — ${client.name}`);
  const details = encodeURIComponent(
    `Artista: ${appointment.artist}\nCliente: ${client.name}${client.phone ? `\nTelefone: ${client.phone}` : ""}${appointment.notes ? `\nObservações: ${appointment.notes}` : ""}${opts.confirmationLink ? `\nLink de confirmação: ${opts.confirmationLink}` : ""}`
  );
  const location = encodeURIComponent(opts.studio?.address || opts.studio?.name || "");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}`;
}
