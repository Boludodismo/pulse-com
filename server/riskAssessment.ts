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
