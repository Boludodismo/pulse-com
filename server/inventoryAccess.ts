import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  artists,
  studioMaterialArtists,
  tenantMaterials,
} from "../drizzle/schema";
import { getDb } from "./db";

export type InventoryContext = {
  studioId: number;
  artistId: number | null;
  user: { role: string };
};
export type InventoryDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export const isInventoryManager = (ctx: InventoryContext) =>
  ["admin", "superadmin"].includes(ctx.user.role);
export function assertOwnArtist(
  ctx: InventoryContext,
  artistId: number | null
) {
  if (
    !isInventoryManager(ctx) &&
    (!ctx.artistId || artistId !== ctx.artistId)
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você pode acessar somente os dados do seu artista.",
    });
  }
}
export function canUseMaterial(
  ownerArtistId: number | null,
  suppliedTo: number[],
  artistId: number | null
) {
  return (
    artistId != null &&
    (ownerArtistId === artistId ||
      (ownerArtistId == null && suppliedTo.includes(artistId)))
  );
}
export async function requireInventoryArtist(
  db: InventoryDatabase,
  studioId: number,
  artistId: number
) {
  const artist = (
    await db
      .select({ id: artists.id })
      .from(artists)
      .where(
        and(
          eq(artists.id, artistId),
          eq(artists.studioId, studioId),
          eq(artists.active, 1)
        )
      )
      .limit(1)
  )[0];
  if (!artist)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione um artista ativo deste estúdio.",
    });
}
export async function requireOwnedMaterial(
  db: InventoryDatabase,
  ctx: InventoryContext,
  id: number
) {
  const material = (
    await db
      .select()
      .from(tenantMaterials)
      .where(
        and(
          eq(tenantMaterials.id, id),
          eq(tenantMaterials.studioId, ctx.studioId),
          eq(tenantMaterials.isActive, 1)
        )
      )
      .limit(1)
  )[0];
  if (!material)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Material não encontrado neste estúdio.",
    });
  assertOwnArtist(ctx, material.ownerArtistId);
  return material;
}
export async function requireMaterialForArtist(
  db: InventoryDatabase,
  ctx: InventoryContext,
  material: typeof tenantMaterials.$inferSelect,
  artistId: number | null
) {
  assertOwnArtist(ctx, artistId);
  if (artistId == null)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Defina o artista da sessão antes de escolher os materiais.",
    });
  await requireInventoryArtist(db, ctx.studioId, artistId);
  const allocations = await db
    .select({ artistId: studioMaterialArtists.artistId })
    .from(studioMaterialArtists)
    .where(
      and(
        eq(studioMaterialArtists.studioId, ctx.studioId),
        eq(studioMaterialArtists.tenantMaterialId, material.id)
      )
    )
    .for("share");
  if (
    !canUseMaterial(
      material.ownerArtistId,
      allocations.map(a => a.artistId),
      artistId
    )
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Este material não pertence ao artista e não foi disponibilizado pelo estúdio para ele.",
    });
  }
}
