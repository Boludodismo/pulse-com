Analise o arquivo ZIP anexado e coloque o sistema em funcionamento como uma aplicação SaaS completa para gestão de estúdios e profissionais de tatuagem.

OBJETIVO PRINCIPAL

O sistema é o Tatueipos CRM, um CRM/SaaS completo para tatuadores e estúdios de tatuagem.

Neste momento, o objetivo principal não é redesenhar, reescrever ou criar um novo sistema. O objetivo é utilizar integralmente o projeto existente no arquivo ZIP, instalar suas dependências, configurar banco de dados e variáveis de ambiente, realizar o build e publicar uma versão funcional para testes.

Preserve ao máximo:

* estrutura atual;
* frontend;
* backend;
* banco de dados;
* layout;
* componentes;
* regras de negócio;
* rotas;
* módulos;
* funcionalidades existentes;
* sistema de permissões;
* isolamento de dados entre estúdios.

Não substitua funcionalidades existentes por versões simplificadas e não recrie o projeto do zero.

⸻

1. ARQUITETURA EXISTENTE

O projeto é uma aplicação full-stack.

Frontend

* React 19
* TypeScript
* Vite
* Tailwind CSS
* componentes baseados em shadcn/ui e Radix UI
* Wouter para roteamento
* React Query
* tRPC Client
* FullCalendar
* Recharts
* React Hook Form

Backend

* Node.js
* Express
* TypeScript
* tRPC
* Drizzle ORM
* SuperJSON
* autenticação por sessão/JWT

Banco de dados

* MySQL compatível com MySQL 8+
* Drizzle ORM
* schema já existente no projeto
* relações entre usuários, estúdios, clientes, artistas, agenda, financeiro, estoque, procedimentos e demais módulos

Infraestrutura

* Dockerfile existente
* configuração preparada para deploy
* pnpm como gerenciador de pacotes
* aplicação executada em produção pelo backend Node/Express, que também disponibiliza o frontend compilado

⸻

2. CONCEITO SaaS E MULTI-TENANT

O sistema foi desenvolvido para funcionar como SaaS com múltiplos estúdios e usuários.

É obrigatório preservar o isolamento de dados entre os tenants.

Existem três níveis principais de acesso:

SUPERADMIN

Administrador geral da plataforma.

Pode acessar e administrar os diferentes estúdios cadastrados, conforme as regras já existentes no sistema.

ADMIN

Administrador de um estúdio específico.

Possui acesso aos recursos e informações correspondentes ao próprio estúdio.

COLLABORATOR

Colaborador/tatuador.

Possui acesso restrito de acordo com o estúdio, artista associado e permissões existentes.

Não remover nem enfraquecer essas regras de acesso.

⸻

3. PRINCIPAIS FUNCIONALIDADES EXISTENTES

Dashboard

O sistema possui dashboard com visão operacional e indicadores do estúdio, incluindo dados relacionados a:

* clientes;
* agendamentos;
* receita;
* movimentações;
* desempenho;
* clientes relevantes;
* aniversariantes;
* alertas;
* informações operacionais.

⸻

4. CLIENTES

O CRM possui gestão de clientes com:

* cadastro;
* edição;
* consulta;
* exclusão conforme permissões;
* pesquisa;
* filtros;
* perfil individual;
* histórico de atendimentos;
* observações;
* vínculo com artista responsável;
* dados de contato;
* informações relacionadas aos procedimentos;
* histórico financeiro;
* registros de agenda;
* anamnese;
* imagens quando aplicável;
* sistema de fidelidade.

Existem níveis de fidelidade como:

* Bronze;
* Prata;
* Ouro;
* Platina;
* Diamante.

Preservar os relacionamentos entre clientes, artistas, agenda, procedimentos e financeiro.

⸻

5. ARTISTAS / TATUADORES

Existe módulo próprio para gerenciamento de artistas/tatuadores.

O sistema deve preservar:

* cadastro de artistas;
* edição;
* vínculo com usuários;
* vínculo com clientes;
* agenda;
* procedimentos;
* relatórios;
* informações profissionais;
* permissões relacionadas.

⸻

6. AGENDA E AGENDAMENTOS

O sistema possui agenda completa.

Inclui:

* criação de agendamento;
* edição;
* exclusão conforme permissões;
* consulta;
* filtros;
* artista responsável;
* cliente;
* horário;
* data;
* duração;
* status;
* observações;
* acompanhamento do atendimento.

Os agendamentos possuem status como:

* agendado;
* confirmado;
* concluído;
* cancelado;

e outros estados existentes no código.

Existe também visualização em calendário utilizando FullCalendar, incluindo diferentes formas de visualização e identificação visual de compromissos.

⸻

7. CONFIRMAÇÃO DE AGENDAMENTO

O sistema possui fluxo relacionado à confirmação de agendamento.

Preservar:

* página pública de confirmação quando existente;
* identificação do agendamento;
* resposta do cliente;
* status relacionado;
* links gerados pelo backend;
* integração com lembretes.

A URL pública deverá utilizar o domínio da aplicação em produção e não depender de endereço antigo do Manus.

⸻

8. LEMBRETES E NOTIFICAÇÕES

Existe sistema de:

* notificações;
* alertas;
* lembretes de agendamento;
* notificações de sistema;
* eventos relacionados aos clientes;
* aniversários;
* registros de envio.

Existem processos de backend executados periodicamente para tarefas automáticas.

Esses processos precisam continuar funcionando em produção.

O serviço Node não deve ser transformado em uma hospedagem exclusivamente estática ou serverless incompatível com esses processos.

⸻

9. WHATSAPP E MENSAGENS

O projeto possui estruturas relacionadas a:

* integrações WhatsApp;
* templates de mensagens;
* fila de mensagens;
* lembretes;
* processamento de mensagens;
* configuração de integração.

Não remova essas estruturas mesmo que alguma integração externa ainda precise ser configurada posteriormente.

A aplicação deve funcionar mesmo que as credenciais externas do WhatsApp ainda não estejam configuradas.

⸻

10. ANAMNESE

Existe módulo de anamnese integrado ao CRM.

Inclui estruturas para:

* solicitações;
* preenchimentos;
* registros;
* visualização;
* página pública;
* associação com cliente;
* geração/visualização de documento;
* avaliação de risco.

Preservar integralmente esse módulo.

⸻

11. ALERTAS DE RISCO

O sistema possui classificação relacionada à anamnese e risco do atendimento.

Existem níveis como:

* baixo;
* médio;
* alto;
* crítico.

O CRM possui tela própria de alertas e filtros relacionados.

Não alterar a lógica sem primeiro identificar exatamente sua implementação atual.

⸻

12. PROCEDIMENTOS / SESSÕES DE TATUAGEM

Existe módulo específico de procedimentos técnicos.

O sistema possui estruturas para:

* procedimentos;
* sessões;
* consumíveis utilizados;
* imagens;
* eventos;
* resumo;
* acompanhamento;
* registro técnico;
* associação com cliente;
* associação com profissional;
* controle operacional.

Também existem kits de procedimento e itens vinculados aos kits.

Preservar esse módulo e suas relações com estoque e cliente.

⸻

13. ESTOQUE

Existe módulo de estoque integrado ao sistema.

Possui estruturas relacionadas a:

* materiais;
* movimentações;
* entrada;
* saída;
* consumo;
* produtos;
* catálogo;
* marcas;
* linhas;
* variantes;
* fornecedores;
* procedimentos;
* kits;
* compras.

As baixas e movimentações precisam permanecer relacionadas ao banco oficial do CRM.

Não criar um segundo sistema de estoque paralelo.

⸻

14. CATÁLOGO DE MATERIAIS

O sistema contém estrutura de catálogo detalhado.

Existem entidades para:

* marcas;
* linhas de produto;
* variantes;
* materiais;
* fornecedores;
* ofertas de fornecedores.

Preservar essas tabelas e suas relações.

⸻

15. FORNECEDORES

Existe módulo de fornecedores.

Inclui:

* cadastro;
* consulta;
* edição;
* vínculo com catálogo;
* produtos;
* ofertas;
* compras.

⸻

16. PEDIDOS DE COMPRA

O banco possui estruturas para:

* pedidos de compra;
* itens dos pedidos;
* fornecedores;
* materiais;
* movimentação correspondente.

Preservar toda essa estrutura.

⸻

17. FINANCEIRO

Existe módulo financeiro integrado ao CRM.

Possui estrutura para:

* transações;
* receitas;
* informações financeiras;
* vínculo com clientes;
* vínculo com atendimentos;
* indicadores;
* relatórios;
* colaboradores quando aplicável.

Não remover ou simplificar campos existentes.

⸻

18. COLABORADORES E REPASSES

Existem funcionalidades relacionadas a:

* taxas de colaboradores;
* relatórios de colaboradores;
* valores;
* repasses;
* informações relacionadas ao trabalho executado.

Preservar essas regras.

⸻

19. RELATÓRIOS

O sistema possui módulo de relatórios.

Pode incluir:

* financeiro;
* clientes;
* agendamentos;
* artistas;
* colaboradores;
* performance;
* indicadores;
* gráficos;
* modelos de relatório;
* exportação.

Existem recursos relacionados à geração de PDF e planilhas.

O projeto utiliza bibliotecas como:

* jsPDF;
* jsPDF AutoTable;
* XLSX;
* Recharts.

Não remover essas dependências sem verificar seu uso.

⸻

20. AUDITORIA

Existe sistema de auditoria.

O sistema mantém registros relacionados a:

* usuário;
* ação executada;
* entidade alterada;
* histórico;
* operações realizadas.

Possui telas de auditoria e dashboard correspondente.

Esse mecanismo é importante para um SaaS multiusuário e deve ser preservado.

⸻

21. PESQUISA GLOBAL

Existe funcionalidade de busca no sistema.

Preservar o mecanismo atual de pesquisa e seus filtros.

⸻

22. IMPORTAÇÃO E EXPORTAÇÃO DE CONTATOS

Existe tela relacionada a importação e exportação de contatos.

Preservar essa funcionalidade e suas regras existentes.

⸻

23. CONFIGURAÇÕES DO ESTÚDIO

Existe módulo de configurações relacionado ao estúdio e ao funcionamento do CRM.

Preservar configurações, preferências e integrações já cadastradas no projeto.

⸻

24. AUTENTICAÇÃO

Para este primeiro deploy, utilizar prioritariamente a autenticação local existente no projeto, sem depender do Manus.

Configuração esperada:

AUTH_MODE=local

VITE_AUTH_MODE=local

VITE_APP_ID=tatueipos

O sistema deve permitir criação/inicialização de um administrador local por meio das variáveis:

LOCAL_ADMIN_EMAIL

LOCAL_ADMIN_PASSWORD

LOCAL_ADMIN_NAME

Utilizar um JWT_SECRET seguro.

Não remover estruturas antigas de OAuth se ainda forem utilizadas por partes do sistema. Apenas evitar que o funcionamento inicial dependa do Manus.

⸻

25. BANCO DE DADOS

Utilizar MySQL.

A conexão deve ocorrer por:

DATABASE_URL

No Railway, preferencialmente criar um serviço MySQL dentro do mesmo projeto e utilizar a URL interna fornecida pela plataforma.

O projeto possui um processo preparado para inicializar o banco.

Executar:

pnpm run db:bootstrap

antes da inicialização da aplicação quando necessário.

IMPORTANTE:

Não executar cegamente todo o histórico antigo de migrations em um banco novo antes de verificar sua compatibilidade.

O pacote possui migrations históricas e o objetivo do deploy preparado é inicializar um banco novo utilizando o schema atual.

Não alterar nem excluir dados de um banco existente sem autorização.

⸻

26. VARIÁVEIS DE AMBIENTE PARA O PRIMEIRO TESTE

Configure aproximadamente:

DATABASE_URL=<URL DO MYSQL>
AUTH_MODE=local
VITE_AUTH_MODE=local
VITE_APP_ID=tatueipos
LOCAL_ADMIN_EMAIL=<EMAIL DO ADMINISTRADOR>
LOCAL_ADMIN_PASSWORD=<SENHA FORTE>
LOCAL_ADMIN_NAME=Administrador
JWT_SECRET=<SEGREDO FORTE E ALEATÓRIO>
STORAGE_PROVIDER=disabled
TZ=America/Sao_Paulo
NODE_ENV=production

A variável:

APP_BASE_URL

deve apontar para a URL pública final.

Enquanto estiver utilizando domínio temporário do Railway, utilizar o endereço público fornecido pela plataforma ou permitir a detecção automática já prevista no projeto.

Posteriormente o domínio principal será:

https://tatueipos.com

⸻

27. STORAGE

Existem recursos de imagens e arquivos no projeto.

Para o primeiro teste, é aceitável:

STORAGE_PROVIDER=disabled

Isso deve permitir testar o núcleo do CRM sem depender do storage original do Manus.

Não excluir o código de armazenamento existente.

Posteriormente poderá ser configurado um provedor compatível com S3, Cloudflare R2 ou serviço equivalente.

⸻

28. DEPENDÊNCIAS ANTIGAS DO MANUS

O projeto foi originalmente desenvolvido utilizando serviços do Manus e pode conter referências residuais relacionadas a:

* OAuth;
* Forge;
* storage;
* mapas;
* IA;
* URLs antigas.

Não eliminar essas referências indiscriminadamente.

O objetivo é desacoplar apenas aquilo que impedir a execução independente do CRM.

Para o primeiro teste:

* utilizar autenticação local;
* deixar storage externo desativado caso necessário;
* manter funções independentes funcionando;
* não deixar uma integração opcional impedir a inicialização completa da aplicação.

⸻

29. DEPLOY

O projeto já possui:

* Dockerfile;
* railway.json;
* scripts específicos de build;
* inicialização do banco;
* endpoint de health check.

Utilize preferencialmente o Dockerfile existente.

O fluxo esperado é:

1. extrair o ZIP;
2. identificar a raiz correta do projeto;
3. instalar dependências com pnpm;
4. configurar MySQL;
5. configurar variáveis de ambiente;
6. executar o bootstrap seguro do banco;
7. realizar build;
8. iniciar o backend Node;
9. verificar /health;
10. disponibilizar URL pública;
11. testar autenticação;
12. testar os principais módulos.

O comando de produção esperado está relacionado a:

node dist/index.js

O build específico preparado para Railway pode utilizar:

pnpm run build:railway

O pre-deploy:

pnpm run db:bootstrap

⸻

30. HEALTH CHECK

Existe endpoint:

/health

Utilize esse endpoint para confirmar:

* aplicação ativa;
* disponibilidade do backend;
* conexão com banco quando prevista pela implementação.

⸻

31. REQUISITOS DE SEGURANÇA

Não exponha em logs ou frontend:

* senha do banco;
* JWT secret;
* senha do administrador;
* chaves privadas;
* credenciais de APIs.

Não colocar secrets diretamente no código-fonte.

Utilizar variáveis de ambiente.

Preservar:

* isolamento de tenant;
* validações do backend;
* autenticação;
* autorização;
* permissões;
* auditoria.

⸻

32. O QUE NÃO DEVE SER FEITO

Não:

* recriar o CRM do zero;
* substituir o backend por outro framework sem necessidade;
* migrar MySQL para PostgreSQL apenas por conveniência;
* transformar o projeto em aplicação somente frontend;
* remover tRPC;
* remover Drizzle;
* remover módulos existentes;
* apagar migrations ou schema sem análise;
* alterar identidade visual;
* modificar layout sem necessidade;
* renomear estruturas indiscriminadamente;
* eliminar funcionalidades que apresentarem erro apenas para concluir o deploy;
* substituir dados reais por mocks;
* criar um novo sistema paralelo;
* remover multi-tenancy;
* remover permissões;
* remover auditoria;
* vincular novamente o funcionamento obrigatório ao Manus.

⸻

33. TRATAMENTO DE ERROS

Caso alguma etapa falhe:

1. identificar o erro real nos logs;
2. localizar o arquivo responsável;
3. fazer a menor correção necessária;
4. preservar a arquitetura;
5. testar novamente;
6. documentar exatamente o que foi alterado.

Não resolva erros excluindo módulos inteiros.

Não altere regras de negócio sem evidência técnica de que isso é necessário.

⸻

34. VALIDAÇÃO OBRIGATÓRIA APÓS O DEPLOY

Após colocar o projeto no ar, verificar pelo menos:

* página inicial carregando;
* login local;
* criação da sessão;
* permanência da sessão após atualização da página;
* dashboard;
* clientes;
* artistas;
* agenda;
* calendário;
* anamnese;
* procedimentos;
* estoque;
* fornecedores;
* financeiro;
* relatórios;
* notificações;
* usuários;
* permissões;
* auditoria;
* isolamento por estúdio;
* acesso às rotas públicas;
* conexão com MySQL;
* /health;
* inexistência de erros críticos no console do navegador;
* inexistência de erros críticos nos logs do servidor.

⸻

35. RESULTADO ESPERADO

Quero receber uma versão funcional do Tatueipos CRM publicada para testes, utilizando o código existente no ZIP anexado.

A prioridade é:

preservar o sistema atual, fazê-lo funcionar fora do Manus e disponibilizá-lo em uma URL pública para testes.

Não quero uma demonstração fictícia e não quero uma reconstrução simplificada.

Quero o projeto real anexado executando com:

React + Node.js + Express + tRPC + Drizzle + MySQL, mantendo seus módulos e regras de negócio.

Ao finalizar, informe objetivamente:

1. URL pública da aplicação;
2. status do deploy;
3. status do MySQL;
4. se o login está funcionando;
5. quais variáveis de ambiente foram necessárias;
6. quais arquivos precisaram ser alterados;
7. quais funcionalidades foram efetivamente testadas;
8. quais integrações externas ainda precisam de credenciais;
9. qualquer erro restante;
10. próximos passos necessários para conectar tatueipos.com.

Não considere o trabalho concluído apenas porque o build terminou. Considere concluído somente depois que a aplicação estiver acessível, o banco conectado e o login funcional.
