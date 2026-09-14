import {TECHNICAL_CATALOG_2026} from '@shared/technicalCatalog2026';
import {Input} from './ui/input';
import {Label} from './ui/label';
export type SpecificationForm={category:string;brand:string;line:string;model:string;configuration:string;diameter:string;needleCount:string;gauge:string;taper:string;packageQuantity:string;purchaseUnit:string};
export const emptySpecification:SpecificationForm={category:'',brand:'',line:'',model:'',configuration:'',diameter:'',needleCount:'',gauge:'',taper:'',packageQuantity:'',purchaseUnit:''};
export function specificationFromMaterial(m:any):SpecificationForm{
 let seed:any={};try{seed=JSON.parse(m.notes||'{}')}catch{}
 return Object.fromEntries(Object.keys(emptySpecification).map(key=>[key,String(m[key]??({needleCount:seed.needleCount,taper:seed.taper,packageQuantity:seed.unitsPerPackage,purchaseUnit:seed.purchaseUnit} as any)[key]??'')])) as SpecificationForm;
}
export default function MaterialSpecificationFields({value,onChange,materials}:{value:SpecificationForm;onChange:(key:keyof SpecificationForm,value:string)=>void;materials:any[]}){
 const needle=/agulha|cartucho/i.test(value.category);
 const options=(field:keyof SpecificationForm)=>{
 const seedKey:Record<string,string>={brand:'brandName',line:'lineName',model:'sku',configuration:'format',diameter:'needleDiameter',packageQuantity:'unitsPerPackage'};
 const values=[...materials.map(m=>specificationFromMaterial(m)[field]),...TECHNICAL_CATALOG_2026.filter(m=>field==='category'||!value.category||m.category===value.category).map(m=>(m as any)[seedKey[field]??field])];
 if(field==='gauge')values.push('04','06','08','10','12','14');
 return Array.from(new Set(values.filter(v=>v!==null&&v!==undefined&&String(v)!=='').map(String))).sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
 };
 const fields:[keyof SpecificationForm,string][]=[['category','Categoria'],['brand','Marca'],['line','Linha / variante'],['model','Modelo / SKU'],...(needle?[['needleCount','Quantidade de pontas'],['configuration','Formato da ponta'],['gauge','Calibre — código do fabricante'],['diameter','Diâmetro (mm)'],['taper','Taper']] as [keyof SpecificationForm,string][]:[]),['packageQuantity','Unidades por embalagem'],['purchaseUnit','Tipo de embalagem (caixa, frasco…)']];
 return <div className="space-y-3"><p className="text-sm text-muted-foreground">Busque uma opção existente ou digite uma nova categoria, marca ou variante. Ela ficará disponível nos próximos cadastros do seu estoque.</p><div className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label])=><div key={key}><Label htmlFor={'spec-'+key}>{label}</Label><select aria-label={'Selecionar '+label} className="w-full rounded border bg-background p-2 text-sm mb-1" value={options(key).includes(value[key])?value[key]:''} onChange={e=>onChange(key,e.target.value)}><option value="">Selecionar existente ou digitar abaixo</option>{options(key).map(v=><option key={v} value={v}>{v}</option>)}</select><Input id={'spec-'+key} list={'options-'+key} value={value[key]} onChange={e=>onChange(key,e.target.value)} type={key==='needleCount'||key==='packageQuantity'?'number':'text'} min={1} step={1}/><datalist id={'options-'+key}>{options(key).map(v=><option key={v} value={v}/>)}</datalist></div>)}</div>{needle&&<p className="text-xs text-muted-foreground">Código de calibre e diâmetro são campos separados. Confira os valores na embalagem do fabricante.</p>}</div>;
}
