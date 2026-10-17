// Offline verification/extraction only. This script never changes the CRM database.
import "dotenv/config";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDecipheriv, createHash, hkdfSync } from "node:crypto";
import { gunzipSync } from "node:zlib";
const args = process.argv.slice(2),
  input = args[args.indexOf("--input") + 1],
  out = args.includes("--output") ? args[args.indexOf("--output") + 1] : null;
if (!args.includes("--input") || !input)
  throw new Error(
    "Use --input arquivo.enc e, para extrair, --output diretório novo."
  );
const secret = process.env.AUTH_SECURITY_KEY;
if (!secret || Buffer.byteLength(secret) < 32)
  throw new Error(
    "AUTH_SECURITY_KEY original deve estar configurada no ambiente."
  );
const data = await readFile(input);
if (data.subarray(0, 8).toString() !== "TATUEIC1")
  throw new Error("Formato desconhecido.");
const key = Buffer.from(
  hkdfSync("sha256", secret, "tatuei-consent-backup-v1", "documents", 32)
);
const cipher = createDecipheriv("aes-256-gcm", key, data.subarray(8, 20));
cipher.setAuthTag(data.subarray(20, 36));
const snapshot = JSON.parse(
  gunzipSync(
    Buffer.concat([cipher.update(data.subarray(36)), cipher.final()]),
    { maxOutputLength: 60 * 1024 * 1024 }
  ).toString()
);
if (
  snapshot.format !== "tatuei-consent-v1" ||
  !Array.isArray(snapshot.attachments)
)
  throw new Error("Conteúdo inválido.");
for (const f of snapshot.attachments) {
  const bytes = Buffer.from(f.data, "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== f.sha256)
    throw new Error("Integridade de anexo divergente.");
}
if (out) {
  const target = path.resolve(out);
  await mkdir(target, { mode: 0o700, recursive: false });
  for (const f of snapshot.attachments) {
    if (!/^[\w-]+$/.test(f.id) || !/^\w+$/.test(f.kind))
      throw new Error("Identificador inválido.");
    const ext =
      f.mime === "application/pdf"
        ? "pdf"
        : f.mime === "image/jpeg"
          ? "jpg"
          : f.mime === "image/png"
            ? "png"
            : "bin";
    await writeFile(
      path.join(target, `${f.kind}-${f.id}.${ext}`),
      Buffer.from(f.data, "base64"),
      { mode: 0o600, flag: "wx" }
    );
  }
  await writeFile(
    path.join(target, "registro.json"),
    JSON.stringify(
      {
        ...snapshot,
        attachments: snapshot.attachments.map(
          ({ data, ...metadata }) => metadata
        ),
      },
      null,
      2
    ),
    { mode: 0o600, flag: "wx" }
  );
}
console.log(
  JSON.stringify({
    verified: true,
    recordId: snapshot.record.id,
    revision: snapshot.revision,
    files: snapshot.attachments.length,
    extracted: !!out,
  })
);
