/**
 * Sistema de Avaliação de Risco para Fichas de Anamnese
 * 
 * Calcula automaticamente o nível de risco baseado nas respostas do cliente
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFactor {
  category: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
}

const SEVERITY_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function isReported(value: unknown) {
  return ["sim", "yes", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
}

function isUncertain(value: unknown) {
  return ["talvez", "nao_sei", "não sei"].includes(String(value ?? "").trim().toLowerCase());
}

/**
 * Avalia as respostas da ficha pública. Os textos descrevem o que o cliente
 * relatou; eles são alertas operacionais e não constituem diagnóstico médico.
 */
export function assessPublicAnamnese(payload: Record<string, unknown>): RiskAssessment {
  const factors: RiskFactor[] = [];
  let riskLevel: RiskLevel = "low";
  const add = (category: string, description: string, severity: RiskLevel) => {
    factors.push({ category, description, severity });
    if (SEVERITY_ORDER[severity] > SEVERITY_ORDER[riskLevel]) riskLevel = severity;
  };
  const detail = (key: string) => String(payload[key] ?? "").trim();

  if (isReported(payload.health_pregnant)) add("Gestação", `Gestação relatada${detail("health_pregnant_weeks") ? ` (${detail("health_pregnant_weeks")})` : ""}; requer avaliação antes do procedimento.`, "critical");
  if (isReported(payload.health_hemophilia)) add("Hemofilia", "Hemofilia relatada; atenção crítica ao risco de sangramento.", "critical");
  if (isReported(payload.health_transmissible_disease)) add("Doença transmissível", `Doença transmissível relatada${detail("health_transmissible_disease_detail") ? `: ${detail("health_transmissible_disease_detail")}` : "."}`, "critical");

  if (isReported(payload.health_diabetes)) add("Diabetes", "Diabetes relatada; avaliar controle glicêmico e cicatrização.", "high");
  if (isReported(payload.health_pacemaker)) add("Marcapasso", "Uso de marcapasso relatado; requer avaliação cuidadosa.", "high");
  if (isReported(payload.health_cardiopathy)) add("Cardiopatia", "Cardiopatia relatada; requer avaliação cuidadosa.", "high");
  if (isReported(payload.health_epilepsy)) add("Convulsão / epilepsia", `Histórico relatado${detail("health_epilepsy_detail") ? `: ${detail("health_epilepsy_detail")}` : "."}`, "high");
  if (isReported(payload.health_circulatory_disorder)) add("Circulação", "Distúrbio circulatório relatado.", "high");
  if (isReported(payload.health_healing_problem)) add("Cicatrização", `Problema de cicatrização relatado${detail("health_healing_problem_detail") ? `: ${detail("health_healing_problem_detail")}` : "."}`, "high");
  if (isReported(payload.health_recent_surgery)) add("Cirurgia recente", `Cirurgia recente relatada${detail("health_recent_surgery_detail") ? `: ${detail("health_recent_surgery_detail")}` : "."}`, "high");
  if (isReported(payload.health_acid_use)) add("Uso de ácido", "Uso de ácido no local do procedimento relatado.", "high");
  if (isReported(payload.health_hypertension)) add("Pressão arterial", "Hipo/hipertensão arterial relatada.", "high");

  if (isReported(payload.health_keloid)) add("Queloide", "Cicatriz com queloide relatada; atenção à cicatrização.", "medium");
  if (isReported(payload.health_vitiligo)) add("Vitiligo", "Vitiligo relatado pelo cliente.", "medium");
  if (isReported(payload.health_anemia)) add("Anemia", "Anemia relatada pelo cliente.", "medium");
  if (isUncertain(payload.health_anemia)) add("Anemia", "Cliente informou não saber se possui anemia.", "medium");
  if (isUncertain(payload.health_transmissible_disease)) add("Doença transmissível", "Cliente informou não saber se possui doença transmissível.", "medium");
  if (isReported(payload.health_depression_anxiety)) add("Saúde emocional", "Depressão, pânico ou ansiedade relatados.", "medium");
  if (isUncertain(payload.health_depression_anxiety)) add("Saúde emocional", "Cliente respondeu “talvez” para depressão, pânico ou ansiedade.", "medium");
  if (isReported(payload.health_tanned_skin)) add("Pele bronzeada", "Pele bronzeada relatada no momento da ficha.", "medium");
  if (String(payload.health_ate_last_24h ?? "").trim().toLowerCase() === "nao") add("Alimentação", "Cliente informou não ter se alimentado nas últimas 24 horas.", "medium");
  if (isReported(payload.health_medical_treatment)) add("Tratamento médico", `Tratamento médico relatado${detail("health_medical_treatment_detail") ? `: ${detail("health_medical_treatment_detail")}` : "."}`, "medium");

  const additional = detail("health_additional_info");
  if (additional) {
    const normalized = additional.toLowerCase();
    const critical = CRITICAL_CONDITIONS.find(condition => normalized.includes(condition));
    const high = HIGH_RISK_CONDITIONS.find(condition => normalized.includes(condition));
    const medium = MEDIUM_RISK_CONDITIONS.find(condition => normalized.includes(condition));
    add("Informação adicional", additional, critical ? "critical" : high ? "high" : medium ? "medium" : "medium");
  }

  if (!factors.length) add("Geral", "Nenhum fator de atenção relatado nesta ficha.", "low");
  return { riskLevel, riskFactors: factors };
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
