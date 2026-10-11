import type { Express } from "express";
import sharp from "sharp";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import {
  findPublishedArtistCard,
  projectPublicCard,
} from "./routers/artistCardEditorial";
import { parsePresentation } from "../shared/artistCardPresentation";
import { buildArtistVCard, cardFileName } from "../shared/artistCardContact";
import { storageReadBuffer } from "./storage";

export async function artistContactFile(token: string) {
  const row = await findPublishedArtistCard(token);
  const publicCard = projectPublicCard(row);
  const p = parsePresentation(row.presentation);
  let key = row.photoKey?.startsWith(`artists/${row.studioId}/avatars/`)
    ? row.photoKey
    : null;
  if (
    !key &&
    p?.cover?.key.startsWith(
      `artists/${row.studioId}/${row.artistId}/card/cover/`
    )
  )
    key = p.cover.key;
  let photo: string | undefined;
  if (key && !key.includes("..")) {
    try {
      const original = await storageReadBuffer(key, 5 * 1024 * 1024);
      const thumbnail = await sharp(original, { limitInputPixels: 40_000_000 })
        .autoOrient()
        .resize({
          width: 320,
          height: 320,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .timeout({ seconds: 10 })
        .toBuffer();
      photo = thumbnail.toString("base64");
    } catch {
      /* Contact fields remain downloadable when its optional photo is unavailable. */
    }
  }
  // Use the configured public origin, never a client-supplied Host header.
  const profileUrl = new URL(`/artista/${token}`, ENV.appBaseUrl).href;
  return {
    body: buildArtistVCard(publicCard, profileUrl, false, photo),
    fileName: `${cardFileName(row.name)}.vcf`,
  };
}

export function registerArtistContactDownload(app: Express) {
  app.get("/api/artist-card/:token/contact.vcf", async (req, res) => {
    try {
      const file = await artistContactFile(req.params.token);
      res.setHeader("Content-Type", "text/vcard; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${file.fileName}"`
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(file.body);
    } catch (error) {
      const unavailable =
        error instanceof TRPCError && error.code === "NOT_FOUND";
      return res
        .status(unavailable ? 404 : 503)
        .json({
          error: unavailable
            ? "Cartão indisponível."
            : "Não foi possível baixar o contato. Tente novamente.",
        });
    }
  });
}
