# Homologação descartável do CRM Tatuei

Base histórica: 67acf6bbedd10d81cefa83c5a3689d5a2f34d99a.

Executa uma cópia do CRM com MariaDB 10.11 dentro do mesmo contêiner, banco vinculado somente ao loopback e dados sintéticos. Não é uma restauração dos registros de produção nem uma infraestrutura para dados reais. Nenhum volume persistente é solicitado.

O plano Render Free possui 512 MB e suspende por inatividade. Os registros e uploads temporários podem ser recriados após suspensão, reinício ou deploy. Há limite de 10 MB por arquivo e 64 MB no conjunto dos uploads.

Deploy: Dockerfile.demo; contexto raiz; plano free; branch exclusiva recovery/render-homologacao-20261022. O código não configura domínios próprios nem acessa o Railway.

Variáveis de runtime novas: DEMO_MODE=true, LOCAL_ADMIN_PASSWORD aleatória com pelo menos 16 caracteres, JWT_SECRET e AUTH_SECURITY_KEY exclusivos do teste. Não configurar DATABASE_URL nem credenciais externas; a inicialização recusa esses valores e cria seu banco local. Não adicionar credenciais de produção ao serviço.

Acesso HTTP Basic: usuário demo e a senha definida em LOCAL_ADMIN_PASSWORD no painel Render. Login interno: demo@example.invalid e a mesma senha. Senhas não devem ser publicadas em código, logs ou chat.

Partida: node ops/demo/start.mjs. Cria diretório temporário novo, inicializa banco vazio, aplica o schema consolidado derivado das definições da revisão e adiciona 6 clientes, 2 artistas, 1 calendário, 3 agendamentos e 3 materiais fictícios. As migrações históricas não são reaplicadas.

As tarefas de bot, consentimentos, fila e scheduler são desativadas; e-mails ficam indisponíveis; webhooks/heartbeat/OAuth são bloqueados; chamadas externas de fetch e sockets Node são rejeitadas antes de conectar. A página recebe CSP para limitar conexões do navegador à própria origem. Os uploads usam arquivos temporários isolados e links assinados.

Verificação realizada localmente: build, 24 testes unitários selecionados, health check, exigência de acesso, bloqueio de webhook, login, listas de clientes/artistas/calendários/agendamentos, criação/leitura de cliente fictício, upload/download de imagem e bloqueio de fetch para o domínio original antes de qualquer conexão. A suíte completa e a equivalência MySQL 9/MariaDB não foram certificadas. A imagem Docker e o consumo no plano gratuito exigem validação no Render.

Não importar dados reais nesta modalidade. Uma migração posterior exige banco e armazenamento persistentes independentes, avaliação dos schemas, backup consistente, validação funcional completa e autorização do proprietário para qualquer custo ou alteração de DNS.
