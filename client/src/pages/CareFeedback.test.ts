import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const state=vi.hoisted(()=>({id:'9',data:null as any,isLoading:false,error:null as any,mutate:vi.fn()}));
vi.mock('wouter',()=>({useParams:()=>({id:state.id})}));
vi.mock('@/_core/hooks/useAuth',()=>({useAuth:()=>({user:{studioId:2,role:'collaborator'}})}));
vi.mock('@/lib/trpc',()=>({trpc:{useUtils:()=>({}),customerCare:{feedbackDetail:{useQuery:()=>state},markRead:{useMutation:()=>({mutate:state.mutate,isPending:false})}}}}));
import CareFeedback from './CareFeedback';
beforeEach(()=>{state.id='9';state.isLoading=false;state.error=null;state.data={id:9,clientName:'Maria',appointmentId:14,message:'Como está a cicatrização?',feedback:'Ficou ótima!',feedbackAt:'2026-10-21 12:00:00',readAt:null};state.mutate.mockClear();});
describe('página aberta pelo WhatsApp do artista',()=>{
 it('mostra a pergunta e a resposta do evento e oferece confirmação explícita de leitura',()=>{
  const html=renderToStaticMarkup(createElement(CareFeedback));
  for(const text of ['Maria','Atendimento #14','Mensagem enviada ao cliente','Como está a cicatrização?','Resposta recebida do cliente','Ficou ótima!','Marcar como lida'])expect(html).toContain(text);
  expect(state.mutate).not.toHaveBeenCalled();
 });
 it('mantém o conteúdo consultável depois da leitura',()=>{
  state.data.readAt='2026-10-21 12:05:00';const html=renderToStaticMarkup(createElement(CareFeedback));
  expect(html).toContain('Feedback já marcado como lido.');expect(html).toContain('Ficou ótima!');expect(html).not.toContain('Marcar como lida');
 });
 it('mostra bloqueio de acesso sem renderizar o conteúdo de outro feedback',()=>{
  state.error={message:'Feedback não encontrado ou sem acesso para sua conta.'};const html=renderToStaticMarkup(createElement(CareFeedback));expect(html).toContain('sem acesso');expect(html).not.toContain('Ficou ótima!');
 });
 it('rejeita links inválidos',()=>{state.id='errado';expect(renderToStaticMarkup(createElement(CareFeedback))).toContain('Link de acompanhamento inválido.');});
});
