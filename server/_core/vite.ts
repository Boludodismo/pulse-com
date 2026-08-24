import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";

// Vite is only available in development
let createViteServer: any = null;
let viteConfig: any = null;
let viteLoaded = false;

async function ensureViteLoaded() {
  if (!viteLoaded && process.env.NODE_ENV === "development") {
    const viteModule = await import("vite");
    createViteServer = viteModule.createServer;
    
    // Create minimal vite config inline without importing vite.config.ts
    // This prevents bundling vite.config.ts which contains dev-only dependencies
    viteConfig = {
      root: path.resolve(__dirname, "../..", "client"),
      publicDir: path.resolve(__dirname, "../..", "client", "public"),
      envDir: path.resolve(__dirname, "../.."),
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "../..", "client", "src"),
          "@shared": path.resolve(__dirname, "../..", "shared"),
          "@assets": path.resolve(__dirname, "../..", "attached_assets"),
        },
      },
    };
    viteLoaded = true;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  await ensureViteLoaded();
  
  if (!createViteServer || !viteConfig) {
    throw new Error("Vite modules failed to load");
  }
  
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(__dirname, "../..", "dist", "public")
      : path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
