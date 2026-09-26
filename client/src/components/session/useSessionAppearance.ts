import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { defaultSessionAppearance, type SessionAppearance } from "@shared/sessionAppearance";

const defaults=()=>defaultSessionAppearance(window.matchMedia("(max-width:620px)").matches);
export function useSessionAppearance(procedureId:number){
  const query=trpc.pod.session.getAppearance.useQuery({procedureId},{refetchOnWindowFocus:false,refetchOnMount:"always"});
  const mutation=trpc.pod.session.saveAppearance.useMutation();
  const [value,setValue]=useState(defaults),[saved,setSaved]=useState(defaults),[revision,setRevision]=useState(0);
  const loaded=useRef<number|null>(null),edited=useRef(false);
  useEffect(()=>{loaded.current=null;edited.current=false;const initial=defaults();setValue(initial);setSaved(initial);setRevision(0);},[procedureId]);
  useEffect(()=>{
    if(!query.data||query.isFetching||loaded.current===procedureId)return;
    loaded.current=procedureId;setRevision(query.data.revision);
    const next=query.data.preferences??defaults();setSaved(next);if(!edited.current)setValue(next);
  },[procedureId,query.data,query.isFetching]);
  function change(next:SessionAppearance|((p:SessionAppearance)=>SessionAppearance)){edited.current=true;setValue(next);}
  async function save(){
    const snapshot=value;
    try{const result=await mutation.mutateAsync({procedureId,expectedRevision:revision,preferences:snapshot});setRevision(result.revision);setSaved(snapshot);toast.success("Preferências salvas para as próximas sessões deste artista.");}
    catch(e:any){toast.error(e.message||"Não foi possível salvar as preferências.");}
  }
  async function reload(){
    const result=await query.refetch();
    if(result.error||!result.data){toast.error("Não foi possível carregar as preferências.");return;}
    const next=result.data.preferences??defaults();setValue(next);setSaved(next);setRevision(result.data.revision);edited.current=false;loaded.current=procedureId;
  }
  return {value,change,save,reload,reset:()=>change(defaults()),artistName:query.data?.artistName,canSave:!!query.data?.artistId&&!query.isError&&loaded.current===procedureId,busy:mutation.isPending||query.isFetching,dirty:JSON.stringify(value)!==JSON.stringify(saved)};
}
