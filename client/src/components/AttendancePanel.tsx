import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {Button} from './ui/button';
import {attendanceLabels,transitionAttendance,type AttendanceAction,type AttendanceState} from '@shared/attendance';
import {toast} from 'sonner';
import {useArtistAccess} from '@/hooks/useArtistAccess';

export function AttendanceActions({state,name,pending,onAction}:{state:AttendanceState;name:string;pending:boolean;onAction:(action:AttendanceAction)=>void}) {
  const [confirmAbsence,setConfirmAbsence]=useState(false);
  return <div className="space-y-3">
    <p className="text-sm">Presença: <strong>{{pending:'Aguardando conferência',present:'Presente',late:'Atrasado',no_show:'Não compareceu'}[state.attendance]}</strong> · Sessão: <strong>{{not_started:'Não iniciada',in_progress:'Em andamento',completed:'Finalizada'}[state.session]}</strong>{state.needsMore?' · Precisa de outras sessões':''}</p>
    <div className="grid gap-2 sm:grid-cols-2">{(Object.keys(attendanceLabels) as AttendanceAction[]).map(action=>{
      let enabled=true;try{enabled=JSON.stringify(transitionAttendance(state,action))!==JSON.stringify(state);}catch{enabled=false;}
      if(!enabled)return null;
      return <Button key={action} type="button" variant={action==='no_show'?'destructive':'outline'} disabled={pending} className="h-auto min-h-11 whitespace-normal text-left" onClick={()=>{if(action==='no_show')setConfirmAbsence(true);else{setConfirmAbsence(false);onAction(action);}}}>{action==='present'?`${state.attendance==='no_show'?'Corrigir falta · confirmar presença de':'Confirmar presença de'} ${name}`:attendanceLabels[action]}</Button>;
    })}</div>
    {confirmAbsence&&<div className="rounded-lg border border-red-500/40 p-3 space-y-2" role="alert"><p>Registrar que {name} não compareceu? Esta falta ficará no histórico deste agendamento.</p><div className="flex gap-2"><Button type="button" variant="destructive" disabled={pending} onClick={()=>{setConfirmAbsence(false);onAction('no_show');}}>Registrar falta</Button><Button type="button" variant="outline" onClick={()=>setConfirmAbsence(false)}>Voltar</Button></div></div>}
    <p className="text-xs text-muted-foreground">A presença vincula o atendimento ao pós-venda. Você pode conferir os materiais depois. “Finalizar sessão · precisa de outras sessões” encerra esta sessão e mantém a indicação de continuidade.</p>
  </div>;
}
export function AttendancePanel({appointmentId}:{appointmentId:number}) {
  const {can}=useArtistAccess();
  const utils=trpc.useUtils();
  const query=trpc.attendance.view.useQuery({appointmentId},{refetchInterval:30000});
  const action=trpc.attendance.act.useMutation({onSuccess:()=>{void query.refetch();void utils.appointments.invalidate();void utils.attendance.history.invalidate();void utils.customerCare.invalidate();toast.success('Atendimento registrado.');},onError:error=>{toast.error(error.message);void query.refetch();}});
  return <section className="my-4 rounded-lg border border-orange-500/30 p-3 space-y-3"><h3 className="font-semibold">Acompanhamento do atendimento</h3>{query.isLoading?<p>Carregando atendimento…</p>:query.error?<p role="alert">{query.error.message}</p>:query.data&&<><AttendanceActions state={query.data.state} name={query.data.clientName} pending={action.isPending||!can('appointments',true)} onAction={value=>action.mutate({appointmentId,revision:query.data!.revision,action:value})}/>{can('appointments',true)&&<details><summary className="cursor-pointer py-2">Próximos agendamentos</summary><a className="block py-2 text-orange-400 underline" href={`/schedule?continuar=${appointmentId}`}>Agendar outra sessão para {query.data.clientName}</a></details>}</>}</section>;
}
export function ClientAttendanceHistory({clientId,compact=false}:{clientId:number;compact?:boolean}) {
  const query=trpc.attendance.history.useQuery({clientId},{refetchInterval:30000});
  if(compact)return query.data?.noShowCount?<p className="rounded border border-orange-500/30 p-2 text-sm" role="status">Histórico do cliente: <strong>{query.data.noShowCount}</strong> agendamento(s) em que não compareceu.</p>:null;
  return <section className="my-4 rounded-xl border p-4 space-y-3"><h3 className="font-semibold">Presença e sessões</h3>{query.error?<p role="alert">Não foi possível carregar o histórico de presenças.</p>:<><p><strong>{query.data?.noShowCount??0}</strong> agendamento(s) com falta registrada.</p>{query.data?.events.length?<details><summary className="cursor-pointer">Ver histórico de atendimentos</summary><ul className="mt-3 space-y-2 text-sm">{query.data.events.map((event,index)=><li key={`${event.appointmentId}:${event.createdAt}:${index}`}>{new Date(event.createdAt.replace(' ','T')+'Z').toLocaleString('pt-BR')} · Agendamento #{event.appointmentId} · {attendanceLabels[event.action as AttendanceAction]||event.action}</li>)}</ul></details>:<p className="text-sm text-muted-foreground">As ações registradas na agenda ou pelo link do WhatsApp aparecerão aqui.</p>}</>}</section>;
}
