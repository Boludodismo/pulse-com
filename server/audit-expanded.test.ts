import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";
import * as db from "./db";

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
    openId: "admin-audit-expanded-test",
    name: "Admin Audit Expanded Test",
    email: "admin-audit-expanded@test.com",
    role: "admin",
    artistId: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    studioId: 1,
    loginMethod: "test",
  },
});

describe("Audit System - Expanded Entities", () => {
  describe("Client Audit Logging", () => {
    it("should create audit log when creating a client", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente
      const client = await caller.clients.create({
        name: `Audit Test Client ${timestamp}`,
        email: `auditclient${timestamp}@test.com`,
        phone: "11999999999",
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "create", entity: "client", limit: 100 });
      expect(logs.length).toBeGreaterThan(0);

      // Encontrar o log do cliente criado
      const clientLog = logs.find(log => log.entityName?.includes(`Audit Test Client ${timestamp}`));
      expect(clientLog).toBeDefined();
      expect(clientLog?.action).toBe("create");
      expect(clientLog?.entity).toBe("client");
    });

    it("should create audit log when updating a client", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente
      const client = await caller.clients.create({
        name: `Client Before Update ${timestamp}`,
        email: `before${timestamp}@test.com`,
      });

      // Atualizar cliente
      await caller.clients.update({
        id: client.id,
        data: {
          name: `Client After Update ${timestamp}`,
          email: `after${timestamp}@test.com`,
        },
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "update", entity: "client", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("update");
      expect(latestLog.entity).toBe("client");

      // Verificar detalhes (before/after)
      const details = JSON.parse(latestLog.details || "{}");
      expect(details.before).toBeDefined();
      expect(details.after).toBeDefined();
      expect(details.before.name).toContain("Before Update");
      expect(details.after.name).toContain("After Update");
    });

    it("should create audit log when deleting a client", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente
      const client = await caller.clients.create({
        name: `Client to Delete ${timestamp}`,
        email: `delete${timestamp}@test.com`,
      });

      // Deletar cliente
      await caller.clients.delete({ id: client.id });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "delete", entity: "client", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("delete");
      expect(latestLog.entity).toBe("client");
      expect(latestLog.entityName).toContain("Client to Delete");
    });
  });

  describe("Appointment Audit Logging", () => {
    it.skip("should create audit log when creating an appointment", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente primeiro
      const client = await caller.clients.create({
        name: `Client for Appointment ${timestamp}`,
        email: `appointment${timestamp}@test.com`,
      });

      // Criar agendamento
      await caller.appointments.create({
        clientId: client.id,
        date: new Date().toISOString(),
        duration: 120,
        service: "Tatuagem",
      depositAmount: 0,
      totalAmount: 0,
        artist: "Test Artist",
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "create", entity: "appointment", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("create");
      expect(latestLog.entity).toBe("appointment");
      expect(latestLog.entityName).toContain("Tatuagem");
    });

    it.skip("should create audit log when updating an appointment", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente
      const client = await caller.clients.create({
        name: `Client for Update Appointment ${timestamp}`,
        email: `updateappt${timestamp}@test.com`,
      });

      // Criar agendamento
      const appointment = await caller.appointments.create({
        clientId: client.id,
        date: new Date().toISOString(),
        duration: 120,
        service: "Tatuagem Original",
      depositAmount: 0,
      totalAmount: 0,
        artist: "Test Artist",
      });

      // Atualizar agendamento
      await caller.appointments.update({
        id: appointment.id,
        data: {
          service: "Tatuagem Modificada",
      depositAmount: 0,
      totalAmount: 0,
          duration: 180,
        },
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "update", entity: "appointment", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("update");
      expect(latestLog.entity).toBe("appointment");

      // Verificar detalhes
      const details = JSON.parse(latestLog.details || "{}");
      expect(details.before).toBeDefined();
      expect(details.after).toBeDefined();
    });
  });

  describe("Transaction Audit Logging", () => {
    it("should create audit log when creating a transaction", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente
      const client = await caller.clients.create({
        name: `Client for Transaction ${timestamp}`,
        email: `transaction${timestamp}@test.com`,
      });

      // Criar transação
      await caller.transactions.create({
        clientId: client.id,
        type: "entrada",
        category: "Tatuagem",
        amount: 500,
        paymentMethod: "pix",
        date: new Date().toISOString(),
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "create", entity: "transaction", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("create");
      expect(latestLog.entity).toBe("transaction");
      expect(latestLog.entityName).toContain("Entrada");
      expect(latestLog.entityName).toContain("Tatuagem");
      expect(latestLog.entityName).toContain("500");
    });

    it("should create audit log when updating a transaction", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente
      const client = await caller.clients.create({
        name: `Client for Update Transaction ${timestamp}`,
        email: `updatetrans${timestamp}@test.com`,
      });

      // Criar transação
      const transaction = await caller.transactions.create({
        clientId: client.id,
        type: "entrada",
        category: "Tatuagem",
        amount: 500,
        paymentMethod: "pix",
        date: new Date().toISOString(),
      });

      // Atualizar transação
      await caller.transactions.update({
        id: transaction.id,
        data: {
          amount: 600,
          paymentMethod: "credito",
        },
      });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "update", entity: "transaction", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("update");
      expect(latestLog.entity).toBe("transaction");

      // Verificar detalhes
      const details = JSON.parse(latestLog.details || "{}");
      expect(details.before).toBeDefined();
      expect(details.after).toBeDefined();
      expect(details.before.amount).toBe(500);
      expect(details.after.amount).toBe(600);
    });

    it("should create audit log when deleting a transaction", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const timestamp = Date.now();

      // Criar cliente
      const client = await caller.clients.create({
        name: `Client for Delete Transaction ${timestamp}`,
        email: `deletetrans${timestamp}@test.com`,
      });

      // Criar transação
      const transaction = await caller.transactions.create({
        clientId: client.id,
        type: "saida",
        category: "Material",
        amount: 200,
        paymentMethod: "dinheiro",
        date: new Date().toISOString(),
      });

      // Deletar transação
      await caller.transactions.delete({ id: transaction.id });

      // Buscar logs de auditoria
      const logs = await db.listAuditLogs({ action: "delete", entity: "transaction", limit: 1 });
      expect(logs.length).toBeGreaterThan(0);

      const latestLog = logs[0];
      expect(latestLog.action).toBe("delete");
      expect(latestLog.entity).toBe("transaction");
      expect(latestLog.entityName).toContain("Saída");
      expect(latestLog.entityName).toContain("Material");
    });
  });

  describe("Audit Filtering", () => {
    it("should filter audit logs by entity type", async () => {
      const caller = appRouter.createCaller(createAdminContext());

      // Buscar apenas logs de clientes
      const clientLogs = await caller.audit.list({ entity: "client", limit: 10 });
      expect(Array.isArray(clientLogs)).toBe(true);
      if (clientLogs.length > 0) {
        clientLogs.forEach((log) => {
          expect(log.entity).toBe("client");
        });
      }

      // Buscar apenas logs de agendamentos
      const appointmentLogs = await caller.audit.list({ entity: "appointment", limit: 10 });
      expect(Array.isArray(appointmentLogs)).toBe(true);
      if (appointmentLogs.length > 0) {
        appointmentLogs.forEach((log) => {
          expect(log.entity).toBe("appointment");
        });
      }

      // Buscar apenas logs de transações
      const transactionLogs = await caller.audit.list({ entity: "transaction", limit: 10 });
      expect(Array.isArray(transactionLogs)).toBe(true);
      if (transactionLogs.length > 0) {
        transactionLogs.forEach((log) => {
          expect(log.entity).toBe("transaction");
        });
      }
    });
  });
});
