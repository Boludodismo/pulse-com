import { describe, expect, it } from "vitest";
import type { Client } from "../drizzle/schema";
import { findDuplicateGroups } from "./clientDeduplication";

function client(values: Partial<Client> & Pick<Client, "id" | "name">): Client {
  return {
    artistId: null,
    email: null,
    phone: null,
    birthDate: null,
    instagram: null,
    cep: null,
    street: null,
    number: null,
    complement: null,
    reference: null,
    neighborhood: null,
    city: null,
    state: null,
    country: "Brasil",
    gender: null,
    docType: "cpf",
    docNumber: null,
    totalSpent: 0,
    appointmentCount: 0,
    loyaltyLevel: "Bronze",
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
    studioId: 1,
    ...values,
  };
}

describe("findDuplicateGroups", () => {
  it("reconhece o mesmo cliente com telefone brasileiro em formatos diferentes", () => {
    const groups = findDuplicateGroups([
      client({ id: 1, name: "João da Silva", phone: "(31) 99999-0000" }),
      client({ id: 2, name: "JOAO DA SILVA", phone: "+55 31 99999-0000" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toContain("telefone");
  });

  it("não mistura pessoas diferentes que compartilham um telefone", () => {
    expect(findDuplicateGroups([
      client({ id: 1, name: "Ana Souza", phone: "31999990000" }),
      client({ id: 2, name: "Bruno Souza", phone: "31999990000" }),
    ])).toHaveLength(0);
  });

  it("nunca mistura cadastros pertencentes a estúdios diferentes", () => {
    expect(findDuplicateGroups([
      client({ id: 1, studioId: 1, name: "Ana Souza", phone: "31999990000" }),
      client({ id: 2, studioId: 2, name: "Ana Souza", phone: "31999990000" }),
    ])).toHaveLength(0);
  });

  it("não une nomes iguais sem outro identificador compatível", () => {
    expect(findDuplicateGroups([
      client({ id: 1, name: "Maria Oliveira", email: "maria1@example.com" }),
      client({ id: 2, name: "Maria Oliveira", email: "maria2@example.com" }),
    ])).toHaveLength(0);
  });

  it("mantém como principal o cadastro que já possui histórico operacional", () => {
    const [group] = findDuplicateGroups([
      client({ id: 1, name: "Carlos Lima", email: "carlos@example.com" }),
      client({ id: 2, name: "Carlos Lima", email: "carlos@example.com", appointmentCount: 4 }),
    ]);

    expect(group.survivorId).toBe(2);
    expect(group.duplicateIds).toEqual([1]);
  });
});
