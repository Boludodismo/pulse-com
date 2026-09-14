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
    openId: "admin-pdf-test",
    name: "Admin PDF Test",
    email: "admin-pdf@test.com",
    role: "admin",
    artistId: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "test",
  },
});

describe("Audit PDF Export", () => {
  it("should generate PDF report successfully", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const result = await caller.audit.exportPDF({ startDate, endDate });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("pdf");
    expect(result).toHaveProperty("filename");
    expect(typeof result.pdf).toBe("string");
    expect(typeof result.filename).toBe("string");
    expect(result.filename).toMatch(/^relatorio-auditoria-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("should return valid base64 encoded PDF", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const result = await caller.audit.exportPDF({ startDate, endDate });

    // Verificar se é base64 válido
    expect(() => Buffer.from(result.pdf, "base64")).not.toThrow();
    
    // Verificar se o buffer decodificado tem conteúdo
    const buffer = Buffer.from(result.pdf, "base64");
    expect(buffer.length).toBeGreaterThan(0);
    
    // Verificar se começa com assinatura de PDF (%PDF)
    const pdfSignature = buffer.toString("utf8", 0, 4);
    expect(pdfSignature).toBe("%PDF");
  });

  it("should include correct date range in filename", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const endDate = new Date("2024-12-31");
    const startDate = new Date("2024-12-01");

    const result = await caller.audit.exportPDF({ startDate, endDate });

    expect(result.filename).toBe("relatorio-auditoria-2024-12-01-2024-12-31.pdf");
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
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    await expect(
      caller.audit.exportPDF({ startDate, endDate })
    ).rejects.toThrow("Acesso negado");
  });

  it("should generate PDF for different date ranges", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    
    // Teste com 7 dias
    const endDate1 = new Date();
    const startDate1 = new Date();
    startDate1.setDate(startDate1.getDate() - 7);
    const result1 = await caller.audit.exportPDF({ startDate: startDate1, endDate: endDate1 });
    expect(result1.pdf).toBeDefined();

    // Teste com 30 dias
    const endDate2 = new Date();
    const startDate2 = new Date();
    startDate2.setDate(startDate2.getDate() - 30);
    const result2 = await caller.audit.exportPDF({ startDate: startDate2, endDate: endDate2 });
    expect(result2.pdf).toBeDefined();

    // Teste com 90 dias
    const endDate3 = new Date();
    const startDate3 = new Date();
    startDate3.setDate(startDate3.getDate() - 90);
    const result3 = await caller.audit.exportPDF({ startDate: startDate3, endDate: endDate3 });
    expect(result3.pdf).toBeDefined();
  });
});
