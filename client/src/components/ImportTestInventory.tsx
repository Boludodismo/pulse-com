import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { TEST_IMPORTABLE_COUNT, estimatePrice } from '@shared/inventoryTestCatalog';
import { TECHNICAL_CATALOG_2026, canAddCatalogItemToOperationalStock } from '@shared/technicalCatalog2026';
const pendingPrices = TECHNICAL_CATALOG_2026.filter(x => canAddCatalogItemToOperationalStock(x) && !estimatePrice(x).estimated).length;
export default function ImportTestInventory({artists,onComplete}:{artists:{id:number;name:string}[];onComplete:()=>void}) {
 const [artist,setArtist]=useState('');
 const [running,setRunning]=useState(false);
 const [progress,setProgress]=useState(0);
 const [message,setMessage]=useState('');
 const mutation=trpc.pod.inventory.importTestCatalog.useMutation();
 const run=async(profile?:'session')=>{
   if(running||!artist)return;
   setRunning(true);setMessage('');setProgress(0);
   let offset=0,created=0,preserved=0,priced=0,blocked=0;
   try{
     while(offset<(profile?1:TECHNICAL_CATALOG_2026.length)){
       const result=await mutation.mutateAsync({artistId:Number(artist),offset,profile});
       created+=result.created;preserved+=result.preserved;priced+=result.priced;blocked+=result.blocked;
       offset=result.nextOffset;setProgress(offset);
     }
     setMessage(`Concluído: ${created} novos materiais; ${preserved} referências já cadastradas preservadas; ${priced} custos zerados preenchidos; ${blocked} itens bloqueados não importados.`);
   }catch(e){setMessage(`Importação interrompida após ${offset} referências. Os registros concluídos foram mantidos. Pode repetir sem duplicar. ${e instanceof Error?e.message:''}`);}
   finally{setRunning(false);onComplete();}
 };
 return <details className="rounded-lg border border-orange-500/30 p-4">
   <summary className="cursor-pointer font-medium">Preparar catálogo completo para testes</summary>
   <div className="mt-3 space-y-3 text-sm">
     <p>{TEST_IMPORTABLE_COUNT} referências disponíveis. Cria saldo fictício no estoque do artista selecionado, com mínimo para alerta e custo estimado. Preserva saldos existentes e custos preenchidos.</p>
     <p>{TEST_IMPORTABLE_COUNT - pendingPrices} referências com estimativa por família; {pendingPrices} com preço pendente de cotação.</p>
     <p className="text-muted-foreground">Pesquisa de 17/09/2026 por família/similar, sem frete. As fontes e conversões ficam em cada material. Os valores são estimativas para simulação, não notas de compra. Itens sem oferta comparável ficam com preço pendente (zero), identificado na ficha. Equipamentos recebem 2 unidades/mínimo 1; consumíveis, uma quantidade de teste e mínimo de 25%.</p>
     <label className="block">Artista do estoque de teste<select aria-label="Artista do estoque de teste" className="mt-1 w-full rounded border bg-background p-2" value={artist} onChange={e=>setArtist(e.target.value)} disabled={running}><option value="">Selecionar artista</option>{artists.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
     <Button disabled={!artist||running} onClick={()=>void run()}>{running?`Importando ${progress}/${TECHNICAL_CATALOG_2026.length}…`:'Adicionar estoque fictício e estimativas'}</Button>
     <p>Complemento da sessão: batoques Electric Ink P 500/M 300/G 200, vaselina 800 g e seis pretos Electric Ink/Easy Glow de 240 ml. Consumo por toque: 1 cartucho, 1 par de luvas, 1 batoque, 20 g de vaselina ou 0,5 ml de tinta (editável). Dynamic permanece bloqueada no catálogo.</p>
     <Button variant="outline" disabled={!artist||running} onClick={()=>void run('session')}>Adicionar embalagens da sessão de teste</Button>
     <p role="status">{message}</p>
   </div>
 </details>;
}
