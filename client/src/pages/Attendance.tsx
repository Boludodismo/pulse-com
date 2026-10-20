import {useEffect} from 'react';
import {useRoute} from 'wouter';
import {trpc} from '@/lib/trpc';
import {AttendanceActions} from '@/components/AttendancePanel';
import {toast} from 'sonner';

export default function Attendance() {
  const [,params]=useRoute('/atendimento/:token');
  const token=params?.token||'';
  const valid=/^[a-f0-9]{64}$/.test(token);
  const query=trpc.attendance.publicView.useQuery({token},{enabled:valid,retry:false});
  const action=trpc.attendance.publicAct.useMutation({onSuccess:()=>{void query.refetch();toast.success('Atendimento registrado.');},onError:error=>{toast.error(error.message);void query.refetch();}});
  useEffect(()=>{const meta=document.createElement('meta');meta.name='robots';meta.content='noindex,nofollow';document.head.appendChild(meta);return()=>meta.remove();},[]);
  return <main className="min-h-dvh bg-zinc-950 px-4 py-8 text-zinc-100"><article className="mx-auto max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5"><p className="text-xs uppercase tracking-widest text-orange-400">Tatuei · Atendimento</p>{!valid||query.error?<div role="alert"><h1 className="text-xl font-semibold">Atendimento indisponível</h1><p className="mt-3">{query.error?.message||'Link inválido.'}</p><a className="mt-4 block underline" href="/schedule">Abrir agenda do CRM</a></div>:query.isLoading?<p>Carregando atendimento…</p>:query.data&&<><header><h1 className="text-2xl font-semibold">Atendimento de {query.data.clientName}</h1><p className="mt-2 text-sm text-zinc-400">{query.data.date.slice(0,10).split('-').reverse().join('/')} às {query.data.date.slice(11,16)} · {query.data.duration} minutos</p><p className="mt-1">{query.data.service} · {query.data.artist}</p></header><AttendanceActions state={query.data.state} name={query.data.clientName} pending={action.isPending} onAction={value=>action.mutate({token,action:value,revision:query.data!.revision})}/><details className="border-t border-zinc-700 pt-4"><summary className="cursor-pointer">Próximos agendamentos</summary><a className="mt-3 block text-orange-400 underline" href={`/schedule?continuar=${query.data.appointmentId}`}>Agendar outra sessão para {query.data.clientName}</a><p className="mt-2 text-xs text-zinc-400">A agenda do CRM abre com este cliente selecionado. Entre com sua conta para escolher e salvar o novo horário.</p></details></>}</article></main>;
}
