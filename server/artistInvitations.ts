import { createHash, randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { artists, studios, studioInvitations, users, userModulePermissions } from '../drizzle/schema';
import { SAAS_MODULES } from './saas';
import { hashPassword } from './_core/localAuth';

export const permissionInput = z.array(z.object({ module: z.enum(SAAS_MODULES), canRead: z.boolean(), canWrite: z.boolean() })).max(SAAS_MODULES.length)
  .refine(p => new Set(p.map(x => x.module)).size === p.length, 'Não repita módulos.')
  .refine(p => p.every(x => !x.canWrite || x.canRead), 'Permissão de edição exige visualização.');
export const tokenInput = z.string().regex(/^[a-f0-9]{64}$/, 'Convite inválido.');
export const invitationPassword = z.string().min(10, 'Use pelo menos 10 caracteres.').max(72)
  .refine(p => Buffer.byteLength(p, 'utf8') <= 72, 'A senha excede o tamanho permitido.');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const timestamp = () => new Date().toISOString().slice(0,19).replace('T',' ');
export function pendingInvitation(invitation: { status: string; expiresAt: string; artistId: number | null } | undefined, now = Date.now()) {
  return !!invitation?.artistId && invitation.status === 'pending' && Date.parse(invitation.expiresAt.replace(' ', 'T').replace(/Z$/, '') + 'Z') > now;
}
const unavailable = () => new TRPCError({ code: 'BAD_REQUEST', message: 'Convite inválido, expirado, revogado ou já utilizado. Solicite um novo link ao proprietário.' });
async function connection() { const db = await getDb(); if (!db) throw new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: 'Banco temporariamente indisponível.' }); return db; }

export async function issueArtistInvitation(input: { studioId: number; artistId: number; invitedByUserId: number; permissions: z.infer<typeof permissionInput> }) {
  const permissions = permissionInput.parse(input.permissions);
  const db = await connection();
  return db.transaction(async tx => {
    const [artist] = await tx.select().from(artists).where(and(eq(artists.id, input.artistId), eq(artists.studioId, input.studioId))).limit(1).for('update');
    if (!artist || !artist.active) throw new TRPCError({ code: 'NOT_FOUND', message: 'Artista ativo não encontrado neste estúdio.' });
    const email = z.string().email('Preencha um e-mail válido no cadastro do artista.').parse(artist.email?.trim().toLowerCase());
    if (!artist.phone || artist.phone.replace(/\D/g,'').length < 10) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Preencha o WhatsApp com DDD no cadastro do artista.' });
    const [existing] = await tx.select({ id: users.id }).from(users).where(sql`lower(trim(${users.email})) = ${email} OR ${users.artistId} = ${artist.id}`).limit(1);
    if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Este e-mail ou artista já possui uma conta. Gerencie o acesso em Gestão SaaS; o convite não altera contas existentes.' });
    await tx.update(studioInvitations).set({ status: 'revoked', revokedAt: timestamp() }).where(and(eq(studioInvitations.studioId,input.studioId),eq(studioInvitations.artistId,artist.id),eq(studioInvitations.status,'pending')));
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now()+7*86400000).toISOString().slice(0,19).replace('T',' ');
    const result = await tx.insert(studioInvitations).values({ studioId: input.studioId, artistId: artist.id, email, role: 'collaborator', tokenHash: tokenHash(token), status: 'pending', expiresAt, invitedByUserId: input.invitedByUserId, permissionSnapshot: permissions });
    return { id: Number(result[0].insertId), token, expiresAt: expiresAt.replace(' ','T')+'Z', name: artist.name, phone: artist.phone };
  });
}
export async function inspectArtistInvitation(token: string) {
  const db = await connection();
  const [invitation] = await db.select().from(studioInvitations).where(eq(studioInvitations.tokenHash,tokenHash(token))).limit(1);
  if (!pendingInvitation(invitation)) throw unavailable();
  const [artist] = await db.select({ name: artists.name, active: artists.active }).from(artists).where(and(eq(artists.id,invitation.artistId!),eq(artists.studioId,invitation.studioId))).limit(1);
  const [studio] = await db.select({ name: studios.name, isActive: studios.isActive }).from(studios).where(eq(studios.id,invitation.studioId)).limit(1);
  if (!artist?.active || !studio?.isActive) throw unavailable();
  return { name: artist.name, studioName: studio.name, email: invitation.email, permissions: permissionInput.parse(invitation.permissionSnapshot), expiresAt: invitation.expiresAt.replace(' ','T')+'Z' };
}
export async function registerInvitedArtist(token: string, password: string) {
  tokenInput.parse(token); invitationPassword.parse(password);
  // Validate the bearer token before spending bcrypt CPU. Transaction revalidates it.
  await inspectArtistInvitation(token);
  const passwordHash = await hashPassword(password);
  const db = await connection();
  return db.transaction(async tx => {
    const [invitation] = await tx.select().from(studioInvitations).where(eq(studioInvitations.tokenHash,tokenHash(token))).limit(1).for('update');
    if (!pendingInvitation(invitation)) throw unavailable();
    const [artist] = await tx.select().from(artists).where(and(eq(artists.id,invitation.artistId!),eq(artists.studioId,invitation.studioId))).limit(1).for('update');
    const [studio] = await tx.select({ isActive: studios.isActive }).from(studios).where(eq(studios.id,invitation.studioId)).limit(1);
    if (!artist?.active || !studio?.isActive || artist.email?.trim().toLowerCase() !== invitation.email) throw unavailable();
    const [existing] = await tx.select({ id: users.id }).from(users).where(sql`lower(trim(${users.email})) = ${invitation.email} OR ${users.artistId} = ${artist.id}`).limit(1);
    if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Já existe uma conta para este cadastro. Nenhuma senha foi alterada. Contate o proprietário.' });
    const permissions = permissionInput.parse(invitation.permissionSnapshot);
    const result = await tx.insert(users).values({
      openId: 'artist-invite:'+tokenHash(invitation.email).slice(0,50), name: artist.name, email: invitation.email,
      loginMethod: 'local', passwordHash, role: 'collaborator', studioId: invitation.studioId, artistId: artist.id,
      isActive: 1, accessStatus: 'active', accessExpiresAt: null,
    });
    const userId = Number(result[0].insertId);
    if (permissions.length) await tx.insert(userModulePermissions).values(permissions.map(p => ({ userId, studioId: invitation.studioId, module: p.module, canRead: p.canRead ? 1 : 0, canWrite: p.canWrite ? 1 : 0 })));
    await tx.update(studioInvitations).set({ status: 'accepted', acceptedUserId: userId, acceptedAt: timestamp() }).where(eq(studioInvitations.id, invitation.id));
    return { success: true as const };
  });
}
