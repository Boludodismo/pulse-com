import {trpc} from '@/lib/trpc';
function display(value:unknown):string{
 if(value===null||value===undefined)return '—';
 if(typeof value==='object'){const v=value as any;if(v.type==='formula')return `${v.formula} (fórmula original, não executada)${v.cached==null?'':` · valor: ${display(v.cached)}`}`;if(v.iso)return v.iso;return JSON.stringify(value,null,2)}
 return String(value);
}
export default function ImportedClientRecords({clientId}:{clientId:number}){
 const {data,error}=trpc.contactImport.history.useQuery({clientId});
 if(error)return <p className="text-sm text-muted-foreground">Histórico importado indisponível: {error.message}</p>;
 if(!data?.length)return null;
 return <section className="space-y-4 mb-6"><h3 className="text-lg font-semibold">Fichas e dados importados</h3><p className="text-sm text-muted-foreground">Conteúdo integral das planilhas, separado por preenchimento e origem. A autorização administrativa para mensagens não substitui a resposta original aos termos do procedimento.</p>
 {data.map(entry=><div key={entry.id} className="space-y-3"><p className="text-sm">Permissão de mensagens: {String(entry.result.permission).replace(/_/g,' ')}.</p>
 {entry.payload.review.length>0&&<details><summary>Observações de conferência</summary><ul className="list-disc pl-5">{entry.payload.review.map((r,i)=><li key={i}>{r}</li>)}</ul></details>}
 {entry.payload.sources.map((source,i)=><details key={`${source.key}-${i}`} className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">{source.kind==='anamnese'?'Ficha de anamnese':'Contato BotConversa'} · {source.key} · linha {source.row}</summary><p className="text-xs text-muted-foreground my-3">{source.file} · {source.sheet}</p><table className="w-full text-sm"><tbody>{source.headers.map((header,col)=><tr key={col} className="border-t"><th className="text-left align-top w-1/3 p-2 break-words">{header?display(header):`Coluna ${col+1} (sem título)`}</th><td className="p-2 align-top whitespace-pre-wrap break-words">{display(source.values[col])}</td></tr>)}</tbody></table>{source.metadata!=null&&<details className="mt-3"><summary>Metadados originais</summary><pre className="text-xs whitespace-pre-wrap break-words">{display(source.metadata)}</pre></details>}</details>)}
 </div>)}
 </section>
}
