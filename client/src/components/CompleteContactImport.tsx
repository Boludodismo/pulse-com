import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {toast} from 'sonner';
export default function CompleteContactImport(){
 const prepare=trpc.contactImport.prepare.useMutation();
 const apply=trpc.contactImport.importBatch.useMutation();
 const utils=trpc.useUtils();
 const [plan,setPlan]=useState<any>(null),[progress,setProgress]=useState(0),[running,setRunning]=useState(false),[results,setResults]=useState<any[]>([]);
 async function load(file?:File){if(!file)return;setPlan(null);setResults([]);setProgress(0);try{setPlan(await prepare.mutateAsync({content:await file.text()}))}catch(e){toast.error((e as Error).message)}}
 async function run(){if(!plan)return;setRunning(true);try{let offset=progress;while(offset<plan.total){const page=await apply.mutateAsync({batchId:plan.batchId,offset});setResults(old=>[...old,...page.results]);offset=page.nextOffset;setProgress(offset);if(page.done)break;}toast.success('Importação completa. Consulte as permissões e pendências no relatório.');await utils.clients.list.invalidate();}catch(e){toast.error((e as Error).message)}finally{setRunning(false)}}
 async function download(){if(!plan)return;const data=await utils.contactImport.report.fetch({batchId:plan.batchId});const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`importacao_tatuei_${plan.batchId}_resultado.json`;a.click();URL.revokeObjectURL(url)}
 return <Card className="mb-6"><CardHeader><CardTitle>Importação completa de fichas e contatos</CardTitle></CardHeader><CardContent className="space-y-4">
  <p className="text-sm text-muted-foreground">Preserva cada formulário, os campos originais e as etiquetas. Completa apenas campos vazios dos cadastros correspondentes. A autorização administrativa de WhatsApp se aplica às fichas de anamnese e à etiqueta Nome_Confirmado; recusas anteriores e identidades duvidosas ficam pendentes.</p>
  <label className="block text-sm font-medium" htmlFor="complete-contact-file">Arquivo completo de contatos (.json)</label>
  <input id="complete-contact-file" type="file" accept=".json,application/json" disabled={running||prepare.isPending} onChange={e=>void load(e.target.files?.[0])}/>
  {prepare.isPending&&<p>Verificando arquivo e conta de destino…</p>}
  {(prepare.error||apply.error)&&<p role="alert" className="text-red-400">{prepare.error?.message||apply.error?.message}</p>}
  {plan&&<><p className="font-medium">Destino: {plan.studioName} · Estúdio {plan.studioId}</p><p>{plan.total} cadastros: {plan.newClients} novos e {plan.matched} correspondentes. {plan.eligible} atendem ao critério administrativo de autorização.</p><p>{plan.withReview} cadastros têm observações para revisão. Telefones inválidos, compartilhados ou com recusa anterior não recebem nova autorização automática.</p>
   {!plan.integrationReady&&<p>Verifique a integração WhatsApp ativa para concluir as autorizações de envio.</p>}
   <Button onClick={()=>void run()} disabled={running||progress===plan.total}>{running?'Importando…':progress?'Continuar importação':'Importar cadastros e autorizações'}</Button>
   <p role="status">Processados: {progress} de {plan.total}</p>
   {progress>0&&<Button variant="outline" onClick={()=>void download()}>Baixar resultado e cópia anterior</Button>}
   <details><summary>Ver análise dos cadastros</summary><div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr><th>Cliente</th><th>Ação</th><th>Observações</th></tr></thead><tbody>{plan.plan.map((p:any)=><tr key={p.groupKey}><td className="p-2 align-top">{p.name}</td><td className="p-2 align-top">{p.action}</td><td className="p-2 whitespace-pre-wrap">{p.review.join('\n')||'—'}</td></tr>)}</tbody></table></div></details>
   {results.length>0&&<p>Autorizações aplicadas nesta execução: {results.filter(r=>r.permission==='autorizado_pelo_administrador').length}. As demais situações constam no resultado.</p>}
  </>}
 </CardContent></Card>
}
