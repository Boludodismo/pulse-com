import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const mocks=vi.hoisted(()=>({db:vi.fn()}));
vi.mock('./db',()=>({getDb:mocks.db}));
vi.mock('./saas',()=>({isUserAccessActive:vi.fn(async()=>true)}));
vi.mock('./messaging/careFeedbackNotices',()=>({queueCareFeedbackArtistNotice:vi.fn(async()=>true)}));
import {customerCareRouter} from './routers/customerCare';
import {invitedRoutePermission} from './invitedArtistAccess';
import {artistRouteModule} from '../shared/artistInvitations';
const ctx={user:{id:1,role:'collaborator',studioId:2,artistId:7},studioId:2,artistId:7} as any;
let row:any,query:any,update:any;
beforeEach(()=>{vi.clearAllMocks();row={id:9,artistId:7,clientName:'Maria',message:'Pergunta https://crm.tatuei.com/feedback/segredo',feedback:'Tudo bem',readAt:null};update=null;mocks.db.mockResolvedValue({select:()=>{const q:any={from:()=>q,leftJoin:()=>q,where:(c:any)=>{query=new MySqlDialect().sqlToQuery(c);return q;},limit:async()=>row?[row]:[]};return q;},update:()=>({set:(data:any)=>({where:async(c:any)=>{update={data,...new MySqlDialect().sqlToQuery(c)};}})})});});
describe('link autenticado do feedback e confirmação de leitura',()=>{
 it('localiza o evento exato com filtros de estúdio e artista sem expor o token de resposta',async()=>{
  const result=await customerCareRouter.createCaller(ctx).feedbackDetail({id:9});
  expect(result.feedback).toBe('Tudo bem');expect(result.message).not.toContain('/feedback/segredo');expect(query.params).toEqual([9,2,7]);
 });
 it('bloqueia feedback fora do escopo e colaborador sem artista identificado',async()=>{
  row=null;await expect(customerCareRouter.createCaller(ctx).feedbackDetail({id:99})).rejects.toMatchObject({code:'NOT_FOUND'});expect(query.params).toEqual([99,2,7]);
  await expect(customerCareRouter.createCaller({...ctx,user:{...ctx.user,artistId:null},artistId:null}).feedbackDetail({id:9})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('abrir o link não marca como lida; a confirmação exige uma ação explícita e mantém o escopo',async()=>{
  await customerCareRouter.createCaller(ctx).feedbackDetail({id:9});expect(update).toBeNull();
  await customerCareRouter.createCaller(ctx).markRead({id:9});expect(update.params).toEqual([9,2,7]);expect(update.data.readAt).toBeTruthy();
 });
 it('permite a página própria ao artista convidado sem abrir a administração de mensagens',()=>{
  expect(artistRouteModule('/acompanhamento/9')).toBe('self');expect(artistRouteModule('/messaging')).toBeNull();
  expect(invitedRoutePermission('customerCare.feedbackDetail')).toBe('self');expect(invitedRoutePermission('customerCare.markRead')).toBe('self');
 });
});
