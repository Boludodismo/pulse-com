import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, tenantProcedure } from '../_core/trpc';
import { issueArtistInvitation, inspectArtistInvitation, registerInvitedArtist, permissionInput, tokenInput, invitationPassword } from '../artistInvitations';
import { listUserPermissions } from '../saas';
import { getDb } from '../db';
import { studioInvitations } from '../../drizzle/schema';
const manager = tenantProcedure.use(({ctx,next}) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'superadmin') throw new TRPCError({code:'FORBIDDEN',message:'Apenas o proprietário ou superadministrador pode gerenciar convites.'});
  return next({ctx});
});
export const artistInvitationsRouter = router({
  access: tenantProcedure.query(({ctx}) => listUserPermissions(ctx.user.id,ctx.studioId)),
  issue: manager.input(z.object({artistId:z.number().int().positive(),permissions:permissionInput})).mutation(({ctx,input}) => issueArtistInvitation({...input,studioId:ctx.studioId,invitedByUserId:ctx.user.id})),
  list: manager.input(z.object({artistId:z.number().int().positive()})).query(async ({ctx,input}) => {
    const db = await getDb(); if (!db) return [];
    return db.select({id:studioInvitations.id,status:studioInvitations.status,email:studioInvitations.email,expiresAt:studioInvitations.expiresAt}).from(studioInvitations).where(and(eq(studioInvitations.studioId,ctx.studioId),eq(studioInvitations.artistId,input.artistId))).orderBy(desc(studioInvitations.id)).limit(10);
  }),
  revoke: manager.input(z.object({id:z.number().int().positive()})).mutation(async ({ctx,input}) => {
    const db = await getDb(); if (!db) throw new TRPCError({code:'SERVICE_UNAVAILABLE'});
    await db.update(studioInvitations).set({status:'revoked',revokedAt:new Date().toISOString().slice(0,19).replace('T',' ')}).where(and(eq(studioInvitations.id,input.id),eq(studioInvitations.studioId,ctx.studioId),eq(studioInvitations.status,'pending')));
    return {success:true};
  }),
  inspect: publicProcedure.input(z.object({token:tokenInput})).query(({input}) => inspectArtistInvitation(input.token)),
  register: publicProcedure.input(z.object({token:tokenInput,password:invitationPassword})).mutation(async ({input,ctx}) => {
    if (ctx.user) throw new TRPCError({code:'CONFLICT',message:'Você já está conectado. Abra o convite em uma janela privada ou saia da conta antes de continuar.'});
    try { return await registerInvitedArtist(input.token,input.password); }
    catch(error) {
      if (error instanceof TRPCError) throw error;
      // Do not expose SQL, password hashes, or input values in public errors.
      console.error('[ArtistInvitations] Registration failed; no request data logged.');
      throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Não foi possível concluir o cadastro. Consulte o proprietário antes de tentar novamente.'});
    }
  }),
});
