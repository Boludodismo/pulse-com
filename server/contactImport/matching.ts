// Pure matching rules: a shared telephone/email alone never proves identity.
export type Person = { id?: number; name: string; phone?: string | null; email?: string | null; docNumber?: string | null; birthDate?: string | null; isArchived?: number };
export function nameKey(value: string) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
export function phoneKey(value?: string | null) { let v=(value||'').replace(/\D/g,''); if(v.length===10||v.length===11)v='55'+v; return v; }
export function phoneAlias(value?: string | null) { const v=phoneKey(value); return /^55\d{2}9[6-9]\d{7}$/.test(v)?v.slice(0,4)+v.slice(5):v; }
export function birthKey(value?: string | null) { return value?.slice(0,10)||''; }
export function sameName(a: string,b: string) { const x=nameKey(a),y=nameKey(b); return x===y && x.split(' ').filter(t=>!['de','da','do','das','dos','e'].includes(t)).length>=2; }
export function chooseExisting(incoming: Person, existing: Person[]) {
 const candidates=existing.filter(p=>!p.isArchived&&sameName(incoming.name,p.name)&&(
  (!!phoneKey(incoming.phone)&&phoneAlias(incoming.phone)===phoneAlias(p.phone))||
  (!!incoming.docNumber&&incoming.docNumber===p.docNumber)||
  (!!incoming.email&&incoming.email.toLowerCase()===p.email?.toLowerCase())||
  (!!birthKey(incoming.birthDate)&&birthKey(incoming.birthDate)===birthKey(p.birthDate))
 ));
 const conflicting=candidates.some(p=>!!birthKey(incoming.birthDate)&&!!birthKey(p.birthDate)&&birthKey(incoming.birthDate)!==birthKey(p.birthDate)||!!incoming.docNumber&&!!p.docNumber&&incoming.docNumber!==p.docNumber);
 return {match:candidates.length===1&&!conflicting?candidates[0]:undefined, ambiguous:candidates.length>1||conflicting};
}
export function permissionReason(group: {sources: {kind:string}[];tags:string[]}) {
 if(group.sources.some(s=>s.kind==='anamnese'))return 'admin_importacao_anamnese';
 if(group.tags.some(t=>t==='Nome_Confirmado'||t==='.Nome_Confirmado'))return 'admin_importacao_nome_confirmado';
 return null;
}
