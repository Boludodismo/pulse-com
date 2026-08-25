/**
 * Sistema de Avaliação de Risco para Fichas de Anamnese
 * 
 * Calcula automaticamente o nível de risco baseado nas respostas do cliente
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFactor {
  code?: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  guidance?: string;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
}

export const RISK_ASSESSMENT_VERSION = "2026.1";

const severityWeight: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function highestSeverity(factors: RiskFactor[]): RiskLevel {
  return factors.reduce<RiskLevel>(
    (highest, factor) => severityWeight[factor.severity] > severityWeight[highest] ? factor.severity : highest,
    "low",
  );
}

function normalizedAnswer(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR");
}

function isPositive(value: unknown): boolean {
  return ["sim", "yes", "true", "1"].includes(normalizedAnswer(value));
}

function isUnknown(value: unknown): boolean {
  return ["nao_sei", "não sei", "nao sei", "talvez"].includes(normalizedAnswer(value));
}

/**
 * Avalia o formulário público completo. O resultado é apoio operacional baseado
 * em respostas autodeclaradas; não é diagnóstico nem autorização clínica.
 */
export function calculatePublicAnamneseRisk(payload: Record<string, unknown>): RiskAssessment {
  const factors: RiskFactor[] = [];
  const add = (
    code: string,
    category: string,
    description: string,
    severity: RiskLevel,
    guidance: string,
  ) => factors.push({ code, category, description, severity, guidance });

  const yesNoRules: Array<{
    key: string;
    code: string;
    category: string;
    description: string;
    severity: RiskLevel;
    guidance: string;
  }> = [
    { key: "health_medical_treatment", code: "MEDICAL_TREATMENT", category: "Tratamento médico", description: "Cliente informou estar em tratamento médico.", severity: "medium", guidance: "Revisar o tratamento, medicamentos e restrições antes do procedimento." },
    { key: "health_recent_surgery", code: "RECENT_SURGERY", category: "Cirurgia recente", description: "Cliente informou cirurgia recente.", severity: "high", guidance: "Avaliar recuperação e solicitar liberação do profissional de saúde quando aplicável." },
    { key: "health_diabetes", code: "DIABETES", category: "Diabetes", description: "Cliente informou diabetes.", severity: "high", guidance: "Confirmar controle da condição e orientar avaliação profissional devido a cicatrização e infecção." },
    { key: "health_pregnant", code: "PREGNANCY", category: "Gestação", description: "Cliente informou gestação.", severity: "critical", guidance: "Não prosseguir automaticamente; exigir avaliação individual e orientação do profissional de saúde." },
    { key: "health_hypertension", code: "HYPERTENSION", category: "Hipertensão", description: "Cliente informou hipertensão.", severity: "high", guidance: "Confirmar se está controlada e revisar medicação e condições do atendimento." },
    { key: "health_keloid", code: "KELOID", category: "Quelóide", description: "Cliente informou histórico ou tendência a quelóide.", severity: "high", guidance: "Explicar o risco de cicatrização elevada e avaliar área, histórico e conduta antes de prosseguir." },
    { key: "health_acid_use", code: "ACID_USE", category: "Uso de ácidos", description: "Cliente informou uso de ácidos na pele.", severity: "high", guidance: "Identificar produto, área e data de uso; avaliar adiamento do procedimento." },
    { key: "health_vitiligo", code: "VITILIGO", category: "Vitiligo", description: "Cliente informou vitiligo.", severity: "medium", guidance: "Avaliar estabilidade e área a ser tatuada; orientar consulta profissional quando necessário." },
    { key: "health_pacemaker", code: "PACEMAKER", category: "Marca-passo", description: "Cliente informou uso de marca-passo.", severity: "critical", guidance: "Bloquear o procedimento até avaliação individual e orientação do profissional de saúde." },
    { key: "health_cardiopathy", code: "CARDIOPATHY", category: "Cardiopatia", description: "Cliente informou condição cardíaca.", severity: "critical", guidance: "Não prosseguir automaticamente; solicitar avaliação individual e orientação do profissional de saúde." },
    { key: "health_anemia", code: "ANEMIA", category: "Anemia", description: "Cliente informou anemia.", severity: "medium", guidance: "Confirmar acompanhamento, sintomas atuais e condições para o atendimento." },
    { key: "health_transmissible_disease", code: "TRANSMISSIBLE_DISEASE", category: "Condição transmissível", description: "Cliente informou condição transmissível.", severity: "high", guidance: "Preservar confidencialidade, aplicar precauções universais e avaliar orientação profissional sem discriminação." },
    { key: "health_circulatory_disorder", code: "CIRCULATORY_DISORDER", category: "Circulação", description: "Cliente informou distúrbio circulatório.", severity: "high", guidance: "Avaliar região, gravidade e orientação do profissional de saúde antes do procedimento." },
    { key: "health_epilepsy", code: "EPILEPSY", category: "Epilepsia", description: "Cliente informou epilepsia ou convulsões.", severity: "high", guidance: "Confirmar controle, gatilhos e plano de segurança para o atendimento." },
    { key: "health_hemophilia", code: "HEMOPHILIA", category: "Hemofilia/coagulação", description: "Cliente informou hemofilia ou alteração de coagulação.", severity: "critical", guidance: "Não realizar sem avaliação e liberação específica do profissional de saúde." },
    { key: "health_healing_problem", code: "HEALING_PROBLEM", category: "Cicatrização", description: "Cliente informou problemas prévios de cicatrização.", severity: "high", guidance: "Revisar histórico, causa e local; avaliar adiamento ou liberação profissional." },
    { key: "health_tanned_skin", code: "TANNED_SKIN", category: "Pele bronzeada", description: "Cliente informou pele recentemente bronzeada.", severity: "medium", guidance: "Avaliar integridade da pele e adiar em caso de irritação, queimadura ou descamação." },
    { key: "health_depression_anxiety", code: "EMOTIONAL_HEALTH", category: "Saúde emocional", description: "Cliente informou ansiedade ou depressão.", severity: "medium", guidance: "Acolher, alinhar pausas e consentimento; verificar se está confortável para o procedimento." },
  ];

  for (const rule of yesNoRules) {
    if (isPositive(payload[rule.key])) {
      const detail = payload[`${rule.key}_detail`] || payload[`${rule.key}_details`];
      add(rule.code, rule.category, detail ? `${rule.description} Detalhe: ${String(detail)}` : rule.description, rule.severity, rule.guidance);
    } else if (isUnknown(payload[rule.key])) {
      add(`${rule.code}_UNKNOWN`, rule.category, `Cliente não soube informar: ${rule.category}.`, "medium", "Esclarecer esta resposta antes do procedimento.");
    }
  }

  if (normalizedAnswer(payload.health_ate_last_24h) === "nao") {
    add("NO_RECENT_MEAL", "Alimentação", "Cliente informou não ter se alimentado nas últimas 24 horas.", "high", "Não iniciar o procedimento sem reavaliar o estado do cliente e providenciar alimentação adequada.");
  }

  const additional = String(payload.health_additional_info ?? "").trim();
  if (additional) {
    add("ADDITIONAL_INFORMATION", "Informação adicional", additional, "medium", "Ler e registrar a avaliação desta informação antes do atendimento.");
  }

  if (factors.length === 0) {
    factors.push({
      code: "NO_REPORTED_FACTOR",
      category: "Geral",
      description: "Nenhum fator de atenção foi identificado nas respostas autodeclaradas.",
      severity: "low",
      guidance: "Manter a checagem presencial e os protocolos padrão do estúdio.",
    });
  }

  return { riskLevel: highestSeverity(factors), riskFactors: factors };
}

/**
 * Palavras-chave que indicam condições críticas
 */
const CRITICAL_CONDITIONS = [
  "hiv", "aids", "hepatite", "diabetes descompensado", "hemofilia",
  "câncer ativo", "quimioterapia", "radioterapia", "imunossupressor",
  "transplante recente", "insuficiência renal", "diálise",
  "marca-passo", "anticoagulante", "varfarina", "heparina"
];

const HIGH_RISK_CONDITIONS = [
  "diabetes", "hipertensão descontrolada", "epilepsia", "asma grave",
  "doença cardíaca", "problema cardíaco", "pressão alta descontrolada",
  "convulsão", "alergia grave", "anafilaxia", "corticoide",
  "imunossupressão", "lúpus", "artrite reumatoide"
];

const MEDIUM_RISK_CONDITIONS = [
  "hipertensão controlada", "pressão alta controlada", "asma",
  "bronquite", "rinite", "sinusite", "gastrite", "refluxo",
  "ansiedade", "depressão", "enxaqueca", "anemia"
];

/**
 * Calcula o nível de risco baseado nas respostas da anamnese
 */
export function calculateRiskLevel(data: {
  hasAllergies: boolean;
  allergiesDetails?: string | null;
  hasDiseases: boolean;
  diseasesDetails?: string | null;
  usesMedication: boolean;
  medicationDetails?: string | null;
  isPregnant: boolean;
  hasKeloid: boolean;
}): RiskAssessment {
  const riskFactors: RiskFactor[] = [];
  let maxSeverity: RiskLevel = "low";

  // Gravidez é sempre risco crítico
  if (data.isPregnant) {
    riskFactors.push({
      category: "Gravidez",
      description: "Cliente está grávida - requer avaliação médica",
      severity: "critical"
    });
    maxSeverity = "critical";
  }

  // Análise de alergias
  if (data.hasAllergies && data.allergiesDetails) {
    const allergiesLower = data.allergiesDetails.toLowerCase();
    
    if (allergiesLower.includes("anestésico") || allergiesLower.includes("lidocaína") || 
        allergiesLower.includes("anestesia") || allergiesLower.includes("benzocaína")) {
      riskFactors.push({
        category: "Alergia",
        description: "Alergia a anestésicos - CRÍTICO",
        severity: "critical"
      });
      maxSeverity = "critical";
    } else if (allergiesLower.includes("látex") || allergiesLower.includes("luva")) {
      riskFactors.push({
        category: "Alergia",
        description: "Alergia a látex - usar luvas nitrílicas",
        severity: "high"
      });
      if (maxSeverity !== "critical") maxSeverity = "high";
    } else if (allergiesLower.includes("tinta") || allergiesLower.includes("pigmento") ||
               allergiesLower.includes("corante")) {
      riskFactors.push({
        category: "Alergia",
        description: "Possível alergia a pigmentos - teste de sensibilidade recomendado",
        severity: "high"
      });
      if (maxSeverity !== "critical") maxSeverity = "high";
    } else {
      riskFactors.push({
        category: "Alergia",
        description: data.allergiesDetails,
        severity: "medium"
      });
      if (maxSeverity === "low") maxSeverity = "medium";
    }
  }

  // Análise de doenças
  if (data.hasDiseases && data.diseasesDetails) {
    const diseasesLower = data.diseasesDetails.toLowerCase();
    
    // Verifica condições críticas
    for (const condition of CRITICAL_CONDITIONS) {
      if (diseasesLower.includes(condition)) {
        riskFactors.push({
          category: "Doença",
          description: `Condição crítica detectada: ${condition.toUpperCase()} - REQUER AUTORIZAÇÃO MÉDICA`,
          severity: "critical"
        });
        maxSeverity = "critical";
        break;
      }
    }

    // Verifica condições de alto risco
    if (maxSeverity !== "critical") {
      for (const condition of HIGH_RISK_CONDITIONS) {
        if (diseasesLower.includes(condition)) {
          riskFactors.push({
            category: "Doença",
            description: `Condição de alto risco: ${condition} - avaliação cuidadosa necessária`,
            severity: "high"
          });
          maxSeverity = "high";
          break;
        }
      }
    }

    // Verifica condições de médio risco
    if (maxSeverity === "low") {
      for (const condition of MEDIUM_RISK_CONDITIONS) {
        if (diseasesLower.includes(condition)) {
          riskFactors.push({
            category: "Doença",
            description: `Condição de médio risco: ${condition}`,
            severity: "medium"
          });
          maxSeverity = "medium";
          break;
        }
      }
    }

    // Se tem doença mas não foi classificada, marca como médio risco
    if (riskFactors.filter(f => f.category === "Doença").length === 0) {
      riskFactors.push({
        category: "Doença",
        description: data.diseasesDetails,
        severity: "medium"
      });
      if (maxSeverity === "low") maxSeverity = "medium";
    }
  }

  // Análise de medicamentos
  if (data.usesMedication && data.medicationDetails) {
    const medicationLower = data.medicationDetails.toLowerCase();
    
    if (CRITICAL_CONDITIONS.some(cond => medicationLower.includes(cond))) {
      riskFactors.push({
        category: "Medicamento",
        description: "Medicamento de alto risco detectado - REQUER AUTORIZAÇÃO MÉDICA",
        severity: "critical"
      });
      maxSeverity = "critical";
    } else if (medicationLower.includes("anticoagulante") || 
               medicationLower.includes("aspirina") ||
               medicationLower.includes("ácido acetilsalicílico") ||
               medicationLower.includes("aas")) {
      riskFactors.push({
        category: "Medicamento",
        description: "Uso de anticoagulantes - risco aumentado de sangramento",
        severity: "high"
      });
      if (maxSeverity !== "critical") maxSeverity = "high";
    } else {
      riskFactors.push({
        category: "Medicamento",
        description: data.medicationDetails,
        severity: "low"
      });
    }
  }

  // Quelóide é risco médio
  if (data.hasKeloid) {
    riskFactors.push({
      category: "Quelóide",
      description: "Tendência a quelóide - cicatrização anormal possível",
      severity: "medium"
    });
    if (maxSeverity === "low") maxSeverity = "medium";
  }

  // Se não tem nenhum fator de risco, é baixo risco
  if (riskFactors.length === 0) {
    riskFactors.push({
      category: "Geral",
      description: "Nenhum fator de risco identificado",
      severity: "low"
    });
  }

  return {
    riskLevel: maxSeverity,
    riskFactors
  };
}
