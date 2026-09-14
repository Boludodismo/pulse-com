export const CARE_DEFAULTS = [
 { name: "Aniversário", kind: "birthday", amount: 0, unit: "days", body: "Bom dia, {primeiro_nome}! 🎉 Feliz aniversário! Desejamos muita alegria e um novo ciclo cheio de boas histórias. Um abraço da equipe {nome_estudio}!" },
 { name: "Cicatrização — uma semana", kind: "session", amount: 7, unit: "days", body: "Bom dia, {primeiro_nome}! Aqui é da equipe {nome_estudio}. Faz uma semana da sua sessão com {nome_artista}. Como está sendo a cicatrização? Ficou alguma dúvida sobre os cuidados? Conte para a gente: {link_feedback}" },
 { name: "Experiência — um mês", kind: "session", amount: 1, unit: "months", body: "Bom dia, {primeiro_nome}! Como ficou sua tatuagem depois da cicatrização? Queremos saber o que você achou do trabalho de {nome_artista} e do nosso atendimento. Seu retorno é muito importante: {link_feedback}" },
 { name: "Reencontro — um ano", kind: "session", amount: 1, unit: "years", body: "Bom dia, {primeiro_nome}! Já faz um ano da sua sessão com {nome_artista}! Como está sua tatuagem? Está pensando em uma nova arte ou gostaria de avaliar um retoque ou acrescentar algum detalhe? Vamos conversar: {link_feedback}" },
] as const;
export function careDueDate(date: string, amount: number, unit: string) {
 const [y,m,d] = date.slice(0,10).split('-').map(Number);
 if (unit === 'days') return new Date(Date.UTC(y,m-1,d+amount)).toISOString().slice(0,10);
 const target = new Date(Date.UTC(y + (unit === 'years' ? amount : 0), m-1 + (unit === 'months' ? amount : 0), 1));
 const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(d,last)); return target.toISOString().slice(0,10);
}
export function renderCareMessage(body: string, vars: Record<string,string>) {
 return body.replace(/\{([a-z_]+)\}/g, (match,key) => vars[key] ?? match);
}
export function normalizeCareTags(tags: string[]) {
 return Array.from(new Set(tags.map(t=>t.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR')).filter(Boolean))).slice(0,30);
}
