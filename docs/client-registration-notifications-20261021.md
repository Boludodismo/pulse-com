# Notificações no cadastro de clientes

A opção de notificações WhatsApp inicia marcada no cadastro principal, nos cadastros rápidos da agenda, procedimentos e orçamentos e nas duas importações de contatos. Todos esses caminhos enviam a escolha ao servidor. O endpoint de cadastro também assume `true` quando um chamador antigo omite a opção. Desmarcar é persistido; selecionar um cliente existente não muda sua preferência.

A origem é administrativa (`cadastro_cliente:operacional:usuario_<id>`), sem afirmar que houve manifestação pessoal do cliente. Usuários que já têm permissão para criar clientes podem definir essa preferência no novo cadastro, dentro do estúdio da sessão. As rotas de gestão de consentimento de clientes existentes mantêm suas restrições.

A preferência fica em `client_whatsapp_permissions` mesmo sem uma conexão WhatsApp ativa. Havendo conexão, o vínculo em `integration_contacts` é salvo na mesma transação. Os lembretes reconciliam a preferência com o canal antes de enfileirar. Recusa anterior, cadastro arquivado e alteração de telefone continuam bloqueando a habilitação automática. Não existe atualização em massa de clientes antigos.

Telefone ausente permite salvar o cliente, com aviso de que não foi possível habilitar notificações. Telefone brasileiro inválido com a opção marcada é recusado antes do cadastro comum; importações preservam os registros e indicam pendências. Falha ao salvar a preferência não é apresentada como falha de criação, evitando incentivar duplicatas.

A importação completa mantém seus critérios de correspondência, revisão de identidades e preservação dos dados existentes. O padrão novo vale para os clientes novos; cadastros antigos continuam sujeitos aos critérios anteriores e às recusas. Importação sem canal salva a preferência dos novos clientes para reconciliação posterior.

Validação: testes unitários e de integração com conexões simuladas, TypeScript ES2022 e build de produção. `scripts/client-registration-regression.mjs` monta os componentes React reais em jsdom, com RPCs simuladas, verifica o padrão marcado e os dados enviados ao salvar com a opção ligada/desligada nos seis caminhos. Executar com jsdom instalado ou `DOM_MODULE_ROOT` apontando para seu `node_modules`. Não acessa clientes reais nem envia mensagens. Não substitui validação de entrega do provedor ou publicação em produção.
