import { useState } from 'react';
import { inkStockQuantity, isSessionCup, isSessionInk, sessionCupSize, SESSION_CUP_ML, type SessionCupSize, type QuantityMaterial } from '@shared/sessionInkQuantity';

type Props = { planning?: boolean; material: QuantityMaterial; value: string; onChange: (quantity: string) => void; disabled?: boolean; materials?: QuantityMaterial[]; onMaterialChange?: (id: string) => void };
export default function SessionMaterialQuantity({material,value,onChange,disabled,materials=[],onMaterialChange,planning=false}: Props) {
  const initialDrops = Number(value) * (material.unit.toLowerCase() === 'ml' ? 20 : 1);
  const [mode,setMode] = useState<'drops'|'cup'|'base'>(() => isSessionInk(material) && Math.abs(initialDrops - Math.round(initialDrops)) > 0.00001 ? 'base' : 'drops');
  const [size,setSize] = useState<SessionCupSize|'custom'>('M');
  const [customMl,setCustomMl] = useState('');
  const [count,setCount] = useState(() => String(Math.round(Number(value) * (material.unit.toLowerCase() === 'ml' ? 20 : 1)) || 1));
  const cup = isSessionCup(material), ink = isSessionInk(material), actualSize = sessionCupSize(material);
  const control = 'w-full min-h-11 rounded-md border border-input bg-background px-3 text-base';
  const update = (n: string, m=mode, s=size) => { setCount(n); onChange(m === 'base' ? n : inkStockQuantity(material.unit, Number(n), m, s==='custom'?Number(customMl):s)); };
  return <div className="space-y-2 min-w-0">
    {cup && <label className="block text-xs">Tamanho do batoque
      {onMaterialChange ? <select className={control} disabled={disabled} value={String(material.id)} onChange={e=>onMaterialChange(e.target.value)}>{materials.filter(isSessionCup).map(m=><option key={String(m.id)} value={String(m.id)}>{m.name}{m.configuration ? ' · '+m.configuration : ''}</option>)}</select> : <p>{actualSize || material.configuration || 'Conforme o material selecionado'}</p>}
      {actualSize && <p className="text-xs text-muted-foreground">Capacidade usada na sessão: {SESSION_CUP_ML[actualSize]} ml</p>}
    </label>}
    {ink && <>
      <label className="block text-xs">Medida da tinta<select className={control} disabled={disabled} value={mode} onChange={e=>{const next=e.target.value as typeof mode;setMode(next);update('1',next);}}><option value="drops">Gotas</option><option value="cup">Batoque cheio</option><option value="base">Unidade do estoque ({material.unit})</option></select></label>
      {mode==='cup' && <label className="block text-xs">Tamanho do batoque<select className={control} disabled={disabled} value={size} onChange={e=>{const next=e.target.value as typeof size;setSize(next);update(count,mode,next);}}>{Object.entries(SESSION_CUP_ML).map(([s,ml])=><option key={s} value={s}>{s} · {ml} ml · {ml*20} gotas</option>)}<option value="custom">Outro tamanho / volume do fabricante</option></select></label>}
      {mode==='cup' && size==='custom' && <label className="block text-xs">Volume do batoque cheio (ml)<input className={control} type="number" min="0.001" step="0.001" inputMode="decimal" disabled={disabled} value={customMl} onChange={e=>{setCustomMl(e.target.value);onChange(inkStockQuantity(material.unit,Number(count),mode,Number(e.target.value)));}}/></label>}
    </>}
    <label className="block text-xs">{ink ? mode==='base'?`Quantidade (${material.unit})`:mode==='drops'?'Quantidade de gotas':'Quantidade de batoques cheios' : cup?'Quantidade de unidades':`Quantidade (${material.unit})`}
      <input className={control} aria-label={`Quantidade de ${material.name}`} type="number" min={(ink&&mode!=='base')||cup?'1':'0.001'} step={(ink&&mode!=='base')||cup?'1':'0.001'} inputMode={(ink&&mode!=='base')||cup?'numeric':'decimal'} disabled={disabled} value={ink&&mode!=='base'?count:value} onChange={e=>ink?update(e.target.value):onChange(cup && !Number.isInteger(Number(e.target.value))?'':e.target.value)}/>
    </label>
    {ink && <p className="text-xs text-muted-foreground">{value ? `${planning ? "Quantidade prevista" : "Baixa de tinta"}: ${Number(value).toLocaleString('pt-BR')} ${material.unit}.` : 'Informe uma quantidade inteira e cadastre a tinta em ml ou gotas.'} Conversão da sessão: 20 gotas/ml. O batoque vazio é registrado separadamente.</p>}
  </div>;
}
