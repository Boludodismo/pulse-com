import {createHash} from 'node:crypto';
import {and,eq,isNotNull,isNull,desc,sql} from 'drizzle-orm';
import {careEvents} from '../../drizzle/customerCareSchema';
import {clients} from '../../drizzle/schema';
import {getDb} from '../db';
import {queueArtistOperationalNotice} from './artistNotifications';

export function careFeedbackVersion(feedback:string) {
 return createHash('sha256').update(feedback).digest('hex');
}
export function formatCareFeedbackNotice(input:{id:number;clientName:string;appointmentId:number|null;message:string;feedback:string},origin:string) {
 const link=new URL(`/acompanhamento/${input.id}`,origin).toString();
 const question=input.message.replace(/https?:\/\/\S+\/feedback\/\S+/g,'[link de feedback do atendimento]');
 const body=`Mensagem enviada ao cliente:\n${question}\n\nResposta recebida:\n${input.feedback}`;
 const parts:string[]=[];
 let rest=body;
 while(rest.length){let end=Math.min(rest.length,3000);if(end<rest.length&&/[\uD800-\uDBFF]/.test(rest[end-1]))end--;parts.push(rest.slice(0,end));rest=rest.slice(end);}
 return parts.map((part,index)=>`Novo feedback no Tatuei\nCliente: ${input.clientName}${input.appointmentId?`\nAtendimento #${input.appointmentId}`:''}${parts.length>1?`\nParte ${index+1}/${parts.length}`:''}\n\n${part}\n\nAbra no CRM para consultar e marcar como lida:\n${link}`);
}

/** Resolve the recipient from the saved care event, never from a submitted phone or client owner. */
export async function queueCareFeedbackArtistNotice(studioId:number,eventId:number) {
 try {
  const db=await getDb();if(!db)return false;
  const [event]=await db.select({id:careEvents.id,studioId:careEvents.studioId,artistId:careEvents.artistId,clientId:careEvents.clientId,appointmentId:careEvents.appointmentId,message:careEvents.message,feedback:careEvents.feedback,clientName:clients.name})
   .from(careEvents).leftJoin(clients,and(eq(clients.id,careEvents.clientId),eq(clients.studioId,careEvents.studioId)))
   .where(and(eq(careEvents.id,eventId),eq(careEvents.studioId,studioId),eq(careEvents.status,'responded'))).limit(1);
  if(!event?.artistId||!event.feedback||!event.clientName)return false;
  const origin=process.env.PUBLIC_URL||process.env.APP_BASE_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:'');
  if(!origin)return false;
  const messages=formatCareFeedbackNotice({...event,clientName:event.clientName,feedback:event.feedback},origin);
  const key=`care-feedback:${studioId}:${event.id}:${event.artistId}:${careFeedbackVersion(event.feedback)}`;
  for(let index=0;index<messages.length;index++){
   const queued=await queueArtistOperationalNotice({studioId,artistId:event.artistId,clientId:event.clientId,appointmentId:event.appointmentId??undefined,
    trigger:`care_artist_feedback:${event.id}`,message:messages[index],idempotencyKey:`${key}:${index===messages.length-1?'done':index}`});
   if(!queued)return false;
  }
  return true;
 }catch{console.warn('[CustomerCare] Aviso ao artista pendente.',{studioId,eventId});return false;}
}

/** Recover only unread feedback not fully queued; the durable jobs own provider retries. */
export async function recoverCareFeedbackArtistNotices() {
 const db=await getDb();if(!db)return;
 const events=await db.select({id:careEvents.id,studioId:careEvents.studioId}).from(careEvents)
  .where(and(eq(careEvents.status,'responded'),isNotNull(careEvents.artistId),isNotNull(careEvents.feedback),isNull(careEvents.readAt),
   sql`NOT EXISTS (SELECT 1 FROM integration_jobs j WHERE j.studio_id=${careEvents.studioId} AND j.idempotency_key=CONCAT('care-feedback:',${careEvents.studioId},':',${careEvents.id},':',${careEvents.artistId},':',SHA2(${careEvents.feedback},256),':done'))`))
  .orderBy(desc(careEvents.feedbackAt)).limit(50);
 for(const event of events)await queueCareFeedbackArtistNotice(event.studioId,event.id);
}
