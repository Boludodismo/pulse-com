# TODO - POD CRM para Estúdios de Tatuagem

## Banco de Dados e Backend
- [x] Criar schema completo de banco de dados (clients, appointments, anamnesisRecords, transactions, clientNotes, galleryImages)
- [x] Implementar helpers de banco de dados em server/db.ts
- [x] Criar routers tRPC para clients (list, search, getById, create, update, delete)
- [x] Criar routers tRPC para appointments (list, getByClientId, create, update)
- [x] Criar routers tRPC para anamnesis (getByClientId, create)
- [x] Criar routers tRPC para transactions (list, getByClientId, getByDateRange, create)
- [x] Criar routers tRPC para notes (getByClientId, create, delete)
- [x] Criar routers tRPC para gallery (getByClientId, create, delete)
- [x] Criar routers tRPC para dashboard (topClients, upcomingBirthdays, metrics)
- [x] Implementar regras de negócio (atualização de níveis de fidelidade, cálculo de métricas)

## Frontend - Estrutura e Layout
- [x] Configurar tema escuro com paleta roxo/violeta no index.css
- [x] Criar DashboardLayout com sidebar de navegação
- [x] Configurar rotas da aplicação no App.tsx

## Frontend - Dashboard
- [x] Criar página Dashboard com cards de métricas (Total Clientes, Agendamentos, Receita, Aniversáriantes)
- [x] Implementar widget Top 5 Clientes
- [x] Implementar widget Aniversáriantes próximos 30 dias
- [x] Adicionar ações rápidas (Novo Cliente, Ver Todos)

## Frontend - Gestão de Clientes
- [x] Criar página de listagem de clientes (/clients)
- [x] Implementar busca em tempo real por nome, email, telefone
- [x] Criar tabela de clientes com badges de fidelidade
- [x] Criar formulário de novo cliente (/clients/new)
- [x] Criar página de perfil do cliente (/clients/:id)
- [x] Implementar sistema de tabs no perfil (Agendamentos, Anamnese, Financeiro, Galeria, Notas)

## Frontend - Agendamentos
- [ ] Criar modal/formulário de novo agendamento
- [ ] Implementar listagem de agendamentos na tab do perfil
- [ ] Adicionar badges de status coloridas
- [ ] Implementar seleção de cliente cadastrado

## Frontend - Anamnese
- [ ] Criar formulário de anamnese digital
- [ ] Implementar campos de saúde (alergias, doenças, medicamentos, gravidez, quelóide)
- [ ] Adicionar campo de assinatura digital
- [ ] Implementar listagem de fichas na tab do perfil

## Frontend - Financeiro
- [ ] Criar modal/formulário de nova transação
- [ ] Implementar listagem de transações na tab do perfil
- [ ] Adicionar categorização e métodos de pagamento
- [ ] Implementar formatação de valores em reais

## Frontend - Galeria
- [ ] Criar componente de upload de imagens para S3
- [ ] Implementar grid responsivo de imagens
- [ ] Adicionar descrições e tags
- [ ] Implementar visualização ampliada de imagens

## Frontend - Notas
- [ ] Criar formulário de nova nota
- [ ] Implementar listagem de notas na tab do perfil
- [ ] Adicionar timestamp e autor das notas

## Testes e Validações
- [x] Criar testes vitest para routers principais
- [x] Implementar validações Zod nos schemas
- [x] Testar fluxos completos de criação e edição

## Polimento Final
- [x] Implementar loading states e skeletons
- [x] Adicionar estados vazios com mensagens amigáveis
- [x] Configurar toasts de feedback (sucesso/erro)
- [x] Garantir responsividade mobile
- [x] Revisar acessibilidade (labels, contraste, navegação por teclado)


## Novos Formulários Interativos
- [x] Criar formulário de novo agendamento na tab Agendamentos
- [x] Criar formulário de nova transação na tab Financeiro
- [x] Criar formulário de nova nota na tab Notas
- [x] Implementar invalidação de cache após criação de registros
- [x] Adicionar feedback visual de sucesso/erro

## Formulário de Anamnese Digital
- [x] Criar formulário de anamnese na tab Anamnese do perfil
- [x] Implementar campos condicionais (alergias, doenças, medicamentos)
- [x] Adicionar checkbox de termo de consentimento obrigatório
- [x] Validar aceite do termo antes de permitir envio
- [x] Testar criação de fichas de anamnese


## Sistema de Upload de Imagens para Galeria
- [x] Criar router tRPC para upload de imagens com S3
- [x] Implementar componente de drag-and-drop para upload
- [x] Adicionar preview de imagens antes do upload
- [x] Criar formulário com campos de descrição e tags
- [x] Implementar validação de tipo e tamanho de arquivo
- [x] Adicionar opção de vincular imagem a agendamento
- [x] Testar upload e visualização na galeria


## Página de Agenda com Calendário
- [x] Criar página Schedule com calendário mensal
- [x] Implementar navegação entre meses (anterior/próximo)
- [x] Adicionar filtros por status e artista
- [x] Exibir agendamentos no calendário com cores por status
- [x] Criar modal de detalhes do agendamento
- [x] Implementar edição de status diretamente no calendário
- [x] Adicionar indicadores de quantidade de agendamentos por dia
- [x] Garantir responsividade do calendário


## Drag-and-Drop para Reagendar
- [x] Implementar eventos de drag (onDragStart, onDragEnd) nos agendamentos
- [x] Implementar eventos de drop (onDragOver, onDrop) nos dias do calendário
- [x] Adicionar feedback visual durante o arrasto (cursor, opacity)
- [x] Calcular nova data mantendo horário original
- [x] Atualizar agendamento via mutation tRPC
- [x] Invalidar cache após reagendamento
- [x] Adicionar toast de confirmação/erro
- [x] Testar drag-and-drop entre diferentes dias


## Modal de Edição de Agendamento
- [x] Criar modal de edição com formulário completo
- [x] Adicionar campos de data e hora editáveis
- [x] Implementar campos de duração, serviço e artista
- [x] Adicionar campo de observações (textarea)
- [x] Validar campos obrigatórios antes de salvar
- [x] Implementar mutation para atualizar agendamento
- [x] Adicionar botão "Editar" no modal de detalhes
- [x] Invalidar cache após edição
- [x] Testar edição completa de agendamentos


## Detecção de Conflitos de Horário
- [x] Criar procedimento tRPC para verificar conflitos de horário
- [x] Implementar lógica de cálculo de sobreposição de intervalos
- [x] Adicionar validação no backend ao criar/editar agendamentos
- [ ] Criar procedimento para sugerir horários disponíveis (opcional)
- [x] Adicionar chamada de verificação no formulário de novo agendamento
- [x] Adicionar chamada de verificação no formulário de edição
- [x] Exibir alerta visual quando detectar conflito
- [x] Mostrar detalhes do agendamento conflitante
- [ ] Implementar sugestões de horários alternativos (opcional)
- [x] Testar detecção de conflitos em diversos cenários


## Página de Relatórios Financeiros
- [x] Criar router tRPC para dados agregados de receita mensal
- [x] Criar router tRPC para breakdown por categoria
- [x] Criar router tRPC para breakdown por método de pagamento
- [x] Criar página Reports com layout de cards e gráficos
- [x] Implementar filtros de período (mês atual, últimos 3/6/12 meses, personalizado)
- [x] Adicionar gráfico de barras de receita mensal (Recharts)
- [x] Adicionar gráfico de pizza para breakdown por categoria
- [x] Adicionar gráfico de pizza para breakdown por método de pagamento
- [x] Criar cards de resumo (total receitas, despesas, saldo)
- [x] Implementar comparativo entre períodos com percentual
- [ ] Adicionar tabela detalhada de transações (opcional)
- [x] Adicionar rota no App.tsx e link no menu
- [x] Testar relatórios com diferentes filtros


## Exportação de Relatórios em PDF
- [x] Instalar dependências jspdf e jspdf-autotable
- [x] Criar função de exportação de PDF com formatação profissional
- [x] Adicionar cabeçalho com logo e informações do estúdio
- [x] Incluir resumo financeiro (receita, despesas, saldo)
- [x] Adicionar tabela detalhada de transações do período
- [x] Incluir breakdown por categoria e método de pagamento
- [x] Adicionar botão de exportar na página Reports
- [x] Implementar nome de arquivo automático com período
- [x] Testar exportação com diferentes períodos


## Sistema de Busca Global
- [x] Criar endpoint tRPC de busca global (search.global)
- [x] Implementar busca em clientes (nome, email, telefone)
- [x] Implementar busca em agendamentos (serviço, artista, cliente)
- [x] Implementar busca em transações (categoria, descrição)
- [x] Criar componente GlobalSearch com modal
- [x] Implementar atalho de teclado Ctrl+K / Cmd+K
- [x] Adicionar navegação por teclado (setas, Enter, Esc)
- [x] Agrupar resultados por tipo com ícones
- [x] Implementar redirecionamento ao selecionar resultado
- [x] Adicionar destaque de texto pesquisado
- [x] Integrar componente no DashboardLayout
- [x] Testar busca global com diferentes termos


## Filtro de Período na Busca Global
- [x] Atualizar endpoint tRPC search.global com parâmetros opcionais de data
- [x] Modificar funções de busca no db.ts para filtrar por período
- [x] Adicionar seletor de período no componente GlobalSearch
- [x] Implementar opções pré-definidas (hoje, última semana, último mês, último ano)
- [x] Adicionar date pickers para período personalizado
- [x] Exibir indicador visual do período ativo
- [x] Testar filtros de período com diferentes intervalos


## Sistema de Notificações Automáticas
- [x] Criar tabela de notificationLogs no schema
- [x] Criar router tRPC para notificações (getUpcomingAppointments, sendReminders, getNotificationLogs)
- [x] Implementar função para verificar agendamentos próximos (24h)
- [x] Implementar função para enviar notificações usando notifyOwner
- [x] Criar página de Notificações com listagem de agendamentos próximos
- [x] Adicionar botão para enviar lembretes manualmente
- [x] Exibir histórico de notificações enviadas
- [x] Adicionar rota no App.tsx e link no menu
- [x] Testar envio de notificações


## Página de Configurações do Estúdio
- [x] Criar tabela studioSettings no schema
- [x] Criar tabela artists no schema
- [x] Criar router tRPC para configurações (getSettings, updateSettings)
- [x] Criar router tRPC para artistas (list, create, update, delete)
- [x] Criar página Settings com tabs para diferentes seções
- [x] Implementar seção de Informações Básicas (nome, endereço, contato)
- [x] Implementar seção de Identidade Visual (logo, cores)
- [ ] Implementar seção de Horário de Funcionamento (opcional)
- [x] Implementar seção de Gerenciamento de Artistas
- [ ] Adicionar upload de logo com integração S3 (opcional)
- [x] Adicionar rota no App.tsx e link no menu
- [x] Testar todas as configurações


## Sistema de Permissões por Role
- [x] Adicionar campo artistId (nullable) na tabela users
- [x] Executar migration para atualizar schema
- [x] Criar artistProcedure middleware no tRPC
- [x] Modificar queries de clientes para filtrar por artista
- [x] Modificar queries de agendamentos para filtrar por artista (via artistId em appointments)
- [x] Modificar queries de transações para filtrar por artista (via clientId vinculado)
- [x] Adaptar menu lateral para mostrar apenas itens permitidos
- [x] Restringir acesso a Configurações apenas para admins
- [x] Restringir acesso a Relatórios apenas para admins
- [x] Testar acesso com usuário artista
- [x] Testar acesso com usuário admin

## Gerenciamento de Usuários
- [x] Adicionar campo isActive na tabela users
- [x] Criar endpoint para listar todos os usuários
- [x] Criar endpoint para criar novo usuário
- [x] Criar endpoint para editar usuário existente
- [x] Criar endpoint para ativar/desativar usuário
- [x] Criar endpoint para excluir usuário
- [x] Criar página Users com listagem de usuários
- [x] Implementar formulário de criação de usuário
- [x] Implementar formulário de edição de usuário
- [x] Adicionar filtros por role e status
- [x] Adicionar busca em tempo real
- [x] Adicionar item "Usuários" no menu lateral (apenas admins)
- [x] Testar todas as operações CRUD

## Sistema de Auditoria
- [x] Criar tabela auditLogs no schema
- [x] Criar funções de auditoria no db.ts
- [x] Integrar auditoria no endpoint de criação de usuário
- [x] Integrar auditoria no endpoint de edição de usuário
- [x] Integrar auditoria no endpoint de exclusão de usuário
- [x] Criar endpoint para listar logs de auditoria
- [x] Criar página Audit com listagem de logs
- [x] Implementar filtros por ação, entidade e período
- [x] Implementar busca em tempo real
- [x] Adicionar visualização detalhada de mudanças (diff)
- [x] Implementar exportação de logs em CSV
- [x] Adicionar item "Auditoria" no menu lateral (apenas admins)
- [x] Testar registro de todas as ações

## Expansão do Sistema de Auditoria
- [x] Integrar auditoria no endpoint de criação de cliente
- [x] Integrar auditoria no endpoint de edição de cliente
- [x] Integrar auditoria no endpoint de exclusão de cliente
- [x] Integrar auditoria no endpoint de criação de agendamento
- [x] Integrar auditoria no endpoint de edição de agendamento
- [x] Integrar auditoria no endpoint de exclusão de agendamento (não existe endpoint de delete)
- [x] Integrar auditoria no endpoint de criação de transação
- [x] Integrar auditoria no endpoint de edição de transação
- [x] Integrar auditoria no endpoint de exclusão de transação
- [x] Testar auditoria de todas as operações expandidas

## Dashboard de Auditoria
- [x] Criar endpoint para estatísticas gerais de auditoria
- [x] Criar endpoint para ações por dia
- [x] Criar endpoint para distribuição por tipo de ação
- [x] Criar endpoint para distribuição por entidade
- [x] Criar endpoint para ranking de usuários mais ativos
- [x] Criar endpoint para heatmap de horários
- [x] Criar página AuditDashboard com gráficos
- [x] Implementar gráfico de linha (ações por dia)
- [x] Implementar gráfico de barras (distribuição por tipo)
- [x] Implementar gráfico de pizza (distribuição por entidade)
- [x] Implementar cards de métricas
- [x] Implementar tabelas de rankings
- [x] Implementar filtros de período
- [x] Adicionar link no menu lateral (botão na página Audit)
- [x] Testar todos os gráficos e métricas

## Exportação de Relatórios de Auditoria em PDF
- [x] Instalar biblioteca jsPDF (já estava instalado)
- [x] Criar função de geração de PDF no backend
- [x] Criar endpoint tRPC para exportar PDF
- [x] Implementar botão "Exportar PDF" no dashboard
- [x] Adicionar loading state durante geração
- [x] Testar exportação de PDF

## Personalização de Templates de Relatórios
- [x] Criar tabela reportTemplates no schema
- [x] Criar funções de gerenciamento de templates no db.ts
- [x] Criar endpoints tRPC para templates (criar, listar, atualizar, excluir)
- [x] Atualizar função generateAuditPDF para aceitar configurações de template
- [x] Criar modal de configuração de template
- [x] Implementar seleção de seções
- [x] Implementar configurações de limites
- [x] Implementar personalização visual (título, cor, rodapé)
- [x] Implementar salvamento de templates
- [x] Implementar carregamento de templates salvos
- [x] Testar criação e uso de templates

## Correções no Cadastro de Clientes
- [x] Corrigir campo de data de nascimento para permitir digitação manual DD/MM/AAAA
- [x] Adicionar seletor de ano funcional no calendário
- [x] Validar data de nascimento (não futura, formato válido)
- [x] Implementar busca automática por CEP via ViaCEP
- [x] Preencher automaticamente logradouro, bairro, cidade e estado
- [x] Tratar erros de CEP (inválido, não encontrado, falha na API)
- [x] Testar digitação manual de data
- [x] Testar seleção por calendário
- [x] Testar busca de CEP válido
- [x] Testar CEP inválido e falha de API

## Melhorias no Cadastro de Clientes
- [x] Adicionar campos de endereço: número, complemento, referência
- [x] Adicionar campo de gênero (homem, mulher, outros)
- [x] Atualizar schema do banco de dados
- [x] Atualizar endpoints tRPC
- [x] Atualizar formulário NewClient.tsx
- [x] Implementar cálculo automático de idade (idade é calculada dinamicamente a partir da data de nascimento)
- [x] Testar todos os novos campos

## Sistema de Agenda com FullCalendar
- [x] Instalar dependências do FullCalendar (core, interaction, daygrid, timegrid, list, multimonth)
- [x] Criar schema de calendários personalizados
- [x] Atualizar schema de appointments com calendarId
- [x] Criar endpoints tRPC para calendários (CRUD)
- [x] Criar endpoints tRPC para eventos (list, update com drag & drop - calendarId adicionado)
- [x] Desenvolver componente FullCalendar com drag & drop
- [x] Implementar 4 views (dia, semana, mês, ano)
- [x] Desenvolver sidebar com lista de calendários
- [x] Implementar toggles de visibilidade
- [x] Aplicar cores dos calendários aos eventos
- [x] Implementar UI dark mode
- [x] Adicionar snap de horários (15min)
- [x] Adicionar highlight de horário atual
- [x] Testar drag & drop em todas as views

## Modal de Criação/Edição de Eventos com Duplo Clique

- [x] Criar componente EventModal com formulário completo
- [x] Adicionar campos: cliente (select), calendário (select), data, hora inicial, hora final, serviço/tipo
- [x] Implementar handler de duplo clique em espaço vazio (dateClick com double click)
- [x] Implementar handler de duplo clique em evento existente (eventClick com double click)
- [x] Integrar com endpoint de criação de appointments
- [x] Integrar com endpoint de edição de appointments
- [x] Garantir sincronização imediata com invalidação de cache
- [x] Testar criação de evento via duplo clique
- [x] Testar edição de evento via duplo clique

## Upload de Imagem de Referência no Modal de Eventos

- [x] Adicionar campo referenceImageUrl no schema de appointments
- [x] Atualizar banco de dados com migração
- [x] Adicionar campo de upload de imagem no EventModal
- [x] Implementar preview da imagem selecionada
- [x] Criar endpoint tRPC para upload de imagem para S3
- [x] Integrar upload com criação/edição de eventos
- [x] Exibir imagem de referência ao editar evento existente
- [x] Testar upload e visualização de imagens

## Correção de Scroll no Modal de Eventos

- [x] Ajustar DialogContent para permitir scroll interno
- [x] Testar scroll com imagem anexada

## Melhoria de Navegação no Dashboard

- [x] Analisar comportamento atual do DashboardLayout
- [x] Garantir que sidebar esteja sempre visível em desktop
- [x] Adicionar botão de menu hambúrguer em mobile
- [x] Testar navegação em diferentes tamanhos de tela

## Breadcrumbs de Navegação

- [x] Criar componente de breadcrumbs
- [x] Integrar breadcrumbs no header do DashboardLayout
- [x] Mapear rotas para breadcrumbs
- [x] Testar navegação com breadcrumbs

## Melhoria de Visibilidade do Botão Voltar ao Dashboard

- [x] Tornar breadcrumb mais destacado visualmente
- [x] Adicionar estilo de botão ao link "Início"
- [x] Garantir que menu lateral esteja sempre visível
- [x] Testar navegação em todas as páginas

## Correção de Layout - Sidebar em /calendar

- [x] Mover rota /calendar para dentro do DashboardLayout
- [x] Testar navegação do sidebar em /calendar

## Preparação para Google Cloud Run (Export + Docker)

- [x] Adicionar AUTH_MODE=local com admin fixo (email/senha em ENV)
- [x] Parametrizar STORAGE_PROVIDER (s3|disabled)
- [x] Criar Dockerfile production-ready (porta 8080)
- [x] Criar docker-compose.yml para teste local
- [x] Criar .env.example com todas variáveis
- [x] Criar README_DEPLOY.md com instruções Cloud Run
- [x] Gerar arquivo .zip final

## Correções para Google Cloud Run Build

- [x] Substituir import.meta.dirname por __dirname ESM em vite.config.ts
- [x] Substituir import.meta.dirname por __dirname ESM em vitest.config.ts
- [x] Substituir import.meta.dirname por __dirname ESM em server/_core/vite.ts
- [x] Fixar PORT sem varredura em server/_core/index.ts
- [x] Corrigir Dockerfile para estrutura real do projeto
- [x] Testar build local

## Sistema de Anamnese - Fase 1: Envio de Link e Preenchimento

- [ ] Criar tabelas anamnese_requests e anamnese_submissions
- [ ] Salvar schema JSON do formulário
- [ ] Criar endpoint para gerar link único
- [ ] Criar endpoint para enviar por email/WhatsApp
- [ ] Criar página pública de preenchimento (/anamnese/:token)
- [ ] Implementar formulário multi-step (8 etapas)
- [ ] Criar endpoint para salvar submissão
- [ ] Adicionar botão "Enviar Anamnese" na página de cliente
- [ ] Exibir submissões na aba do cliente
- [ ] Testar fluxo completo

## Sistema de Anamnese - Fase 1: Envio de Link

- [x] Criar schema JSON do formulário (80+ campos)
- [x] Criar tabelas de anamnese no banco (requests + submissions)
- [x] Implementar backend: gerar token, criar request
- [x] Implementar backend: endpoints públicos (getByToken, submit)
- [x] Criar página pública de preenchimento multi-step
- [x] Criar componente SendAnamneseDialog
- [x] Integrar botão "Enviar Link" no ClientProfile
- [x] Testar fluxo completo (gerar link → preencher → retornar)

## Correções no Sistema de Anamnese

- [x] Corrigir rota pública /anamnese/:token (acesso sem autenticação)
- [x] Implementar envio por Email no SendAnamneseDialog
- [x] Permitir edição de email antes de enviar
- [x] Criar tabela anamneseSendLogs no schema
- [x] Implementar registro de logs de envio (cliente, data/hora, canal)
- [x] Testar link público abrindo em navegador externo
- [x] Testar envio por WhatsApp e Email
- [x] Validar logs de envio sendo registrados

## URGENTE - Correção de Erro no Cadastro

- [ ] Corrigir erro "Failed query: insert into clients" causado por campo artistId inválido
- [ ] Remover campo artistId do endpoint de criação de clientes
- [ ] Testar cadastro completo funcionando

## CRÍTICO - Correção Sistemática de Todos os Cadastros

### Diagnóstico
- [ ] Verificar logs do backend para identificar causa raiz
- [ ] Verificar console do frontend para erros de validação
- [ ] Identificar padrão de falha (schema, validação, serialização, etc.)
- [ ] Documentar causa raiz exata

### Correção de Cadastros
- [ ] Corrigir cadastro de usuários (admin/colaborador)
- [ ] Corrigir cadastro de clientes
- [ ] Corrigir cadastro de agendamentos
- [ ] Corrigir cadastro de transações financeiras
- [ ] Corrigir cadastro de anamnese
- [ ] Corrigir cadastro de notas
- [ ] Corrigir cadastro de imagens da galeria
- [ ] Corrigir cadastro de artistas
- [ ] Corrigir cadastro de configurações

### Padronização
- [ ] Criar camada única de persistência (saveEntity/updateEntity)
- [ ] Padronizar IDs (auto-increment consistente)
- [ ] Padronizar campos obrigatórios e defaults
- [ ] Padronizar formato de datas (ISO 8601)
- [ ] Padronizar tipagem de dados
- [ ] Implementar tratamento de erro padronizado

### Validação e UX
- [ ] Adicionar validação de campos obrigatórios
- [ ] Normalizar máscaras antes de salvar
- [ ] Implementar mensagens de sucesso padronizadas
- [ ] Implementar mensagens de erro amigáveis
- [ ] Adicionar logs técnicos separados

### Checklist de Testes
- [ ] Criar admin → salvar OK → login OK
- [ ] Criar colaborador → salvar OK → permissões OK
- [ ] Criar cliente → salvar OK → editar OK
- [ ] Criar agendamento → salvar OK → editar OK → persistência OK
- [ ] Criar transação → salvar OK → editar OK
- [ ] Criar anamnese → salvar OK → vincular OK
- [ ] Criar nota → salvar OK
- [ ] Criar imagem galeria → salvar OK

### Observabilidade
- [ ] Adicionar modo debug com logs estruturados
- [ ] Implementar logging de entityType, payload, userId, timestamp
- [ ] Garantir logs não expõem dados sensíveis

## URGENTE - Correção de Erro 500 no Envio de Link de Anamnese

- [ ] Reproduzir erro e capturar logs detalhados do servidor
- [ ] Identificar causa raiz do erro 500 (verificar stack trace)
- [ ] Implementar correção no endpoint anamnese.createRequest
- [ ] Testar envio 10 vezes consecutivas para validar 100% de sucesso
- [ ] Adicionar tratamento de erro robusto


## CORREÇÕES OBRIGATÓRIAS - ORDEM FIXA

### 1. CLIENTE
- [x] Corrigir erro no campo Data de Nascimento
- [x] Garantir que cliente seja salvo no banco
- [x] Retornar feedback simples (sucesso/erro)

### 2. AGENDA / CALENDÁRIO
- [x] Permitir criar agendamento vinculado a cliente
- [x] Fazer eventos aparecerem no calendário
- [x] Não alterar layout

### 3. CAIXA
- [x] Ativar entradas e saídas
- [x] Mostrar saldo
- [x] Relatório básico funcional (mínimo)

### 4. NOTIFICAÇÕES
- [x] Ativar notificação: Novo cliente
- [x] Ativar notificação: Novo agendamento
- [x] Exibição básica no painel

#### 5. USUÁRIOS
- [x] Criar admin com senha obrigatória
- [x] Cadastro inicial do estúdio
- [x] Criar colaboradores com Login, Senha, Papel

### 6. AUDITORIA
- [x] Registrar: Criar
- [x] Registrar: Editar
- [x] Registrar: Excluir
- [x] Registro simples funcional

## Visualização de Fichas de Anamnese Preenchidas

- [ ] Criar tabela anamnese_submissions no banco (se não existir)
- [ ] Implementar tela de visualização formatada da anamnese
- [ ] Adicionar botão de exportação para PDF
- [ ] Testar fluxo: preencher anamnese → visualizar → exportar PDF


## Sistema de Alertas de Risco em Anamnese

- [ ] Adicionar campo riskLevel (low, medium, high, critical) no schema de anamnesisRecords
- [ ] Implementar função calculateRiskLevel no backend
- [ ] Atualizar endpoint de criação de anamnese para calcular risco automaticamente
- [ ] Adicionar badges coloridos de risco na listagem de fichas
- [ ] Criar painel de alertas mostrando fichas de alto risco
- [ ] Implementar notificação automática para riscos críticos
- [ ] Testar sistema com diferentes cenários de risco


## Deleção de Agendamentos
- [ ] Criar endpoint tRPC para deletar agendamento
- [ ] Adicionar botão de deletar na página Agenda
- [ ] Adicionar botão de deletar no modal de detalhes do Calendário Visual
- [ ] Implementar atalho de teclado Delete/Backspace
- [ ] Adicionar confirmação antes de deletar
- [ ] Testar deleção em ambas as páginas

## Sistema de Autenticação Hierárquica (Multi-Estúdios)
- [x] Criar tabela studios no schema
- [x] Adicionar campo studioId em todas as tabelas (users, clients, appointments, transactions, artists, auditLogs)
- [x] Atualizar enum de role para superadmin/admin/collaborator
- [x] Migrar dados existentes para estúdio padrão
- [x] Criar middlewares superAdminProcedure, adminProcedure, collaboratorProcedure
- [x] Atualizar artistProcedure para aceitar nova hierarquia
- [x] Atualizar função listClients para filtrar por studioId e artistId
- [x] Adicionar studioId em todos os endpoints de criação (clients, appointments, transactions, artists)
- [x] Atualizar tipos de role no frontend (Users.tsx)
- [x] Corrigir todos os erros TypeScript
- [x] Criar primeiro usuário superadmin no banco
- [x] Criar ambiente de teste com múltiplos estúdios e usuários
- [x] Testar isolamento de dados entre estúdios
- [x] Testar permissões de cada role (superadmin, admin, collaborator)
- [x] Validar que colaborador vê apenas seus próprios clientes
- [ ] Criar endpoint de cadastro de estúdio com chave mestre
- [ ] Criar página de cadastro de estúdio (/register-studio)
- [ ] Criar endpoint para listar estúdios (superadmin only)
- [ ] Criar endpoint para gerenciar colaboradores (admin only)
- [ ] Adaptar menu lateral conforme role do usuário
- [ ] Adicionar filtro de estúdio para superadmin nas páginas de listagem
- [ ] Documentar fluxo de cadastro de estúdio e colaboradores

## Correção Urgente: Menu Lateral
- [x] Investigar por que o menu lateral foi removido do DashboardLayout
- [x] Restaurar todos os itens de menu na sidebar (Dashboard, Clientes, Agenda, etc.)
- [x] Testar navegação entre páginas
- [x] Verificar se todos os links estão funcionando
- [x] Criar documentação completa para testes


## Correções de Bugs Críticos (21/01/2026)
- [ ] CLIENTES: Corrigir erro "usuário não vinculado ao estúdio" no cadastro
- [ ] CALENDÁRIO: Implementar drag & drop com persistência (eventDrop/eventResize)
- [ ] CALENDÁRIO: Ajustar locale para pt-BR (rótulos em português)
- [ ] USUÁRIOS: Adicionar botão "Buscar" clicável
- [ ] CONFIGURAÇÕES: Corrigir persistência de Artista
- [ ] AUDITORIA/ALERTAS: Criar seed de dados de teste


## BUGS CRÍTICOS A CORRIGIR

### Ficha de Anamnese
- [ ] Corrigir link de visualização da ficha de anamnese
- [ ] Validar rota /anamnese/:id
- [ ] Testar acesso à ficha preenchida

### Drag & Drop na Agenda
- [x] Corrigir erro ao arrastar agendamento
- [x] Implementar redimensionamento de eventos (aumentar/diminuir duração)
- [x] Adicionar feedback visual durante arraste
- [x] Testar compatibilidade com iCloud-like interaction

### Duplo Clique no Calendário
- [x] Implementar abertura automática do menu de agendamento ao duplo clique
- [x] Otimizar UX para ser intuitiva
- [x] Testar em diferentes visualizações (dia, semana, mês, ano)

### Salvamento de Eventos no Calendário Visual
- [ ] Corrigir salvamento automático após alteração
- [ ] Validar persistência de dados no banco
- [ ] Testar em todas as visualizações (dia, semana, mês, ano)
- [ ] Implementar sincronização em tempo real

### Estabilidade Geral
- [ ] Tornar comportamento da agenda estável e responsivo
- [ ] Garantir consistência em todas as interações
- [ ] Testar em diferentes navegadores
- [ ] Validar performance com muitos eventos


## CORREÇÕES CRÍTICAS (Mar/2026)

- [x] Correção 1: Incompatibilidade Date vs string - helper formatDate aceitar Date | string | null em todos os arquivos
- [x] Correção 2: Propriedades faltantes no EventModal (depositPaid, depositAmount, totalAmount) e tipos Insert/Select no schema
- [x] Correção 3: Transações de banco de dados para evitar race conditions e validação de businessHours
- [x] Correção 4: Cron jobs automáticos para lembretes de aniversário e agendamentos

## Seed de Dados de Demonstração (6+ meses)
- [ ] Criar perfis de tatuadores (5-8 artistas com especialidades)
- [ ] Criar clientes (50+ clientes com histórico completo)
- [ ] Criar agendamentos (300+ agendamentos distribuídos em 6 meses)
- [ ] Criar transações financeiras (receita acima de R$250.000/mês)
- [ ] Criar fichas de anamnese para clientes
- [ ] Criar notas e galeria de imagens
- [ ] Validar integridade dos dados inseridos


## Relatórios por Tatuador com Gráficos Avançados (Mar/2026)
- [x] Endpoint backend: receita por artista com filtros de período (semanal, mensal, bimestral, anual)
- [x] Componente ArtistRevenueChart com gráfico de bolhas/círculos
- [x] Gráfico de barras comparativo por artista
- [x] Gráfico de pizza de participação percentual por artista
- [x] Gráfico de linhas para evolução temporal por artista
- [x] Filtros de período: Semanal, Mensal, Bimestral, Anual
- [x] Seletor de visualização (Bolhas / Barras / Pizza / Linhas)
- [x] Integração na página de Relatórios como nova seção
- [x] Testes unitários para formatArtistRevenueResult (10 testes passando)


## Correção Drag-and-Drop e Sincronização Calendário/Agenda (Mar/2026)
- [x] Corrigir drag-and-drop no Calendário Visual para arrastar para dia E horário específico
- [x] Implementar grade de horários na Agenda (visão semanal com slots de hora por dia)
- [x] Sincronização bidirecional: mudanças no Calendário Visual refletem na Agenda e vice-versa
- [x] Invalidar cache tRPC em ambas as páginas após qualquer alteração
- [x] Testes unitários: 14 testes passando (toLocalDateString, calcWeekDropDate, calcMonthDropDate, getEventStyle, sincronização)

## Correção Sistema de Lembretes (Mar/2026)
- [x] Corrigir scheduler para enviar lembretes apenas para agendamentos do dia seguinte (não todos de uma vez)
- [x] Garantir que o filtro de data considera apenas a data local (não UTC) para evitar disparos errados
- [x] Verificar notificationLogs para não reenviar lembretes já enviados com sucesso
- [x] Enviar UMA notificação consolidada com todos os agendamentos do dia seguinte (não uma por agendamento)
- [x] Testes unitários: 13 testes passando (toLocalDateStr, getTomorrowRange, filterUpcomingAppointments, buildReminderMessage)

## Correção e Atualização da Ficha de Anamnese (Mar/2026)
- [x] Corrigir URL hardcoded do link de anamnese para usar domínio dinâmico (APP_BASE_URL ou localhost)
- [x] Atualizar schema JSON v2.0 com os 39 campos do PDF (dados pessoais, tatuagem, saúde, consentimento)
- [x] Reescrever PublicAnamnese.tsx com 6 etapas, campos condicionais, barra de progresso e visual dark
- [x] Garantir que dados submetidos são armazenados e visíveis no perfil do cliente (JOIN com anamneseSubmissions)
- [x] AnamneseView.tsx atualizado para exibir fichas do novo fluxo (39 campos) e do fluxo antigo
- [x] ClientProfile.tsx atualizado para exibir fichas via link e fichas manuais separadamente
- [x] Testes unitários: 19 testes passando (schema, campos condicionais, validação, URL dinâmica)

## Módulo Estoque e Fornecedores — Etapa 1 (Mar/2026)
- [x] Schema: tabelas materials, suppliers, stockMovements, purchaseOrders, purchaseOrderItems
- [x] Migração do banco com pnpm db:push (5 tabelas criadas)
- [x] Helpers db.ts: CRUD materiais, fornecedores, movimentações, pedidos + buildWhatsAppOrderMessage
- [x] Procedures tRPC: stock.* e suppliers.* (list, create, update, delete, movements, orders, whatsapp link)
- [x] Página Estoque: listagem com badge de alerta (vermelho/amarelo), cadastro/edição, movimentações por material
- [x] Página Fornecedores: listagem em cards, cadastro/edição, pedido de orçamento com link WhatsApp e cópia de mensagem
- [x] Integração no menu lateral (Package + Truck) e rotas App.tsx
- [x] Testes unitários: 19 testes passando (buildWhatsAppOrderMessage, alerta de estoque mínimo, movimentações)

## Correção Cadastro Fornecedores e Materiais (Abr/2026)
- [x] Diagnosticar incompatibilidade: tabelas não criadas no banco TiDB, tipos errados (timestamp vs bigint)
- [x] Criar 5 tabelas via SQL direto no banco (suppliers, materials, stock_movements, purchase_orders, purchase_order_items)
- [x] Corrigir schema Drizzle (bigint para timestamps, avgPrice, materialName, materialUnit, import bigint)
- [x] Corrigir helpers db.ts (timestamps via código Date.now(), averagePrice→avgPrice, reference→notes)
- [x] Testar cadastro de fornecedor (Art Hand's) e material (Cartucho 7RL) com sucesso

## Edição/Exclusão de Fichas de Anamnese e Formulário Editável pelo Cliente (Abr/2026)
- [x] Endpoint backend: updateAnamneseSubmission (editar payloadJson de ficha existente)
- [x] Endpoint backend: deleteAnamneseSubmission (excluir ficha submetida)
- [x] Endpoint backend: deleteAnamneseRecord (excluir ficha manual do painel interno)
- [x] Endpoint backend: updateAnamneseRecord (editar ficha manual do painel interno)
- [x] Botões Editar e Excluir nas fichas manuais (ClientProfile - aba Anamnese)
- [x] Botões Editar e Excluir nas fichas via link (ClientProfile - aba Anamnese)
- [x] Formulário público: pré-preencher com dados existentes (isEditing=true, existingPayload) quando cliente reabre link
- [x] Formulário público: permite reenvio (atualiza submissão existente quando submissionId fornecido)
- [x] Banner "Modo Edição" animado no formulário público
- [x] Mensagem de conclusão diferenciada: "Ficha atualizada!" vs "Ficha enviada!"
- [x] Testes unitários: 14 testes passando (isTokenValidForEdit, resolveFormMode, buildSubmitPayload, validateStep, exclusão)

## Fix: Campos Bloqueados no Formulário Público de Anamnese (Abr/2026)
- [x] Localizar e remover disabled/readOnly: 4 campos (client_name, client_dob, client_email, client_phone) estavam com type="readonly" no schema JSON
- [x] Corrigir shared/anamnese.schema.json: todos os 4 campos convertidos de "readonly" para "text"
- [x] Remover bloco case "readonly" do renderField no PublicAnamnese.tsx (renderizava Input com readOnly+disabled)
- [x] Remover "readonly" do tipo FieldDef no TypeScript
- [x] Submit já atualiza o mesmo registro (submissionId passado quando existingSubmissionId presente) - sem duplicata
- [x] Validado manualmente: campo Nome editado de "Cliente Teste Correção" para "João da Silva (Editado)" com sucesso

## Fix: Máscara de Data e CEP Auto-fill (Abr/2026)
- [x] Fix 1: Máscara DD/MM/YYYY no campo client_dob (formata automaticamente ao digitar)
- [x] Fix 2: Campo CEP com máscara 00000-000 e auto-preenchimento de endereço via ViaCEP API

## Melhorias Pontuais — Clientes, Agenda, Notificações (Abr/2026)
- [x] Fix 1: Linha da tabela de clientes totalmente clicável (sem conflito com botões internos)
- [x] Fix 2: Duplo clique em dia/horário livre na Agenda abre EventModal com data/hora pré-preenchidos
- [x] Fix 3: Clique simples em evento na Agenda abre diretamente o modal de edição (EventModal)
- [x] Fix 4: Drag & drop e resize na Agenda (Schedule.tsx) funcionando com salvamento automático
- [x] Fix 5: Notificações WhatsApp configuráveis (dias antes, horário envio, reenvio, horário reenvio)
- [x] Fix 6: Confirmação do cliente via link WhatsApp registrada no agendamento (confirmado/não confirmado/atraso/chegada antecipada)

## Envio Automático de Lembretes WhatsApp (Abr/2026)
- [x] Criar scheduler server-side que roda diariamente no horário configurado
- [x] Ler configurações do banco (reminderDaysBefore, reminderTime, reminderResend, reminderResendTime)
- [x] Buscar agendamentos que se encaixam na janela de lembrete configurada
- [x] Gerar link WhatsApp com token de confirmação para cada agendamento
- [x] Registrar envio no notificationLogs com tipo "whatsapp_primary" ou "whatsapp_resend"
- [x] Evitar reenvio duplicado (checar notificationLogs antes de enviar)
- [x] Exibir status do scheduler automático na página de Notificações
- [x] Testar scheduler com diferentes configurações (22 testes passando)

## Lembretes Individuais por Agendamento (Abr/2026)
- [x] Criar tabela appointmentReminders no schema (appointmentId, scheduledAt, message, status)
- [x] Migrar banco com a nova tabela
- [x] Helpers no db.ts: createReminder, listRemindersByAppointment, updateReminder, deleteReminder, getPendingRemindersToSend, markReminderSent, markReminderFailed
- [x] Endpoints no routers.ts: appointments.reminders.list, create, update, delete
- [x] Aba "Lembretes" no EventModal com UI para adicionar/editar/remover lembretes individuais
- [x] Campos: data do envio, horário do envio, mensagem personalizada com variáveis {nome}, {data}, {horário}, {serviço}, {artista}
- [x] Botão "Usar modelo" para preencher mensagem padrão automaticamente
- [x] Scheduler verifica lembretes individuais a cada 1 minuto e dispara no momento configurado
- [x] Evitar disparo duplicado (checar status do lembrete antes de enviar)
- [x] Exibir status do lembrete (pendente/enviado/falhou) no submenu com badges coloridos
- [x] Notificar dono do estúdio com link WhatsApp ao disparar lembrete individual

## Melhorias na Tela de Notificações (Abr/2026)
- [x] Botão "Enviar Agora" na lista de agendamentos próximos gera link WhatsApp imediato e abre direto
- [x] Clique em lembrete agendado abre modal para editar data, horário e mensagem
- [x] Link WhatsApp gerado é clicável diretamente na tela (abre wa.me)
- [x] Endpoint backend getAllPendingReminders para listar lembretes pendentes na tela de Notificações
- [x] Botão "Abrir WhatsApp e Enviar Agora" dentro do modal de edição do lembrete

## Fix: Código do País no Link WhatsApp (Abr/2026)
- [x] Criar normalizeWhatsAppNumber centralizado em shared/const.ts (cobre todos os formatos: com/sem +55, 10 ou 11 dígitos, parênteses, traços)
- [x] Corrigir scheduler.ts (checkWhatsAppSchedule e runIndividualReminders) para usar normalizeWhatsAppNumber
- [x] Corrigir routers.ts (getWhatsAppLink de fornecedores) para usar normalizeWhatsAppNumber
- [x] Corrigir Notifications.tsx para importar buildWhatsAppLink do shared/const.ts
- [x] 22 testes do reminder-scheduler passando (incluindo teste de não duplicação do 55)

## Envio Imediato de Lembrete WhatsApp no Agendamento (Abr/2026)
- [x] Botão "Enviar WhatsApp Agora" no EventModal (aba Info, ao editar agendamento existente)
- [x] Gerar link WhatsApp com mensagem de confirmação e abrir wa.me diretamente
- [x] Exibir link gerado na tela para reenvio posterior (clique para abrir novamente)
- [x] Aviso quando cliente não tem telefone cadastrado

## CPF/Passaporte no Cadastro de Cliente (Abr/2026)
- [x] Adicionar campo docType (enum: cpf | passport) e docNumber no schema da tabela clients
- [x] Migrar banco para adicionar as colunas docType e docNumber (migração 0027)
- [x] Máscara automática CPF: 000.000.000-00 no campo de documento (NewClient.tsx)
- [x] Alternância CPF / Passaporte no formulário de cadastro (botões de seleção)
- [x] Exibir o tipo de documento correto na ficha do cliente (ClientProfile.tsx com ícone CreditCard)
- [x] Endpoints clients.create e clients.update aceitam docType e docNumber

## Fix: Valor/Sinal no Modal de Edição + Artistas no Agendamento (Abr/2026)
- [x] Fix: valor e sinal não aparecem ao abrir modal de edição de agendamento
- [x] Cadastro de artistas: página /artists com listagem, cadastro, edição e exclusão
- [x] Item de menu "Artistas" no sidebar (visível para admin/superadmin)
- [x] Seleção de artista no modal de agendamento (dropdown com artistas cadastrados, fallback para texto livre)
- [ ] Exibir artista no card do agendamento na agenda

## Fix: Valores Inflacionados nos Relatórios + Integração Estoque/Transações (Abr/2026)
- [x] Fix: Reports.tsx formatCurrency dividindo por 100 (valores em centavos no banco)
- [x] Fix: exportPDF.ts formatCurrency dividindo por 100
- [x] Fix: ArtistRevenueChart.tsx formatCurrency dividindo por 100 + tickFormatters ajustados
- [x] Fix: GlobalSearch.tsx formatCurrency dividindo por 100
- [x] Endpoint transactions.createWithMaterials: cria transação + baixa automática de múltiplos materiais
- [x] Formulário de transação no ClientProfile: seção "Materiais Utilizados" com dropdown de estoque
- [x] Botão dinâmico: "Registrar + Baixar N material(is)" quando há materiais selecionados
- [x] Invalidação de cache de estoque após criação de transação com materiais
- [x] Toast com feedback de quantos materiais tiveram baixa realizada
- [x] 12 novos testes vitest para lógica de centavos e baixa de estoque

## Dashboard Widgets (Maio/2026)
- [x] Endpoint backend dashboard.weeklyAppointments (agendamentos da semana, timezone SP)
- [x] Função db.getWeeklyAppointments com join em clients, ordenação por data
- [x] WeeklyAppointmentsWidget: lista semana atual, destaque visual para hoje, status badge
- [x] RemindersWidget: lembretes automáticos (atendimentos hoje, próximas 24h, próximo futuro)
- [x] LowStockWidget: materiais abaixo do mínimo com distinção crítico/alerta
- [x] Inserção dos 3 widgets no Dashboard em grid responsivo (md:2col / xl:3col)
- [x] 17 testes vitest para lógica dos widgets (semana, lembretes, estoque)

## Diagnóstico v6 — 10 Bugs (Maio/2026)
- [x] Bug 4: Schema Zod da criação de agendamento aceita depositPaid/depositAmount/totalAmount
- [x] Bug 6: Conversão de centavos corrigida no EventModal (/ 100 ao carregar, * 100 ao salvar)
- [x] Bug 7: Atalho Delete/Backspace ignorado quando foco está em input/textarea/select
- [x] Bug 9: Runtime error de conflitos corrigido (conflict.date tratado como string ISO)
- [x] Bug 3: Sinal pago gera transação automática no Caixa ao atualizar agendamento
- [x] Bug 10: Campo depositPaymentMethod adicionado no EventModal e routers.ts
- [x] Bug 1: Aba Lembretes habilitada ao criar novo agendamento (pendingReminders)
- [x] Bug 2: Formulário duplicado no ClientProfile substituído pelo EventModal unificado
- [x] Bug 5: Data exibida com timezone America/Sao_Paulo no ClientProfile
- [x] Bug 8: listAppointments e listTransactions filtram por studioId do usuário
- [x] 20 testes vitest para todas as correções do diagnóstico v6

## Autenticação Local (e-mail + senha) — Maio/2026
- [x] Campo passwordHash adicionado na tabela users (schema + migração db:push)
- [x] localAuth.ts reescrito com bcrypt multi-usuário e ensureLocalAdmin na inicialização
- [x] Endpoints: POST /api/auth/local/login (HTTP 200 testado), POST /api/auth/local/logout
- [x] Tela LocalLogin.tsx com e-mail + senha, mostrar/ocultar senha, feedback de erro
- [x] DashboardLayout detecta VITE_AUTH_MODE e exibe LocalLogin quando não autenticado
- [x] Página Users.tsx: criação com senha, botão redefinir senha (ícone chave)
- [x] Endpoints tRPC users.createLocal e users.setPassword (admin only)
- [x] AUTH_MODE=local e VITE_AUTH_MODE=local configurados nas variáveis de ambiente
- [x] 10 testes vitest para autenticação local (bcrypt, validação, ENV)

## Finalização Auth Local — Senhas e Sincronização (Maio/2026)
- [x] Constraint UNIQUE openId sincronizada com Drizzle (migração 0029 marcada como aplicada)
- [x] pnpm db:push executado com sucesso (No schema changes, migrations applied)
- [x] Formulário de criação de usuário testado (email novo → HTTP 201, duplicado → HTTP 409)
- [x] Senha definida para João Victor Souza Coelho (jvdtna@yahoo.com.br) — Tattoo@2026
- [x] Senha definida para Cássia Tavares (cassialutavares27@gmail.com) — Tattoo@2026
- [x] Nome corrigido de "cass" para "Cássia Tavares" no banco
- [x] Login testado com sucesso para ambos (HTTP 200)
- [x] Usuário de teste removido do banco

## Auth Local — Sessão Final (07/05/2026)
- [x] Configurar williantattoo@me.com como superadmin com senha 123456#
- [x] Corrigir ensureLocalAdmin para NÃO sobrescrever senha existente
- [x] Confirmar login de João e Cássia com senha Tattoo@2026
- [x] Corrigir testes unitários (roles, studioId, depositAmount, date format)
- [x] 242 testes passando, 4 skipped (edge cases pré-existentes)

## Correções e Novas Funcionalidades — Usuários (07/05/2026)
- [x] Corrigir erro na criação de novo usuário (formulário não salva) — era e-mail duplicado, mensagem de erro agora visível
- [x] Adicionar página de detalhes do usuário (clicar no nome abre perfil)
- [x] Adicionar funcionalidade de excluir usuário (superadmin)

## Trocar Senha e Recuperação de Senha (07/05/2026)
- [ ] Backend: endpoint users.changePassword (usuário logado troca própria senha)
- [ ] Backend: tabela passwordResetTokens no schema
- [ ] Backend: endpoint auth.requestPasswordReset (gera token e envia e-mail)
- [ ] Backend: endpoint auth.resetPassword (valida token e redefine senha)
- [ ] Frontend: modal "Trocar Senha" acessível no perfil/menu do usuário logado
- [ ] Frontend: link "Esqueci minha senha" na tela de login
- [ ] Frontend: página /reset-password?token=... para redefinir senha via link
- [ ] Testar fluxo completo de recuperação de senha

## Agenda Estilo Apple Calendar + Financeiro Colaboradores (07/05/2026)

- [ ] Schema: campos signalStatus, paymentStatus, paymentMethod em appointments
- [ ] Schema: tabela collaboratorRates (percentual por colaborador)
- [ ] Backend: procedures para rates e relatórios financeiros por colaborador
- [ ] Agenda: visão semanal com dias abreviados PT-BR (Dom, Seg, Ter, Qua, Qui, Sex, Sáb)
- [ ] Agenda: grade de horários (07:00–22:00) com separação visual por hora
- [ ] Agenda: clicar em slot vazio → modal novo agendamento com data/hora pré-preenchida
- [ ] Agenda: clicar em agendamento → modal de edição
- [ ] Agenda: arrastar agendamento para outra data/hora (drag & drop)
- [ ] Modal: status de sinal (aguardando sinal / sinal confirmado)
- [ ] Modal: status de pagamento (pendente / pago) + forma de pagamento
- [ ] Gestão de percentual do colaborador (admin edita, colaborador visualiza)
- [ ] Relatórios financeiros: diário, semanal, mensal e anual por colaborador

## Exportação de Agendamento para Calendários

- [ ] Backend: endpoint /api/appointments/:id/ics para gerar arquivo .ics
- [ ] Backend: incluir dados da anamnese no .ics (observações com destaque)
- [ ] Backend: incluir link da ficha de anamnese e link de confirmação no .ics
- [ ] Frontend: botões "Salvar no iCloud" e "Salvar no Google Calendar" na ficha de agendamento
- [ ] Frontend: botão de link de confirmação via WhatsApp na ficha de agendamento

## Agenda e Calendários — Sessão Atual

- [ ] Corrigir botão Hoje na agenda (não navega para a data atual)
- [ ] Backend: tabela de calendários (nome, cor, descrição, ativo)
- [ ] Frontend: página Calendário Visual com criação/edição/exclusão e seleção de cor
- [ ] Integrar calendários na agenda (filtrar eventos por calendário, cor do evento = cor do calendário)


## Melhorias na Agenda e Calendário Visual (Sessão atual)
- [x] Corrigir botão "Hoje" no Schedule.tsx — scroll automático para hora atual na visão semanal
- [x] Adicionar linha de hora atual (linha vermelha) na visão semanal do Schedule.tsx
- [x] Scroll automático ao entrar na visão semanal
- [x] Reescrever CalendarPage.tsx com interface completa estilo Apple Calendar
- [x] Sidebar de calendários com mini calendário mensal, criação/edição/exclusão e toggle de visibilidade
- [x] Paleta de cores estilo Apple Calendar (15 cores + cor personalizada com color picker)
- [x] Visões Dia/Semana/Mês no Calendário Visual
- [x] Linha de hora atual (linha vermelha) no Calendário Visual
- [x] Scroll automático para hora atual no Calendário Visual
- [x] Botão "Hoje" funcional no Calendário Visual
- [x] Agendamentos exibidos com cor do calendário associado
- [x] Corrigir erro TypeScript JSX.Element[] → React.ReactElement[]
- [x] 246 testes passando, 0 erros TypeScript

## Busca em Agendamentos e Novo Agendamento da Ficha do Cliente
- [x] Adicionar campo de busca textual na página Agenda (Schedule.tsx)
- [x] Filtrar agendamentos por nome do cliente, serviço, artista, status e observações em tempo real
- [x] Adicionar botão "Limpar busca" (X) quando há texto digitado
- [x] Exibir badge de contagem de resultados com texto da busca ativa
- [x] Adicionar botão "Novo Agendamento" no header da página Agenda
- [x] Adicionar prop initialClientId no EventModal
- [x] Pré-preencher o cliente no EventModal ao abrir da ficha do cliente
- [x] Exibir painel de informações do cliente selecionado no EventModal (nome, telefone, e-mail, Instagram, data de nascimento, nível de fidelidade)
- [x] Mostrar telefone do cliente no dropdown de seleção do EventModal
- [x] Corrigir erros TypeScript (loyaltyLevel comparison, birthdate → birthDate)
- [x] 246 testes passando, 0 erros TypeScript

## Auditoria Técnica Completa (2026-05-08)
- [x] TZ-1: EventModal ao editar — usar split direto na string do banco, evita dia errado em fusos UTC+
- [x] TZ-2: Reports.tsx — enviar datas no formato local YYYY-MM-DD HH:mm:ss em vez de ISO UTC
- [x] SEC-1: getArtistRevenue — corrigir studioId hardcoded = 1, usar parâmetro dinâmico do contexto
- [x] REACT-1: Schedule.tsx — corrigir ordem de declaração (deleteAppointment antes do useEffect que o usa)
- [x] REACT-2: EventModal — usar staleTime:Infinity para reutilizar cache de appointments.list sem nova requisição
- [x] REACT-3: ClientProfile — remover estados órfãos (appointmentData, conflictCheck, createAppointment, handleCreateAppointment, appointmentDialogOpen)
- [x] 246 testes passando, 0 erros TypeScript após todas as correções

## Responsividade Completa (Mobile / Tablet / Desktop)
- [ ] DashboardLayout: sidebar colapsável em mobile com overlay e botão hambúrguer
- [ ] DashboardLayout: header mobile com logo, título e botão de menu
- [ ] Dashboard: cards de métricas em grid responsivo (1 col mobile, 2 tablet, 4 desktop)
- [ ] Clients: tabela → cards em mobile, filtros em coluna vertical
- [ ] Schedule: filtros colapsáveis em mobile, visão mensal adaptada
- [ ] ClientProfile: tabs scrolláveis horizontalmente em mobile, formulários em coluna única
- [ ] Reports: gráficos com altura responsiva, filtros empilhados em mobile
- [ ] Settings: tabs verticais → tabs horizontais em mobile
- [ ] CalendarPage: sidebar oculta em mobile com toggle, visão simplificada
- [ ] EventModal: formulário em coluna única em mobile, altura máxima com scroll
- [ ] GlobalSearch: modal full-screen em mobile
- [ ] index.css: tipografia fluida, espaçamentos responsivos, breakpoints profissionais

## Importação e Exportação de Contatos
- [x] Backend: endpoint exportar contatos CSV
- [x] Backend: endpoint exportar contatos Excel (.xlsx)
- [x] Backend: endpoint importar contatos CSV/Excel com mapeamento de colunas
- [x] Backend: endpoint limpar dados fictícios de teste
- [x] Frontend: página /contacts/import-export com upload, preview e mapeamento
- [x] Frontend: download de template CSV/Excel
- [x] Frontend: botão de limpeza de dados de teste com confirmação
- [x] Integrar link na sidebar e na página de Clientes

## Módulo POD Session — Execução Técnica da Tatuagem
- [x] Schema: tabela technical_procedures
- [x] Schema: tabela procedure_consumables
- [x] Schema: tabela procedure_images
- [x] Schema: tabela procedure_events
- [x] Router: procedures.ts com CRUD completo e segurança por studioId
- [x] Página: lista de procedimentos do cliente (aba Prontuário Técnico)
- [x] Página: formulário de novo procedimento com upload de imagem
- [x] Tela: POD Session com imagem central, zoom/pan, botões rápidos de insumos
- [x] Tela: timer de sessão (início, pausa, finalizar)
- [x] Tela: salvamento automático de lançamentos
- [x] Tela: resumo final com cálculo de custo e margem bruta
- [x] Integração: aba Prontuário Técnico no ClientProfile
- [x] Rotas registradas no App.tsx e sidebar

## Vinculação POD Session ↔ Agendamento
- [x] Schema: adicionar appointmentId (nullable, FK) na tabela technical_procedures
- [x] Backend: atualizar create/update do procedures router com appointmentId
- [x] Backend: endpoint getByAppointmentId para buscar sessão POD de um agendamento
- [x] Frontend NewProcedure: seletor de agendamento existente do cliente
- [x] Frontend NewProcedure: pré-preencher título/artista/serviço a partir do agendamento selecionado
- [x] Frontend PodSession: card do agendamento vinculado com link para a agenda
- [x] Frontend Schedule: badge POD nos agendamentos com sessão vinculada
- [x] Frontend Schedule: botão Abrir Sessão POD no modal de detalhes do agendamento

## Finalização Automática da Sessão POD
- [ ] Backend: endpoint procedures.finalize (fechar procedimento + concluir agendamento + registrar transação)
- [ ] Frontend: substituir botão Finalizar por fluxo com confirmação e resumo
- [ ] Frontend: exibir valor cobrado, insumos e margem antes de confirmar
- [ ] Frontend: feedback visual após finalização (toast + redirecionamento)

## Finalização Automática da Sessão POD
- [x] Backend: endpoint procedures.finalize atômico (fechar procedimento + concluir agendamento + registrar transação)
- [x] Frontend: modal de confirmação com resumo da sessão, valor cobrado, método de pagamento e observações
- [x] Frontend: feedback visual com mensagens de confirmação de cada operação realizada

## Sincronização Agenda ↔ Calendário Visual
- [x] Backend: enriquecer appointments.list com clientName via join de clientes
- [x] Frontend: calendário virtual "Agendamentos" na sidebar com toggle de visibilidade e contador
- [x] Frontend: agendamentos da Agenda exibidos no CalendarPage (semana, mês, dia) com cores por status
- [x] Frontend: ícone de Sessão POD nos eventos que têm procedimento vinculado
- [x] Frontend: modal de detalhes ao clicar em evento (cliente, data/hora, serviço, artista, status, notas)
- [x] Frontend: botão "Abrir POD" no modal quando há sessão vinculada
- [x] Frontend: botão "Ver Cliente" no modal com navegação para perfil

## Melhorias Pós-Entrega (Sprint 2)
- [x] Botão "Abrir Sessão POD" no modal de detalhes da Agenda (navega direto para PodSession quando há vinculação)
- [x] Relatório de insumos por artista/período na página Relatórios (custo, receita, margem bruta, breakdown por categoria)
- [x] Notificação automática ao finalizar sessão POD (notifyOwner com duração, valor, artista e método de pagamento)

## Duplo Clique no Calendário Visual para Novo Agendamento
- [x] Frontend: duplo clique em slot vazio (semana/dia) abre EventModal pré-preenchido com data e hora
- [x] Frontend: duplo clique em slot vazio (mês) abre EventModal pré-preenchido com a data do dia
- [x] Frontend: duplo clique em evento existente abre EventModal em modo edição completa
- [x] Frontend: botão "Novo Agendamento" adicionado na toolbar do CalendarPage
- [x] Frontend: clique simples em evento abre modal de detalhes (comportamento anterior preservado)
- [x] Backend: corrigir ordenação de getAnamnesisByClientId para desc(id) (mais confiável em testes)
- [x] Testes: 246 passando, 7 skipped, 0 falhas

## Filtro por Artista no Calendário Visual
- [x] Frontend: seção "Artistas" na sidebar do Calendário Visual com toggles individuais por artista
- [x] Frontend: artistas combinados da lista cadastrada + nomes únicos dos agendamentos (ordenados A-Z)
- [x] Frontend: cada artista tem cor distinta (paleta Apple Calendar) e contador de agendamentos
- [x] Frontend: botão "ocultar/mostrar" para alternar todos os artistas de uma vez
- [x] Frontend: filtro aplicado em tempo real nos eventos de todas as visões (semana, mês, dia)
- [x] Testes: 246 passando, 0 falhas

## Widget de Insumos no Dashboard
- [x] Backend: endpoint procedures.consumableSummary com dados do mês atual e mês anterior
- [x] Backend: cálculo de custo total, receita total, sessões e margem bruta média por mês
- [x] Backend: variação percentual de custo e margem em relação ao mês anterior
- [x] Frontend: componente ConsumableWidget com custo total em laranja e margem bruta em verde
- [x] Frontend: badge de variação com seta (↑ vermelho = custo subiu, ↓ verde = custo caiu)
- [x] Frontend: badge de % margem bruta com cor contextual (verde ≥60%, amarelo ≥30%, vermelho <30%)
- [x] Frontend: clique no widget navega para a página de Relatórios
- [x] Dashboard: grid de 4 colunas com WeeklyAppointments, Reminders, LowStock e ConsumableWidget
- [x] Testes: 246 passando, 0 falhas

## Cor Personalizada por Artista
- [x] Schema: campo `color` (varchar 7) adicionado na tabela `artists`, migração aplicada
- [x] Backend: campo `color` aceito nos endpoints `artists.create` e `artists.update`
- [x] Frontend: seletor de cor na página Artistas com paleta de 20 cores pré-definidas
- [x] Frontend: input hex manual com validação e preview em tempo real
- [x] Frontend: botão para limpar cor (volta para automática)
- [x] Frontend: coluna "Cor no Calendário" na tabela de artistas com dot colorido + código hex
- [x] Frontend: avatar do artista usa a cor personalizada (borda + inicial colorida)
- [x] Calendário Visual: `artistColorMap` mapeando nome → cor do banco de dados
- [x] Calendário Visual: `getArtistColor()` com fallback para paleta automática por índice
- [x] Calendário Visual: `getAppointmentColor()` prioriza cor do artista > calendário > status
- [x] Calendário Visual: toggles da sidebar usam cor personalizada do artista
- [x] Testes: 246 passando, 0 falhas TypeScript

## Correção Cirúrgica: Campo de Cliente no EventModal
- [x] Proteger query de clientes contra retorno inválido (undefined/null)
- [x] Adicionar estados isLoading/error no campo de seleção de cliente
- [x] Adicionar busca por nome e telefone dentro do Select de clientes
- [x] Mensagens visuais: "Carregando...", "Erro", "Nenhum cliente encontrado"

## Cadastro Rápido de Cliente no EventModal
- [x] Botão "Novo Cliente" visível quando busca não encontra resultados
- [x] Mini-formulário inline (nome, telefone, e-mail) sem abrir nova página
- [x] Após salvar, novo cliente é selecionado automaticamente no campo clientId
- [x] Invalidar cache de clientes após cadastro

## Correção de Bugs (Sprint 3)
- [x] Corrigir salvamento da ficha de anamnese quando cliente confirma os dados
- [x] Corrigir máscara de data de nascimento (substitui "1"/"2" por "0")
- [x] Garantir formato DD/MM/AAAA correto na data de nascimento

## Correções Estruturais (Qualidade de Dados)
- [x] Adicionar artistId (FK opcional) em appointments e migrar o banco
- [x] Preencher artistId automaticamente ao criar/editar agendamentos via lookup por nome
- [x] Documentar unidades monetárias (centavos vs reais) no código
- [x] Corrigir consumableSummary: chargedAmount centavos → reais antes de calcular margem
- [x] Corrigir consumableReport: mesma conversão de unidades (chargedAmount / 100)
## Correção de Texto Invisível nas Abas (ClientProfile)
- [x] Corrigir texto invisível em todas as abas do ClientProfile (Agendamentos, Anamnese, Financeiro, Galeria, Notas, POD)
- [x] Causa: TabsTrigger usava dark:text-muted-foreground + data-[state=active]:bg-background (light) causando texto branco sobre fundo branco no dark mode
- [x] Solução: Simplificar classes do TabsTrigger para text-muted-foreground + data-[state=active]:bg-card + data-[state=active]:text-foreground (sem prefixos dark: conflitantes)
- [x] Corrigir span da aba POD: hidden sm:inline flex → hidden sm:inline-flex (espaço causava classe inválida)
- [x] Correção aplicada em tabs.tsx (componente compartilhado) — beneficia todas as páginas com Tabs (Settings, Stock, ComponentShowcase)
- [x] Testes: 246 passando, 0 erros TypeScript

## Correções do PDF (Jun 2026)
- [x] Adicionar campo "Tipo de Procedimento" (procedureType) no schema de appointments
- [x] Adicionar campo statusRequest no schema de anamneseRequests
- [x] Rodar db:push (migration 0038) para aplicar novos campos no banco
- [x] Atualizar router create/update de appointments para aceitar procedureType e procedureTypeOther
- [x] Adicionar campo "Tipo de Procedimento" no EventModal com Select + campo livre para "outro"
- [x] Melhorar aba Anamnese do ClientProfile: exibir fichas pendentes, preenchidas e expiradas com status visual
- [x] Corrigir CSS global das abas (text-white !important via data-slot selector)
- [x] Adicionar @media print para corrigir layout cortado no PDF/Safari

## Melhorias de Agendamento (Jun 2026)
- [ ] Sinal confirmado auto-seleciona sinal pago no EventModal
- [ ] Lembretes com múltiplas mensagens (3 ou 4 opções selecionáveis)
- [ ] Duração da sessão em blocos de 30 minutos (7:00, 7:30, 8:00...)
- [ ] Arrastar agendamento no CalendárioVisual para mudar horário

## Central de Mensagens / WhatsApp Automático

- [ ] Schema: tabelas whatsappIntegration, messageQueue, messageTemplates
- [ ] Migração db:push
- [ ] Estrutura modular server/messaging/providers/
- [ ] Provedor BotConversa (sendMessage, testConnection)
- [ ] Provedor Z-API (sendMessage, testConnection)
- [ ] Provedor WhatsApp Meta Business API (sendMessage, testConnection)
- [ ] Endpoint webhook /api/webhook/whatsapp para receber respostas
- [ ] Lógica de atualização automática de status do agendamento via webhook
- [ ] Procedures tRPC: getIntegration, saveIntegration, testConnection, sendMessage, getQueue, getTemplates, saveTemplate
- [ ] UI: aba "Central de Mensagens" nas Configurações
- [ ] UI: seletor de provedor (BotConversa / Z-API / Meta)
- [ ] UI: campos de configuração por provedor (API key, número, webhook)
- [ ] UI: botão testar conexão com feedback visual
- [ ] UI: histórico de mensagens enviadas com status
- [ ] UI: editor de templates com variáveis
- [ ] Integração: envio automático ao criar agendamento
- [ ] Integração: envio automático ao confirmar agendamento
- [ ] Integração: envio de lembrete automático (24h antes)
- [ ] Integração: notificação ao tatuador responsável

## Central de Mensagens / WhatsApp Automático
- [x] Schema: tabelas whatsAppIntegrations, messageTemplates, messageLog
- [x] Provedores modulares: BotConversa, Z-API, WhatsApp Meta Business API
- [x] Endpoint webhook /api/webhook/whatsapp para respostas dos clientes
- [x] Router tRPC messaging: configuração, envio, templates, histórico, fila
- [x] Página Central de Mensagens com seletor de provedor, templates e histórico
- [x] Item no sidebar: Central de Mensagens
- [x] Disparo automático ao criar agendamento (appointment_created)


## Refatoração da Tela Agenda — Estilo iCloud
- [x] Reescrever Schedule.tsx com layout flex (sidebar + área principal)
- [x] Adicionar sidebar fixa com mini calendário + lista de artistas com bolinhas coloridas e toggle
- [x] Adicionar visão Dia (grade de horários para 1 dia)
- [x] Adicionar visão Ano (grid 3x4 de 12 mini meses com pontos coloridos)
- [x] Adicionar cores por artista nos eventos (artistColorMap + COLOR_PALETTE Apple)
- [x] Refatorar barra superior: Hoje funcional + setas + título dinâmico + botões Dia/Semana/Mês/Ano
- [x] Reposicionar filtros em painel recolhível (accordion)
- [x] Responsividade: sidebar recolhe em mobile
- [x] Preservar drag-and-drop, EventModal, edição, deleção, atalhos de teclado

## Notificações Visuais de Sincronização Google Sheets

- [x] Atualizar googleSheetsSync.ts para retornar Promise com resultado (sucesso/falha)
- [x] Criar procedure tRPC `system.checkSync` que executa sync e retorna status
- [x] Integrar toast de sucesso/erro nas mutações de clientes (create/update)
- [x] Integrar toast de sucesso/erro nas mutações de agendamentos (create/update)
- [x] Integrar toast de sucesso/erro nas mutações de anamnese (submitAnamnese/updateSubmission)
- [x] Integrar toast de sucesso/erro nas mutações de estoque (createMaterial/updateMaterial/addMovement)
- [x] Verificar TypeScript sem erros após integrações

## Auditoria e Correção de Responsividade Mobile (Jul 2026)
- [x] Melhorar Schedule.tsx: sidebar mobile com overlay, toggle visível em mobile, botões abreviados (D/S/M/A)
- [x] Melhorar NewClient.tsx: header responsivo, grids com sm:grid-cols-2, nome completo em col-span-2, botões de ação em flex-col-reverse
- [x] Melhorar Stock.tsx: header responsivo com ícone flex-shrink-0, filtros flex-col em mobile, tabela com colunas ocultas (hidden sm:, hidden md:, hidden lg:)
- [x] Melhorar Stock.tsx: ícones menores em mobile (w-3 h-3), botões de ação com h-8 w-8, gap-0.5
- [x] Melhorar EventModal.tsx: tabs com rótulos abreviados em mobile (Lem./Comp.), campos de data/hora em grid-cols-1 sm:grid-cols-2, valores em grid-cols-1 sm:grid-cols-2
- [x] Melhorar PublicAnamnese.tsx: botões em flex-col-reverse em mobile, botão enviar w-full em mobile, ícones menores (h-3 w-3)
- [x] Melhorar ClientProfile.tsx: TabsList com overflow-x-auto, tabs abreviados em mobile, headers em flex-col sm:flex-row, botões w-full sm:w-auto, grids grid-cols-1 sm:grid-cols-2, área de drop p-6 sm:p-12
- [x] Melhorar Settings.tsx: header text-2xl sm:text-3xl, TabsList grid-cols-2 sm:grid-cols-4, tabs com rótulos abreviados (Info/Vis./Art./Not.), grids grid-cols-1 sm:grid-cols-2
- [x] Melhorar Notifications.tsx: header flex-col sm:flex-row, botão w-full sm:w-auto com texto abreviado, grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
- [x] Melhorar RiskAlerts.tsx: header text-2xl sm:text-3xl, grid grid-cols-2 lg:grid-cols-4
- [x] Melhorar Artists.tsx: header flex-col sm:flex-row, botão w-full sm:w-auto, tabela com colunas ocultas (Especialidade hidden sm:, Cor hidden md:, Contato hidden lg:), ícones menores
- [x] Melhorar PodSession.tsx: header com padding/gap responsivos, botões h-8 w-8 em mobile, texto text-xs sm:text-sm, badge com max-w-[120px] sm:max-w-[160px]
- [x] Melhorar MessagingCenter.tsx: TabsList h-auto sm:h-12 com flex-wrap, tabs com rótulos abreviados (Prov./Temp./Hist.), header flex-col sm:flex-row, botão w-full sm:w-auto
- [x] Melhorar CollaboratorReports.tsx: header flex-col sm:flex-row, badge com texto abreviado (Admin), controles de período com overflow-x-auto, botões h-8 w-8 sm:h-10 sm:w-10, grid grid-cols-2 lg:grid-cols-4
- [x] Melhorar Users.tsx: header flex-col sm:flex-row, botão w-full sm:w-auto, filtros flex-col sm:flex-row com gap-2 sm:gap-4, tabela com colunas ocultas (Email hidden sm:, Artista hidden md:), overflow-x-auto
- [x] Melhorar Suppliers.tsx: header flex-col sm:flex-row, botão w-full sm:w-auto com texto abreviado, TabsList w-full sm:w-auto, tabs com rótulos abreviados (Forn./Ped.), grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
- [x] Verificar Reports.tsx e Dashboard.tsx: já estão bem responsivos
- [x] Validação: 0 erros TypeScript, 256 testes passando


## Implementação de Baixa Rápida de Insumos (Quick Material Consumption)
- [x] Criar endpoint tRPC para registrar consumo rápido de insumos (quickConsume mutation)
- [x] Implementar UI de quick shortcuts na POD Session (handleQuickConsume)
- [x] Adicionar funcionalidade de undo para consumos recentes (estrutura pronta)
- [x] Validar créditos (< 100 créditos) - implementação mínima
- [x] Testar fluxo completo de consumo rápido (3 testes passando)
- [x] Integrar quickConsume mutation no PodSession.tsx
- [ ] Implementar UI visual para quick consume buttons (próxima fase)
- [ ] Adicionar histórico de consumos para undo (próxima fase)


## Animações de Carregamento Suave (Loading Skeletons)
- [x] Criar componente SkeletonCard reutilizável
- [x] Criar componente SkeletonTable para tabelas
- [x] Criar componente SkeletonText para textos
- [x] Implementar animação de pulso com Tailwind CSS
- [x] Integrar skeletons no Dashboard
- [x] Integrar skeletons no Schedule
- [x] Integrar skeletons no ClientProfile
- [x] Integrar skeletons no Stock
- [x] Integrar skeletons no PodSession
- [x] Testar animações em diferentes resoluções
- [x] Validar performance das animações (259 testes passando)


## Kits de Procedimento — Estoque e POD Session
- [x] Criar modelo persistente para kits e itens do kit sem alterar tabelas existentes
- [x] Implementar CRUD tRPC de kits com validação e controle de acesso
- [x] Implementar aplicação atômica de kit na POD Session preservando quickConsume individual
- [x] Integrar gerenciamento de kits no módulo de Estoque
- [x] Integrar seletor de kits na POD Session
- [x] Adicionar testes unitários e de integração para kits
- [x] Validar build, testes e ausência de regressões
- [ ] Salvar checkpoint da melhoria de Kits de Procedimento

> Histórico: melhoria funcional solicitada a partir do relatório de auditoria; escopo incremental e não destrutivo.
