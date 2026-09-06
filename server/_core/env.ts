const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
const detectedAppBaseUrl =
  process.env.APP_BASE_URL?.trim() ||
  process.env.PUBLIC_URL?.trim() ||
  (railwayPublicDomain ? `https://${railwayPublicDomain}` : "");

const detectedS3Endpoint = process.env.AWS_ENDPOINT_URL ?? process.env.ENDPOINT ?? "";
const detectedS3AccessKeyId = process.env.AWS_ACCESS_KEY_ID ?? process.env.ACCESS_KEY_ID ?? "";
const detectedS3SecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? process.env.SECRET_ACCESS_KEY ?? "";
const detectedS3Bucket = process.env.AWS_S3_BUCKET_NAME ?? process.env.BUCKET ?? "";
const hasCompleteS3Config = Boolean(
  detectedS3Endpoint &&
  detectedS3AccessKeyId &&
  detectedS3SecretAccessKey &&
  detectedS3Bucket
);

const requestedStorageProvider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
const detectedStorageProvider = hasCompleteS3Config
  ? "s3"
  : requestedStorageProvider ||
    (process.env.BUILT_IN_FORGE_API_KEY ? "manus" : "disabled");

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  appBaseUrl: detectedAppBaseUrl.replace(/\/+$/, ""),
  // Auth mode: "oauth" (Manus) or "local" (standalone)
  authMode: process.env.AUTH_MODE ?? "oauth",
  // Local auth admin credentials (only used when AUTH_MODE=local)
  localAdminEmail: process.env.LOCAL_ADMIN_EMAIL ?? "admin@podcrm.local",
  localAdminPassword: process.env.LOCAL_ADMIN_PASSWORD ?? "admin123",
  localAdminName: process.env.LOCAL_ADMIN_NAME ?? "Admin",
  localStudioName: process.env.LOCAL_STUDIO_NAME ?? "Meu Estúdio",
  schedulerMode: (process.env.SCHEDULER_MODE ?? (process.env.AUTH_MODE === "local" ? "local" : "heartbeat")).toLowerCase(),
  // Storage provider: "manus", "s3" or "disabled". If complete S3 credentials exist, prefer S3.
  storageProvider: detectedStorageProvider,
  // S3-compatible storage (Railway Buckets, R2, AWS S3, etc.)
  s3Endpoint: detectedS3Endpoint,
  s3AccessKeyId: detectedS3AccessKeyId,
  s3SecretAccessKey: detectedS3SecretAccessKey,
  s3Bucket: detectedS3Bucket,
  s3Region: process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? process.env.REGION ?? "auto",
  s3UrlStyle: (process.env.AWS_S3_URL_STYLE ?? "virtual").toLowerCase(),
};
