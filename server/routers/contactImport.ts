import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import mysql, {type Connection, type RowDataPacket, type ResultSetHeader} from 'mysql2/promise';
import {createHash} from 'node:crypto';
import {router,tenantProcedure} from '../_core/trpc';
import {normalizeBrazilianPhone} from '../messaging/phone';
import {initializeContactImportSchema} from '../contactImport/schema';
import {chooseExisting,phoneAlias,phoneKey,permissionReason,type Person} from '../contactImport/matching';
import {submittedSessionDate,sessionDateStats} from '../contactImport/sessionDates';

const basicSchema=z.object({name:z.string().min(1).max(255),email:z.string().max(320).nullable(),phone:z.string().max(20).nullable(),birthDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),instagram:z.string().max(100).nullable(),docNumber:z.string().max(50).nullable()});
const sourceSchema=z.object({kind:z.enum(['anamnese','botconversa']),key:z.string(),file:z.string(),sheet:z.string(),row:z.number().int().positive(),headers:z.array(z.unknown()),values:z.array(z.unknown()),metadata:z.unknown().optional()});
const groupSchema=z.object({key:z.string().regex(/^C\d{5}$/),basic:basicSchema,tags:z.array(z.string().min(1).max(60)).max(100),sources:z.array(sourceSchema).min(1),review:z.array(z.string()),blockPermission:z.boolean()});
const bundleSchema=z.object({format:z.literal('tatuei-contact-bundle-v1'),expectedStudioName:z.string().min(1),groups:z.array(groupSchema).min(1).max(10000),archive:z.unknown()});
type Group=z.infer<typeof groupSchema>;
type Bundle=z.infer<typeof bundleSchema>;
async function connect(){return mysql.createConnection({uri:process.env.DATABASE_URL!,dateStrings:true});}
async function rows(c:Connection,query:string,params:(string|number|null)[]=[]){return (await c.execute<RowDataPacket[]>(query,params))[0];}
function manager(ctx:any){if(!['admin','superadmin'].includes(ctx.user.role))throw new TRPCError({code:'FORBIDDEN'});}
async function context(c:Connection,studioId:number){
 const [studio]=await rows(c,'SELECT id,name FROM studios WHERE id=?',[studioId]);
 if(!studio)throw new TRPCError({code:'FORBIDDEN',message:'Estúdio da sessão não encontrado.'});
 const existing=await rows(c,'SELECT * FROM clients WHERE studioId=?',[studioId]);
 const consents=await rows(c,'SELECT * FROM integration_contacts WHERE studio_id=?',[studioId]);
 const tags=await rows(c,'SELECT * FROM care_tags WHERE studio_id=?',[studioId]);
 const integrations=await rows(c,"SELECT id FROM whatsapp_integrations WHERE studio_id=? AND is_enabled=1 AND status='ativo'",[studioId]);
 return {studio,existing,consents,tags,integrations};
}
function resultPlan(group:Group,existing:RowDataPacket[]){
 const identityPending=group.review.some(r=>r.startsWith('Correspondência pendente'));
 const choice=identityPending?{match:undefined,ambiguous:true}:chooseExisting(group.basic,existing as Person[]);
 const shared=existing.some(p=>!p.isArchived&&p.id!==choice.match?.id&&phoneAlias(p.phone)&&phoneAlias(p.phone)===phoneAlias(group.basic.phone));
 return {groupKey:group.key,name:group.basic.name,clientId:choice.match?.id||null,action:choice.match?'completar':'criar',review:[...group.review,...(choice.ambiguous?['Correspondência com o CRM ambígua; registros mantidos separados.']:[]),...(shared?['Telefone também aparece em outro cadastro do CRM.']:[])],block:group.blockPermission||choice.ambiguous||shared,eligible:!!permissionReason(group)};
}
function validateBundle(content:string):Bundle{
 const bundle=bundleSchema.parse(JSON.parse(content));
 if(new Set(bundle.groups.map(g=>g.key)).size!==bundle.groups.length)throw new Error('Grupo repetido no arquivo.');
 const sourceKeys=bundle.groups.flatMap(g=>g.sources.map(s=>s.key));
 if(new Set(sourceKeys).size!==sourceKeys.length)throw new Error('Linha de origem vinculada a mais de um cliente.');
 for(const g of bundle.groups){
  if(!g.tags.includes('IMPORTADO'))throw new Error('A etiqueta IMPORTADO é obrigatória.');
  if(g.basic.birthDate){const d=new Date(g.basic.birthDate+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==g.basic.birthDate)throw new Error('Data de nascimento inválida.');}
  for(const s of g.sources)if(s.headers.length!==s.values.length)throw new Error('Colunas de origem incompletas.');
 }
 return bundle;
}
export const contactImportRouter=router({
 sessionDateBatches:tenantProcedure.query(async({ctx})=>{
  manager(ctx);const c=await connect();try{
   const data=await rows(c,'SELECT b.id AS batch_id,b.content_hash,s.name AS studio_name,r.client_id,r.payload_json,r.result_json FROM client_import_batches b JOIN studios s ON s.id=b.studio_id JOIN client_import_records r ON r.batch_id=b.id AND r.studio_id=b.studio_id WHERE b.studio_id=? ORDER BY b.id DESC,r.id',[ctx.studioId]);
   const batches=new Map<number,{batchId:number;hash:string;studioId:number;studioName:string;records:any[]}>();
   for(const row of data){let batch=batches.get(Number(row.batch_id));if(!batch){batch={batchId:Number(row.batch_id),hash:String(row.content_hash),studioId:ctx.studioId,studioName:String(row.studio_name),records:[]};batches.set(batch.batchId,batch)}batch.records.push({clientId:Number(row.client_id),payload:JSON.parse(row.payload_json),result:JSON.parse(row.result_json)})}
   return Array.from(batches.values()).map(({records,...batch})=>({...batch,...sessionDateStats(records)})).filter(b=>b.forms>0);
  }finally{await c.end()}
 }),
 confirmAnamnesisSessionDates:tenantProcedure.input(z.object({batchId:z.number().int().positive(),hash:z.string().regex(/^[a-f0-9]{64}$/),expectedForms:z.number().int().positive(),expectedClients:z.number().int().positive(),basis:z.literal('submission_date')})).mutation(async({ctx,input})=>{
  manager(ctx);const c=await connect();try{
   await c.beginTransaction();
   const [batch]=await rows(c,'SELECT id,content_hash,payload_json FROM client_import_batches WHERE id=? AND studio_id=? FOR UPDATE',[input.batchId,ctx.studioId]);
   if(!batch)throw new TRPCError({code:'NOT_FOUND'});
   if(batch.content_hash!==input.hash)throw new TRPCError({code:'CONFLICT',message:'O lote foi alterado. Atualize a conferência.'});
   const data=await rows(c,'SELECT r.id,r.client_id,r.payload_json,r.result_json,c.id AS owned_client FROM client_import_records r LEFT JOIN clients c ON c.id=r.client_id AND c.studioId=r.studio_id WHERE r.batch_id=? AND r.studio_id=? ORDER BY r.id FOR UPDATE',[input.batchId,ctx.studioId]);
   if(data.length!==validateBundle(batch.payload_json).groups.length)throw new TRPCError({code:'CONFLICT',message:'Conclua a importação do lote antes de confirmar as datas.'});
   const records=data.map(r=>({id:Number(r.id),clientId:Number(r.client_id),owned:!!r.owned_client,payload:JSON.parse(r.payload_json) as Group,result:JSON.parse(r.result_json)}));
   const before=sessionDateStats(records);
   if(before.forms!==input.expectedForms||before.clients!==input.expectedClients||before.invalid)throw new TRPCError({code:'CONFLICT',message:'As fichas ou datas disponíveis não correspondem à conferência. Atualize a página.'});
   const confirmedAt=new Date().toISOString();let updatedForms=0;
   for(const record of records){
    let changed=false;
    for(const source of record.payload.sources){
     if(source.kind!=='anamnese')continue;
     if(!record.owned)throw new TRPCError({code:'FORBIDDEN'});
     const date=submittedSessionDate(source)!;
     const previous=record.result.anamnesisSessionDates?.[source.key];
     if(previous){if(previous.date!==date)throw new TRPCError({code:'CONFLICT',message:'Uma ficha já possui outra data de sessão confirmada.'});continue}
     record.result.anamnesisSessionDates??={};
     record.result.anamnesisSessionDates[source.key]={date,basis:input.basis,confirmedBy:ctx.user.id,confirmedAt};
     changed=true;updatedForms++;
    }
    if(changed)await c.execute('UPDATE client_import_records SET result_json=? WHERE id=? AND studio_id=? AND batch_id=?',[JSON.stringify(record.result),record.id,ctx.studioId,input.batchId]);
   }
   const saved=await rows(c,'SELECT client_id,payload_json,result_json FROM client_import_records WHERE studio_id=? AND batch_id=? ORDER BY id',[ctx.studioId,input.batchId]);
   const verified=sessionDateStats(saved.map(r=>({clientId:Number(r.client_id),payload:JSON.parse(r.payload_json),result:JSON.parse(r.result_json)})));
   if(verified.confirmed!==before.forms||saved.some((r,i)=>r.payload_json!==data[i].payload_json))throw new Error('Falha ao conferir as datas salvas.');
   await c.commit();return {batchId:input.batchId,studioId:ctx.studioId,...verified,updatedForms};
  }catch(e){await c.rollback();throw e}finally{await c.end()}
 }),
 prepare:tenantProcedure.input(z.object({content:z.string().max(20000000)})).mutation(async({ctx,input})=>{
  manager(ctx); const bundle=validateBundle(input.content),c=await connect();
  try{
   const state=await context(c,ctx.studioId);
   if(state.studio.name!==bundle.expectedStudioName)throw new TRPCError({code:'FORBIDDEN',message:'O estúdio da sessão não corresponde ao arquivo.'});
   await initializeContactImportSchema();
   const hash=createHash('sha256').update(input.content).digest('hex');
   await c.execute('INSERT INTO client_import_batches(studio_id,author_id,content_hash,payload_json,before_json) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',[ctx.studioId,ctx.user.id,hash,JSON.stringify(bundle),JSON.stringify({clients:state.existing,consents:state.consents,tags:state.tags})]);
   const [batch]=await rows(c,'SELECT id FROM client_import_batches WHERE studio_id=? AND content_hash=?',[ctx.studioId,hash]);
   const plan=bundle.groups.map(g=>resultPlan(g,state.existing));
   return {batchId:Number(batch.id),studioId:ctx.studioId,studioName:String(state.studio.name),total:plan.length,newClients:plan.filter(g=>g.action==='criar').length,matched:plan.filter(g=>g.action==='completar').length,eligible:plan.filter(g=>g.eligible).length,withReview:plan.filter(g=>g.review.length).length,integrationReady:state.integrations.length===1,plan};
  }finally{await c.end()}
 }),
 importBatch:tenantProcedure.input(z.object({batchId:z.number().int().positive(),offset:z.number().int().min(0)})).mutation(async({ctx,input})=>{
  manager(ctx);const c=await connect();
  try{
   await c.beginTransaction();
   const [batch]=await rows(c,'SELECT * FROM client_import_batches WHERE id=? AND studio_id=? FOR UPDATE',[input.batchId,ctx.studioId]);
   if(!batch)throw new TRPCError({code:'NOT_FOUND'});
   const bundle=validateBundle(batch.payload_json),state=await context(c,ctx.studioId);
   if(state.studio.name!==bundle.expectedStudioName)throw new TRPCError({code:'FORBIDDEN'});
   const results:any[]=[];
   for(const group of bundle.groups.slice(input.offset,input.offset+50)){
    const [done]=await rows(c,'SELECT result_json FROM client_import_records WHERE studio_id=? AND batch_id=? AND group_key=?',[ctx.studioId,batch.id,group.key]);
    if(done){results.push({...JSON.parse(done.result_json),repeated:true});continue;}
    const plan=resultPlan(group,state.existing);
    let clientId=plan.clientId;
    if(!clientId){
     const b=group.basic;
     const [insert]=await c.execute<ResultSetHeader>('INSERT INTO clients(studioId,name,email,phone,birthDate,instagram,docType,docNumber,country) VALUES(?,?,?,?,?,?,?,?,?)',[ctx.studioId,b.name,b.email,b.phone,b.birthDate,b.instagram,b.docNumber?'cpf':null,b.docNumber,null]);
     clientId=insert.insertId;
    }else{
     const old=state.existing.find(p=>p.id===clientId)!;
     // Existing nonempty values and history always win; originals remain below.
     for(const key of ['email','phone','birthDate','instagram','docNumber'] as const){
      if(!old[key]&&group.basic[key])await c.execute(`UPDATE clients SET \`${key}\`=? WHERE id=? AND studioId=?`,[group.basic[key],clientId,ctx.studioId]);
     }
     if(!old.docNumber&&group.basic.docNumber)await c.execute("UPDATE clients SET docType='cpf' WHERE id=? AND studioId=?",[clientId,ctx.studioId]);
    }
    for(const tag of Array.from(new Set(group.tags))){
     const found=await rows(c,'SELECT id FROM care_tags WHERE studio_id=? AND client_id=? AND BINARY label=?',[ctx.studioId,clientId,tag]);
     if(!found.length)await c.execute('INSERT INTO care_tags(studio_id,client_id,label) VALUES(?,?,?)',[ctx.studioId,clientId,tag]);
    }
    let permission='fora_do_criterio';const reason=permissionReason(group);
    if(reason){
     permission='pendente';
     const [client]=await rows(c,'SELECT * FROM clients WHERE id=? AND studioId=?',[clientId,ctx.studioId]);
     let phone='';try{phone=normalizeBrazilianPhone(client.phone||'')}catch{}
     const siblings=bundle.groups.filter(g=>g.key!==group.key&&phoneAlias(g.basic.phone)&&phoneAlias(g.basic.phone)===phoneAlias(group.basic.phone));
     const links=await rows(c,'SELECT * FROM integration_contacts WHERE studio_id=? AND (client_id=? OR normalized_phone=?)',[ctx.studioId,clientId,phone]);
     if(links.some(l=>l.opted_out_at))permission='recusa_existente_preservada';
     else if(plan.block||siblings.length)permission='identidade_ou_telefone_a_revisar';
     else if(!phone)permission='telefone_a_validar';
     else if(state.integrations.length!==1)permission='integracao_a_validar';
     else if(links.some(l=>l.client_id!==clientId||l.normalized_phone!==phone||l.integration_id!==state.integrations[0].id))permission='vinculo_existente_a_revisar';
     else{
      await c.execute('INSERT INTO integration_contacts(studio_id,integration_id,client_id,normalized_phone,has_whatsapp_opt_in,opt_in_at,opt_in_source) VALUES(?,?,?,?,1,NOW(),?) ON DUPLICATE KEY UPDATE has_whatsapp_opt_in=1,opt_in_at=COALESCE(opt_in_at,NOW()),opt_in_source=COALESCE(opt_in_source,VALUES(opt_in_source))',[ctx.studioId,state.integrations[0].id,clientId,phone,reason]);
      permission='autorizado_pelo_administrador';
     }
    }
    const result={groupKey:group.key,clientId,action:plan.action,permission,review:plan.review};
    await c.execute('INSERT INTO client_import_records(studio_id,batch_id,group_key,client_id,payload_json,result_json,author_id) VALUES(?,?,?,?,?,?,?)',[ctx.studioId,batch.id,group.key,clientId,JSON.stringify(group),JSON.stringify(result),ctx.user.id]);
    results.push(result);
   }
   await c.commit();return {results,nextOffset:input.offset+results.length,total:bundle.groups.length,done:input.offset+results.length>=bundle.groups.length};
  }catch(e){await c.rollback();throw e}finally{await c.end()}
 }),
 history:tenantProcedure.input(z.object({clientId:z.number().int().positive()})).query(async({ctx,input})=>{
  const c=await connect();try{
   const [client]=await rows(c,'SELECT id,artistId FROM clients WHERE id=? AND studioId=?',[input.clientId,ctx.studioId]);
   if(!client||ctx.user.role==='collaborator'&&client.artistId!==ctx.user.artistId)throw new TRPCError({code:'FORBIDDEN'});
   const data=await rows(c,'SELECT id,payload_json,result_json,created_at FROM client_import_records WHERE studio_id=? AND client_id=? ORDER BY id',[ctx.studioId,input.clientId]);
   return data.map(r=>({id:Number(r.id),payload:JSON.parse(r.payload_json) as Group,result:JSON.parse(r.result_json),createdAt:String(r.created_at)}));
  }finally{await c.end()}
 }),
 report:tenantProcedure.input(z.object({batchId:z.number().int().positive()})).query(async({ctx,input})=>{
  manager(ctx);const c=await connect();try{
   const [batch]=await rows(c,'SELECT id,payload_json,before_json,content_hash FROM client_import_batches WHERE studio_id=? AND id=?',[ctx.studioId,input.batchId]);
   if(!batch)throw new TRPCError({code:'NOT_FOUND'});
   const records=await rows(c,'SELECT group_key,client_id,payload_json,result_json FROM client_import_records WHERE studio_id=? AND batch_id=? ORDER BY id',[ctx.studioId,input.batchId]);
   const bundle=validateBundle(batch.payload_json),expected=new Map(bundle.groups.map(g=>[g.key,JSON.stringify(g)]));
   const stored=records.map(r=>JSON.parse(r.payload_json) as Group);
   const originalDataVerified=records.length===bundle.groups.length&&records.every(r=>expected.get(r.group_key)===JSON.stringify(JSON.parse(r.payload_json)));
   const operational=await rows(c,'SELECT c.id,c.birthDate,i.has_whatsapp_opt_in,i.opted_out_at FROM clients c LEFT JOIN integration_contacts i ON i.studio_id=c.studioId AND i.client_id=c.id WHERE c.studioId=?',[ctx.studioId]);
   const importedIds=new Set(records.map(r=>Number(r.client_id)));
   const birthdayRules=await rows(c,"SELECT name,enabled,send_time FROM care_rules WHERE studio_id=? AND kind='birthday'",[ctx.studioId]);
   const settings=await rows(c,'SELECT timezone FROM message_automation_settings WHERE studio_id=?',[ctx.studioId]);
   return {batchId:Number(batch.id),hash:String(batch.content_hash),total:bundle.groups.length,originalDataVerified,forms:stored.reduce((n,g)=>n+g.sources.filter(s=>s.kind==='anamnese').length,0),botRecords:stored.reduce((n,g)=>n+g.sources.filter(s=>s.kind==='botconversa').length,0),birthdayReady:operational.filter(p=>importedIds.has(p.id)&&p.birthDate&&p.has_whatsapp_opt_in===1&&!p.opted_out_at).length,timezone:settings[0]?.timezone||'America/Sao_Paulo',birthdayRules,results:records.map(r=>JSON.parse(r.result_json)),before:JSON.parse(batch.before_json)};
  }finally{await c.end()}
 }),
});
