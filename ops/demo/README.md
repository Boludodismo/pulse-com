# Demonstração descartável de homologação

A revisão local é baseada em `3a42c456fa65a7adaa31820f4c0062d421cab0fb`. O destino publicado não foi validado por esta revisão.

Use [RENDER-TEST-RUNBOOK.md](RENDER-TEST-RUNBOOK.md) para o procedimento de uma **nova** homologação, somente após autorização separada de publicação. Não reutilize ou altere o serviço existente e não conecte produção.

`Dockerfile.demo` compila a aplicação com Node 24.19.0 e inicia `node ops/demo/start.mjs`. O supervisor cria MariaDB e uploads locais temporários com dados fictícios, recusa banco externo, reduz o ambiente e bloqueia integrações reais. Health: `/api/health`.

Variáveis que o operador fornece no novo serviço: `DEMO_MODE`, `LOCAL_ADMIN_PASSWORD`, `JWT_SECRET`, `AUTH_SECURITY_KEY`. O supervisor gera a conexão local descartável. Não configurar DATABASE_URL, S3 ou outras credenciais externas.

Os uploads têm limite de 10 MiB por arquivo e 64 MiB de objetos publicados, sem exclusão automática por cota. Anexos em banco têm limites próprios. Banco e arquivos podem ser perdidos em reinícios, suspensão ou deploy; não há promessa de persistência gratuita.

Os resultados e as limitações dos testes desta revisão estão no REVIEW.md da entrega. A imagem Docker, o consumo no plano gratuito e a validação efetiva no Render exigem conferência no destino autorizado.
