import { automaticReminderIdempotencyKey } from "./automaticReminders";
import {randomBytes,createHash} from 'node:crypto';
import {and,eq,gte,lte,isNull,desc} from 'drizzle-orm';
import {getDb} from '../db';
import {appointments,technicalProcedures,clients,artists,studios,whatsappIntegrations,messageAutomationSettings,integrationContacts,messageQueue} from '../../drizzle/schema';
import {careRules,careEvents,careSessions} from '../../drizzle/customerCareSchema';
import {careDueDate,renderCareMessage} from '../../shared/customerCare';
import {firstName} from './messagePresentation';
import {sendAndLog} from './service';
import {normalizeBrazilianPhone} from './phone';
export function careClock(now:Date,timezone:string) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(key:string)=>parts.find(p=>p.type===key)?.value??'00';return{date:`${part('year')}-${part('month')}-${part('day')}`,time:`${part('hour')}:${part('minute')}`};
}
export async function runCustomerCareCycle() {
 const db=await getDb();if(!db)return;
 const rules=await db.select().from(careRules).where(eq(careRules.enabled,1));
 for(const studioId of Array.from(new Set(rules.map(r=>r.studioId)))) {
  const studioRules=rules.filter(r=>r.studioId===studioId);
  const integration=(await db.select().from(whatsappIntegrations).where(and(eq(whatsappIntegrations.studioId,studioId),eq(whatsappIntegrations.status,'ativo'),eq(whatsappIntegrations.isEnabled,1))).limit(1))[0];if(!integration)continue;
  const settings=(await db.select().from(messageAutomationSettings).where(eq(messageAutomationSettings.studioId,studioId)).limit(1))[0];const timezone=settings?.timezone||'America/Sao_Paulo';
  const clock=careClock(new Date(),timezone);
  const studio=(await db.select().from(studios).where(eq(studios.id,studioId)).limit(1))[0];
  // Capture the first observed completion once; later edits cannot restart follow-up.
  const completed=await db.select().from(appointments).where(and(eq(appointments.studioId,studioId),eq(appointments.status,'concluido')));
  for(const a of completed)await db.insert(careSessions).values({studioId,clientId:a.clientId,artistId:a.artistId,appointmentId:a.id,sourceKey:`appointment:${a.id}`,completedAt:a.updatedAt}).onDuplicateKeyUpdate({set:{sourceKey:`appointment:${a.id}`}});
  const procedures=await db.select().from(technicalProcedures).where(and(eq(technicalProcedures.studioId,studioId),eq(technicalProcedures.status,'finalizado')));
  for(const p of procedures){const key=p.appointmentId?`appointment:${p.appointmentId}`:`procedure:${p.id}`;await db.insert(careSessions).values({studioId,clientId:p.clientId,artistId:p.artistId,appointmentId:p.appointmentId,sourceKey:key,completedAt:p.finishedAt||p.updatedAt}).onDuplicateKeyUpdate({set:{sourceKey:key}});}
  const sessions=await db.select().from(careSessions).where(eq(careSessions.studioId,studioId));
  const studioClients=await db.select().from(clients).where(eq(clients.studioId,studioId));
  const studioArtists=await db.select().from(artists).where(eq(artists.studioId,studioId));
  const origin=process.env.PUBLIC_URL||process.env.APP_BASE_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:'');if(!origin)continue;
  for(const rule of studioRules){
   const occurrences=rule.kind==='birthday'?studioClients.filter(c=>c.birthDate?.slice(5,10)===clock.date.slice(5,10)).map(c=>({clientId:c.id,artistId:c.artistId,appointmentId:null as number|null,date:clock.date,key:`birthday:${c.id}:${clock.date}`})):
    sessions.filter(s=>s.completedAt>=rule.createdAt).map(s=>({clientId:s.clientId,artistId:s.artistId,appointmentId:s.appointmentId,date:careDueDate(careClock(new Date(s.completedAt.replace(' ','T')+'Z'),timezone).date,rule.amount,rule.unit),key:`session:${s.id}:${rule.id}`}));
   for(const occurrence of occurrences){
    const client=studioClients.find(c=>c.id===occurrence.clientId);if(!client)continue;
    const key=createHash('sha256').update(`care:${studioId}:${occurrence.key}`).digest('hex');const token=randomBytes(32).toString('hex');
    const feedbackUrl=`${origin.replace(/\/$/,'')}/feedback/${token}`;
    let body=renderCareMessage(rule.body,{primeiro_nome:firstName(client.name),nome_cliente:firstName(client.name),nome_artista:studioArtists.find(a=>a.id===occurrence.artistId)?.name||'nossa equipe',nome_estudio:studio?.name||'nosso estúdio',link_feedback:feedbackUrl});
    if(rule.kind==='session'&&!rule.body.includes('{link_feedback}'))body+=`\nConte para a gente: ${feedbackUrl}`;
    await db.insert(careEvents).values({studioId,ruleId:rule.id,clientId:client.id,artistId:occurrence.artistId,appointmentId:occurrence.appointmentId,dueDate:occurrence.date,occurrenceKey:key,token,message:body}).onDuplicateKeyUpdate({set:{occurrenceKey:key}});
   }
   // At 09:00 studio time (minute scheduler); retry only during that morning hour.
   if(clock.time<'09:00'||clock.time>='10:00')continue;
   const due=await db.select().from(careEvents).where(and(eq(careEvents.studioId,studioId),eq(careEvents.ruleId,rule.id),eq(careEvents.status,'pending'),lte(careEvents.dueDate,clock.date),gte(careEvents.dueDate,rule.kind==='birthday'?clock.date:careDueDate(clock.date,-1,'days'))));
   for(const event of due){
    const client=studioClients.find(c=>c.id===event.clientId);if(!client?.phone)continue;
    const consent=(await db.select({id:integrationContacts.id}).from(integrationContacts).where(and(eq(integrationContacts.studioId,studioId),eq(integrationContacts.integrationId,integration.id),eq(integrationContacts.clientId,event.clientId),eq(integrationContacts.hasWhatsappOptIn,1),isNull(integrationContacts.optedOutAt))).limit(1))[0];if(!consent)continue;
    const feedbackUrl=`${origin.replace(/\/$/,'')}/feedback/${event.token}`;
    let outgoing=renderCareMessage(rule.body,{primeiro_nome:firstName(client.name),nome_cliente:firstName(client.name),nome_artista:studioArtists.find(a=>a.id===event.artistId)?.name||'nossa equipe',nome_estudio:studio?.name||'nosso estúdio',link_feedback:feedbackUrl});
    if(rule.kind==='session'&&!rule.body.includes('{link_feedback}'))outgoing+=`\nConte para a gente: ${feedbackUrl}`;
    const sent=await sendAndLog({studioId,integrationId:integration.id,recipientType:'client',recipientPhone:normalizeBrazilianPhone(client.phone),recipientName:client.name,clientId:event.clientId,appointmentId:event.appointmentId??undefined,message:outgoing,trigger:'customer_care',idempotencyKey:rule.kind==='birthday'?automaticReminderIdempotencyKey('birthday',integration.id,event.clientId,event.dueDate):`care:${event.occurrenceKey}`});
    if(sent.success)await db.update(careEvents).set({status:'queued',message:outgoing,queueId:sent.messageId?Number(sent.messageId):null}).where(eq(careEvents.id,event.id));
   }
  }
 }
}
// A free-text WhatsApp reply is attached only when the latest outbound message
// is an identified care request. Other replies retain their existing workflow.
export async function recordCareWhatsappReply(studioId:number,phone:string,text:string) {
 const db=await getDb();if(!db)return false;
 const recent=await db.select().from(messageQueue).where(and(eq(messageQueue.studioId,studioId),eq(messageQueue.recipientType,'client'),eq(messageQueue.recipientPhone,normalizeBrazilianPhone(phone)))).orderBy(desc(messageQueue.sentAt),desc(messageQueue.id)).limit(1);
 const message=recent[0];if(!message||message.trigger!=='customer_care'||!message.sentAt)return false;
 const event=(await db.select().from(careEvents).where(and(eq(careEvents.studioId,studioId),eq(careEvents.clientId,message.clientId!),eq(careEvents.message,message.message))).limit(1))[0];if(!event||Date.now()-Date.parse(message.sentAt.replace(' ','T')+'Z')>90*86400000)return false;
 await db.update(careEvents).set({feedback:((event.feedback?event.feedback+'\n\n':'')+text).slice(-12000),feedbackAt:new Date().toISOString().slice(0,19).replace('T',' '),readAt:null,status:'responded'}).where(eq(careEvents.id,event.id));return true;
}
