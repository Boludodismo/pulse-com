# Convites de artista e WhatsApp por estúdio

Escopo: `amused-youthfulness` / `courageous-hope` / `staging-custos`, branch `homologacao-final-2026-09-06`. Produção, main e crm.tatuei.com não são destinos desta alteração.

## Fluxo

1. Proprietário salva nome, e-mail e WhatsApp em Artistas.
2. Em **Convidar artista**, escolhe visualizar/editar por módulo antes de gerar o link.
3. Copia o link ou abre o rascunho no WhatsApp para conferir e enviar manualmente. Não há envio automático nesta implementação.
4. Artista abre `/convite-artista/:token`, confere o estúdio e define a própria senha.
5. Entra pelo login local existente. A conta é sempre colaborador, vinculada ao artista e estúdio do convite.
6. Proprietário pode revogar o convite pendente ou gerar outro. Permissões posteriores continuam na Gestão SaaS existente.

Convite: token aleatório de 256 bits, somente SHA-256 no banco, validade de 7 dias em UTC, uso único. A validade do link não é a validade da conta. Cadastro e permissões são gravados na mesma transação, com bloqueio de linha e revalidação do convite. Nenhuma conta existente é reatribuída, promovida ou tem sua senha redefinida. E-mail/artista já cadastrado exige gerenciamento pelo fluxo existente.

## Banco

Migration nova `0057_artist_invitations.sql`: reutiliza `studio_invitations`, acrescenta `artistId` e `permissionSnapshot`. Em bancos importados sem a tabela histórica, cria apenas a tabela necessária. Não altera usuários existentes nem reexecuta migrations antigas. Helper de inicialização possui IDs explícitos de homologação/serviço, trava e verificação das colunas; reaplicação é idempotente.

Desativação reversível: remover o ponto de navegação/rotas e revogar convites pendentes. Não excluir usuários ou tabelas com dados. As colunas aditivas podem permanecer enquanto a funcionalidade é retirada.

## Permissões e isolamento

Reutiliza `user_module_permissions` e os módulos existentes. Novas contas são identificadas por openId `artist-invite:` e têm uma política incremental em `server/invitedArtistAccess.ts`, aplicada no middleware autenticado e de artista. Rotas não revisadas são negadas por padrão para essas contas, incluindo administração, busca/dashboard globais e estoque legado. Dados de clientes, agendamentos, anamnese, galeria, notas e transações passam por validação de estúdio nos acessos por ID. Estoque usa o módulo individual existente.

O menu reflete permissões; a autorização real permanece no servidor. Perfil/cartão próprio é acesso básico. Agenda, financeiro, anamnese e POD podem necessitar também de visualização de Clientes para seus fluxos completos. Operações negadas exigem liberação do proprietário; não são elevadas automaticamente. O financeiro com baixa no estoque legado permanece bloqueado para convidados: usar estoque individual/POD.

Superadministrador preserva o perfil existente e a seleção de estúdio; nenhum usuário recebe superadmin pelo convite. A nova política não transforma o RBAC legado de contas preexistentes nem constitui auditoria completa de todas as rotas antigas. `auth.me` deixa de retornar o hash de senha ao navegador.

## WhatsApp individual por estúdio

A Central de Mensagens já mantém integração por `studioId`, com adaptadores Meta/WhatsApp Business, BotConversa e Z-API e credenciais criptografadas no servidor. A tela explicita que cada estúdio usa sua própria conta/número/credenciais. Outros bots dependem de adaptador compatível; não existe conexão universal automática.

`getActiveIntegration` exige estúdio válido, status ativo e isEnabled=1, além do ID solicitado quando houver. Nunca usa a primeira integração global como alternativa quando falta tenant. O worker existente também vincula integração e job ao mesmo estúdio. Nenhuma credencial foi cadastrada e nenhuma conexão ou mensagem externa foi disparada durante esta alteração. A Central Inteligente permanece desativada e separada desta configuração.

## Validação

- Build e TypeScript: aprovados.
- Suíte completa: 368 aprovados, 50 falhas preexistentes e 14 ignorados (432 testes). Os nomes das falhas coincidem com a execução anterior; nenhuma falha nova identificada.
- Nova bateria final direcionada: 37 aprovados, incluindo convites, permissões, isolamento de WhatsApp e migration idempotente/restrita a staging.
- Testes de serviço usam banco simulado: não substituem a prova de cadastro concorrente em MySQL real.
- Navegador remoto indisponível por timeout CDP. Pendente validar visualmente no celular e testar convite com uma conta de teste nova, login, revogação, leitura/edição e tentativa de acesso entre estúdios no ambiente real.
- Não houve redefinição de credenciais existentes nem mensagem real de WhatsApp nos testes.

## Pontos de extensão

`server/artistInvitations.ts`: emissão e cadastro transacional.
`server/routers/artistInvitations.ts`: access, issue, list, revoke, inspect, register.
`shared/artistInvitations.ts`: módulos e navegação.
`client/src/components/ArtistInvitationDialog.tsx`: seleção e compartilhamento.
`client/src/pages/AcceptArtistInvitation.tsx`: cadastro via convite.
`server/messaging/providers/*`, `provider.ts`, `service.ts`: adaptadores futuros por provedor; sempre preservar o estúdio em seleção, filas, consentimento e logs.
