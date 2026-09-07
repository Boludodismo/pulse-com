import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useAuth} from '@/_core/hooks/useAuth';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Textarea} from './ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from './ui/dialog';
import {toast} from 'sonner';
const blank={name:'',kind:'session' as 'session'|'birthday',amount:7,unit:'days' as 'days'|'months'|'years',body:'Bom dia, {primeiro_nome}! ',enabled:false};
export function CareHistory({clientId}:{clientId?:number}) {
 const utils=trpc.useUtils();const query=trpc.customerCare.history.useQuery(clientId?{clientId}:undefined,{refetchInterval:30000});
 const read=trpc.customerCare.markRead.useMutation({onSuccess:()=>utils.customerCare.history.invalidate()});
 const statuses:Record<string,string>={pending:'Programado',queued:'Na fila de envio',responded:'Resposta recebida',cancelled:'Cancelado'};
 return <div className="space-y-3"><h3 className="font-semibold">Histórico de pós-venda e respostas</h3>{query.error&&<p role="alert">Não foi possível carregar o acompanhamento.</p>}{!query.error&&!query.data?.length&&<p className="text-sm text-muted-foreground">Nenhum acompanhamento registrado. As respostas aparecerão aqui e na ficha do cliente.</p>}{query.data?.map(e=><article key={e.id} className="rounded-lg border p-3 space-y-2"><p><a className="underline" href={`/clients/${e.clientId}`}>{e.clientName}</a> · {e.dueDate.split('-').reverse().join('/')} · {statuses[e.status]||e.status}</p><p className="text-sm whitespace-pre-wrap">{e.message.replace(/https?:\/\/\S+\/feedback\/\S+/g,'[link de feedback do atendimento]')}</p>{e.feedback&&<div className="rounded bg-orange-500/10 p-3"><strong>{!e.readAt?'Nova resposta para o artista responsável':'Resposta do cliente'}</strong><p className="whitespace-pre-wrap">{e.feedback}</p>{!e.readAt&&<Button size="sm" onClick={()=>read.mutate({id:e.id})}>Marcar como lida</Button>}</div>}</article>)}</div>;
}
export default function CustomerCarePanel() {
 const {user}=useAuth();const manager=user?.role==='admin'||user?.role==='superadmin';const utils=trpc.useUtils();
 const rules=trpc.customerCare.rules.useQuery();const [form,setForm]=useState<(typeof blank&{id?:number})|null>(null);
 const defaults=trpc.customerCare.defaults.useMutation({onSuccess:()=>{utils.customerCare.rules.invalidate();toast.success('Modelos adicionados como inativos.');},onError:e=>toast.error(e.message)});
 const save=trpc.customerCare.saveRule.useMutation({onSuccess:()=>{utils.customerCare.rules.invalidate();setForm(null);toast.success('Modelo salvo.');},onError:e=>toast.error(e.message)});
 return <section className="space-y-4 rounded-xl border border-orange-500/30 p-4 my-5">
  <h2 className="text-xl font-bold">Relacionamento e pós-venda</h2><p className="text-sm text-muted-foreground">Aniversários e acompanhamento de sessões concluídas. Envio às 9h no fuso do estúdio (padrão: Brasília), com autorização do cliente e proteção contra duplicidade. A fila depende de uma conexão WhatsApp testada.</p>
  <p className="text-sm text-muted-foreground">Os prazos começam na conclusão da sessão. Não são enviados retroativamente para sessões anteriores à criação do modelo. Os modelos ficam inativos até a configuração da integração.</p>
  {manager&&<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={defaults.isPending} onClick={()=>defaults.mutate()}>Adicionar modelos predefinidos</Button><Button onClick={()=>setForm({...blank})}>Criar mensagem de pós-venda</Button></div>}
  {rules.error&&<p role="alert">Não foi possível carregar os modelos.</p>}
  <div className="grid gap-3 md:grid-cols-2">{rules.data?.map(r=><article className="rounded-lg border p-4 space-y-2" key={r.id}><h3 className="font-semibold">{r.name}</h3><p className="text-sm">{r.enabled?'Ativo':'Inativo'} · {r.kind==='birthday'?'No aniversário':`${r.amount} ${r.unit==='days'?'dia(s)':r.unit==='months'?'mês(es)':'ano(s)'} após a sessão`} · 09:00</p><p className="text-sm whitespace-pre-wrap">{r.body}</p>{manager&&<Button size="sm" variant="outline" onClick={()=>setForm({id:r.id,name:r.name,kind:r.kind as any,amount:r.amount,unit:r.unit as any,body:r.body,enabled:!!r.enabled})}>Editar mensagem</Button>}</article>)}</div>
  <CareHistory/>
  <Dialog open={!!form} onOpenChange={open=>{if(!open)setForm(null);}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{form?.id?'Editar mensagem':'Nova mensagem'}</DialogTitle></DialogHeader>{form&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();save.mutate(form);}}>
   <label className="block">Nome<Input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label className="block">Quando enviar<select className="block w-full border rounded bg-background p-2" value={form.kind} onChange={e=>setForm({...form,kind:e.target.value as any,amount:e.target.value==='birthday'?0:7})}><option value="birthday">Aniversário</option><option value="session">Após sessão concluída</option></select></label>
   {form.kind==='session'&&<div className="flex gap-2"><label>Intervalo<Input type="number" min={1} max={365} value={form.amount} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></label><label>Unidade<select className="block border rounded bg-background p-2" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value as any})}><option value="days">Dias</option><option value="months">Meses</option><option value="years">Anos</option></select></label></div>}
   <p className="text-sm">Horário: 09:00 · Variáveis: {'{primeiro_nome}, {nome_artista}, {nome_estudio}, {link_feedback}'}</p>
   <label className="block">Mensagem<Textarea required rows={6} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
   <label className="flex gap-2"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})}/>Ativar envio automático</label>
   <Button disabled={save.isPending} type="submit">Salvar modelo</Button>
  </form>}</DialogContent></Dialog>
 </section>;
}
export function ClientCare({clientId}:{clientId:number}) {
 const utils=trpc.useUtils();const tags=trpc.customerCare.tags.useQuery({clientId});const [draft,setDraft]=useState('');
 const save=trpc.customerCare.saveTags.useMutation({onSuccess:()=>{utils.customerCare.tags.invalidate({clientId});utils.clients.search.invalidate();setDraft('');toast.success('Etiquetas atualizadas.');},onError:e=>toast.error(e.message)});
 return <section className="space-y-4 rounded-xl border p-4 my-4"><h2 className="font-semibold">Etiquetas do cliente</h2><p className="text-sm text-muted-foreground">Exemplos: realismo, fine line, cover-up, retorno. Pesquise a etiqueta na lista de clientes.</p><div className="flex gap-2 flex-wrap">{tags.data?.map(t=><Button size="sm" variant="outline" key={t.label} onClick={()=>save.mutate({clientId,labels:tags.data!.filter(x=>x.label!==t.label).map(x=>x.label)})} aria-label={`Remover etiqueta ${t.label}`}>{t.label} ×</Button>)}</div><form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(draft.trim())save.mutate({clientId,labels:[...(tags.data||[]).map(t=>t.label),draft.trim()]});}}><Input aria-label="Nova etiqueta" maxLength={60} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Nova etiqueta"/><Button disabled={save.isPending||tags.isLoading||!!tags.error}>Adicionar etiqueta</Button></form><CareHistory clientId={clientId}/></section>;
}
export function CareNotice(){const{user}=useAuth();const history=trpc.customerCare.history.useQuery(undefined,{enabled:!!user?.studioId,refetchInterval:30000});const count=history.data?.filter(e=>e.feedback&&!e.readAt).length||0;return count?<a href="/messaging" className="block rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 mb-4" role="status">Você tem {count} nova(s) resposta(s) de pós-venda. Abrir acompanhamento.</a>:null;}
