import { describe, expect, it } from "vitest";
import schema from "../shared/anamnese.schema.json";
import { clientPatchFromAnamnese } from "../shared/clientPersonal";

describe("contato de emergência da anamnese", () => {
  const fields = schema.steps.find(step => step.id === "dados_pessoais")!.fields;
  const keys = ["emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"];

  it("inclui nome, telefone e vínculo como campos opcionais nos dados pessoais", () => {
    for (const key of keys) {
      expect(fields.find(field => field.key === key)).toMatchObject({ key, type: "text", required: false });
    }
    const allKeys = schema.steps.flatMap(step => step.fields.map(field => field.key));
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  it("mantém os dados no payload JSON e não substitui o telefone do cliente", () => {
    const payload = {
      client_phone: "31999990000",
      emergency_contact_name: "Contato de teste",
      emergency_contact_phone: "31988880000",
      emergency_contact_relationship: "Irmã",
    };
    const saved = JSON.parse(JSON.stringify(payload));
    expect(saved).toEqual(payload);
    expect(clientPatchFromAnamnese(saved).phone).not.toBe(payload.emergency_contact_phone);
    expect(clientPatchFromAnamnese(saved)).toEqual(clientPatchFromAnamnese({ client_phone: payload.client_phone }));
    expect(fields.filter(field => saved[field.key]).map(field => field.key)).toEqual(expect.arrayContaining(keys));
  });

  it("mantém compatibilidade com fichas antigas sem contato de emergência", () => {
    const oldPayload: Record<string, string> = { client_name: "Cliente antigo" };
    expect(fields.filter(field => oldPayload[field.key]).map(field => field.key)).toEqual(["client_name"]);
    expect(clientPatchFromAnamnese(oldPayload)).toMatchObject({ name: "Cliente antigo" });
  });
});
