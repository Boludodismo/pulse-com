import {createHash} from 'node:crypto';
import type {Connection,RowDataPacket} from 'mysql2/promise';
import {normalizeBrazilianPhone} from '../messaging/phone';

export async function planAnamnesisConsent(c:Connection,studioId:number,lock=false){
  const [integrations]=await c.execute<RowDataPacket[]>("SELECT id FROM whatsapp_integrations WHERE studio_id=? AND status='ativo' AND is_enabled=1",[studioId]);
  if(integrations.length!==1)throw new Error('Exige uma integração ativa.');
  const integrationId=Number(integrations[0].id);
  const [clients]=await c.execute<RowDataPacket[]>('SELECT id,phone,isArchived FROM clients WHERE studioId=? ORDER BY id'+(lock?' FOR UPDATE':''),[studioId]);
  const evidence=new Set<number>();
  for(const table of ['anamnese_submissions','anamnesisRecords']){
    const [rows]=await c.execute<RowDataPacket[]>(`SELECT DISTINCT a.clientId FROM ${table} a JOIN clients c ON c.id=a.clientId WHERE c.studioId=?`,[studioId]);
    for(const row of rows)evidence.add(Number(row.clientId));
  }
  const [imports]=await c.execute<RowDataPacket[]>('SELECT r.client_id,r.payload_json FROM client_import_records r JOIN clients c ON c.id=r.client_id AND c.studioId=r.studio_id WHERE r.studio_id=?',[studioId]);
  for(const row of imports){
    const payload=JSON.parse(row.payload_json);
    if(payload.sources?.some((source:{kind:string})=>source.kind==='anamnese'))evidence.add(Number(row.client_id));
  }
  const [consents]=await c.execute<RowDataPacket[]>('SELECT client_id,integration_id,has_whatsapp_opt_in,opted_out_at FROM integration_contacts WHERE studio_id=? ORDER BY client_id'+(lock?' FOR UPDATE':''),[studioId]);
  const rows=clients.filter(row=>evidence.has(Number(row.id))).map(client=>{
    const consent=consents.find(row=>Number(row.client_id)===Number(client.id));
    let phone='';try{phone=normalizeBrazilianPhone(client.phone??'')}catch{}
    const reason=client.isArchived?'archived':!phone?'invalid_phone':consent?.opted_out_at?'revoked':consent&&Number(consent.integration_id)!==integrationId?'other_integration':Number(consent?.has_whatsapp_opt_in)===1?'authorized':'authorize';
    return {clientId:Number(client.id),phone,reason,existing:Boolean(consent)};
  });
  const hash=createHash('sha256').update(JSON.stringify({studioId,integrationId,rows})).digest('hex');
  const counts=Object.fromEntries(['authorize','authorized','revoked','invalid_phone','archived','other_integration'].map(reason=>[reason,rows.filter(row=>row.reason===reason).length]));
  return {studioId,integrationId,hash,total:rows.length,counts,rows};
}

export async function applyAnamnesisConsent(c:Connection,input:{studioId:number;actorId:number;hash:string;authorizationId:string;expiresAt:string}){
  const expiry=Date.parse(input.expiresAt);
  if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+3600000||!/^[a-f0-9]{64}$/.test(input.hash)||!/^[a-zA-Z0-9_-]{8,60}$/.test(input.authorizationId))throw new Error('Autorização inválida ou expirada.');
  await c.beginTransaction();
  try{
    const [actors]=await c.execute<RowDataPacket[]>('SELECT role,studioId FROM users WHERE id=? AND isActive=1',[input.actorId]);
    if(!actors[0]||!['admin','superadmin'].includes(actors[0].role)||Number(actors[0].studioId)!==input.studioId)throw new Error('Gestor de outro estúdio.');
    const key=createHash('sha256').update(`anamnesis-consent:${input.studioId}:${input.authorizationId}`).digest('hex');
    const [done]=await c.execute<RowDataPacket[]>('SELECT id FROM integration_events WHERE idempotency_key=?',[key]);
    if(done.length){await c.rollback();return {result:'already_applied'};}
    const plan=await planAnamnesisConsent(c,input.studioId,true);
    if(plan.hash!==input.hash)throw new Error('Os cadastros mudaram desde a análise.');
    for(const row of plan.rows.filter(row=>row.reason==='authorize')){
      const source=`gestor:${input.actorId}:${input.authorizationId}`;
      if(row.existing)await c.execute('UPDATE integration_contacts SET has_whatsapp_opt_in=1,opt_in_at=UTC_TIMESTAMP(),opt_in_source=?,normalized_phone=? WHERE studio_id=? AND client_id=? AND integration_id=? AND opted_out_at IS NULL',[source,row.phone,input.studioId,row.clientId,plan.integrationId]);
      else await c.execute('INSERT INTO integration_contacts(studio_id,integration_id,client_id,normalized_phone,has_whatsapp_opt_in,opt_in_at,opt_in_source) VALUES(?,?,?,?,1,UTC_TIMESTAMP(),?)',[input.studioId,plan.integrationId,row.clientId,row.phone,source]);
    }
    const after=await planAnamnesisConsent(c,input.studioId,true);
    if(after.counts.authorize!==0||after.counts.authorized!==plan.counts.authorized+plan.counts.authorize)throw new Error('Verificação do lote falhou.');
    await c.execute("INSERT INTO integration_events(studio_id,integration_id,direction,type,idempotency_key,payload_hash,status,processed_at) VALUES(?,?,'inbound','explicit_anamnesis_consent',?,?,'processed',UTC_TIMESTAMP())",[input.studioId,plan.integrationId,key,input.hash]);
    await c.commit();return {result:'applied',changed:plan.counts.authorize,total:after.total,counts:after.counts};
  }catch(error){await c.rollback();throw error;}
}
