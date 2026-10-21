import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({db:vi.fn()}));
vi.mock('../db',()=>({getDb:mocks.db}));
import {recordCareWhatsappReply} from './customerCare';
function database(reads:any[][]){const writes:any[]=[];mocks.db.mockResolvedValue({select:()=>{const rows=reads.shift()||[];const chain:any={from:()=>chain,where:()=>chain,orderBy:()=>chain,limit:()=>chain,then:(resolve:any)=>Promise.resolve(rows).then(resolve)};return chain;},update:()=>({set:(data:any)=>({where:async()=>writes.push(data)})}),insert:()=>({values:(data:any)=>({onDuplicateKeyUpdate:async()=>writes.push(data)})})});return writes;}
const message={id:45,clientId:7,trigger:'customer_care',message:'Como está a cicatrização?',sentAt:'2026-10-21 12:00:00'};
const event={id:9,clientId:7,appointmentId:3,artistId:5,message:message.message,feedback:null};
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-21T13:00:00Z'));});
afterEach(()=>vi.useRealTimers());
describe('respostas de WhatsApp disponíveis no acompanhamento',()=>{
 it('salva o texto do cliente como resposta não lida do atendimento identificado',async()=>{
  const writes=database([[message],[event],[event]]);
  expect(await recordCareWhatsappReply(10,'11999998888','A cicatrização foi ótima.','reply-1')).toBe(true);
  expect(writes).toEqual([{feedback:'A cicatrização foi ótima.',feedbackAt:'2026-10-21 13:00:00',readAt:null,status:'responded'}]);
 });
 it('preserva a primeira mensagem quando o cliente complementa sua resposta',async()=>{
  const writes=database([[message],[],[{...event,feedback:'Cicatrizou bem.'}]]);
  await recordCareWhatsappReply(10,'11999998888','Muito obrigado!','reply-2');
  expect(writes[0].feedback).toBe('Cicatrizou bem.\n\nMuito obrigado!');expect(writes[0].readAt).toBeNull();
 });
 it('guarda resposta de associação ambígua para conferência sem escolher outro artista',async()=>{
  const writes=database([[message],[event,{...event,id:10,appointmentId:4,artistId:6}]]);
  expect(await recordCareWhatsappReply(10,'11999998888','Estou com uma dúvida.','reply-3')).toBe(true);
  expect(writes[0]).toMatchObject({studioId:10,clientId:7,artistId:null,appointmentId:null,status:'responded',feedback:'Estou com uma dúvida.'});
 });
 it('não classifica outra conversa como feedback de cicatrização',async()=>{
  const writes=database([[{...message,trigger:'appointment_reminder'}]]);
  expect(await recordCareWhatsappReply(10,'11999998888','Confirmado','reply-4')).toBe(false);expect(writes).toEqual([]);
 });
});
