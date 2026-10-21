import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const mocks=vi.hoisted(()=>({db:vi.fn(),queue:vi.fn()}));
vi.mock('../db',()=>({getDb:mocks.db}));
vi.mock('./artistNotifications',()=>({queueArtistOperationalNotice:mocks.queue}));
import {careFeedbackVersion,formatCareFeedbackNotice,queueCareFeedbackArtistNotice,recoverCareFeedbackArtistNotices} from './careFeedbackNotices';
const event={id:9,studioId:2,clientId:3,clientName:'Maria',artistId:7,appointmentId:14,message:'Como está a cicatrização? https://crm.tatuei.com/feedback/segredo',feedback:'Tudo ótimo!'};
let saved:any,conditions:any[];
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('PUBLIC_URL','https://crm.tatuei.com');saved={...event};conditions=[];mocks.queue.mockResolvedValue(true);
 mocks.db.mockResolvedValue({select:()=>{const q:any={from:()=>q,leftJoin:()=>q,where:(c:any)=>{conditions.push(new MySqlDialect().sqlToQuery(c));return q;},orderBy:()=>q,limit:async()=>saved?[saved]:[]};return q;}});
});
afterEach(()=>vi.unstubAllEnvs());
describe('avisos completos de feedback para o artista responsável',()=>{
 it('envia a pergunta, a resposta e o link autenticado do evento ao artista salvo no atendimento',async()=>{
  expect(await queueCareFeedbackArtistNotice(2,9)).toBe(true);
  expect(mocks.queue).toHaveBeenCalledWith(expect.objectContaining({studioId:2,artistId:7,clientId:3,appointmentId:14,trigger:'care_artist_feedback:9',idempotencyKey:`care-feedback:2:9:7:${careFeedbackVersion(event.feedback)}:done`}));
  const notice=mocks.queue.mock.calls[0][0].message;
  for(const text of ['Maria','Como está a cicatrização?','Tudo ótimo!','https://crm.tatuei.com/acompanhamento/9','marcar como lida'])expect(notice).toContain(text);
  expect(notice).not.toContain('/feedback/segredo');expect(conditions[0].params).toEqual([9,2,'responded']);
 });
 it('reutiliza a chave na repetição e distingue complemento de resposta e troca do artista',async()=>{
  await queueCareFeedbackArtistNotice(2,9);await queueCareFeedbackArtistNotice(2,9);
  expect(mocks.queue.mock.calls[0][0].idempotencyKey).toBe(mocks.queue.mock.calls[1][0].idempotencyKey);
  saved.feedback+=' Mais uma dúvida.';await queueCareFeedbackArtistNotice(2,9);
  expect(mocks.queue.mock.calls[2][0].idempotencyKey).not.toBe(mocks.queue.mock.calls[0][0].idempotencyKey);
  saved.artistId=8;await queueCareFeedbackArtistNotice(2,9);
  expect(mocks.queue.mock.calls[3][0]).toMatchObject({artistId:8});expect(mocks.queue.mock.calls[3][0].idempotencyKey).not.toBe(mocks.queue.mock.calls[2][0].idempotencyKey);
 });
 it('não escolhe um artista para feedback ambíguo nem usa um telefone enviado pelo cliente',async()=>{
  saved.artistId=null;expect(await queueCareFeedbackArtistNotice(2,9)).toBe(false);expect(mocks.queue).not.toHaveBeenCalled();
  saved=null;expect(await queueCareFeedbackArtistNotice(2,9)).toBe(false);
 });
 it('divide textos longos sem perder conteúdo nem o link e só conclui quando todas as partes entram na fila',async()=>{
  const input={...event,feedback:'🙂'.repeat(6000)};
  const messages=formatCareFeedbackNotice(input,'https://crm.tatuei.com');
  expect(messages.length).toBeGreaterThan(1);expect(messages.every(m=>m.length<4000&&m.includes('/acompanhamento/9'))).toBe(true);
  const body=messages.map(m=>m.split('\n\n').slice(1,-1).join('\n\n')).join('');
  expect(body).toContain(input.feedback);
  saved=input;mocks.queue.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  expect(await queueCareFeedbackArtistNotice(2,9)).toBe(false);expect(mocks.queue).toHaveBeenCalledTimes(2);
  expect(mocks.queue.mock.calls.every(c=>!c[0].idempotencyKey.endsWith(':done'))).toBe(true);
 });
 it('mantém uma falha de fila isolada do feedback registrado',async()=>{
  mocks.queue.mockRejectedValue(new Error('indisponível'));expect(await queueCareFeedbackArtistNotice(2,9)).toBe(false);
 });
 it('recupera apenas respostas não lidas sem job completo, com a mesma identidade estável',async()=>{
  await recoverCareFeedbackArtistNotices();
  expect(conditions[0].sql).toContain('NOT EXISTS');expect(conditions[0].sql).toContain('SHA2');expect(conditions[0].sql).toContain('read_at');
  expect(mocks.queue).toHaveBeenCalledTimes(1);
 });
});
