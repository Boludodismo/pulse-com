import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {router,tenantProcedure,publicProcedure} from '../_core/trpc';
import {enforceRateLimit} from '../security/rateLimit';
import {ATTENDANCE_ACTIONS} from '../../shared/attendance';
import {applyAttendance,applyPublicAttendance,attendanceHistory,attendanceView,publicAttendanceView,requireAttendanceAppointment} from './service';
const token=z.string().regex(/^[a-f0-9]{64}$/);
const action=z.enum(ATTENDANCE_ACTIONS), revision=z.number().int().min(0);
export const attendanceRouter=router({
  view:tenantProcedure.input(z.object({appointmentId:z.number().int().positive()})).query(({ctx,input})=>attendanceView(input.appointmentId,ctx.studioId,ctx.artistId,ctx.user.role==='collaborator')),
  act:tenantProcedure.input(z.object({appointmentId:z.number().int().positive(),action,revision})).mutation(async({ctx,input})=>{
    await requireAttendanceAppointment(input.appointmentId,ctx.studioId,ctx.artistId,ctx.user.role==='collaborator');
    try{return await applyAttendance({...input,studioId:ctx.studioId,source:`crm_user:${ctx.user.id}`,actorArtistId:ctx.user.role==='collaborator'?ctx.artistId!:undefined});}
    catch(error){if(error instanceof TRPCError)throw error;throw new TRPCError({code:'BAD_REQUEST',message:error instanceof Error?error.message:'Não foi possível registrar o atendimento.'});}
  }),
  history:tenantProcedure.input(z.object({clientId:z.number().int().positive()})).query(({ctx,input})=>attendanceHistory(input.clientId,ctx.studioId,ctx.artistId,ctx.user.role==='collaborator')),
  publicView:publicProcedure.input(z.object({token})).query(({input})=>publicAttendanceView(input.token)),
  publicAct:publicProcedure.input(z.object({token,action,revision})).mutation(async({ctx,input})=>{
    await enforceRateLimit(ctx.req,'attendance-action',input.token,60,60000);
    try{return await applyPublicAttendance(input);}catch(error){if(error instanceof TRPCError)throw error;throw new TRPCError({code:'BAD_REQUEST',message:error instanceof Error?error.message:'Não foi possível registrar o atendimento.'});}
  }),
});
