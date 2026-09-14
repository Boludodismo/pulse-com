import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { legacyArchiveTables, type LegacyArchiveTable } from '@shared/legacyArchive';
export default function LegacyArchive() {
  const {user} = useAuth();
  const [table,setTable] = useState<LegacyArchiveTable>('anamnesis_risk_history');
  const [offset,setOffset] = useState(0);
  const query = trpc.legacyArchive.list.useQuery({table,offset},{enabled:user?.role==='superadmin'});
  if(user?.role!=='superadmin') return <p>Acesso exclusivo do superadministrador.</p>;
  return <div className="space-y-5 p-4 max-w-full">
    <h1 className="text-2xl font-semibold">Históricos anteriores</h1>
    <p className="text-muted-foreground">Consulta dos registros preservados na atualização. Estes registros são somente para leitura; os novos lançamentos ficam nos módulos atuais.</p>
    <select aria-label="Tipo de histórico" className="border rounded p-2 bg-background max-w-full" value={table} onChange={e=>{setTable(e.target.value as LegacyArchiveTable);setOffset(0);}}>
      {Object.entries(legacyArchiveTables).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
    {query.isLoading && <p>Carregando…</p>}
    {query.error && <p role="alert">Não foi possível carregar: {query.error.message}</p>}
    {query.data && <><p>{query.data.total} registro(s)</p>
      <div className="overflow-x-auto border rounded"><table className="w-full text-sm"><thead><tr>{Object.keys(query.data.rows[0]||{}).map(k=><th className="p-3 text-left whitespace-nowrap" key={k}>{k}</th>)}</tr></thead><tbody>
        {query.data.rows.map((row,i)=><tr className="border-t" key={String(row.id??i)}>{Object.entries(row).map(([k,v])=><td className="p-3 min-w-28 max-w-sm break-words align-top" key={k}>{v==null?'—':typeof v==='object'?JSON.stringify(v):String(v)}</td>)}</tr>)}
      </tbody></table></div>
      <div className="flex gap-4"><button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Anterior</button><button disabled={offset+50>=query.data.total} onClick={()=>setOffset(offset+50)}>Próxima</button></div>
    </>}
  </div>;
}
