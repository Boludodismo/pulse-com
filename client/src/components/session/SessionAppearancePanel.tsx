import { X } from "lucide-react";
import type { SessionAppearance } from "@shared/sessionAppearance";

export default function SessionAppearancePanel({value,onChange,artistName,canSave,busy,dirty,onSave,onReload,onReset,onClose}:{
  value:SessionAppearance;onChange:(value:SessionAppearance)=>void;artistName?:string|null;canSave:boolean;busy:boolean;dirty:boolean;
  onSave:()=>void;onReload:()=>void;onReset:()=>void;onClose:()=>void;
}){
  return <section className="cockpit-sheet appearance-sheet" aria-label="Preferências visuais">
    <button className="close" aria-label="Fechar preferências visuais" onClick={onClose}><X size={17}/></button>
    <h3>Preferências visuais</h3>
    <p>{artistName?`Perfil de ${artistName}`:"Defina o artista da sessão para salvar seu perfil."}</p>
    <p>Salve para usar estes ajustes nas próximas sessões deste artista, com qualquer cliente.</p>
    {([['materials','Materiais'],['layers','Camadas'],['tools','Submenus e janelas'],['palette','Paleta de cores']] as const).map(([key,label])=><fieldset key={key}>
      <legend>{label}</legend>
      <label>Tamanho <output>{Math.round(value[key].size*100)}%</output><input aria-label={`Tamanho de ${label}`} type="range" min=".85" max="1.35" step=".05" value={value[key].size} onChange={e=>onChange({...value,[key]:{...value[key],size:+e.target.value}})}/></label>
      <label>Opacidade do fundo <output>{Math.round(value[key].opacity*100)}%</output><input aria-label={`Opacidade de ${label}`} type="range" min=".4" max="1" step=".05" value={value[key].opacity} onChange={e=>onChange({...value,[key]:{...value[key],opacity:+e.target.value}})}/></label>
    </fieldset>)}
    <p role="status">{dirty?"Ajustes ainda não salvos para as próximas sessões.":"Preferências carregadas."} O texto e os ícones permanecem legíveis ao alterar o fundo.</p>
    <div className="sheet-actions"><button onClick={onReset} disabled={busy}>Restaurar padrão</button><button onClick={onReload} disabled={busy}>Recarregar salvas</button><button className="primary" onClick={onSave} disabled={busy||!canSave}>{busy?"Salvando…":"Salvar para este artista"}</button></div>
  </section>;
}
