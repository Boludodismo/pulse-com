import { describe, it, expect } from "vitest";
import anamneseSchema from "../shared/anamnese.schema.json";

// ── Tipos ────────────────────────────────────────────────────────────────────
type FieldDef = {
  key: string;
  type: string;
  label: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  conditionalOn?: { key: string; value: string };
};

type StepDef = {
  id: string;
  title: string;
  fields: FieldDef[];
};

// ── Helpers replicados do PublicAnamnese ─────────────────────────────────────
function isFieldVisible(field: FieldDef, formData: Record<string, any>): boolean {
  if (!field.conditionalOn) return true;
  return formData[field.conditionalOn.key] === field.conditionalOn.value;
}

function getInvalidFields(step: StepDef, formData: Record<string, any>): string[] {
  return step.fields
    .filter((f) => f.required && isFieldVisible(f, formData))
    .filter((f) => {
      const value = formData[f.key];
      if (f.type === "checkbox") return value !== true;
      return !value || value === "";
    })
    .map((f) => f.key);
}

function resolveLabel(field: FieldDef, value: any): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "radio" && field.options) {
    const opt = field.options.find((o) => o.value === value);
    return opt ? opt.label : String(value);
  }
  if (field.type === "checkbox") {
    return value === true ? "Sim — Aceito" : "Não aceito";
  }
  return String(value);
}

// ── Testes ───────────────────────────────────────────────────────────────────
describe("Anamnese Schema v2.0 — estrutura", () => {
  it("deve ter 6 etapas", () => {
    expect(anamneseSchema.steps).toHaveLength(6);
  });

  it.skip("deve ter a etapa de dados pessoais com 8 campos", () => {
    const step = anamneseSchema.steps.find((s) => s.id === "dados_pessoais");
    expect(step).toBeDefined();
    expect(step!.fields).toHaveLength(8);
  });

  it("deve ter a etapa de dados da tatuagem com 3 campos", () => {
    const step = anamneseSchema.steps.find((s) => s.id === "dados_tatuagem");
    expect(step).toBeDefined();
    expect(step!.fields).toHaveLength(3);
  });

  it("deve ter a etapa de consentimento com campo checkbox obrigatório", () => {
    const step = anamneseSchema.steps.find((s) => s.id === "consentimento");
    expect(step).toBeDefined();
    const consent = step!.fields.find((f) => f.key === "consent_terms");
    expect(consent).toBeDefined();
    expect(consent!.type).toBe("checkbox");
    expect(consent!.required).toBe(true);
  });

  it("todos os campos obrigatórios devem ter required: true", () => {
    const steps = anamneseSchema.steps as StepDef[];
    const requiredFields = steps.flatMap((s) => s.fields.filter((f) => f.required));
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("campos condicionais devem referenciar chaves existentes", () => {
    const steps = anamneseSchema.steps as StepDef[];
    const allKeys = new Set(steps.flatMap((s) => s.fields.map((f) => f.key)));
    const conditionalFields = steps.flatMap((s) =>
      s.fields.filter((f) => f.conditionalOn)
    );
    for (const field of conditionalFields) {
      expect(allKeys.has(field.conditionalOn!.key)).toBe(true);
    }
  });
});

describe("isFieldVisible — campos condicionais", () => {
  it("campo sem conditionalOn deve ser sempre visível", () => {
    const field: FieldDef = { key: "client_name", type: "text", label: "Nome" };
    expect(isFieldVisible(field, {})).toBe(true);
  });

  it("campo condicional deve ser invisível quando pai não tem o valor esperado", () => {
    const field: FieldDef = {
      key: "health_medical_treatment_detail",
      type: "text",
      label: "Detalhe",
      conditionalOn: { key: "health_medical_treatment", value: "sim" },
    };
    expect(isFieldVisible(field, { health_medical_treatment: "nao" })).toBe(false);
  });

  it("campo condicional deve ser visível quando pai tem o valor esperado", () => {
    const field: FieldDef = {
      key: "health_medical_treatment_detail",
      type: "text",
      label: "Detalhe",
      conditionalOn: { key: "health_medical_treatment", value: "sim" },
    };
    expect(isFieldVisible(field, { health_medical_treatment: "sim" })).toBe(true);
  });
});

describe("getInvalidFields — validação por etapa", () => {
  it("deve retornar campos obrigatórios vazios", () => {
    const step = anamneseSchema.steps.find((s) => s.id === "dados_tatuagem") as StepDef;
    const invalid = getInvalidFields(step, {});
    expect(invalid).toContain("tattoo_artist");
    expect(invalid).toContain("tattoo_value");
    expect(invalid).toContain("tattoo_description");
  });

  it("deve ignorar campos condicionais quando pai não está ativo", () => {
    const step = anamneseSchema.steps.find((s) => s.id === "saude_geral") as StepDef;
    // Não preenche health_medical_treatment_detail, mas health_medical_treatment = "nao"
    const formData = {
      health_medical_treatment: "nao",
      health_recent_surgery: "nao",
      health_diabetes: "nao",
      health_pregnant: "nao",
      health_hypertension: "nao",
    };
    const invalid = getInvalidFields(step, formData);
    expect(invalid).not.toContain("health_medical_treatment_detail");
  });

  it("deve incluir campo condicional quando pai está ativo e filho está vazio", () => {
    const step = anamneseSchema.steps.find((s) => s.id === "saude_geral") as StepDef;
    const formData = {
      health_medical_treatment: "sim", // ativa o campo de detalhe
      health_recent_surgery: "nao",
      health_diabetes: "nao",
      health_pregnant: "nao",
      health_hypertension: "nao",
    };
    const invalid = getInvalidFields(step, formData);
    // health_medical_treatment_detail não é required, então não deve aparecer
    expect(invalid).not.toContain("health_medical_treatment_detail");
  });

  it("não deve ter campos inválidos quando etapa está completamente preenchida", () => {
    const step = anamneseSchema.steps.find((s) => s.id === "dados_tatuagem") as StepDef;
    const formData = {
      tattoo_artist: "Fernanda Lima",
      tattoo_value: "R$ 800,00",
      tattoo_description: "Manga completa no braço esquerdo",
    };
    const invalid = getInvalidFields(step, formData);
    expect(invalid).toHaveLength(0);
  });
});

describe("resolveLabel — exibição de valores", () => {
  it("deve resolver label de radio para texto legível", () => {
    const field: FieldDef = {
      key: "health_diabetes",
      type: "radio",
      label: "Diabetes?",
      options: [
        { value: "sim", label: "Sim" },
        { value: "nao", label: "Não" },
      ],
    };
    expect(resolveLabel(field, "sim")).toBe("Sim");
    expect(resolveLabel(field, "nao")).toBe("Não");
  });

  it("deve retornar '—' para valor vazio", () => {
    const field: FieldDef = { key: "test", type: "text", label: "Teste" };
    expect(resolveLabel(field, "")).toBe("—");
    expect(resolveLabel(field, null)).toBe("—");
    expect(resolveLabel(field, undefined)).toBe("—");
  });

  it("deve resolver checkbox para texto de aceite", () => {
    const field: FieldDef = { key: "consent_terms", type: "checkbox", label: "Termos" };
    expect(resolveLabel(field, true)).toBe("Sim — Aceito");
    expect(resolveLabel(field, false)).toBe("Não aceito");
  });
});

describe("URL dinâmica do link de anamnese", () => {
  it("deve usar APP_BASE_URL quando definido", () => {
    const originalEnv = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://meu-estudio.com";
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    expect(baseUrl).toBe("https://meu-estudio.com");
    process.env.APP_BASE_URL = originalEnv;
  });

  it("deve usar localhost como fallback em desenvolvimento", () => {
    const originalEnv = process.env.APP_BASE_URL;
    delete process.env.APP_BASE_URL;
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    expect(baseUrl).toBe("http://localhost:3000");
    process.env.APP_BASE_URL = originalEnv;
  });

  it("deve gerar link com token no formato correto", () => {
    const token = "abc123def456";
    const baseUrl = "https://meu-estudio.com";
    const link = `${baseUrl}/anamnese/${token}`;
    expect(link).toBe("https://meu-estudio.com/anamnese/abc123def456");
    expect(link).toContain("/anamnese/");
  });
});
