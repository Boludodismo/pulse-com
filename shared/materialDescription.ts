type MaterialSpecification={name:string;brand?:string|null;line?:string|null;model?:string|null;configuration?:string|null;diameter?:string|null;needleCount?:number|null;gauge?:string|null;taper?:string|null;packageQuantity?:number|null;purchaseUnit?:string|null;unit?:string|null;notes?:string|null};
export function materialDescription(m:MaterialSpecification){
 let seed:any={};try{seed=JSON.parse(m.notes||'{}')}catch{}
 return [m.name,m.brand&&`Marca: ${m.brand}`,m.line&&`Linha: ${m.line}`,m.model&&`Modelo: ${m.model}`,m.configuration&&`Formato: ${m.configuration}`,(m.needleCount??seed.needleCount)&&`Pontas: ${m.needleCount??seed.needleCount}`,m.gauge&&`Calibre (código): ${m.gauge}`,m.diameter&&`Diâmetro: ${m.diameter} mm`,(m.taper??seed.taper)&&`Taper: ${m.taper??seed.taper}`,(m.packageQuantity??seed.unitsPerPackage)&&`Embalagem: ${m.packageQuantity??seed.unitsPerPackage} ${m.unit||'unidades'} / ${m.purchaseUnit??seed.purchaseUnit??'embalagem'}`].filter(Boolean).join(' · ');
}
