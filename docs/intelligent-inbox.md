# Central Inteligente de Atendimentos — arquitetura inativa

## Escopo e arquitetura analisada

Extensão do CRM existente, publicada exclusivamente em `amused-youthfulness / staging-custos / courageous-hope`, branch `homologacao-final-2026-09-06`. Não altera `production`, `main` ou `crm.tatuei.com`.

- Frontend: React 19, Vite, Wouter, Tailwind, componentes Card/Button/Input/Badge e DashboardLayout existentes.
- API: router tRPC existente, `tenantProcedure`, autenticação e assinatura da sessão preservadas.
- Tenant: `ctx.user.studioId`; IDs de estúdio enviados no payload são rejeitados. Superadministrador também precisa selecionar empresa para a Central.
- RBAC: mesma tabela `user_module_permissions`, módulos em `SAAS_MODULES`, funções `hasModulePermission`/`listUserPermissions` e tela Gestão SaaS.
- Banco: MySQL/Drizzle. `clients`, `artists`, `users`, `whatsapp_integrations`, `integration_contacts` e `integration_events` permanecem as entidades de referência. Não são duplicados cadastros, credenciais, contatos ou filas de envio.
- Logs futuros: reutilizar `integration_events.type`, com nomes definidos em `INBOX_EVENTS`. Nenhum evento de operação externa inexistente é inserido agora.
- Jobs: o scheduler, Heartbeat e filas existentes não são modificados. A nova Central não é registrada neles.
- Configuração: `ENV`, com `INTELLIGENT_INBOX_ENABLED=false` por padrão. Valor também definido explicitamente no Railway de homologação.
- Migrations: histórico existente é preservado. A base importada de homologação não tem controle histórico e pula o replay; um helper restrito aos IDs exatos do serviço/ambiente aplica somente a migration nova, sob lock MySQL.

## Estado entregue

Somente preparação estrutural. `operational=false` permanece obrigatório nesta versão, inclusive se a flag for ligada acidentalmente. Não há adaptador concreto, cliente de IA, webhook HTTP, cron, job de resumo, sincronização, leitura externa, geração de sugestões, exportação ChatGPT ou envio de mensagem na Central.

A tela consulta somente as permissões da sessão ao abrir. Não consulta as tabelas novas nem realiza polling, refetch ao focar a janela ou refetch de reconexão. Exibe indicadores 0, filtros desativados, participantes futuros e configuração sem segredos. Ausência da integração é estado normal, não erro. Nenhum dado de demonstração foi inserido.

## Arquivos criados

- `shared/intelligentInbox.ts`: permissões, nomes, classificações extensíveis, prioridades, intenções, tipos de mensagens, eventos e indicadores.
- `drizzle/0055_intelligent_inbox.sql`: migration nova e aditiva.
- `drizzle/intelligentInboxSchema.ts`: definições Drizzle das quatro tabelas, índices e FKs compostas.
- `server/_core/stagingIntelligentInboxSchema.ts`: aplicação isolada na base importada de homologação.
- `server/intelligentInbox/contracts.ts`: interfaces futuras, sem implementação externa.
- `server/intelligentInbox/service.ts`: estado desconectado e operações bloqueadas.
- `server/routers/intelligentInbox.ts`: endpoints autenticados, autorizados e inativos.
- `server/intelligentInbox.test.ts`: 15 testes de segurança, inatividade e schema.
- `client/src/pages/IntelligentInbox.tsx`: página responsiva, navegação interna e configuração futura.
- `docs/intelligent-inbox.md`: este relatório e guia de expansão.

## Arquivos modificados

- `client/src/App.tsx`: apenas acrescenta `/intelligent-inbox`.
- `client/src/components/DashboardLayout.tsx`: apenas acrescenta o item Central Inteligente ao menu. Não adiciona consultas globais.
- `client/src/pages/SaaSAdmin.tsx`: acrescenta rótulos das permissões ao final da matriz existente.
- `client/src/pages/SaaSAdmin.labels.test.ts`: expectativa ampliada para os novos rótulos; mantém os anteriores.
- `drizzle/meta/_journal.json`: acrescenta a entrada 55, sem alterar migrations aplicadas.
- `drizzle/schema.ts`: exporta o schema novo e amplia o enum de módulos RBAC sem remover valores.
- `server/_core/env.ts`: flag específica, false por padrão.
- `server/_core/index.ts`: chamada do helper aditivo de schema na inicialização, sem timer.
- `server/routers.ts`: registra apenas `intelligentInbox`.
- `server/saas.ts`: acrescenta os novos módulos à matriz existente.
- `server/saas.test.ts`: amplia a expectativa dos módulos, preservando os sete anteriores.

Nenhuma biblioteca, lockfile, autenticação, regra de agenda, estoque, financeiro, clientes, anamnese, fornecedor ou integração de mensagens existente foi substituída. `dist/index.js` gerado localmente não faz parte do commit.

## Permissões

Mesma matriz Ler/Editar existente; não há concessão automática de permissões a colaboradores nem nova tabela de autorização.

| Módulo | Ler | Editar |
|---|---|---|
| intelligent_inbox | Visualizar Central | Reservado, sem operação atual |
| inbox_conversations | Conversas e contexto do cliente | Reservado |
| inbox_summaries | Resumos e histórico | Reservado |
| inbox_priorities | Prioridades | Reservado |
| inbox_opportunities | Oportunidades | Reservado |
| inbox_settings | Configuração da integração | Gerenciar integração (bloqueado nesta fase) |
| inbox_suggestions | Visualizar respostas sugeridas | Gerar sugestões (bloqueado nesta fase) |

Todas as operações exigem também leitura de `intelligent_inbox`. Admin e superadmin usam seu papel existente, sempre com estúdio selecionado. Colaboradores precisam das permissões específicas. O item de navegação é visível aos papéis existentes, mas a API e a página negam acesso quando não autorizado.

## Rotas e endpoints

Rota de página nova: `/intelligent-inbox`, protegida pelo DashboardLayout existente. Seções internas: visão geral, conversas, aguardando resposta, novos orçamentos, oportunidades, prioridades, resolvidos, histórico e configuração.

Namespace HTTP tRPC existente: `/api/trpc/intelligentInbox.<procedimento>`.

| Procedimento | Tipo | Comportamento atual |
|---|---|---|
| access | query | Permissões somente do usuário/estúdio autenticados |
| status | query | Integração não configurada, operacional false |
| dashboard | query | Métricas zeradas, sem consultas de conversas |
| conversations | query | Página vazia; limite até 100 e cursor preparados |
| messages | query | Página vazia; conversa e cursor preparados |
| summaries | query | Histórico vazio |
| priorities | query | Página vazia |
| opportunities | query | Página vazia |
| clientContext | query | Contexto vazio; referência ao cliente existente |
| settings | query | Configuração vazia/inativa, sem credenciais |
| configure | mutation | Recusa ativação; não escreve nada |
| suggestedReply | query | Resposta null |
| generateSuggestedReply | mutation | Recusa geração; não escreve nada |

Não existe endpoint de webhook da Central. Listagens são contratos inativos: não são repositórios funcionais e não expõem dados mesmo se houver registros inseridos manualmente.

## Tabelas, relacionamentos e escala

Quatro tabelas novas. `studio_id` obrigatório em todas. Não há novas colunas nas tabelas antigas; apenas ampliação compatível do enum `user_module_permissions.module`.

- `inbox_sync_state`: configuração futura, vínculo opcional com `whatsapp_integrations.id`, cursores e marcas de processamento. Sem tokens.
- `inbox_conversations`: relacionamento lógico com `clients.id`, `artists.id`, `users.id` e `integration_contacts.id`; FK composta `(studio_id,sync_state_id)` para a configuração do mesmo estúdio.
- `inbox_messages`: FK composta `(studio_id,conversation_id)`; ID externo único dentro da conversa/estúdio; conteúdo e metadados de mídia, sem baixar arquivos.
- `inbox_summaries`: snapshots de resumo/análise por janela, gerais ou de conversa; FK composta para conversa, quando informada; chave única de janela/escopo para idempotência.

Índices por estúdio, última interação, status/prioridade, classificação, cliente, artista, atendente, telefone, paginação de mensagens, processamento pendente e histórico. O resumo persistido e as métricas por janela evitam recalcular/carregar todo o histórico. Na fase futura, a implementação de busca deve usar esses índices, paginação por cursor e estratégia de busca textual validada com volume real.

Os vínculos com entidades antigas são lógicos porque não se alteram suas chaves nesta entrega. Antes de qualquer ingestão futura, o repositório deverá validar `studioId` de cliente, artista, usuário, integração e contato. Nenhuma ingestão é possível agora. As classificações, tipos, prioridade e intenção usam VARCHAR, com listas TypeScript de referência, não enum rígido no banco.

## Pontos exatos de integração futura

1. Implementar `BotConversaAdapter` em `server/intelligentInbox/contracts.ts`; confirmar endpoints reais, escopos e assinatura antes de registrar webhook. Reutilizar credenciais criptografadas da integração existente.
2. Implementar `InboxRepository`: validação tenant de todos os relacionamentos, ingestão idempotente, paginação, índice de busca e atualização de cursores somente após commit.
3. Implementar `AnalysisService` e `SuggestedReplyService`: somente após autorização, respeitando permissões, limites, proteção de dados e conteúdo externo não confiável.
4. Implementar `SummaryService.summarizeWindow`: janelas explícitas, contagem de mensagens, último ID processado e snapshots em `inbox_summaries`.
5. Registrar um job somente na fase de ativação. Deve verificar flag global, configuração tenant e disponibilidade dos adaptadores antes de qualquer leitura externa.
6. Implementar `ChatGptSummaryExport.exportAuthorizedSummary`: exportação explícita do resumo autorizado, sem expor o histórico inteiro ou credenciais. A capacidade de entrega dentro do ChatGPT precisará ser confirmada na integração real; não é prometida por esta estrutura.
7. Substituir os retornos vazios no router por serviços paginados, mantendo `tenantProcedure` e os guardas RBAC. Adicionar controles de cache por usuário/tenant antes de retornar dados reais.
8. Conectar o detalhe à ficha `/clients/:id` existente somente quando houver conversa associada. Não foi duplicada nem modificada a ficha atual.
9. Persistir eventos sanitizados em `integration_events`; nunca conteúdo/segredos completos em logs. Os eventos permitidos estão em `INBOX_EVENTS`.

## Reversão

Não há migration antiga editada, reset, seed ou exclusão de dados. Reverter o commit remove UI/API/serviços, mantendo as tabelas novas e os valores extras do enum sem afetar os módulos antigos. Essa é a reversão preferida, sem perda de dados.

Excluir tabelas ou reduzir o enum não é necessário para desativar o recurso. Caso desejado futuramente, exige backup, verificação de tabelas vazias e ausência de permissões usando os novos valores; deve ser uma nova migration revisada. Não foi criado rollback destrutivo automático.

## Validação e limitações

- TypeScript: aprovado, sem erros.
- Build Vite/esbuild: aprovado. Aviso existente de tamanho de bundle permanece.
- Testes novos: 15/15 aprovados.
- Suíte antes: 316 aprovados, 50 falharam, 14 ignorados (380 testes).
- Suíte depois: 331 aprovados, 50 falharam, 14 ignorados (395 testes).
- Comparação por nome: nenhuma falha nova, nenhuma falha anterior ocultada. Dois testes de expectativa fixa de módulos foram atualizados para a extensão intencional do RBAC.
- As 50 falhas anteriores incluem testes que dependem de banco/configuração e um teste de data/fuso do SaaS. Não foram corrigidas por refatoração fora do escopo.
- Migração: testes conferem quatro tabelas, tenant obrigatório, índices, FKs compostas e ausência de operações destrutivas. Aplicação real e status do deploy serão conferidos nos logs de homologação.
- Login, dashboard, clientes, agenda, estoque, financeiro, troca de tenant real, mobile/orientações e console: nova rodada de testes visuais bloqueada pela indisponibilidade do navegador de validação (timeout de conexão). Não se afirma aprovação visual desses itens. Login e isolamento estão cobertos parcialmente pelos testes de sessão/RBAC, sem substituir o teste real.
- Nenhuma integração BotConversa/OpenAI/ChatGPT foi configurada por este módulo. Nenhum webhook ou cron da Central está ativo. Rotinas de outros módulos já existentes permanecem preservadas.

## Inventário exato das colunas novas

### inbox_sync_state

| Coluna | Definição MySQL |
|---|---|
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` |
| `studio_id` | `INT NOT NULL` |
| `integration_id` | `INT` |
| `name` | `VARCHAR(255)` |
| `provider` | `VARCHAR(40) NOT NULL DEFAULT 'botconversa'` |
| `external_id` | `VARCHAR(255)` |
| `status` | `VARCHAR(40) NOT NULL DEFAULT 'not_configured'` |
| `connected_at` | `DATETIME` |
| `webhook_configured` | `INT NOT NULL DEFAULT 0` |
| `sync_enabled` | `INT NOT NULL DEFAULT 0` |
| `summary_enabled` | `INT NOT NULL DEFAULT 0` |
| `summary_interval_minutes` | `INT NOT NULL DEFAULT 60` |
| `last_sync_at` | `DATETIME` |
| `last_processed_at` | `DATETIME` |
| `last_message_at` | `DATETIME` |
| `last_summary_at` | `DATETIME` |
| `sync_status` | `VARCHAR(40) NOT NULL DEFAULT 'disabled'` |
| `sync_cursor` | `TEXT` |
| `external_cursor` | `TEXT` |
| `error_count` | `INT NOT NULL DEFAULT 0` |
| `last_error` | `TEXT` |
| `created_at` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### inbox_conversations

| Coluna | Definição MySQL |
|---|---|
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` |
| `studio_id` | `INT NOT NULL` |
| `sync_state_id` | `INT NOT NULL` |
| `client_id` | `INT` |
| `integration_contact_id` | `INT` |
| `external_contact_id` | `VARCHAR(255)` |
| `external_conversation_id` | `VARCHAR(191) NOT NULL` |
| `client_name` | `VARCHAR(255)` |
| `phone` | `VARCHAR(32)` |
| `source` | `VARCHAR(80)` |
| `channel` | `VARCHAR(80)` |
| `artist_id` | `INT` |
| `attendant_user_id` | `INT` |
| `last_interaction_at` | `DATETIME` |
| `status` | `VARCHAR(40) NOT NULL DEFAULT 'open'` |
| `priority` | `VARCHAR(20) NOT NULL DEFAULT 'NORMAL'` |
| `classification` | `VARCHAR(80) NOT NULL DEFAULT 'other'` |
| `waiting_since` | `DATETIME` |
| `waiting_seconds` | `INT NOT NULL DEFAULT 0` |
| `summary` | `TEXT` |
| `purchase_intent` | `VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN'` |
| `pending_actions` | `TEXT` |
| `next_recommended_action` | `TEXT` |
| `suggested_reply` | `TEXT` |
| `analyzed_message_count` | `INT NOT NULL DEFAULT 0` |
| `last_summary_at` | `DATETIME` |
| `last_processed_at` | `DATETIME` |
| `processing_status` | `VARCHAR(40) NOT NULL DEFAULT 'disabled'` |
| `created_at` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### inbox_messages

| Coluna | Definição MySQL |
|---|---|
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` |
| `studio_id` | `INT NOT NULL` |
| `conversation_id` | `INT NOT NULL` |
| `external_message_id` | `VARCHAR(191) NOT NULL` |
| `message_type` | `VARCHAR(40) NOT NULL DEFAULT 'text'` |
| `direction` | `VARCHAR(20) NOT NULL DEFAULT 'inbound'` |
| `actor` | `VARCHAR(40) NOT NULL DEFAULT 'customer'` |
| `text_content` | `TEXT` |
| `media_reference` | `TEXT` |
| `metadata` | `TEXT` |
| `message_at` | `DATETIME` |
| `processed_at` | `DATETIME` |
| `processing_status` | `VARCHAR(40) NOT NULL DEFAULT 'disabled'` |
| `created_at` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### inbox_summaries

| Coluna | Definição MySQL |
|---|---|
| `id` | `INT AUTO_INCREMENT PRIMARY KEY` |
| `studio_id` | `INT NOT NULL` |
| `conversation_id` | `INT` |
| `scope_key` | `VARCHAR(100) NOT NULL` |
| `window_start` | `DATETIME NOT NULL` |
| `window_end` | `DATETIME NOT NULL` |
| `summary` | `TEXT` |
| `metrics` | `TEXT` |
| `analysis` | `TEXT` |
| `analyzed_message_count` | `INT NOT NULL DEFAULT 0` |
| `last_message_id` | `INT` |
| `processing_status` | `VARCHAR(40) NOT NULL DEFAULT 'disabled'` |
| `analysis_version` | `VARCHAR(80)` |
| `last_error` | `TEXT` |
| `processed_at` | `DATETIME` |
| `created_at` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` |

