import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// Mock global do fetch para evitar chamadas reais ao Google Sheets durante testes
beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: async () => ({ sucesso: true, mensagem: "mock" }),
    ok: true,
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});


// Mock context para admin
const createAdminContext = (): Context => ({
  req: {
    ip: "127.0.0.1",
    headers: { "user-agent": "Test Browser" },
    socket: { remoteAddress: "127.0.0.1" },
  } as any,
  res: {} as any,
  user: {
    id: 1,
    openId: "admin-template-test",
    name: "Admin Template Test",
    email: "admin-template@test.com",
    role: "admin",
    artistId: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "test",
  },
});

describe("Report Templates", () => {
  it("should create a new template", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    const result = await caller.reportTemplates.create({
      name: "Template Teste",
      description: "Template de teste",
      includeSections: ["metrics", "actionsByType"],
      sectionOrder: ["metrics", "actionsByType"],
      logsLimit: 50,
      usersLimit: 10,
      reportTitle: "Relatório Personalizado",
      reportSubtitle: "Subtítulo teste",
      primaryColor: "#ff0000",
      footerText: "Rodapé personalizado",
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("should list templates", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // Criar template primeiro
    await caller.reportTemplates.create({
      name: "Template Lista",
      includeSections: ["metrics"],
      sectionOrder: ["metrics"],
      logsLimit: 20,
      usersLimit: 5,
    });

    const templates = await caller.reportTemplates.list();

    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0]).toHaveProperty("id");
    expect(templates[0]).toHaveProperty("name");
    expect(templates[0]).toHaveProperty("includeSections");
    expect(Array.isArray(templates[0].includeSections)).toBe(true);
  });

  it("should get a specific template", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // Criar template
    const created = await caller.reportTemplates.create({
      name: "Template Get",
      includeSections: ["metrics", "topUsers"],
      sectionOrder: ["metrics", "topUsers"],
      logsLimit: 30,
      usersLimit: 15,
    });

    const template = await caller.reportTemplates.get({ id: created.id });

    expect(template).toBeDefined();
    expect(template?.id).toBe(created.id);
    expect(template?.name).toBe("Template Get");
    expect(template?.logsLimit).toBe(30);
    expect(template?.usersLimit).toBe(15);
  });

  it("should update a template", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // Criar template
    const created = await caller.reportTemplates.create({
      name: "Template Original",
      includeSections: ["metrics"],
      sectionOrder: ["metrics"],
      logsLimit: 20,
      usersLimit: 5,
    });

    // Atualizar
    await caller.reportTemplates.update({
      id: created.id,
      name: "Template Atualizado",
      logsLimit: 100,
    });

    const updated = await caller.reportTemplates.get({ id: created.id });

    expect(updated?.name).toBe("Template Atualizado");
    expect(updated?.logsLimit).toBe(100);
  });

  it("should delete a template", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    // Criar template
    const created = await caller.reportTemplates.create({
      name: "Template Delete",
      includeSections: ["metrics"],
      sectionOrder: ["metrics"],
      logsLimit: 20,
      usersLimit: 5,
    });

    // Deletar
    await caller.reportTemplates.delete({ id: created.id });

    // Tentar buscar (deve retornar null)
    const deleted = await caller.reportTemplates.get({ id: created.id });
    expect(deleted).toBeNull();
  });

  it("should deny access to non-admin users", async () => {
    const userContext: Context = {
      req: {
        ip: "127.0.0.1",
        headers: { "user-agent": "Test Browser" },
        socket: { remoteAddress: "127.0.0.1" },
      } as any,
      res: {} as any,
      user: {
        id: 2,
        openId: "regular-user",
        name: "Regular User",
        email: "user@test.com",
        role: "collaborator",
        artistId: null,
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: "test",
      },
    };

    const caller = appRouter.createCaller(userContext);

    await expect(
      caller.reportTemplates.create({
        name: "Template Unauthorized",
        includeSections: ["metrics"],
        sectionOrder: ["metrics"],
        logsLimit: 20,
        usersLimit: 5,
      })
    ).rejects.toThrow("Acesso negado");
  });

  it("should export PDF with custom template", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const result = await caller.audit.exportPDF({
      startDate,
      endDate,
      logsLimit: 10,
      usersLimit: 3,
      template: {
        includeSections: ["metrics", "actionsByType"],
        reportTitle: "Relatório Customizado",
        reportSubtitle: "Teste de customização",
        primaryColor: "#00ff00",
        footerText: "Rodapé teste",
      },
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("pdf");
    expect(result).toHaveProperty("filename");
    expect(typeof result.pdf).toBe("string");

    // Verificar se é base64 válido
    const buffer = Buffer.from(result.pdf, "base64");
    expect(buffer.length).toBeGreaterThan(0);

    // Verificar assinatura de PDF
    const pdfSignature = buffer.toString("utf8", 0, 4);
    expect(pdfSignature).toBe("%PDF");
  });
});
