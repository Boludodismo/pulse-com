import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {MySqlDialect,getTableConfig} from 'drizzle-orm/mysql-core';
const mocks=vi.hoisted(()=>({db:vi.fn(),consent:vi.fn(),send:vi.fn()}));
vi.mock('../db',()=>({getDb:mocks.db}));
vi.mock('../attendance/consent',()=>({ensureCareWhatsappConsent:mocks.consent}));
vi.mock('./service',()=>({sendAndLog:mocks.send}));
import {runCustomerCareCycle,selectCareChannel} from './customerCare';
const studioChannel={id:20,ownerRole:'admin',ownerArtistId:null};
const personal={id:21,ownerRole:'collaborator',ownerArtistId:5};
const other={id:22,ownerRole:'collaborator',ownerArtistId:6};
function fixture({kind='session',channels=[other,studioChannel,personal],events=[{id:9,clientId:7,artistId:5,appointmentId:3,dueDate:'2026-10-17',token:'a'.repeat(64),occurrenceKey:'x'}],clients=[{id:7,phone:'11999998888',name:'Maria Silva',artistId:5,birthDate:'1990-10-20'}]}={}){
 const queries:any[]=[];const writes:any[]=[];const rule={id:1,studioId:10,name:'Cuidados',kind,enabled:1,createdAt:'2026-10-01 00:00:00',amount:7,unit:'days',body:'Olá, {primeiro_nome}! {link_feedback}'};
 const reads:any={care_rules:[rule],whatsapp_integrations:channels,message_automation_settings:[{timezone:'America/Sao_Paulo'}],studios:[{name:'Estúdio'}],appointments:[],technical_procedures:[],care_sessions:[{id:2,studioId:10,clientId:7,artistId:5,appointmentId:3,completedAt:'2026-10-10 13:00:00'}],clients,artists:[{id:5,name:'Artista'}],care_events:events};
 const db:any={select:()=>{let name='';const chain:any={from:(table:any)=>{name=getTableConfig(table).name;return chain;},leftJoin:()=>chain,where:(condition:any)=>{queries.push({name,...new MySqlDialect().sqlToQuery(condition)});return chain;},orderBy:()=>chain,limit:()=>chain,then:(resolve:any)=>Promise.resolve(reads[name]||[]).then(resolve)};return chain;},insert:(table:any)=>({values:(data:any)=>({onDuplicateKeyUpdate:async()=>writes.push({table:getTableConfig(table).name,data})})}),update:(table:any)=>({set:(data:any)=>({where:async()=>writes.push({table:getTableConfig(table).name,data})})})};
 mocks.db.mockResolvedValue(db);return{queries,writes};
}
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));vi.stubEnv('PUBLIC_URL','https://crm.tatuei.com');mocks.consent.mockResolvedValue(true);mocks.send.mockResolvedValue({success:true,messageId:'45'});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
describe('ciclo real de pós-venda até a fila',()=>{
 it('seleciona o canal do artista ou estúdio sem emprestar canal alheio',()=>{expect(selectCareChannel([other,studioChannel,personal],5)?.id).toBe(21);expect(selectCareChannel([other,studioChannel],5)?.id).toBe(20);expect(selectCareChannel([other],5)).toBeNull();expect(selectCareChannel([other,studioChannel],null)?.id).toBe(20);});
 it('enfileira com consentimento, primeiro nome, feedback e chave estável; confirma fila somente no sucesso',async()=>{const f=fixture();await runCustomerCareCycle();expect(mocks.consent).toHaveBeenCalledWith(10,21,7);expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({integrationId:21,clientId:7,appointmentId:3,trigger:'customer_care',idempotencyKey:'care:x',message:expect.stringContaining('Olá, Maria! https://crm.tatuei.com/feedback/')}));expect(f.writes).toContainEqual(expect.objectContaining({table:'care_events',data:expect.objectContaining({status:'queued',queueId:45})}));const channelQuery=f.queries.find(q=>q.name==='whatsapp_integrations');expect(channelQuery.sql).toContain('sandbox_mode');expect(channelQuery.params).toContain(0);const due=f.queries.find(q=>q.name==='care_events');expect(due.params).toContain('2026-10-13');expect(due.params).toContain('2026-10-20');});
 it('usa WhatsApp do estúdio quando não há canal do artista',async()=>{fixture({channels:[other,studioChannel]});await runCustomerCareCycle();expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({integrationId:20}));});
 it('mantém pendente sem consentimento e sem marcar como enviado',async()=>{const f=fixture();mocks.consent.mockResolvedValue(false);await runCustomerCareCycle();expect(mocks.send).not.toHaveBeenCalled();expect(f.writes.some(w=>w.data.status==='queued')).toBe(false);});
 it('não usa outro artista quando não existe fallback do estúdio',async()=>{fixture({channels:[other]});await runCustomerCareCycle();expect(mocks.send).not.toHaveBeenCalled();expect(mocks.consent).not.toHaveBeenCalled();});
 it('mantém falha pendente para próxima tentativa',async()=>{const f=fixture();mocks.send.mockResolvedValue({success:false,error:'indisponível'});await runCustomerCareCycle();expect(f.writes.some(w=>w.data.status==='queued')).toBe(false);});
 it('não envia de madrugada; cria programação sem alterar atendimento',async()=>{vi.setSystemTime(new Date('2026-10-20T04:26:00Z'));const f=fixture();await runCustomerCareCycle();expect(mocks.send).not.toHaveBeenCalled();expect(f.writes.some(w=>w.table==='care_events')).toBe(true);expect(f.writes.some(w=>w.table==='appointments')).toBe(false);});
 it('aniversário continua limitado ao próprio dia',async()=>{const f=fixture({kind:'birthday'});await runCustomerCareCycle();const due=f.queries.find(q=>q.name==='care_events');expect(due.params.filter((p:any)=>p==='2026-10-20')).toHaveLength(2);expect(due.params).not.toContain('2026-10-13');});
});
