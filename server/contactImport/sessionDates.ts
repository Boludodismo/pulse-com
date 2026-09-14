type Source = {kind:string;key:string;headers:unknown[];values:unknown[]};

export function submittedSessionDate(source:Source):string|null {
 if(source.kind!=='anamnese')return null;
 const index=source.headers.findIndex(h=>typeof h==='string'&&h.trim()==='Carimbo de data/hora');
 const value=source.values[index] as {type?:string;iso?:string}|undefined;
 if(!value||typeof value!=='object'||!['date','datetime'].includes(value.type||'')||typeof value.iso!=='string')return null;
 const day=value.iso.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const parsed=new Date(`${day}T12:00:00Z`);
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day?day:null;
}

export function sessionDateStats(records:{payload:{sources:Source[]};result:any;clientId:number}[]){
 let forms=0,confirmed=0,invalid=0;const clients=new Set<number>();
 for(const record of records)for(const source of record.payload.sources){
  if(source.kind!=='anamnese')continue;
  forms++;clients.add(record.clientId);
  const date=submittedSessionDate(source);
  if(!date)invalid++;
  if(date&&record.result.anamnesisSessionDates?.[source.key]?.date===date)confirmed++;
 }
 return {forms,clients:clients.size,confirmed,invalid};
}
