/** Synthetic fixtures; refuses every database outside the disposable local CI service. */
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {ensureContactImportSchema} from '../server/contactImport/schema';
import {contactImportRouter} from '../server/routers/contactImport';
async function main(){
 const url=new URL(process.env.DATABASE_URL!);assert.equal(process.env.CI,'true');assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.pathname,'/supplier_test');
 const root=await mysql.createConnection(url.toString());await root.query('CREATE DATABASE contact_import_test CHARACTER SET utf8mb4');await root.end();
 url.pathname='/contact_import_test';process.env.DATABASE_URL=url.toString();
 const c=await mysql.createConnection({uri:url.toString(),dateStrings:true});
 const statements=[
 'CREATE TABLE studios(id INT PRIMARY KEY,name VARCHAR(255))',
 'CREATE TABLE clients(id INT AUTO_INCREMENT PRIMARY KEY,studioId INT NOT NULL,name VARCHAR(255) NOT NULL,email VARCHAR(320),phone VARCHAR(20),birthDate TIMESTAMP NULL,instagram VARCHAR(100),docNumber VARCHAR(50),docType VARCHAR(20),country VARCHAR(50),artistId INT,isArchived INT DEFAULT 0)',
 'CREATE TABLE care_tags(id INT AUTO_INCREMENT PRIMARY KEY,studio_id INT,client_id INT,label VARCHAR(60),UNIQUE(studio_id,client_id,label))',
 'CREATE TABLE whatsapp_integrations(id INT PRIMARY KEY,studio_id INT,is_enabled INT,status VARCHAR(20))',
 'CREATE TABLE integration_contacts(id INT AUTO_INCREMENT PRIMARY KEY,studio_id INT,integration_id INT,client_id INT,normalized_phone VARCHAR(32),has_whatsapp_opt_in INT DEFAULT 0,opt_in_at TIMESTAMP NULL,opt_in_source VARCHAR(100),opted_out_at TIMESTAMP NULL,UNIQUE(studio_id,client_id),UNIQUE(studio_id,normalized_phone))',
 'CREATE TABLE care_rules(id INT AUTO_INCREMENT PRIMARY KEY,studio_id INT,name VARCHAR(120),kind VARCHAR(20),enabled INT,send_time VARCHAR(5))',
 'CREATE TABLE message_automation_settings(studio_id INT,timezone VARCHAR(80))',
 "INSERT INTO studios VALUES(101,'Estúdio teste'),(202,'Outro estúdio')",
 "INSERT INTO clients(id,studioId,name,phone,email) VALUES(10,101,'Ana Exemplo','+5511987654321','original@example.test'),(20,101,'Carlos Exemplo','+5511987654323',NULL),(30,202,'Ana Exemplo','+5511987654321','outro@example.test')",
 "INSERT INTO whatsapp_integrations VALUES(1,101,1,'ativo'),(2,202,1,'ativo')",
 "INSERT INTO care_tags(studio_id,client_id,label) VALUES(101,10,'Anterior')",
 "INSERT INTO integration_contacts(studio_id,integration_id,client_id,normalized_phone,opted_out_at) VALUES(101,1,20,'+5511987654323',NOW())",
 ];for(const s of statements)await c.query(s);
 process.env.RUN_DB_MIGRATIONS='false';await ensureContactImportSchema();
 const [uninitialized]:any=await c.query("SHOW TABLES LIKE 'client_import_batches'");assert.equal(uninitialized.length,0);
 const caller=(studioId:number)=>contactImportRouter.createCaller({user:{id:1,role:'admin',studioId,isActive:1,accessStatus:'active',openId:'test'},req:{headers:{}},res:{}} as any);
 const owner=caller(101),other=caller(202);
 const group=(n:number,name:string,kind='botconversa',tags:string[]=[])=>({key:`C${String(n).padStart(5,'0')}`,basic:{name,email:'novo@example.test',phone:`+551198765432${n}`,birthDate:n===1?'1952-04-25':null,instagram:null,docNumber:null},tags:['IMPORTADO',...tags],sources:[{kind,key:`R${n}`,file:'teste.xlsx',sheet:'Teste',row:n+1,headers:['Nome','Resposta','Fórmula'],values:[name,'Resposta integral\ncom acentuação',{type:'formula',formula:'=+55',cached:null}]}],review:[],blockPermission:false});
 const bundle={format:'tatuei-contact-bundle-v1',expectedStudioName:'Estúdio teste',groups:[group(1,'Ana Exemplo','anamnese'),group(2,'Bruno Exemplo','botconversa',['.Nome_Confirmado']),group(3,'Carlos Exemplo','anamnese'),group(4,'Diana Exemplo')],archive:{original:'Preservar'}};
 for(const [i,g] of bundle.groups.entries()){g.sources[0].headers.push('Carimbo de data/hora');g.sources[0].values.push({type:'datetime',iso:`2024-10-${11+i}T00:15:00`} as any)}
 const before=JSON.stringify((await c.query('SELECT * FROM clients WHERE studioId=202'))[0]);
 const plan=await owner.prepare({content:JSON.stringify(bundle)});assert.equal(plan.matched,2);assert.equal(plan.newClients,2);
 await assert.rejects(other.importBatch({batchId:plan.batchId,offset:0}),{code:'NOT_FOUND'});
 await assert.rejects(other.report({batchId:plan.batchId}),{code:'NOT_FOUND'});
 await assert.rejects(other.history({clientId:10}),{code:'FORBIDDEN'});
 const result=await owner.importBatch({batchId:plan.batchId,offset:0});assert.equal(result.done,true);assert.equal(result.results.filter(r=>r.permission==='autorizado_pelo_administrador').length,2);assert.equal(result.results[2].permission,'recusa_existente_preservada');
 const [people]:any=await c.query('SELECT * FROM clients WHERE studioId=101');assert.equal(people.length,4);assert.equal(people.find((p:any)=>p.id===10).email,'original@example.test');assert.equal(people.find((p:any)=>p.id===10).birthDate.slice(0,10),'1952-04-25');
 const history=await owner.history({clientId:10});assert.deepEqual(history[0].payload.sources,bundle.groups[0].sources);
 const audit=await owner.report({batchId:plan.batchId});assert.equal(audit.originalDataVerified,true);assert.equal(audit.forms,2);assert.equal(audit.botRecords,2);assert.equal(audit.birthdayReady,1);assert.equal(audit.timezone,'America/Sao_Paulo');
 const repeated=await owner.importBatch({batchId:plan.batchId,offset:0});assert.ok(repeated.results.every(r=>r.repeated));assert.equal((await owner.report({batchId:plan.batchId})).results.length,4);
 assert.equal(JSON.stringify((await c.query('SELECT * FROM clients WHERE studioId=202'))[0]),before);
 const [tags]:any=await c.query('SELECT label FROM care_tags WHERE client_id=10');assert.deepEqual(tags.map((t:any)=>t.label).sort(),['Anterior','IMPORTADO']);
 const dateBatches=await owner.sessionDateBatches();assert.equal(dateBatches.length,1);assert.equal(dateBatches[0].forms,2);assert.equal(dateBatches[0].confirmed,0);
 assert.equal((await other.sessionDateBatches()).length,0);
 const dateInput={batchId:plan.batchId,hash:dateBatches[0].hash,expectedForms:2,expectedClients:2,basis:'submission_date' as const};
 await assert.rejects(other.confirmAnamnesisSessionDates(dateInput),{code:'NOT_FOUND'});
 await assert.rejects(owner.confirmAnamnesisSessionDates({...dateInput,expectedForms:3}),{code:'CONFLICT'});
 await assert.rejects(owner.confirmAnamnesisSessionDates({...dateInput,hash:'0'.repeat(64)}),{code:'CONFLICT'});
 const [dateBefore]:any=await c.query('SELECT id,payload_json,result_json FROM client_import_records ORDER BY id');
 await c.query("CREATE TRIGGER session_date_failure BEFORE UPDATE ON client_import_records FOR EACH ROW BEGIN IF NEW.client_id=20 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic date rollback'; END IF; END");
 await assert.rejects(owner.confirmAnamnesisSessionDates(dateInput));
 assert.deepEqual((await c.query('SELECT id,payload_json,result_json FROM client_import_records ORDER BY id'))[0],dateBefore);
 await c.query('DROP TRIGGER session_date_failure');
 const dates=await owner.confirmAnamnesisSessionDates(dateInput);assert.equal(dates.confirmed,2);assert.equal(dates.updatedForms,2);assert.equal(dates.clients,2);
 const dateHistory=await owner.history({clientId:10});assert.equal(dateHistory[0].result.anamnesisSessionDates.R1.date,'2024-10-11');assert.equal(dateHistory[0].result.anamnesisSessionDates.R1.confirmedBy,1);assert.equal(dateHistory[0].result.anamnesisSessionDates.R1.basis,'submission_date');assert.deepEqual(dateHistory[0].payload.sources,bundle.groups[0].sources);
 assert.equal((await owner.report({batchId:plan.batchId})).originalDataVerified,true);
 const savedDates=JSON.stringify((await c.query('SELECT id,payload_json,result_json FROM client_import_records ORDER BY id'))[0]);
 assert.equal((await owner.confirmAnamnesisSessionDates(dateInput)).updatedForms,0);
 assert.equal(JSON.stringify((await c.query('SELECT id,payload_json,result_json FROM client_import_records ORDER BY id'))[0]),savedDates);
 const [untouchedBot]:any=await c.query("SELECT result_json FROM client_import_records WHERE group_key='C00002'");assert.equal(JSON.parse(untouchedBot[0].result_json).anamnesisSessionDates,undefined);
 assert.equal(JSON.stringify((await c.query('SELECT * FROM clients WHERE studioId=202'))[0]),before);
 const rollbackBundle={...bundle,groups:[{...group(5,'Reversão Exemplo','anamnese'),key:'C00010'}]};const rollbackPlan=await owner.prepare({content:JSON.stringify(rollbackBundle)});
 await c.query("CREATE TRIGGER import_failure BEFORE INSERT ON client_import_records FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic rollback check'");
 await assert.rejects(owner.importBatch({batchId:rollbackPlan.batchId,offset:0}));
 const [count]:any=await c.query('SELECT COUNT(*) AS n FROM clients WHERE studioId=101');assert.equal(count[0].n,4);assert.equal((await owner.report({batchId:rollbackPlan.batchId})).results.length,0);
 await c.end();console.log('PASS: complete original history, birthday before 1970, existing values/tags, opt-out, tenant boundaries, retry idempotence and transaction rollback');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
