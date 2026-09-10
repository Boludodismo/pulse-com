import { createHash, randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from './db';
import { studios, studioInvitations, users, calendars } from '../drizzle/schema';
import { hashPassword } from './_core/localAuth';
import { invitationExpiresAt, parseAccessExpiry } from './saas';

export const pilotToken = z.string().regex(/^[a-f0-9]{64}$/);
export const pilotRegistration = z.object({
  token: pilotToken,
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(320).transform(v => v.toLowerCase()),
  studioName: z.string().trim().min(2).max(255),
  password: z.string().min(10, 'Use pelo menos 10 caracteres.').max(72)
    .refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Senha muito longa.'),
});
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
// Namespace separates pilot registration from legacy account reassignment.
const tokenHash = (token: string) => 'pilot:' + digest(token);
const unavailable = () => new TRPCError({ code: 'BAD_REQUEST', message: 'Convite inválido, expirado, revogado ou já utilizado.' });
export function assertPilotPending(invitation: { status: string; expiresAt: string; artistId: number | null; role: string; tokenHash: string } | undefined) {
  if (!invitation || !invitation.tokenHash.startsWith('pilot:') || invitation.artistId != null || invitation.role !== 'admin' || invitation.status !== 'pending' || !(parseAccessExpiry(invitation.expiresAt) > Date.now())) throw unavailable();
}
async function connection() { const db = await getDb(); if (!db) throw new TRPCError({code:'SERVICE_UNAVAILABLE'}); return db; }

export async function issuePilotInvitation(input: { email: string; studioName: string; invitedByUserId: number }) {
  const db = await connection();
  const email = input.email.trim().toLowerCase();
  return db.transaction(async tx => {
    const [existing] = await tx.select({id:users.id}).from(users).where(sql`lower(trim(${users.email})) = ${email}`).limit(1);
    if (existing) throw new TRPCError({code:'CONFLICT',message:'Este e-mail já possui uma conta. Use outro e-mail; nenhuma conta existente será alterada.'});
    const [pending] = await tx.select({id:studioInvitations.id}).from(studioInvitations).where(and(eq(studioInvitations.email,email),eq(studioInvitations.status,'pending'),sql`${studioInvitations.tokenHash} like 'pilot:%'`,sql`${studioInvitations.expiresAt} > UTC_TIMESTAMP()`)).limit(1);
    if (pending) throw new TRPCError({code:'CONFLICT',message:'Já existe um convite piloto pendente para este e-mail. Revogue-o antes de gerar outro.'});
    const studio = await tx.insert(studios).values({name:input.studioName,email,masterKey:randomBytes(32).toString('hex'),isActive:1});
    const studioId = Number(studio[0].insertId);
    const token = randomBytes(32).toString('hex');
    const expiresAt = invitationExpiresAt();
    await tx.insert(studioInvitations).values({studioId,email,role:'admin',tokenHash:tokenHash(token),status:'pending',expiresAt,invitedByUserId:input.invitedByUserId});
    return {token,expiresAt:expiresAt.replace(' ','T')+'Z',studioId};
  });
}
export async function inspectPilotInvitation(token: string) {
  const db = await connection();
  const [invitation] = await db.select().from(studioInvitations).where(eq(studioInvitations.tokenHash,tokenHash(token))).limit(1);
  assertPilotPending(invitation);
  const [studio] = await db.select({name:studios.name,isActive:studios.isActive}).from(studios).where(eq(studios.id,invitation.studioId)).limit(1);
  if (!studio?.isActive) throw unavailable();
  return {studioName:studio.name,expiresAt:invitation.expiresAt};
}
export async function registerPilot(input: z.infer<typeof pilotRegistration>) {
  const data = pilotRegistration.parse(input);
  await inspectPilotInvitation(data.token);
  const passwordHash = await hashPassword(data.password);
  const db = await connection();
  return db.transaction(async tx => {
    const [invitation] = await tx.select().from(studioInvitations).where(eq(studioInvitations.tokenHash,tokenHash(data.token))).limit(1).for('update');
    assertPilotPending(invitation);
    if (invitation.email !== data.email) throw new TRPCError({code:'BAD_REQUEST',message:'Informe o e-mail para o qual o convite foi criado.'});
    const [studio] = await tx.select().from(studios).where(eq(studios.id,invitation.studioId)).limit(1).for('update');
    if (!studio?.isActive) throw unavailable();
    const [existing] = await tx.select({id:users.id}).from(users).where(sql`lower(trim(${users.email})) = ${data.email} OR ${users.studioId} = ${invitation.studioId}`).limit(1);
    if (existing) throw new TRPCError({code:'CONFLICT',message:'Já existe uma conta para este e-mail ou estúdio. Nenhuma conta foi alterada.'});
    // Stable unique openId prevents two concurrent pilot invites creating the same login.
    const result = await tx.insert(users).values({openId:'pilot:'+digest(data.email).slice(0,58),name:data.name,email:data.email,passwordHash,loginMethod:'local',role:'admin',studioId:invitation.studioId,isActive:1,accessStatus:'active',accessExpiresAt:null});
    const userId = Number(result[0].insertId);
    await tx.update(studios).set({name:data.studioName}).where(eq(studios.id,invitation.studioId));
    await tx.insert(calendars).values({userId,name:'Agenda do estúdio',color:'#ff7900',isVisible:1,isDefault:1});
    await tx.update(studioInvitations).set({status:'accepted',acceptedUserId:userId,acceptedAt:new Date().toISOString().slice(0,19).replace('T',' ')}).where(eq(studioInvitations.id,invitation.id));
    return {success:true as const};
  });
}
