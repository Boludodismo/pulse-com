// Storage helpers for Manus proxy and standalone S3-compatible providers.

import { createHmac, timingSafeEqual } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type ManusStorageConfig = { baseUrl: string; apiKey: string };

function ensureSecretConfigured() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is required for secure storage links");
  }
}

function storageToken(key: string): string {
  ensureSecretConfigured();
  return createHmac("sha256", ENV.cookieSecret).update(normalizeKey(key)).digest("hex");
}

export function verifyStorageAccessToken(key: string, token: string): boolean {
  if (!ENV.cookieSecret || !key || !token) return false;
  const expected = Buffer.from(storageToken(key), "utf8");
  const received = Buffer.from(token, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function buildStableProxyUrl(key: string): string {
  const normalized = normalizeKey(key);
  const query = `key=${encodeURIComponent(normalized)}&token=${encodeURIComponent(storageToken(normalized))}`;
  return `${ENV.appBaseUrl || ""}/api/storage?${query}`;
}

function getManusStorageConfig(): ManusStorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

let s3Client: S3Client | null = null;

function getS3Config() {
  if (!ENV.s3Endpoint || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey || !ENV.s3Bucket) {
    throw new Error(
      "S3 storage credentials missing: set AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET_NAME"
    );
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: ENV.s3Region || "auto",
      endpoint: ENV.s3Endpoint,
      forcePathStyle: ENV.s3UrlStyle === "path",
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
    });
  }

  return { client: s3Client, bucket: ENV.s3Bucket };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildManusDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage download URL failed (${response.status}): ${message}`);
  }
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (ENV.storageProvider === "disabled") {
    console.warn("[Storage] Upload skipped - storage is disabled");
    return { key, url: "" };
  }

  if (ENV.storageProvider === "s3") {
    const { client, bucket } = getS3Config();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
    return { key, url: buildStableProxyUrl(key) };
  }

  if (ENV.storageProvider !== "manus") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${ENV.storageProvider}`);
  }

  const { baseUrl, apiKey } = getManusStorageConfig();
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  if (ENV.storageProvider === "disabled") {
    console.warn("[Storage] Download skipped - storage is disabled");
    return { key, url: "" };
  }

  if (ENV.storageProvider === "s3") {
    const { client, bucket } = getS3Config();
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 300 }
    );
    return { key, url };
  }

  if (ENV.storageProvider !== "manus") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${ENV.storageProvider}`);
  }

  const { baseUrl, apiKey } = getManusStorageConfig();
  return {
    key,
    url: await buildManusDownloadUrl(baseUrl, key, apiKey),
  };
}
