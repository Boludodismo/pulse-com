import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({connect:vi.fn(),execute:vi.fn(),commit:vi.fn(),rollback:vi.fn()}));
vi.mock('mysql2/promise',()=>({default:{createConnection:mock.connect}}));
vi.mock('../saas',async original=>({...await original<typeof import('../saas')>(),isUserAccessActive:async()=>true}));
vi.mock('../invitedArtistAccess',()=>({assertInvitedArtistAccess:async()=>{}}));
import {contactImportRouter} from '../routers/contactImport';
const basic={name:'Cliente Fixture',phone:'+5531999998888',email:null,birthDate:null,instagram:null,docNumber:null};
const group={key:'C00001',basic,tags:['IMPORTADO'],sources:[{kind:'botconversa',key:'source1',file:'test',sheet:'test',row:1,headers:[],values:[]}],review:[],blockPermission:false};
const bundle={format:'tatuei-contact-bundle-v1',expectedStudioName:'Teste',groups:[group],archive:{}};
let integration:boolean,refused:boolean,existing:boolean;
beforeEach(()=>{
 vi.clearAllMocks();integration=true;refused=false;existing=false;
 mock.connect.mockResolvedValue({execute:mock.execute,beginTransaction:async()=>{},commit:mock.commit,rollback:mock.rollback,end:async()=>{}});
 mock.execute.mockImplementation(async(sql:string)=>{
  let result:any=[];
  if(sql.startsWith('SELECT * FROM client_import_batches'))result=[{id:1,payload_json:JSON.stringify(bundle)}];
  else if(sql.startsWith('SELECT id,name FROM studios'))result=[{id:2,name:'Teste'}];
  else if(sql.startsWith('SELECT * FROM clients WHERE studioId'))result=existing?[{id:10,...basic}]:[];
  else if(sql.startsWith('SELECT * FROM clients WHERE id'))result=[{id:10,...basic}];
  else if(sql.startsWith('SELECT id FROM whatsapp_integrations'))result=integration?[{id:19}]:[];
  else if(sql.startsWith('SELECT enabled FROM client_whatsapp_permissions'))result=refused?[{enabled:0}]:[];
  else if(sql.startsWith('INSERT INTO clients'))result={insertId:10};
  return [result];
 });
});
const run=(recordWhatsAppConsent?:boolean)=>contactImportRouter.createCaller({user:{id:8,studioId:2,role:'admin'},req:{headers:{},socket:{}},res:{}} as any).importBatch({batchId:1,offset:0,...(recordWhatsAppConsent===undefined?{}:{recordWhatsAppConsent})});
const writes=()=>mock.execute.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO client_whatsapp_permissions'));
describe('Complete-file new-client notification choice',()=>{
 it('defaults new clients to enabled independently of legacy import tags',async()=>{
  const result=await run();expect(result.results[0].permission).toBe('autorizado_pelo_administrador');
  expect(writes()[0][0]).toContain('?,?,?,1,?,NOW()');expect(writes()[0][1]).toEqual([2,10,basic.phone,'cadastro_cliente:operacional:usuario_8']);
 });
 it('persists permission without an active channel',async()=>{
  integration=false;const result=await run();expect(result.results[0].permission).toBe('preferencia_salva_sem_integracao');expect(writes()).toHaveLength(1);
 });
 it('persists the unchecked choice for new clients',async()=>{
  const result=await run(false);expect(result.results[0].permission).toBe('notificacoes_desativadas');expect(writes()[0][0]).toContain('?,?,?,0,?,NOW()');
 });
 it('preserves prior refusal',async()=>{
  refused=true;const result=await run();expect(result.results[0].permission).toBe('recusa_existente_preservada');expect(writes()).toEqual([]);
 });
 it('does not automatically authorize existing customers outside the legacy criteria',async()=>{
  existing=true;const result=await run();expect(result.results[0].permission).toBe('fora_do_criterio');expect(writes()).toEqual([]);
 });
});
