import {useParams} from 'wouter';
import {useAuth} from '@/_core/hooks/useAuth';
import {trpc} from '@/lib/trpc';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

export default function CareFeedback(){
 const {id:rawId}=useParams<{id:string}>();const id=Number(rawId);const valid=Number.isSafeInteger(id)&&id>0;
 const {user}=useAuth();const utils=trpc.useUtils();
 const query=trpc.customerCare.feedbackDetail.useQuery({id:valid?id:0},{enabled:valid&&!!user?.studioId,retry:false,refetchInterval:30000});
 const read=trpc.customerCare.markRead.useMutation({onSuccess:async()=>{
  await Promise.all([utils.customerCare.feedbackDetail.invalidate({id}),utils.customerCare.history.invalidate()]);
  toast.success('Feedback marcado como lido.');
 },onError:e=>toast.error(e.message)});
 if(!valid)return <p role="alert">Link de acompanhamento inválido.</p>;
 if(query.isLoading)return <p role="status">Carregando feedback…</p>;
 if(query.error)return <p role="alert">{query.error.message}</p>;
 const feedback=query.data;if(!feedback)return null;
 return <section className="mx-auto w-full max-w-3xl space-y-5 p-3 sm:p-6 [overflow-wrap:anywhere]">
  <header><h1 className="text-2xl font-bold">Feedback do atendimento</h1><p className="mt-2 font-medium">{feedback.clientName||'Cliente'}{feedback.appointmentId?` · Atendimento #${feedback.appointmentId}`:''}</p></header>
  <article className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Mensagem enviada ao cliente</h2><p className="whitespace-pre-wrap">{feedback.message}</p></article>
  <article className="space-y-3 rounded-xl border border-orange-500/40 bg-orange-500/10 p-4"><h2 className="font-semibold">Resposta recebida do cliente</h2><p className="whitespace-pre-wrap">{feedback.feedback}</p>
   {feedback.feedbackAt&&<p className="text-sm text-muted-foreground">Recebida em {new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(feedback.feedbackAt)?feedback.feedbackAt:feedback.feedbackAt.replace(' ','T')+'Z').toLocaleString('pt-BR')}</p>}
   {feedback.readAt?<p role="status">Feedback já marcado como lido.</p>:<Button disabled={read.isPending} onClick={()=>read.mutate({id})}>{read.isPending?'Confirmando leitura…':'Marcar como lida'}</Button>}
  </article>
 </section>;
}
