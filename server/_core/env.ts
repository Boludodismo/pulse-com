export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Auth mode: "oauth" (Manus) or "local" (standalone)
  authMode: process.env.AUTH_MODE ?? "oauth",
  // Local auth admin credentials (only used when AUTH_MODE=local)
  localAdminEmail: process.env.LOCAL_ADMIN_EMAIL ?? "admin@podcrm.local",
  localAdminPassword: process.env.LOCAL_ADMIN_PASSWORD ?? "admin123",
  localAdminName: process.env.LOCAL_ADMIN_NAME ?? "Admin",
  // Storage provider: "s3" or "disabled"
  storageProvider: process.env.STORAGE_PROVIDER ?? "s3",
};
