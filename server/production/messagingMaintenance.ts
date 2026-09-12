import mysql, {type Connection, type RowDataPacket} from 'mysql2/promise';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {normalizeBrazilianPhone} from '../messaging/phone';
import {decryptIntegrationSecret} from '../messaging/crypto';
import {BotConversaProvider} from '../messaging/providers/botconversa';
import {zonedSqlDateTime} from '../../shared/studioClock';

export function consentIdentityFingerprint(studioId:number, clientId:number, phone:string) {
  return createHash('sha256').update(JSON.stringify({studioId,clientId,phone:normalizeBrazilianPhone(phone)})).digest('hex');
}

/** Explicit one-client maintenance operation. Existing refusals are never overwritten. */
export async function repairMissingConsent(c:Connection, input:{studioId:number;clientId:number;actorId:number;fingerprint:string;authorizationId:string;expiresAt:string}) {
  const expiry=Date.parse(input.expiresAt);
  if (!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+3600000) throw new Error('A autorização de manutenção deve expirar em até uma hora.');
  if (!/^[a-f0-9]{64}$/.test(input.fingerprint)||!/^[a-zA-Z0-9_-]{8,60}$/.test(input.authorizationId)) throw new Error('Identificação de manutenção inválida.');
  await c.beginTransaction();
  try {
    const [actor]=await c.execute<RowDataPacket[]>('SELECT id,role,studioId FROM users WHERE id=? AND isActive=1',[input.actorId]);
    if (!actor[0]||!['admin','superadmin'].includes(actor[0].role)||Number(actor[0].studioId)!==input.studioId) throw new Error('Gestor não pertence ao estúdio informado.');
    const [client]=await c.execute<RowDataPacket[]>('SELECT id,phone FROM clients WHERE id=? AND studioId=? AND isArchived=0 FOR UPDATE',[input.clientId,input.studioId]);
    if (!client[0]||consentIdentityFingerprint(input.studioId,input.clientId,client[0].phone)!==input.fingerprint) throw new Error('O cadastro mudou ou não corresponde à autorização.');
    const [integrations]=await c.execute<RowDataPacket[]>('SELECT id FROM whatsapp_integrations WHERE studio_id=? AND status=? AND is_enabled=1',[input.studioId,'ativo']);
    if(integrations.length!==1) throw new Error('A manutenção exige uma única integração ativa no estúdio.');
    const integrationId=Number(integrations[0].id);
    const operationKey=createHash('sha256').update(`consent-repair:${input.studioId}:${input.clientId}:${input.authorizationId}`).digest('hex');
    const [audit]=await c.execute<RowDataPacket[]>('SELECT id FROM integration_events WHERE idempotency_key=?',[operationKey]);
    if(audit.length){await c.rollback();return {result:'already_applied'};}
    const [existing]=await c.execute<RowDataPacket[]>('SELECT integration_id,has_whatsapp_opt_in,opted_out_at FROM integration_contacts WHERE studio_id=? AND client_id=? FOR UPDATE',[input.studioId,input.clientId]);
    if(existing.length){
      if(Number(existing[0].integration_id)===integrationId&&Number(existing[0].has_whatsapp_opt_in)===1&&!existing[0].opted_out_at){await c.rollback();return {result:'already_authorized'};}
      throw new Error('Já existe uma permissão ou recusa no cadastro; manutenção não aplicada.');
    }
    await c.execute('INSERT INTO integration_contacts(studio_id,integration_id,client_id,normalized_phone,has_whatsapp_opt_in,opt_in_at,opt_in_source) VALUES(?,?,?,?,1,UTC_TIMESTAMP(),?)',[input.studioId,integrationId,input.clientId,normalizeBrazilianPhone(client[0].phone),`gestor:${input.actorId}:${input.authorizationId}`]);
    await c.execute("INSERT INTO integration_events(studio_id,integration_id,direction,type,idempotency_key,payload_hash,status,processed_at) VALUES(?,?,'inbound','explicit_consent_repair',?,?,'processed',UTC_TIMESTAMP())",[input.studioId,integrationId,operationKey,input.fingerprint]);
    await c.commit();return {result:'created',studioId:input.studioId,clientId:input.clientId,integrationId};
  }catch(error){await c.rollback();throw error;}
}

async function main(){
  const args=Object.fromEntries(process.argv.slice(2).map(value=>{const index=value.indexOf('=');return [value.slice(2,index),value.slice(index+1)]}));
  const studioId=Number(args.studio);
  if(!Number.isSafeInteger(studioId)||studioId<=0) throw new Error('Informe --studio=<id>.');
  const c=await mysql.createConnection({uri:process.env.DATABASE_URL!,dateStrings:true});
  try {
    if(args['grant-client']) console.log('[Messaging maintenance]',JSON.stringify(await repairMissingConsent(c,{studioId,clientId:Number(args['grant-client']),actorId:Number(args.actor),fingerprint:args.fingerprint??'',authorizationId:args.authorization??'',expiresAt:args.expires??''})));
    const now=zonedSqlDateTime(new Date(),'America/Sao_Paulo');
    const cutoff=zonedSqlDateTime(new Date(Date.now()-86400000),'America/Sao_Paulo');
    const [integrations]=await c.execute<RowDataPacket[]>('SELECT id,provider,status,is_enabled,sandbox_mode,phoneNumber,encrypted_api_token,apiToken FROM whatsapp_integrations WHERE studio_id=?',[studioId]);
    const active=integrations.filter(row=>row.status==='ativo'&&Number(row.is_enabled)===1);
    console.log('[Messaging maintenance] integrations',JSON.stringify(integrations.map(row=>({id:row.id,provider:row.provider,status:row.status,enabled:row.is_enabled,sandbox:row.sandbox_mode}))));
    const [reminders]=await c.execute<RowDataPacket[]>("SELECT r.id,r.scheduledAt,a.id AS appointmentId,a.date AS appointmentDate,a.status AS appointmentStatus,a.clientId,c.phone FROM appointmentReminders r JOIN appointments a ON a.id=r.appointmentId LEFT JOIN clients c ON c.id=a.clientId AND c.studioId=a.studioId WHERE a.studioId=? AND r.status='pending' AND r.scheduledAt BETWEEN ? AND ? ORDER BY r.id LIMIT 100",[studioId,cutoff,now]);
    for(const row of reminders){
      const [consents]=await c.execute<RowDataPacket[]>('SELECT integration_id,has_whatsapp_opt_in,opted_out_at FROM integration_contacts WHERE studio_id=? AND client_id=?',[studioId,row.clientId]);
      const consent=consents.find(item=>active.some(integration=>integration.id===item.integration_id));
      const reason=!row.phone?'missing_phone':active.length!==1?'active_integration_count':!consent?'missing_consent':consent.opted_out_at?'revoked_consent':Number(consent.has_whatsapp_opt_in)!==1?'inactive_consent':'eligible';
      console.log('[Messaging maintenance] reminder',JSON.stringify({studioId,id:row.id,clientId:row.clientId,appointmentId:row.appointmentId,appointmentDate:row.appointmentDate,appointmentStatus:row.appointmentStatus,scheduledAt:row.scheduledAt,reason,fingerprint:row.phone?consentIdentityFingerprint(studioId,row.clientId,row.phone):null,consents:consents.map(item=>({integrationId:item.integration_id,active:item.has_whatsapp_opt_in,revoked:Boolean(item.opted_out_at)}))}));
    }
    for(const integration of active){
      if(integration.provider!=='botconversa')continue;
      const token=integration.encrypted_api_token?decryptIntegrationSecret(integration.encrypted_api_token):integration.apiToken;
      const result=await new BotConversaProvider({provider:'botconversa',apiToken:token,phoneNumber:integration.phoneNumber}).testConnection();
      console.log('[Messaging maintenance] providerAuth',JSON.stringify({integrationId:integration.id,...result}));
    }
    const [messages]=await c.execute<RowDataPacket[]>('SELECT id,clientId,appointmentId,status,providerMessageId,sentAt FROM message_queue WHERE studio_id=? ORDER BY id DESC LIMIT 15',[studioId]);
    console.log('[Messaging maintenance] recentMessages',JSON.stringify(messages));
  }finally{await c.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main().then(()=>process.exit(0)).catch(()=>{console.error('[Messaging maintenance] Falha; nenhuma credencial foi registrada no log.');process.exit(1)});
