import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("rótulos do painel SaaS em português", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/SaaSAdmin.tsx"), "utf8");

  it("mantém os módulos traduzidos", () => {
    for (const label of ["Clientes", "Agenda", "Estoque", "Financeiro", "Anamnese", "POD", "Relatórios"]) {
      expect(source).toContain(`"${label}"`);
    }
  });

  it("mantém papéis e status traduzidos", () => {
    for (const label of ["Administrador", "Colaborador", "Usuário", "Pendente", "Aceito", "Revogado", "Expirado", "Ativo", "Suspenso"]) {
      expect(source).toContain(`"${label}"`);
    }
  });
});
