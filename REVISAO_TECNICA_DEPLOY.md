# Revisão técnica para deploy

Data da revisão: 24/08/2026

## Diagnóstico do pacote original

- A pasta `drizzle/` existia no ZIP, mas continha migrations duplicadas com sufixo ` 2`.
- O histórico possuía numeração incompleta, migrations fora do diário e scripts que repetiam alterações já aplicadas.
- O `docker-compose.yml` montava toda a pasta `drizzle/` no inicializador do MySQL, o que faria os arquivos duplicados serem executados novamente.
- O schema TypeScript não declarava os IDs autoincrementais como chaves primárias.
- A pasta `.manus/` armazenava históricos locais de consultas e não era segura para publicação.
- Havia uma importação duplicada de React que impedia a verificação completa do TypeScript.

## Correções aplicadas

- Remoção de 406 cópias duplicadas e dos metadados do macOS.
- Reconstrução de `drizzle/migrations/` a partir do schema atual, com uma migration inicial limpa para 37 tabelas.
- Inclusão de chaves primárias e defaults de timestamp válidos no schema.
- Separação entre o código do schema (`drizzle/schema.ts`) e o histórico (`drizzle/migrations/`).
- Aplicação automática das migrations antes da inicialização do servidor.
- Remoção da execução direta dos SQLs pelo container do MySQL.
- Adição do endpoint `GET /health` e atualização dos healthchecks.
- Remoção dos logs `.manus/` e bloqueio da pasta no Git e no Docker.
- Atualização do Dockerfile, das variáveis de exemplo e do guia de deploy na Railway.
- Correção da importação duplicada em `client/src/pages/PodSession.tsx`.

## Validações executadas

- `pnpm check`: aprovado, sem erros TypeScript.
- `pnpm build`: aprovado para frontend, backend e executor de migrations.
- `drizzle-kit check`: histórico de migrations aprovado.
- `pnpm db:generate`: nenhuma diferença entre o schema e a migration inicial.
- Leitura do histórico pelo migrator: 1 migration reconhecida, com 37 instruções SQL.
- Servidor compilado: `/health` retornou HTTP 200 e a página principal retornou HTTP 200.
- Testes sem banco externo: 217 aprovados, 14 ignorados; 48 testes de integração exigem uma instância MySQL ativa.

## Observação de uso

A migration inicial foi preparada para um banco MySQL novo, adequado ao primeiro teste hospedado. Para aproveitar um banco antigo já preenchido, faça backup e prepare uma estratégia de migração específica antes de apontar este pacote para ele.
