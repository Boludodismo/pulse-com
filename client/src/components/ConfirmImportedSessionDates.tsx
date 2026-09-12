import {trpc} from '@/lib/trpc';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {toast} from 'sonner';

export default function ConfirmImportedSessionDates(){
 const utils=trpc.useUtils();
 const {data,error}=trpc.contactImport.sessionDateBatches.useQuery();
 const confirm=trpc.contactImport.confirmAnamnesisSessionDates.useMutation({onSuccess:async result=>{
  toast.success(`${result.confirmed} datas de sessão salvas em ${result.clients} cadastros.`);
  await Promise.all([utils.contactImport.sessionDateBatches.invalidate(),utils.contactImport.history.invalidate(),utils.contactImport.report.invalidate()]);
 }});
 if(error)return <p className="text-sm text-muted-foreground">Datas das fichas importadas: {error.message}</p>;
 if(!data?.length)return null;
 return <Card className="mb-6"><CardHeader><CardTitle>Datas das anamneses importadas</CardTitle></CardHeader><CardContent className="space-y-4">
  <p className="text-sm text-muted-foreground">Use esta opção quando o envio da anamnese corresponde ao dia da sessão. O dia do envio será salvo em cada ficha como data do procedimento, preservando as respostas originais.</p>
  {data.map(batch=><div key={batch.batchId} className="border rounded-lg p-4 space-y-2">
   <p className="font-medium">{batch.studioName} · Estúdio {batch.studioId} · Lote {batch.batchId}</p>
   <p>{batch.forms} fichas em {batch.clients} cadastros. Datas confirmadas: {batch.confirmed} de {batch.forms}.</p>
   {batch.invalid>0&&<p role="alert">{batch.invalid} fichas precisam de uma data de envio válida.</p>}
   <Button disabled={confirm.isPending||batch.invalid>0||batch.confirmed===batch.forms} onClick={()=>confirm.mutate({batchId:batch.batchId,hash:batch.hash,expectedForms:batch.forms,expectedClients:batch.clients,basis:'submission_date'})}>
    {batch.confirmed===batch.forms?'Datas de sessão confirmadas':confirm.isPending?'Salvando datas…':'Usar dia do envio como data da sessão'}
   </Button>
  </div>)}
  {confirm.error&&<p role="alert" className="text-red-400">{confirm.error.message}</p>}
 </CardContent></Card>
}
