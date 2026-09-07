import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {and,eq,desc,isNull,ne} from 'drizzle-orm';
import {router,tenantProcedure,publicProcedure} from '../_core/trpc';
import {getDb} from '../db';
import {clients,whatsappIntegrations,messageAutomationSettings} from '../../drizzle/schema';
import {careRules,careEvents,careTags} from '../../drizzle/customerCareSchema';
import {CARE_DEFAULTS,normalizeCareTags} from '../../shared/customerCare';
const database=async()=>{ const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Banco indisponível.'});return db; };
const manager=(ctx:any)=>{if(!['admin','superadmin'].includes(ctx.user.role))throw new TRPCError({code:'FORBIDDEN'});};
async function requireClient(ctx:any,id:number){const db=await database();const row=(await db.select().from(clients).where(and(eq(clients.id,id),eq(clients.studioId,ctx.studioId))).limit(1))[0];if(!row || (ctx.user.role==='collaborator' && (!ctx.artistId || row.artistId!==ctx.artistId)))throw new TRPCError({code:'FORBIDDEN'});return row;}
export const customerCareRouter=router({
 rules:tenantProcedure.query(async({ctx})=>{const db=await database();return db.select().from(careRules).where(eq(careRules.studioId,ctx.studioId));}),
 defaults:tenantProcedure.mutation(async({ctx})=>{manager(ctx);const db=await database();for(const rule of CARE_DEFAULTS){const exists=(await db.select({id:careRules.id}).from(careRules).where(and(eq(careRules.studioId,ctx.studioId),eq(careRules.name,rule.name))).limit(1))[0];if(!exists)await db.insert(careRules).values({...rule,studioId:ctx.studioId,enabled:0,sendTime:'09:00'}).onDuplicateKeyUpdate({set:{name:rule.name}});}return{ok:true};}),
 saveRule:tenantProcedure.input(z.object({id:z.number().optional(),name:z.string().trim().min(2).max(120),kind:z.enum(['birthday','session']),amount:z.number().int().min(0).max(365),unit:z.enum(['days','months','years']),body:z.string().min(10).max(3000),enabled:z.boolean()})).mutation(async({ctx,input})=>{
  manager(ctx);const db=await database();
  if(input.kind==='session' && input.amount<1)throw new TRPCError({code:'BAD_REQUEST',message:'Informe um intervalo maior que zero.'});
  if(input.enabled){const ready=await db.select({id:whatsappIntegrations.id}).from(whatsappIntegrations).where(and(eq(whatsappIntegrations.studioId,ctx.studioId),eq(whatsappIntegrations.isEnabled,1),eq(whatsappIntegrations.status,'ativo'))).limit(1);if(!ready.length)throw new TRPCError({code:'BAD_REQUEST',message:'Salve o modelo como inativo. Para ativar, configure e teste uma conexão WhatsApp deste estúdio.'});}
  if(input.kind==='birthday'&&input.enabled){const other=(await db.select({id:careRules.id}).from(careRules).where(and(eq(careRules.studioId,ctx.studioId),eq(careRules.kind,'birthday'),eq(careRules.enabled,1),input.id?ne(careRules.id,input.id):undefined)).limit(1))[0];if(other)throw new TRPCError({code:'BAD_REQUEST',message:'Mantenha apenas uma mensagem de aniversário ativa por estúdio.'});}
  const {id,...fields}=input;const data={...fields,enabled:input.enabled?1:0,sendTime:'09:00'};
  if(id){const existing=(await db.select({id:careRules.id}).from(careRules).where(and(eq(careRules.id,id),eq(careRules.studioId,ctx.studioId))).limit(1))[0];if(!existing)throw new TRPCError({code:'NOT_FOUND'});await db.update(careRules).set(data).where(and(eq(careRules.id,id),eq(careRules.studioId,ctx.studioId)));}
  else await db.insert(careRules).values({...data,studioId:ctx.studioId});
  if(input.kind==='birthday' && input.enabled)await db.update(messageAutomationSettings).set({birthdayMessagesEnabled:0}).where(eq(messageAutomationSettings.studioId,ctx.studioId));
  return{ok:true};
 }),
 history:tenantProcedure.input(z.object({clientId:z.number().optional()}).optional()).query(async({ctx,input})=>{
  if(input?.clientId)await requireClient(ctx,input.clientId);const db=await database();
  if(ctx.user.role==='collaborator' && !ctx.artistId)return [];
  return db.select({id:careEvents.id,clientId:careEvents.clientId,clientName:clients.name,artistId:careEvents.artistId,appointmentId:careEvents.appointmentId,dueDate:careEvents.dueDate,status:careEvents.status,message:careEvents.message,feedback:careEvents.feedback,feedbackAt:careEvents.feedbackAt,readAt:careEvents.readAt})
  .from(careEvents).leftJoin(clients,and(eq(clients.id,careEvents.clientId),eq(clients.studioId,ctx.studioId)))
  .where(and(eq(careEvents.studioId,ctx.studioId),input?.clientId?eq(careEvents.clientId,input.clientId):undefined,ctx.user.role==='collaborator'?eq(careEvents.artistId,ctx.artistId!):undefined)).orderBy(desc(careEvents.feedbackAt),desc(careEvents.dueDate)).limit(200);
 }),
 markRead:tenantProcedure.input(z.object({id:z.number()})).mutation(async({ctx,input})=>{if(ctx.user.role==='collaborator'&&!ctx.artistId)throw new TRPCError({code:'FORBIDDEN'});const db=await database();await db.update(careEvents).set({readAt:new Date().toISOString().slice(0,19).replace('T',' ')}).where(and(eq(careEvents.id,input.id),eq(careEvents.studioId,ctx.studioId),ctx.user.role==='collaborator'?eq(careEvents.artistId,ctx.artistId!):undefined));return{ok:true};}),
 tags:tenantProcedure.input(z.object({clientId:z.number()})).query(async({ctx,input})=>{await requireClient(ctx,input.clientId);return(await database()).select({label:careTags.label}).from(careTags).where(and(eq(careTags.studioId,ctx.studioId),eq(careTags.clientId,input.clientId)));}),
 saveTags:tenantProcedure.input(z.object({clientId:z.number(),labels:z.array(z.string().trim().min(1).max(60)).max(30)})).mutation(async({ctx,input})=>{await requireClient(ctx,input.clientId);const db=await database();await db.transaction(async tx=>{await tx.delete(careTags).where(and(eq(careTags.studioId,ctx.studioId),eq(careTags.clientId,input.clientId)));const labels=normalizeCareTags(input.labels);if(labels.length)await tx.insert(careTags).values(labels.map(label=>({studioId:ctx.studioId,clientId:input.clientId,label})));});return{ok:true};}),
 feedbackInfo:publicProcedure.input(z.object({token:z.string().regex(/^[a-f0-9]{64}$/)})).query(async({input})=>{
  const db=await database();const event=(await db.select().from(careEvents).where(eq(careEvents.token,input.token)).limit(1))[0];if(!event || !['queued','responded'].includes(event.status) || Date.now()>Date.parse(event.dueDate+'T00:00:00Z')+90*86400000)throw new TRPCError({code:'NOT_FOUND',message:'Link indisponível ou expirado.'});
  return{answered:!!event.feedback,title:'Como foi sua experiência?'};
 }),
 feedback:publicProcedure.input(z.object({token:z.string().regex(/^[a-f0-9]{64}$/),text:z.string().trim().min(2).max(4000)})).mutation(async({input})=>{
  const db=await database();const event=(await db.select().from(careEvents).where(eq(careEvents.token,input.token)).limit(1))[0];if(!event || event.status!=='queued' || Date.now()>Date.parse(event.dueDate+'T00:00:00Z')+90*86400000)throw new TRPCError({code:'BAD_REQUEST',message:'Link expirado ou resposta já recebida.'});
  await db.update(careEvents).set({feedback:input.text,feedbackAt:new Date().toISOString().slice(0,19).replace('T',' '),status:'responded',readAt:null}).where(and(eq(careEvents.id,event.id),isNull(careEvents.feedback)));return{ok:true};
 }),
});
