import { useState } from 'react';
import { inkStockQuantity, isSessionCounted, isSessionCup, isSessionInk, isSessionDiluent, sessionCupSize, SESSION_DROPS_PER_ML, sessionCupSizeLabel, sessionMaterialName, SESSION_CUP_ML, type SessionCupSize, type QuantityMaterial } from '@shared/sessionInkQuantity';

type Props = { planning?: boolean; material: QuantityMaterial; value: string; onChange: (quantity: string) => void; disabled?: boolean; materials?: QuantityMaterial[]; onMaterialChange?: (id: string) => void };
export default function SessionMaterialQuantity({material,value,onChange,disabled,materials=[],onMaterialChange,planning=false}: Props) {
  const initialDrops = Number(value) * (/^(ml|mililitros?)$/i.test(material.unit.trim()) ? SESSION_DROPS_PER_ML : 1);
  const [mode,setMode] = useState<'drops'|'cup'|'base'>(() => isSessionInk(material) && Math.abs(initialDrops - Math.round(initialDrops)) > 0.00001 ? 'base' : 'drops');
  const [dropsPerMl,setDropsPerMl] = useState(SESSION_DROPS_PER_ML);
  const [size,setSize] = useState<SessionCupSize|'custom'>('M');
  const [customMl,setCustomMl] = useState('');
  const [count,setCount] = useState(() => String(Math.round(initialDrops) || 1));
  const counted = isSessionCounted(material), cup = isSessionCup(material), ink = isSessionInk(material), diluent = isSessionDiluent(material), actualSize = sessionCupSizeLabel(material), capacitySize=sessionCupSize(material);
  const control = 'w-full min-h-11 rounded-md border border-input bg-background px-3 text-base';
  const update = (n: string, m=mode, s=size) => { setCount(n); onChange(m === 'base' ? n : dropsPerMl<5||dropsPerMl>60 ? '' : inkStockQuantity(material.unit, Number(n), m, s==='custom'?Number(customMl):s,dropsPerMl)); };
  return <div className="space-y-2 min-w-0">
    {cup && <label className="block text-xs">Tamanho do batoque
      {onMaterialChange ? <select className={control} disabled={disabled} value={String(material.id)} onChange={e=>onMaterialChange(e.target.value)}>{materials.filter(isSessionCup).map(m=><option key={String(m.id)} value={String(m.id)}>{sessionMaterialName(m)}{!sessionCupSizeLabel(m) ? ' · tamanho não informado' : ''}</option>)}</select> : <p>{actualSize || 'Tamanho não informado no cadastro'}</p>}
      {capacitySize&&<p className="text-xs">Capacidade estimada de referência: {SESSION_CUP_ML[capacitySize]} ml · {SESSION_CUP_ML[capacitySize]*SESSION_DROPS_PER_ML} gotas</p>}
      <p className="text-xs text-muted-foreground">Contagem por unidade: 4 un = 4 batoques. Cada tamanho tem seu próprio saldo. A quantidade da embalagem não multiplica o uso.</p>
      {actualSize&&!capacitySize&&<p className="text-xs text-amber-500">Capacidade deste tamanho não cadastrada. Confira o volume do fabricante; a contagem em unidades permanece disponível.</p>}
      {!actualSize && <p className="text-xs text-amber-500">Selecione um batoque com tamanho cadastrado ou informe o tamanho em Estoque → Editar material.</p>}
    </label>}
    {ink && <>
      <label className="block text-xs">Medida {diluent ? "do diluente" : "da tinta"}<select className={control} disabled={disabled} value={mode} onChange={e=>{const next=e.target.value as typeof mode;setMode(next);update('1',next);}}><option value="drops">Gotas</option>{!diluent&&<option value="cup">Batoque cheio</option>}<option value="base">Unidade do estoque ({material.unit})</option></select></label>
      {mode==='drops' && <label className="block text-xs">Gotas por ml (calibração do produto)<input className={control} type="number" min="5" max="60" step="1" value={dropsPerMl} disabled={disabled} onChange={e=>{const rate=Number(e.target.value);setDropsPerMl(rate);onChange(rate>=5&&rate<=60?inkStockQuantity(material.unit,Number(count),mode,size==='custom'?Number(customMl):size,rate):'');}}/></label>}
      {mode==='cup' && <label className="block text-xs">Tamanho do batoque<select className={control} disabled={disabled} value={size} onChange={e=>{const next=e.target.value as typeof size;setSize(next);update(count,mode,next);}}>{Object.entries(SESSION_CUP_ML).map(([s,ml])=><option key={s} value={s}>{s} · {ml} ml · {ml*dropsPerMl} gotas (referência)</option>)}<option value="custom">Outro tamanho / volume do fabricante</option></select></label>}
      {mode==='cup' && size==='custom' && <label className="block text-xs">Volume do batoque cheio (ml)<input className={control} type="number" min="0.001" step="0.001" inputMode="decimal" disabled={disabled} value={customMl} onChange={e=>{setCustomMl(e.target.value);onChange(inkStockQuantity(material.unit,Number(count),mode,Number(e.target.value),dropsPerMl));}}/></label>}
    </>}
    <label className="block text-xs">{ink ? mode==='base'?`Quantidade (${material.unit})`:mode==='drops'?'Quantidade de gotas':'Quantidade de batoques cheios' : cup?'Quantidade de unidades':`Quantidade (${material.unit})`}
      <input className={control} aria-label={`Quantidade de ${material.name}`} type="number" min={(ink&&mode!=='base')||counted?'1':'0.001'} step={(ink&&mode!=='base')||counted?'1':'0.001'} inputMode={(ink&&mode!=='base')||counted?'numeric':'decimal'} disabled={disabled} value={ink&&mode!=='base'?count:value} onChange={e=>ink?update(e.target.value):onChange(counted && !Number.isInteger(Number(e.target.value))?'':e.target.value)}/>
    </label>
    {ink && <p className="text-xs text-muted-foreground">{value ? `${planning ? "Quantidade prevista" : "Consumo"}: ${Number(value).toLocaleString('pt-BR')} ${material.unit}.` : 'Informe uma quantidade inteira e cadastre o material em ml ou gotas.'} Volume estimado com {dropsPerMl} gotas/ml; ajuste à calibração do produto ou informe diretamente em ml. O batoque vazio é registrado separadamente.</p>}
  </div>;
}
