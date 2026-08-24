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
import { startScheduler } from "../scheduler";
import { sdk } from "./sdk";
import * as db from "../db";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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
      const baseUrl = process.env.APP_BASE_URL ||
        (process.env.NODE_ENV === "production"
          ? `https://${process.env.VITE_APP_ID ? "tatuei.com" : "tatuei.manus.space"}`
          : "http://localhost:3000");

      // Gerar token de confirmação
      const { createHash } = await import("crypto");
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET must be configured");
      }
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
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("[ICS] Erro ao gerar arquivo:", error);
      res.status(500).json({ error: "Erro interno ao gerar arquivo" });
    }
  });

  // ── Webhook WhatsApp (recebe respostas dos clientes) ──────────────────────
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
    const verify_token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!verify_token) {
      return res.status(503).send("Webhook verification is not configured");
    }
    if (req.query["hub.verify_token"] === verify_token) {
      res.status(200).send(req.query["hub.challenge"]);
    } else {
      res.status(403).send("Forbidden");
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
    console.log(`Server running on http://0.0.0.0:${port}/`);
    startScheduler();
  });
}

startServer().catch(console.error);
