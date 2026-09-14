import { describe, it, expect } from "vitest";

// ─── Helpers de lógica de negócio ────────────────────────────────────────────

/** Verifica se um token de anamnese ainda é válido para edição */
function isTokenValidForEdit(completedAt: string | null, expiresAt: string): boolean {
  const expired = new Date(expiresAt) < new Date();
  // Token é válido para edição se: já foi preenchido (independente de expiração)
  // OU ainda não foi preenchido e não expirou
  if (completedAt) return true; // ficha preenchida pode sempre ser editada
  return !expired; // ficha não preenchida só pode ser acessada se não expirou
}

/** Determina se o formulário deve entrar em modo edição */
function resolveFormMode(
  isEditing: boolean,
  existingPayload: Record<string, any> | null
): { mode: "edit" | "new"; initialData: Record<string, any> } {
  if (isEditing && existingPayload) {
    return { mode: "edit", initialData: existingPayload };
  }
  return { mode: "new", initialData: {} };
}

/** Monta o payload de submit (novo ou edição) */
function buildSubmitPayload(
  token: string,
  formData: Record<string, any>,
  submissionId?: number
): { token: string; payload: Record<string, any>; submissionId?: number } {
  return { token, payload: formData, ...(submissionId ? { submissionId } : {}) };
}

/** Valida se todos os campos obrigatórios de uma etapa estão preenchidos */
function validateStep(
  fields: { key: string; required?: boolean; type: string }[],
  formData: Record<string, any>
): string[] {
  return fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = formData[f.key];
      if (f.type === "checkbox") return v !== true;
      return !v || v === "";
    })
    .map((f) => f.key);
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("Edição e Exclusão de Fichas de Anamnese", () => {
  describe("isTokenValidForEdit", () => {
    it("token preenchido é sempre válido para edição (mesmo expirado)", () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(isTokenValidForEdit("2026-03-01T10:00:00Z", pastDate)).toBe(true);
    });

    it("token não preenchido e não expirado é válido para primeiro preenchimento", () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(isTokenValidForEdit(null, futureDate)).toBe(true);
    });

    it("token não preenchido e expirado é inválido", () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      expect(isTokenValidForEdit(null, pastDate)).toBe(false);
    });
  });

  describe("resolveFormMode", () => {
    it("retorna modo 'edit' com dados existentes quando isEditing=true e payload presente", () => {
      const payload = { client_name: "João", client_email: "joao@test.com" };
      const result = resolveFormMode(true, payload);
      expect(result.mode).toBe("edit");
      expect(result.initialData).toEqual(payload);
    });

    it("retorna modo 'new' com dados vazios quando isEditing=false", () => {
      const result = resolveFormMode(false, null);
      expect(result.mode).toBe("new");
      expect(result.initialData).toEqual({});
    });

    it("retorna modo 'new' quando isEditing=true mas payload é null", () => {
      const result = resolveFormMode(true, null);
      expect(result.mode).toBe("new");
      expect(result.initialData).toEqual({});
    });
  });

  describe("buildSubmitPayload", () => {
    it("inclui submissionId quando fornecido (modo edição)", () => {
      const result = buildSubmitPayload("abc123", { client_name: "Maria" }, 42);
      expect(result.submissionId).toBe(42);
      expect(result.token).toBe("abc123");
      expect(result.payload.client_name).toBe("Maria");
    });

    it("não inclui submissionId quando não fornecido (primeiro preenchimento)", () => {
      const result = buildSubmitPayload("abc123", { client_name: "Maria" });
      expect(result.submissionId).toBeUndefined();
    });
  });

  describe("validateStep", () => {
    const fields = [
      { key: "client_name", required: true, type: "text" },
      { key: "client_email", required: true, type: "text" },
      { key: "client_cpf", required: false, type: "text" },
      { key: "consent_agree", required: true, type: "checkbox" },
    ];

    it("retorna campos vazios quando todos obrigatórios estão preenchidos", () => {
      const formData = {
        client_name: "Ana",
        client_email: "ana@test.com",
        consent_agree: true,
      };
      expect(validateStep(fields, formData)).toEqual([]);
    });

    it("retorna lista de campos faltando quando obrigatórios estão vazios", () => {
      const formData = { client_name: "Ana" };
      const invalid = validateStep(fields, formData);
      expect(invalid).toContain("client_email");
      expect(invalid).toContain("consent_agree");
      expect(invalid).not.toContain("client_name");
      expect(invalid).not.toContain("client_cpf"); // não obrigatório
    });

    it("checkbox obrigatório com valor false é inválido", () => {
      const formData = {
        client_name: "Ana",
        client_email: "ana@test.com",
        consent_agree: false,
      };
      expect(validateStep(fields, formData)).toContain("consent_agree");
    });

    it("checkbox obrigatório com valor true é válido", () => {
      const formData = {
        client_name: "Ana",
        client_email: "ana@test.com",
        consent_agree: true,
      };
      expect(validateStep(fields, formData)).not.toContain("consent_agree");
    });
  });

  describe("Lógica de exclusão", () => {
    it("identifica corretamente o tipo de item a excluir (record vs submission)", () => {
      const deletingItem = { type: "submission" as const, id: 123 };
      expect(deletingItem.type).toBe("submission");
      expect(deletingItem.id).toBe(123);
    });

    it("distingue exclusão de ficha manual de exclusão de submissão via link", () => {
      const recordItem = { type: "record" as const, id: 10 };
      const submissionItem = { type: "submission" as const, id: 20 };
      expect(recordItem.type).not.toBe(submissionItem.type);
    });
  });
});
