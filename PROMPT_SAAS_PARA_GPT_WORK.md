# Prompt final para o outro ambiente

> **Contexto:** estou evoluindo um CRM para estúdios que já está no ar, mas ainda em desenvolvimento. O sistema tem usuários, empresas/estúdios, dados operacionais e autenticação já funcionais. Quero introduzir uma camada de SaaS multiempresa com segurança, sem reestruturar nem quebrar a aplicação existente.

## Sua missão

Faça uma implementação **incremental, aditiva e compatível** de SaaS multiempresa (multi-tenant), reutilizando a arquitetura, o banco, o sistema de autenticação, as rotas, os componentes e os padrões que já existem no projeto. Antes de editar qualquer código, analise a estrutura atual e apresente um plano de alteração com os arquivos envolvidos, riscos e estratégia de teste.

Não substitua o framework, não recrie o projeto, não troque a autenticação, não faça um refactor amplo e não modifique funcionalidades não relacionadas ao SaaS.

## Objetivo de negócio

Eu sou o único **Superadministrador** global. Preciso cadastrar empresas de teste e gerar convites manuais por link para que administradores convidados usem o CRM de suas próprias empresas, com dados isolados. Esses administradores podem convidar colaboradores e definir permissões por módulo. O sistema e os dados já existentes devem continuar vinculados à minha empresa principal, sem exclusão, duplicação ou migração indevida.

## Regras obrigatórias

| Área | Requisito |
|---|---|
| Preservação | Não apagar, migrar, duplicar, reassociar ou inferir o vínculo de dados existentes. Se uma associação histórica não puder ser determinada com segurança, pare e solicite confirmação. |
| Banco de dados | Antes da primeira migração, gere backup, checkpoint ou ponto de restauração. Faça apenas mudanças aditivas e reversíveis. Não faça operações destrutivas ou irreversíveis sem minha confirmação explícita. |
| Autenticação | Reutilize o fluxo de login/sessão existente. Não crie login local, troca/recuperação de senha, 2FA ou um segundo provedor de identidade. |
| Autorização | O isolamento precisa existir no **servidor/API**, nunca apenas no frontend. O frontend pode ocultar telas, mas não pode ser o mecanismo de segurança. |
| Tenant | Nunca use fallback para primeiro estúdio, `studioId = 1` ou identificador padrão. Sem um contexto válido de empresa e acesso, a API deve recusar a operação. |
| Infraestrutura | Não altere hospedagem, domínio, variáveis de produção, pagamentos, assinaturas ou integrações externas. |
| Escopo | Não modifique fluxos legados que já funcionam, salvo o mínimo indispensável para introduzir o isolamento seguro. |

## Papéis e acesso

Implemente ou adapte os papéis abaixo sem alterar automaticamente o papel de usuários existentes.

| Papel | Capacidades |
|---|---|
| **Superadministrador** | É o único usuário global. Lista empresas, cria convites para qualquer empresa, vê vínculos de acesso e pode suspender/revogar convites ou acessos. |
| **Administrador da empresa** | Opera exclusivamente no próprio estúdio. Pode convidar colaboradores para a própria empresa e configurar suas permissões por módulo. Não acessa outra empresa nem o painel global. |
| **Colaborador** | Opera exclusivamente no próprio estúdio e apenas nos módulos explicitamente permitidos. |

Reconheça o Superadministrador por uma regra segura já compatível com o projeto — por exemplo, a identidade do proprietário, um papel previamente existente ou uma configuração de ambiente que já seja utilizada. Não promova usuários com base em suposições.

## Isolamento obrigatório de empresa no servidor

Crie ou adapte um middleware/procedimento de tenant. Toda leitura ou mutação de dados de negócio deve obter o identificador de empresa de uma associação autorizada do usuário autenticado.

Esse mecanismo deve validar sessão, validar o papel e o estado do acesso, determinar a empresa permitida, inserir o filtro de empresa nas consultas e impedir que administradores ou colaboradores informem livremente um identificador de outra empresa na entrada da API. Caso o Superadministrador selecione uma empresa para operação administrativa, essa capacidade também precisa ser validada pelo servidor.

O mesmo isolamento deve se aplicar a clientes, agenda, estoque, financeiro, anamnese, POD, relatórios e qualquer outro dado operacional que pertença à empresa.

## Modelo de dados — somente aditivo

Adapte os nomes ao schema já existente, mas suporte ao menos estas entidades:

| Entidade | Conteúdo mínimo |
|---|---|
| Vínculo usuário–empresa | `userId`, `studioId`/`tenantId`, `role`, `accessStatus` (`active`, `suspended`, `revoked`) e datas de auditoria. Inclua índices e unicidade adequados. |
| Convite | `studioId`, `email`, `role`, `tokenHash`, `status` (`pending`, `accepted`, `revoked`, `expired`), `expiresAt`, `acceptedAt`, `revokedAt` e emissor. Não guarde token em texto puro. |
| Permissão de módulo | `userId`, `studioId`, `module`, `canRead`, `canWrite`, com unicidade por usuário, empresa e módulo. |

Os módulos mínimos são: `clients`, `appointments`, `stock`, `finance`, `anamnesis`, `pod` e `reports`.

Se tabelas operacionais ainda não tiverem vínculo com empresa, acrescente esse vínculo somente seguindo uma regra inequívoca e segura. Em caso de dúvida sobre dados históricos, não preencha valores automaticamente: pause e solicite minha decisão.

## Convite temporário de sete dias

Implemente um convite com **link copiável**, destinado a envio manual por WhatsApp. O Superadministrador seleciona a empresa, informa e-mail e papel, e gera um link de uso único. O token precisa ser aleatório e criptograficamente seguro; armazene apenas o hash. O convite vale sete dias, pode ser revogado antes do aceite e não pode ser reutilizado.

A página pública de aceite deve usar a autenticação existente. No aceite, valide token, hash, status, expiração e, quando o provedor atual disponibilizar, coerência com o e-mail convidado. Em seguida, ative o vínculo do usuário à empresa, registre data de aceite e invalide o token.

Mesmo sem processo em segundo plano, a expiração deve ser verificada no momento de ler ou aceitar o convite. Se houver uma infraestrutura segura de tarefas já disponível no projeto, ela pode marcar convites vencidos como `expired`, mas isso não pode ser a única proteção.

## Permissões por módulo

Permita que o Administrador da empresa defina permissão de **Ler** e **Editar** por módulo para cada Colaborador. Valide essas permissões na API antes de cada procedimento protegido. Uma permissão ausente deve negar acesso ao Colaborador. O Administrador continua com acesso administrativo apenas à própria empresa; o Superadministrador, com acesso global.

## Interface SaaS em português do Brasil

Adicione ou adapte um painel responsivo, reutilizando os componentes e padrões visuais atuais. Todos os textos devem estar em pt-BR. O painel deve incluir:

| Área | Conteúdo |
|---|---|
| Gestão SaaS | Convites temporários e acesso isolado por empresa. |
| Gerar convite | Empresa, e-mail do convidado, perfil e botão de gerar/copiar link. |
| Convites emitidos | E-mail, perfil, expiração, status e botão para revogar convite pendente. |
| Equipe e permissões | Usuários vinculados, status de acesso e controles de Ler/Editar por módulo. |
| Modelo de acesso | Texto curto explicando Superadministrador, Administrador, Colaborador e Módulos. |

Use rótulos consistentes: **Clientes, Agenda, Estoque, Financeiro, Anamnese, POD, Relatórios, Administrador, Colaborador, Usuário, Pendente, Aceito, Revogado, Expirado, Ativo e Suspenso**.

## Auditoria, testes e validação

Registre, quando a infraestrutura atual permitir, criação, aceite e revogação de convite, alterações de acesso e mudanças de permissões. Não exponha token, hash ou dados de outra empresa em mensagens de erro.

Crie ou atualize testes automatizados para convite válido, token expirado, convite revogado, uso único, isolamento de tenant e permissões por módulo. Ao final, separe claramente os resultados de testes da nova camada SaaS das falhas legadas preexistentes. Não corrija falhas fora do escopo sem pedir autorização.

## Critérios de aceite

A implementação só estará concluída quando puder demonstrar que:

1. Um convidado aceita o link e acessa apenas a empresa vinculada.
2. O administrador convidado não consegue listar, consultar, editar ou excluir dados da empresa principal, inclusive por chamada direta à API.
3. O Superadministrador mantém visão global e poder de criar, suspender e revogar acessos.
4. Um Colaborador acessa apenas módulos autorizados, com validação efetiva no servidor.
5. Convites vencidos ou revogados não podem ser aceitos.
6. O sistema anterior e os dados da empresa principal permanecem funcionando sem reassociação indevida.

> **Ordem de trabalho obrigatória:** primeiro faça a análise da arquitetura e entregue o plano incremental. Não comece migrações, alterações de schema, deploy ou mudanças irreversíveis antes de confirmar que entendeu essas regras e antes de obter confirmação quando necessário.
