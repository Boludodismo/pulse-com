export const QUOTE_MODELS = [
 {name:'Conversa direta',body:'Olá, {primeiro_nome_fornecedor}! Tudo bem? Aqui é {nome_estudio}. Estamos organizando a reposição e gostaríamos de um orçamento para {quantidade} {unidade} de {material}. Você consegue nos informar o valor, a disponibilidade, o prazo de entrega e as condições de pagamento? Obrigado pela atenção!'},
 {name:'Parceiro habitual',body:'Oi, {primeiro_nome_fornecedor}! Como você está? Precisamos repor {material} no {nome_estudio}: {quantidade} {unidade}. Pode nos passar sua melhor condição e quando conseguiria entregar? Se tiver alguma alternativa equivalente, pode nos indicar também. Obrigado!'},
];
export const QUOTE_VARIABLES=['primeiro_nome_fornecedor','nome_fornecedor','nome_estudio','material','quantidade','unidade'];
export function renderQuote(body:string,variables:Record<string,string>){const missing:string[]=[];const message=body.replace(/\{([a-z][a-z0-9_]*)\}/g,(original,key)=>{if(!variables[key]?.trim()){missing.push(key);return original;}return variables[key];});return {message,missing:Array.from(new Set(missing))};}
export function safePublicUrl(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
