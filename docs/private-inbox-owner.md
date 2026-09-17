# Central privada — piloto do proprietário

Regra aprovada em 17/09/2026: apenas a conta configurada do proprietário com papel superadmin acessa a Central. Admin, artista, colaborador e outro superadmin são recusados mesmo com RBAC concedido.

A identidade vem de LOCAL_ADMIN_EMAIL explícito no modo local ou OWNER_OPEN_ID no modo OAuth; ausência de configuração nega acesso. Nunca se usa o primeiro superadmin encontrado.

O servidor mantém o estúdio da sessão e restringe conversas aos estados de sincronização das conexões BotConversa ativas liberadas pelo próprio usuário (production_activated_by_user_id). Esta é uma regra conservadora para o piloto, não um cadastro definitivo de propriedade de integrações. Conexões legadas sem vínculo verificável ficam fora da leitura; não são automaticamente atribuídas. Antes de publicar, verificar que a conexão atual foi liberada pela conta proprietária.

A Central de Mensagens também bloqueia outros usuários no estúdio do proprietário e em estúdios com conexões liberadas por ele. Isso protege configurações, histórico e operações manuais; indicadores de lembretes da agenda continuam disponíveis conforme suas regras existentes. Automações pré-existentes de confirmação e lembretes não são ativadas nem desativadas por esta mudança.

A interface oculta o menu e não consulta a Central para contas não elegíveis. O logout cancela consultas e limpa o cache. Respostas, sugestões automáticas e configurações de envio da Central continuam indisponíveis.

## Próxima fase, ainda não liberada

Contas de artistas e usuários devem ter associação explícita de proprietário por integração, credenciais e webhook independentes. Não liberar RBAC da Central para eles até implementar esse modelo. Não reaproveitar vínculo de estúdio como autorização nem tratar quem ativou uma conexão como proprietário permanente no modelo futuro.

## Publicação

Sem migração de banco. Alterações preparadas em branch isolada; produção não é atualizada por criar a PR. Validar em ambiente de teste da versão atual e registrar o commit publicado antes de concluir WIL-19.


## Homologação sem envio
O ambiente Railway staging-custos (92e8281a-668a-43ed-b2ba-cac84082a91c) bloqueia envios nos três provedores e não processa a fila, independentemente de SCHEDULER_MODE. OUTBOUND_MESSAGING_DISABLED=true também bloqueia outros ambientes. Nenhum envio bloqueado é reportado como sucesso. O bloqueio não desativa a leitura da Central.
