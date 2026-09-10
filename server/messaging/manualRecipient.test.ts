import { describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { resolveManualRecipient } from "./manualRecipient";

function database(...results: unknown[][]) {
  const conditions: any[] = [];
  const db = { select: vi.fn(() => ({ from: () => ({ where: (condition: any) => {
    conditions.push(condition);
    return { limit: async () => results.shift() ?? [] };
  } }) })) };
  return { db: db as any, conditions };
}
const client = { id: 7, name: "Cliente de teste", phone: "31999990000" };

describe("destinatário de envio manual", () => {
  it("resolve clientId omitido pelo botão usando o agendamento e normaliza o telefone", async () => {
    const { db, conditions } = database([{ clientId: 7 }], [client]);
    await expect(resolveManualRecipient(db, 3, { appointmentId: 10, recipientPhone: "+5531999990000" }))
      .resolves.toEqual({ clientId: 7, recipientName: client.name, recipientPhone: "+5531999990000" });
    const queries = conditions.map(c => new MySqlDialect().sqlToQuery(c));
    expect(queries[0].params).toEqual([10, 3]);
    expect(queries[1].params).toEqual([7, 3]);
    expect(queries.every(q => q.sql.includes("studioId"))).toBe(true);
  });
  it("mantém envio com cliente explícito sem agendamento", async () => {
    const { db } = database([client]);
    expect((await resolveManualRecipient(db, 3, { clientId: 7, recipientPhone: client.phone })).clientId).toBe(7);
  });
  it("rejeita agendamento de outra empresa ou inexistente", async () => {
    const { db } = database([]);
    await expect(resolveManualRecipient(db, 3, { appointmentId: 10, recipientPhone: client.phone })).rejects.toThrow("Agendamento não encontrado");
  });
  it("rejeita cliente divergente do agendamento", async () => {
    const { db } = database([{ clientId: 7 }]);
    await expect(resolveManualRecipient(db, 3, { appointmentId: 10, clientId: 8, recipientPhone: client.phone })).rejects.toThrow("não corresponde");
  });
  it("rejeita telefone diferente para não usar consentimento de outro destinatário", async () => {
    const { db } = database([client]);
    await expect(resolveManualRecipient(db, 3, { clientId: 7, recipientPhone: "31988880000" })).rejects.toThrow("telefone não corresponde");
  });
  it("rejeita falta de identidade antes de enfileirar", async () => {
    const { db } = database();
    await expect(resolveManualRecipient(db, 3, { recipientPhone: client.phone })).rejects.toThrow("Selecione um cliente");
    expect(db.select).not.toHaveBeenCalled();
  });
  it("rejeita cliente fora da empresa e telefone inválido", async () => {
    await expect(resolveManualRecipient(database([]).db, 3, { clientId: 7, recipientPhone: client.phone })).rejects.toThrow("Cliente não encontrado");
    await expect(resolveManualRecipient(database([{ ...client, phone: null }]).db, 3, { clientId: 7, recipientPhone: client.phone })).rejects.toThrow("telefone brasileiro válido");
  });
});
