import {describe,it,expect,vi,beforeEach} from 'vitest';
import {careDueDate,normalizeCareTags,CARE_DEFAULTS,renderCareMessage} from '../shared/customerCare';
const mocks=vi.hoisted(()=>({getDb:vi.fn()}));
vi.mock('./db',()=>({getDb:mocks.getDb}));
vi.mock('./saas',()=>({isUserAccessActive:vi.fn(async()=>true)}));
import {customerCareRouter} from './routers/customerCare';
import {careClock} from './messaging/customerCare';
const ctx={user:{id:1,studioId:10,role:'admin'},studioId:10} as any;
function database(reads:any[][]){const writes:any[]=[];const db:any={select:()=>{const rows=reads.shift()||[];const chain:any={from:()=>chain,where:()=>chain,limit:()=>chain,leftJoin:()=>chain,orderBy:()=>chain,then:(r:any)=>Promise.resolve(rows).then(r)};return chain;},update:()=>({set:(values:any)=>({where:async()=>writes.push(values)})}),insert:()=>({values:(v:any)=>({onDuplicateKeyUpdate:async()=>writes.push(v)})}),transaction:async(f:any)=>f(db)};mocks.getDb.mockResolvedValue(db);return writes;}
beforeEach(()=>vi.clearAllMocks());
describe('Relacionamento e pós-venda',()=>{
 it('calcula semana, mês e ano preservando calendário em viradas e anos bissextos',()=>{
 expect(careDueDate('2026-12-28',7,'days')).toBe('2027-01-04');
 expect(careDueDate('2026-01-31',1,'months')).toBe('2026-02-28');
 expect(careDueDate('2024-02-29',1,'years')).toBe('2025-02-28');
 expect(careDueDate('2026-09-07',1,'years')).toBe('2027-09-07');
 });
 it('usa 9h de Brasília, não 9h do servidor UTC',()=>{expect(careClock(new Date('2026-09-07T12:00:00Z'),'America/Sao_Paulo')).toEqual({date:'2026-09-07',time:'09:00'});});
 it('mantém saudações editáveis e etiquetas normalizadas sem duplicidade',()=>{expect(CARE_DEFAULTS).toHaveLength(4);expect(renderCareMessage(CARE_DEFAULTS[0].body,{primeiro_nome:'Willian',nome_estudio:'Estúdio'})).toContain('Bom dia, Willian!');expect(normalizeCareTags([' Realismo ','realismo',' Fine   Line '])).toEqual(['realismo','fine line']);});
 it('não permite ativar envio sem conexão testada e habilitada',async()=>{const writes=database([[]]);await expect(customerCareRouter.createCaller(ctx).saveRule({name:'Teste',kind:'session',amount:7,unit:'days',body:'Bom dia, {primeiro_nome}!',enabled:true})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(writes).toEqual([]);});
 it('recusa editar modelo de outro estúdio',async()=>{const writes=database([[]]);await expect(customerCareRouter.createCaller(ctx).saveRule({id:90,name:'Teste',kind:'session',amount:7,unit:'days',body:'Bom dia, {primeiro_nome}!',enabled:false})).rejects.toMatchObject({code:'NOT_FOUND'});expect(writes).toEqual([]);});
 it('protege etiquetas de cliente de outro estúdio',async()=>{const writes=database([[]]);await expect(customerCareRouter.createCaller(ctx).saveTags({clientId:50,labels:['teste']})).rejects.toMatchObject({code:'FORBIDDEN'});expect(writes).toEqual([]);});
 it('registra feedback uma vez sem alterar consentimento nem agendamento',async()=>{const writes=database([[{id:5,status:'queued',dueDate:new Date().toISOString().slice(0,10),feedback:null}]]);await customerCareRouter.createCaller({} as any).feedback({token:'a'.repeat(64),text:'Gostei do atendimento'});expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({feedback:'Gostei do atendimento',status:'responded',readAt:null});});
 it('rejeita link já respondido ou expirado',async()=>{for(const event of [{id:5,status:'responded',dueDate:'2026-09-07'},{id:5,status:'queued',dueDate:'2020-01-01'}]){const writes=database([[event]]);await expect(customerCareRouter.createCaller({} as any).feedback({token:'a'.repeat(64),text:'Repetido'})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(writes).toEqual([]);}});
});
