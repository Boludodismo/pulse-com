import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const state=vi.hoisted(()=>({data:[] as any[],isLoading:false,mutate:vi.fn()}));
vi.mock('@/lib/trpc',()=>({trpc:{useUtils:()=>({customerCare:{history:{invalidate:vi.fn()}}}),customerCare:new Proxy({},{get:()=>({useQuery:()=>state,useMutation:()=>({mutate:state.mutate})})})}}));
vi.mock('@/_core/hooks/useAuth',()=>({useAuth:()=>({user:{role:'admin',studioId:10}})}));
import CustomerCarePanel,{CareHistory,CareNotice} from './CustomerCarePanel';
const response={id:9,clientId:7,clientName:'Maria',artistId:5,appointmentId:3,dueDate:'2026-10-21',status:'responded',message:'Como está a cicatrização? https://crm.tatuei.com/feedback/segredo',feedback:'Cicatrizou bem.\nSem coceira.',feedbackAt:'2026-10-21 12:00:00',readAt:null};
beforeEach(()=>{state.data=[response,{...response,id:10,status:'queued',feedback:null,message:'Ainda sem resposta'}];state.isLoading=false;state.mutate.mockClear();});
describe('leitura do feedback no CRM',()=>{
 it('exibe pergunta, resposta completa, cliente, atendimento e data sem expor o token público',()=>{
  const html=renderToStaticMarkup(createElement(CareHistory,{responsesOnly:true}));
  for(const text of ['Maria','Atendimento #3','Mensagem enviada ao cliente','Como está a cicatrização?','Cicatrizou bem.\nSem coceira.','Recebida em'])expect(html).toContain(text);
  expect(html).not.toContain('Ainda sem resposta');expect(html).not.toContain('/feedback/segredo');expect(state.mutate).not.toHaveBeenCalled();
 });
 it('mantém respostas disponíveis depois de marcar como lidas',()=>{
  state.data=[{...response,readAt:'2026-10-21 12:05:00'}];
  const html=renderToStaticMarkup(createElement(CareHistory,{responsesOnly:true}));
  expect(html).toContain('Cicatrizou bem.');expect(html).not.toContain('Marcar como lida');
  expect(renderToStaticMarkup(createElement(CustomerCarePanel))).toContain('Ver respostas dos clientes');
 });
 it('oferece abertura direta da resposta no aviso',()=>{
  const html=renderToStaticMarkup(createElement(CareNotice));
  expect(html).toContain('Ver mensagem enviada e resposta recebida.');expect(html).toContain('type="button"');expect(html).toContain('1 nova(s)');
 });
 it('abre somente o evento selecionado, mesmo havendo outros feedbacks do mesmo cliente',()=>{
  state.data=[response,{...response,id:11,appointmentId:4,message:'Gostou do atendimento?',feedback:'Outro retorno'},{...response,id:12,clientName:'João',feedback:'Resposta do João'}];
  const html=renderToStaticMarkup(createElement(CareHistory,{responsesOnly:true,eventId:9}));
  expect(html).toContain('Cicatrizou bem.');expect(html).not.toContain('Outro retorno');expect(html).not.toContain('Resposta do João');
  const notices=renderToStaticMarkup(createElement(CareNotice));
  expect(notices.match(/type="button"/g)).toHaveLength(3);expect(notices).toContain('Maria');expect(notices).toContain('João');expect(notices).toContain('Atendimento #4');
 });
 it('distingue carregamento de ausência de respostas',()=>{
  state.data=[];state.isLoading=true;
  const loading=renderToStaticMarkup(createElement(CareHistory,{responsesOnly:true}));
  expect(loading).toContain('Carregando acompanhamento');expect(loading).not.toContain('Nenhuma resposta recebida');
  state.isLoading=false;
  expect(renderToStaticMarkup(createElement(CareHistory,{responsesOnly:true}))).toContain('Nenhuma resposta recebida');
 });
});
