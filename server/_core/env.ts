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
  appBaseUrl: (process.env.APP_BASE_URL ?? "").replace(/\/+$/, ""),
  s3Endpoint: process.env.AWS_ENDPOINT_URL ?? "",
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  s3Bucket: process.env.AWS_S3_BUCKET_NAME ?? "",
  s3Region: process.env.AWS_DEFAULT_REGION ?? "auto",
  s3UrlStyle: (process.env.AWS_S3_URL_STYLE ?? "path").toLowerCase(),
  // Storage provider: "s3", "manus" or "disabled"
  storageProvider: process.env.STORAGE_PROVIDER ?? "s3",
};
