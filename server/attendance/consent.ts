import {and,eq} from 'drizzle-orm';
import {clientWhatsappPermissions} from '../../drizzle/attendanceSchema';
import {clients,integrationContacts,whatsappIntegrations} from '../../drizzle/schema';
import {getDb} from '../db';
import {normalizeBrazilianPhone} from '../messaging/phone';

export function formWhatsappChoice(payload: Record<string,unknown>): boolean | null {
  return typeof payload.whatsapp_updates==='boolean' ? payload.whatsapp_updates : null;
}
/** Called inside the same transaction that saves the public form. No old form grants permission. */
export async function recordFormWhatsappPermission(tx:any,input:{studioId:number;clientId:number;phone:string|null;choice:boolean|null;requestId:number}) {
  return recordWhatsappPermission(tx,{...input,source:`anamnese_cliente:${input.requestId}:whatsapp_v1`});
}

async function recordWhatsappPermission(tx:any,input:{studioId:number;clientId:number;phone:string|null;choice:boolean|null;source:string}) {
  if (input.choice===null) return;
  const [contact]=await tx.select().from(integrationContacts).where(and(eq(integrationContacts.studioId,input.studioId),eq(integrationContacts.clientId,input.clientId))).limit(1).for('update');
  let phone='';
  try {phone=normalizeBrazilianPhone(input.phone||'');} catch {if(input.choice)return;phone=contact?.normalizedPhone||'';}
  const timestamp=new Date().toISOString().slice(0,19).replace('T',' ');
  const data={studioId:input.studioId,clientId:input.clientId,normalizedPhone:phone,enabled:input.choice?1:0,source:input.source,recordedAt:timestamp};
  await tx.insert(clientWhatsappPermissions).values(data).onDuplicateKeyUpdate({set:data});
  if (!input.choice) {
    if(contact)await tx.update(integrationContacts).set({hasWhatsappOptIn:0,optedOutAt:timestamp}).where(eq(integrationContacts.id,contact.id));
    return;
  }
  // Existing opt-outs survive automatic form registration. A manager can review re-subscription explicitly.
  if(contact?.optedOutAt)return;
  const [integration]=await tx.select({id:whatsappIntegrations.id}).from(whatsappIntegrations).where(and(eq(whatsappIntegrations.studioId,input.studioId),eq(whatsappIntegrations.status,'ativo'),eq(whatsappIntegrations.isEnabled,1))).limit(1);
  if(!integration)return; // Permission is durable and can be applied when a channel becomes available.
  const fields={integrationId:integration.id,normalizedPhone:phone,hasWhatsappOptIn:1,optInAt:timestamp,optInSource:data.source,optedOutAt:null,providerSubscriberId:contact?.integrationId===integration.id && contact?.normalizedPhone===phone ? contact.providerSubscriberId : null};
  await tx.insert(integrationContacts).values({studioId:input.studioId,clientId:input.clientId,...fields}).onDuplicateKeyUpdate({set:fields});
}

export async function ensureCareWhatsappConsent(studioId:number,integrationId:number,clientId:number) {
  const db=await getDb();if(!db)return false;
  return db.transaction(async tx=>{
    const [client]=await tx.select({phone:clients.phone}).from(clients).where(and(eq(clients.id,clientId),eq(clients.studioId,studioId),eq(clients.isArchived,0))).limit(1).for('update');
    if(!client?.phone)return false;
    let phone:string;try{phone=normalizeBrazilianPhone(client.phone);}catch{return false;}
    const [contact]=await tx.select().from(integrationContacts).where(and(eq(integrationContacts.studioId,studioId),eq(integrationContacts.clientId,clientId))).limit(1).for('update');
    if(contact?.optedOutAt)return false;
    const [permission]=await tx.select().from(clientWhatsappPermissions).where(and(eq(clientWhatsappPermissions.studioId,studioId),eq(clientWhatsappPermissions.clientId,clientId))).limit(1);
    if(permission?.enabled===0)return false;
    const existing=contact?.hasWhatsappOptIn===1 && contact.normalizedPhone===phone;
    const form=permission?.enabled===1 && permission.normalizedPhone===phone;
    if(!existing&&!form)return false;
    if(existing&&contact.integrationId===integrationId)return true;
    const fields={integrationId,normalizedPhone:phone,hasWhatsappOptIn:1,optInAt:contact?.optInAt || permission?.recordedAt,optInSource:contact?.optInSource || permission?.source,optedOutAt:null,providerSubscriberId:null};
    await tx.insert(integrationContacts).values({studioId,clientId,...fields}).onDuplicateKeyUpdate({set:fields});
    return true;
  });
}

/** Administrative operational-notification choice for a newly created client; never a claim of personal opt-in. */
export async function recordClientRegistrationPermission(input:{studioId:number;clientId:number;enabled:boolean;actorId:number}) {
  const db=await getDb();
  if(!db)throw new Error('Database not available');
  return db.transaction(async tx=>{
    const [client]=await tx.select({phone:clients.phone}).from(clients).where(and(eq(clients.id,input.clientId),eq(clients.studioId,input.studioId),eq(clients.isArchived,0))).limit(1).for('update');
    if(!client)throw new Error('Client not found in studio');
    if(input.enabled){
      try{normalizeBrazilianPhone(client.phone||'');}catch{return false;}
      const [permission]=await tx.select().from(clientWhatsappPermissions).where(and(eq(clientWhatsappPermissions.studioId,input.studioId),eq(clientWhatsappPermissions.clientId,input.clientId))).limit(1).for('update');
      const [contact]=await tx.select().from(integrationContacts).where(and(eq(integrationContacts.studioId,input.studioId),eq(integrationContacts.clientId,input.clientId))).limit(1).for('update');
      if(permission?.enabled===0 || contact?.optedOutAt)return false;
    }
    await recordWhatsappPermission(tx,{studioId:input.studioId,clientId:input.clientId,phone:client.phone,choice:input.enabled,source:`cadastro_cliente:operacional:usuario_${input.actorId}`});
    return true;
  });
}
