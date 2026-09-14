# Prompt — Implementação incremental de camada SaaS multiempresa

Copie e cole o texto abaixo no seu outro ambiente de desenvolvimento.

---

Você está trabalhando em um sistema de gestão para estúdios que **já está em produção e em desenvolvimento ativo**. Implemente uma camada de **SaaS multiempresa (multi-tenant)** de forma incremental, sem reestruturar, reescrever ou substituir o que já funciona.

## Objetivo

Quero permitir que um único **superadministrador global** crie empresas de teste, gere links de convite temporários e ofereça acesso isolado por empresa. O administrador convidado deve acessar apenas os dados da própria empresa, e poderá convidar colaboradores com permissões por módulo. O sistema atual deve continuar funcionando para a empresa principal, sem migração de dados existentes.

## Restrições obrigatórias

| Tema | Regra |
|---|---|
| Estrutura atual | Preserve o framework, organização de pastas, banco, autenticação, rotas e padrões já existentes. Antes de editar, faça uma leitura do projeto para identificar as convenções atuais. |
| Segurança | A autorização e o isolamento devem ser aplicados **no servidor/API**. Nunca confie somente em filtros ou ocultação no frontend. |
| Dados existentes | Não apague, duplique, migre nem reassocie dados atuais da empresa principal. Não altere o vínculo do administrador principal. |
| Migrações | Faça apenas migrações aditivas e reversíveis. Antes de qualquer migração, gere backup, checkpoint ou ponto de restauração. Pare e peça confirmação antes de qualquer operação destrutiva ou irreversível. |
| Autenticação | Reutilize a autenticação existente. Não introduza login local, troca de senha, 2FA, recuperação de senha ou um provedor de autenticação paralelo. |
| Hospedagem e cobrança | Não altere hospedagem, domínio, variáveis de produção, pagamentos, assinaturas ou integrações de cobrança nesta fase. |
| Fallbacks inseguros | Remova qualquer fallback que escolha automaticamente o primeiro estúdio, use `studioId = 1`, ou permita acesso quando o tenant não estiver determinado. Quando não houver contexto de empresa válido, negue o acesso de forma explícita. |
| Escopo | Não faça refactors amplos. Altere somente o necessário para a camada SaaS e suas telas administrativas. |

## Requisitos funcionais

Implemente os itens abaixo respeitando os contratos e os nomes já existentes no projeto.

### 1. Papéis e escopo de acesso

Use os papéis existentes, se compatíveis, ou acrescente de modo aditivo:

| Papel | Escopo |
|---|---|
| **Superadministrador** | Único usuário com visão global. Pode listar empresas, criar convites para qualquer empresa, visualizar acessos e revogar ou suspender usuários/convites. |
| **Administrador da empresa** | Acessa apenas a própria empresa. Pode convidar colaboradores somente para a própria empresa e gerenciar permissões deles. Não acessa o painel global nem outra empresa. |
| **Colaborador** | Acessa apenas a própria empresa e somente os módulos explicitamente autorizados. |

O superadministrador deve ser reconhecido por uma regra estável e segura já compatível com o projeto — por exemplo, identidade do proprietário já configurada, papel existente ou identificador configurado no ambiente. Não promova usuários existentes automaticamente sem uma regra explícita.

### 2. Isolamento multiempresa no servidor

Crie ou adapte um middleware/procedimento de tenant no servidor. Todas as consultas e mutações com dados de negócio devem exigir um `studioId`/`tenantId` obtido de uma associação autorizada do usuário autenticado.

O middleware deve:

1. Validar a sessão/autenticação já existente.
2. Determinar se o usuário é superadministrador ou pertence a uma empresa ativa.
3. Impedir que administradores e colaboradores forneçam ou troquem livremente o identificador de outra empresa na entrada da API.
4. Aplicar o identificador de empresa em leituras, inserções, atualizações e exclusões.
5. Recusar a operação quando não existir contexto válido, quando o acesso estiver suspenso/revogado ou quando o convite estiver vencido.

Não deixe o frontend escolher o tenant efetivo. Quando for necessário ao superadministrador operar em uma empresa específica, valide explicitamente esse poder no servidor.

### 3. Modelo de dados aditivo

Adapte os nomes ao schema atual, criando apenas tabelas, colunas e índices necessários. Como referência, a solução deve suportar:

| Entidade | Campos e regras mínimas |
|---|---|
| Vínculo de usuário à empresa | `userId`, `studioId`, `role`, `accessStatus` (`active`, `suspended`, `revoked`), datas de auditoria. Garanta unicidade apropriada e índice para consultas por usuário e empresa. |
| Convites | `studioId`, `email`, `role`, `tokenHash`, `status` (`pending`, `accepted`, `revoked`, `expired`), `expiresAt`, `acceptedAt`, `revokedAt`, usuário emissor. O token em texto puro não deve ser salvo no banco. |
| Permissões por módulo | `userId`, `studioId`, `module`, `canRead`, `canWrite`, com unicidade por usuário, empresa e módulo. |

Os módulos mínimos são: `clients`, `appointments`, `stock`, `finance`, `anamnesis`, `pod` e `reports`.

Mantenha as tabelas e os dados já existentes associados à empresa principal. Se as tabelas de negócio ainda não tiverem uma coluna de empresa, adicione-a de forma segura e preencha somente onde houver uma regra inequívoca. Se não houver certeza sobre a associação de dados históricos, pare e solicite confirmação em vez de inferir ou mover registros.

### 4. Convites temporários de sete dias

Implemente um fluxo de convite com link copiável, para envio manual por WhatsApp:

1. O superadministrador cadastra ou seleciona previamente a empresa.
2. Ele gera um convite para e-mail, empresa e papel definidos.
3. O token precisa ser criptograficamente aleatório; armazene somente seu hash.
4. O convite expira em **sete dias**, é de uso único e pode ser revogado antes do aceite.
5. A página pública do convite deve reutilizar o login/autenticação existente para identificar o usuário que o aceitará.
6. Ao aceitar, valide token, hash, status, expiração e coerência do e-mail quando essa informação estiver disponível no provedor existente.
7. Crie/ative o vínculo do usuário com a empresa, registre o aceite e invalide o token.
8. Não crie login local nem envie e-mail automaticamente nesta fase.

Uma verificação de expiração deve ocorrer obrigatoriamente no momento de leitura e aceite do convite. Se o projeto já possuir um mecanismo seguro de tarefas agendadas, você pode também marcar convites vencidos como `expired`; porém, essa tarefa não deve ser requisito para bloquear o acesso vencido.

### 5. Permissões por módulo

Permita ao administrador da empresa configurar, por colaborador e por módulo, permissões de **ler** e **editar**. A permissão deve ser conferida no servidor antes de cada procedimento protegido. Esconder itens do menu no frontend melhora a experiência, mas não substitui a validação na API.

Defina um comportamento explícito para permissões ausentes. A recomendação é negar acesso a colaboradores quando não há permissão cadastrada, mantendo o administrador da própria empresa com acesso administrativo ao escopo dela e o superadministrador com acesso global.

### 6. Painel e textos em português do Brasil

Adicione ou adapte um painel administrativo SaaS em **pt-BR**, responsivo em mobile e desktop. Ele deve usar os componentes e padrões visuais já disponíveis no sistema. Inclua, no mínimo:

| Área | Conteúdo |
|---|---|
| Gestão SaaS | Descrição de convites temporários e acesso isolado por empresa. |
| Gerar convite | Empresa, e-mail do convidado, perfil e botão para gerar/copiar link. |
| Convites emitidos | E-mail, papel, data de expiração, status e ação de revogar enquanto pendente. |
| Equipe e permissões | Usuários vinculados, status de acesso e controles de leitura/edição por módulo. |
| Modelo de acesso | Explicação curta para Superadministrador, Administrador, Colaborador e Módulos. |

Use rótulos traduzidos de forma consistente: **Clientes, Agenda, Estoque, Financeiro, Anamnese, POD, Relatórios, Administrador, Colaborador, Usuário, Pendente, Aceito, Revogado, Expirado, Ativo e Suspenso**.

### 7. Auditoria e erros

Quando a infraestrutura atual permitir, registre ações relevantes: criação, aceite e revogação de convite; alteração de acesso; e mudança de permissões. Nas respostas de erro, não exponha token, hash, dados de outras empresas ou detalhes internos da autorização.

## Estratégia de execução obrigatória

1. Primeiro, apresente uma análise curta do projeto atual indicando onde estão autenticação, schema, procedures/endpoints, consultas de dados e rotas do frontend.
2. Mostre um plano incremental com arquivos previstos, migrações e riscos. Não execute operações destrutivas.
3. Crie o checkpoint/backup antes da primeira alteração de banco.
4. Faça as alterações em etapas pequenas e testáveis.
5. Atualize ou crie testes automatizados para as regras de convite, expiração, revogação, isolamento de tenant e permissões por módulo.
6. Valide a interface em desktop e mobile sem alterar componentes estruturais que já funcionam.
7. Ao final, apresente separadamente: testes da camada SaaS, testes legados aprovados e falhas legadas preexistentes. Não corrija falhas fora do escopo sem autorização.

## Critérios obrigatórios de aceite

Considere a implementação concluída somente se for possível demonstrar os cenários abaixo:

| Cenário | Resultado esperado |
|---|---|
| Convite válido | Usuário convidado aceita o link e recebe acesso apenas à empresa vinculada. |
| Isolamento | Um administrador convidado não consegue listar, consultar, editar ou excluir dados da empresa principal por UI ou chamada direta à API. |
| Superadministrador | Mantém acesso global, consegue criar convites e revogar convites/acessos. |
| Colaborador | Só acessa os módulos autorizados e respeita as permissões de leitura/edição no servidor. |
| Expiração | Convite não pode ser aceito após sete dias. |
| Revogação | Convite revogado não pode ser aceito; acesso revogado ou suspenso deixa de funcionar. |
| Compatibilidade | Fluxos atuais da empresa principal continuam funcionando e nenhum dado existente é removido ou reassociado indevidamente. |

Não faça deploy externo nem alteração de infraestrutura. Antes de qualquer decisão que possa apagar, migrar, recriar ou reassociar dados existentes, pare, explique o impacto e solicite minha confirmação explícita.

---

**Instrução final:** comece pela análise e pelo plano. Não comece pela migração ou por mudanças no código antes de confirmar que compreendeu a arquitetura atual e as restrições acima.
