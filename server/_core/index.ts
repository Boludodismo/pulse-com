import {ensureStagingArtistInvitationSchema} from './stagingArtistInvitationSchema';
import {ensureStagingIntelligentInboxSchema} from './stagingIntelligentInboxSchema';
import { ensureStagingMessagingSchema } from "./stagingMessagingSchema";
import { ensureStagingInventorySchema } from "./stagingInventorySchema";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes, ensureLocalAdmin } from "./localAuth";
import { ENV } from "./env";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runLegacyNotificationCycle, startScheduler } from "../scheduler";
import { sdk } from "./sdk";
import * as db from "../db";
import { processPendingIntegrationJobs } from "../messaging/service";
import { receiveBotConversaWebhook } from "../messaging/secureWebhook";
import { runStartupMigrations } from "./migrations";
import { storageGet, verifyStorageAccessToken } from "../storage";

async function startServer() {
  // Keep schema synchronized on controlled standalone deployments.
  // Disabled by default so existing Manus/production behavior is unchanged.
  await runStartupMigrations();
  await ensureStagingInventorySchema();
  await ensureStagingMessagingSchema();
  await ensureStagingIntelligentInboxSchema();
  await ensureStagingArtistInvitationSchema();

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({
    limit: "50mb",
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Lightweight health endpoint for hosting platforms.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "pod-crm", timestamp: new Date().toISOString() });
  });

  // Stable proxy for private S3-compatible storage objects.
  // The URL contains an HMAC token, so files remain private without storing expiring URLs in the DB.
  app.get("/api/storage", async (req, res) => {
    try {
      const key = typeof req.query.key === "string" ? req.query.key : "";
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!key || !token || !verifyStorageAccessToken(key, token)) {
        return res.status(403).json({ error: "Acesso ao arquivo não autorizado." });
      }

      const { url } = await storageGet(key);
      if (!url) return res.status(404).json({ error: "Arquivo indisponível." });
      return res.redirect(302, url);
    } catch (error) {
      console.error("[Storage] Failed to serve object", error);
      return res.status(404).json({ error: "Arquivo não encontrado." });
    }
  });
  // Auth routes based on AUTH_MODE
  if (ENV.authMode === "local") {
    console.log("[Auth] Using local authentication mode");
    registerLocalAuthRoutes(app);
    // Ensure admin user exists on every startup
    await ensureLocalAdmin({
      email: ENV.localAdminEmail,
      password: ENV.localAdminPassword,
      name: ENV.localAdminName,
      ownerOpenId: ENV.ownerOpenId,
      studioName: ENV.localStudioName,
    });
  } else {
    console.log("[Auth] Using OAuth authentication mode");
    registerOAuthRoutes(app);
  }
  // Rota para download de arquivo .ics (iCalendar) de agendamento
  app.get("/api/appointments/:id/ics", async (req, res) => {
    try {
      // Autenticar usuário
      let user = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Não autorizado" });
        return;
      }
      if (!user) {
        res.status(401).json({ error: "Não autorizado" });
        return;
      }

      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      // Buscar dados do agendamento
      const appointment = await db.getAppointmentById(appointmentId);
      if (!appointment) {
        res.status(404).json({ error: "Agendamento não encontrado" });
        return;
      }

      // Buscar cliente
      const client = await db.getClientById(appointment.clientId);
      if (!client) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
      }

      // Buscar configurações do estúdio
      const studioSettings = await db.getStudioSettings();

      // Buscar anamnese mais recente do cliente
      const anamnesisRecords = await db.getAnamnesisByClientId(appointment.clientId);
      const latestAnamnesis = anamnesisRecords.length > 0 ? anamnesisRecords[0] : null;

      // Construir URL base
      const baseUrl = ENV.appBaseUrl ||
        (process.env.NODE_ENV === "production" ? "https://crm.tatuei.com" : "http://localhost:3000");

      // Gerar token de confirmação
      const { createHash } = await import("crypto");
      const secret = process.env.JWT_SECRET || "secret";
      const token = createHash("sha256")
        .update(`${appointment.id}:${appointment.date}:${secret}`)
        .digest("hex")
        .slice(0, 16);
      const confirmationLink = `${baseUrl}/confirmar?id=${appointment.id}&token=${token}&status=confirmado`;

      // Gerar link de anamnese (se houver)
      let anamnesisLink: string | null = null;
      if (latestAnamnesis) {
        anamnesisLink = `${baseUrl}/anamnese/view/${latestAnamnesis.id}`;
      }

      // Gerar arquivo .ics
      const { generateIcs } = await import("../icsGenerator");
      const icsContent = generateIcs({
        appointment,
        client,
        studio: studioSettings ? {
          name: studioSettings.studioName,
          address: studioSettings.address,
          phone: studioSettings.phone,
        } : null,
        anamnesis: latestAnamnesis,
        anamnesisLink,
        confirmationLink,
        baseUrl,
      });

      // Retornar arquivo
      const filename = `agendamento-${client.name.replace(/[^a-zA-Z0-9]/g, '-')}-${appointment.date.slice(0, 10)}.ics`;
      res.setHeader("Content-Type", "text/calendar; charset=utf-8; method=PUBLISH");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("[ICS] Erro ao gerar arquivo:", error);
      res.status(500).json({ error: "Erro interno ao gerar arquivo" });
    }
  });

  // ── Webhook BotConversa por conexão (autenticado) ──────────────────────────
  app.post("/api/webhook/botconversa/:connectionKey", async (req, res) => {
    try {
      const rawBody = (req as express.Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
      const signature = req.header("x-botconversa-signature") ?? req.header("x-webhook-signature") ?? undefined;
      const result = await receiveBotConversaWebhook({
        connectionKey: req.params.connectionKey,
        rawBody,
        signature,
      });
      return res.status(200).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar webhook.";
      const status = message.includes("Assinatura") || message.includes("não encontrada") ? 401 : 400;
      console.warn("[Webhook BotConversa] Evento recusado:", message);
      return res.status(status).json({ ok: false, error: status === 401 ? "Webhook não autorizado." : "Payload inválido." });
    }
  });

  // ── Webhook WhatsApp legado (recebe respostas dos clientes) ───────────────
  app.post("/api/webhook/whatsapp", async (req, res) => {
    try {
      const body = req.body;
      // Suporte a BotConversa, Z-API e Meta
      // Extrai número e mensagem independente do provedor
      let phone: string | undefined;
      let message: string | undefined;

      // BotConversa
      if (body?.subscriber?.phone && body?.last_message?.text) {
        phone = body.subscriber.phone;
        message = body.last_message.text?.trim();
      }
      // Z-API
      else if (body?.phone && body?.text?.message) {
        phone = body.phone;
        message = body.text.message?.trim();
      }
      // Meta Cloud API
      else if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = body.entry[0].changes[0].value.messages[0];
        phone = msg.from;
        message = msg.text?.body?.trim();
      }

      if (phone && message) {
        const { handleWebhookReply } = await import("../messaging/webhook");
        await handleWebhookReply(phone, message);
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Webhook] Erro:", err);
      res.status(200).json({ ok: true }); // Sempre 200 para não retentar
    }
  });

  // Meta webhook verification (GET)
  app.get("/api/webhook/whatsapp", (req, res) => {
    const verify_token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "podcrm_verify";
    if (req.query["hub.verify_token"] === verify_token) {
      res.status(200).send(req.query["hub.challenge"]);
    } else {
      res.status(403).send("Forbidden");
    }
  });

  /** Callback interno do Heartbeat; a tarefa é identificada pelo token da plataforma. */
  app.post("/api/scheduled/botconversa-jobs", async (req, res) => {
    let scheduleId: number | undefined;
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const schedule = await db.getIntegrationScheduleByTaskUid(user.taskUid);
      if (!schedule || !schedule.isEnabled) return res.json({ ok: true, skipped: "orphan_or_disabled" });
      scheduleId = schedule.id;

      const automatic = await runLegacyNotificationCycle();
      const queue = await processPendingIntegrationJobs(10);
      await db.recordIntegrationScheduleRun(schedule.id, {});
      return res.json({ ok: true, automatic, queue });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (scheduleId) await db.recordIntegrationScheduleRun(scheduleId, { error: message }).catch(() => undefined);
      console.error("[Heartbeat] Falha ao processar integração:", error);
      return res.status(500).json({
        error: message,
        context: { url: req.originalUrl },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Cloud Run requires exact PORT (no port scanning)
  const port = Number(process.env.PORT || 8080);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
    if (ENV.schedulerMode === "local") {
      startScheduler();
    } else {
      console.log("[Scheduler] Processamento periódico configurado para Heartbeat externo.");
    }
  });
}

startServer().catch(console.error);
