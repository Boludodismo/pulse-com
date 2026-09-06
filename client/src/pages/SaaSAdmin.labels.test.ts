import { describe, expect, it } from "vitest";
import {
  accessStatusLabels,
  invitationStatusLabels,
  moduleLabels,
  roleLabels,
} from "./SaaSAdmin";

describe("rótulos do painel SaaS em português", () => {
  it("traduz os módulos do sistema", () => {
    expect(Object.values(moduleLabels)).toEqual([
      "Clientes",
      "Agenda",
      "Estoque",
      "Financeiro",
      "Anamnese",
      "POD",
      "Relatórios",
    ]);
  });

  it("traduz papéis, status de convite e status de acesso", () => {
    expect(roleLabels).toMatchObject({
      admin: "Administrador",
      collaborator: "Colaborador",
      user: "Usuário",
    });
    expect(invitationStatusLabels).toMatchObject({
      pending: "Pendente",
      accepted: "Aceito",
      revoked: "Revogado",
      expired: "Expirado",
    });
    expect(accessStatusLabels).toMatchObject({
      active: "Ativo",
      suspended: "Suspenso",
      revoked: "Revogado",
    });
  });
});
