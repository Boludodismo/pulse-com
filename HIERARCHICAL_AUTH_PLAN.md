# Plano de Implementação - Autenticação Hierárquica

## Estrutura de Permissões

### 1. SUPER ADMIN (Sistema)
- `role = "superadmin"`
- `studioId = NULL`
- Acesso global a TODOS os estúdios
- Acesso a TODOS os colaboradores de todos os estúdios
- Acesso a TODOS os clientes, agendas e dados
- Permissão de leitura total para análise de performance

### 2. ADMIN DO ESTÚDIO
- `role = "admin"`
- `studioId = <id_do_estudio>`
- Cadastro via CHAVE MESTRE
- Acesso total APENAS aos dados do próprio estúdio
- Pode criar, editar e remover colaboradores do estúdio
- Pode visualizar agendas individuais e gerais do estúdio

### 3. COLABORADOR (Tatuador)
- `role = "collaborator"`
- `studioId = <id_do_estudio>`
- `artistId = <id_do_artista>`
- Subcadastro feito pelo admin do estúdio
- Acesso apenas à própria agenda
- Acesso apenas aos próprios clientes
- Não pode ver dados de outros colaboradores

## Alterações no Schema

### 1. Nova tabela `studios`
```typescript
export const studios = mysqlTable("studios", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  masterKey: varchar("masterKey", { length: 64 }).notNull().unique(), // Chave mestre para cadastro
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

### 2. Atualizar tabela `users`
- Adicionar campo `studioId: int("studioId")` (NULL para superadmin)
- Alterar enum `role` para `["superadmin", "admin", "collaborator"]`
- Manter campo `artistId` para vincular colaborador ao artista

### 3. Atualizar tabelas existentes
- `clients`: adicionar `studioId: int("studioId").notNull()`
- `appointments`: adicionar `studioId: int("studioId").notNull()`
- `transactions`: adicionar `studioId: int("studioId").notNull()`
- `artists`: adicionar `studioId: int("studioId").notNull()`
- `anamnesisRecords`: adicionar `studioId: int("studioId").notNull()` (via clientId)
- `clientNotes`: adicionar `studioId: int("studioId").notNull()` (via clientId)
- `galleryImages`: adicionar `studioId: int("studioId").notNull()` (via clientId)
- `auditLogs`: adicionar `studioId: int("studioId")` (NULL para ações globais)

## Middlewares de Permissões

### 1. `superAdminProcedure`
- Verifica se `ctx.user.role === "superadmin"`
- Permite acesso total sem filtros

### 2. `adminProcedure`
- Verifica se `ctx.user.role === "admin"`
- Injeta `ctx.studioId` no contexto
- Filtra automaticamente por `studioId`

### 3. `collaboratorProcedure`
- Verifica se `ctx.user.role === "collaborator"`
- Injeta `ctx.studioId` e `ctx.artistId` no contexto
- Filtra automaticamente por `studioId` e `artistId`

### 4. `protectedProcedure` (atualizado)
- Aceita qualquer usuário autenticado
- Injeta `ctx.user`, `ctx.studioId`, `ctx.artistId` conforme role

## Endpoints Novos

### 1. `auth.registerStudio`
- Input: `{ masterKey, name, email, phone, address, adminName, adminEmail }`
- Valida chave mestre
- Cria estúdio
- Cria usuário admin vinculado ao estúdio
- Retorna credenciais de acesso

### 2. `studios.list` (superadmin only)
- Lista todos os estúdios cadastrados

### 3. `studios.getById` (superadmin only)
- Detalhes de um estúdio específico

### 4. `studios.update` (superadmin ou admin do estúdio)
- Atualiza dados do estúdio

### 5. `collaborators.create` (admin only)
- Cria novo colaborador vinculado ao estúdio
- Vincula a um artista existente

### 6. `collaborators.list` (admin only)
- Lista colaboradores do estúdio

## Regras de Filtragem Automática

### SUPER ADMIN
- Sem filtros
- Acesso total a todos os dados

### ADMIN DO ESTÚDIO
- Todos os endpoints filtram por `studioId = ctx.user.studioId`
- Pode ver todos os clientes, agendamentos, transações do estúdio
- Pode ver todos os colaboradores do estúdio

### COLABORADOR
- Todos os endpoints filtram por `studioId = ctx.user.studioId` E `artistId = ctx.user.artistId`
- Pode ver apenas seus próprios clientes
- Pode ver apenas seus próprios agendamentos
- Pode ver apenas suas próprias transações
- Não pode acessar configurações
- Não pode acessar relatórios globais

## Fluxo de Cadastro

### 1. Cadastro de Estúdio (via chave mestre)
1. Usuário acessa `/register-studio`
2. Informa chave mestre + dados do estúdio + dados do admin
3. Sistema valida chave mestre
4. Sistema cria estúdio
5. Sistema cria usuário admin vinculado ao estúdio
6. Sistema redireciona para login

### 2. Cadastro de Colaborador (pelo admin)
1. Admin acessa `/users` (página de gerenciamento)
2. Clica em "Novo Colaborador"
3. Preenche dados + seleciona artista
4. Sistema cria usuário com `role = "collaborator"`, `studioId` do admin, `artistId` selecionado
5. Colaborador recebe credenciais de acesso

## Adaptações no Frontend

### 1. Menu lateral (DashboardLayout)
- SUPER ADMIN: vê tudo + item "Estúdios"
- ADMIN: vê tudo exceto "Estúdios"
- COLABORADOR: vê apenas Dashboard, Clientes, Agenda, Calendário Visual

### 2. Páginas de listagem
- Adicionar indicador visual do estúdio atual (para superadmin)
- Adicionar filtro de estúdio (apenas para superadmin)

### 3. Formulários
- Remover seleção de artista para colaboradores (usar artistId do usuário logado)
- Adicionar seleção de estúdio apenas para superadmin

## Migração de Dados Existentes

1. Criar estúdio padrão "Estúdio Principal"
2. Vincular todos os usuários existentes ao estúdio padrão
3. Vincular todos os clientes, agendamentos, transações ao estúdio padrão
4. Definir primeiro usuário como superadmin
5. Definir demais usuários como admin ou collaborator conforme role atual

## Checklist de Implementação

- [ ] Criar tabela `studios`
- [ ] Atualizar tabela `users` (studioId, role enum)
- [ ] Atualizar todas as tabelas com studioId
- [ ] Executar migration
- [ ] Criar middlewares de permissões
- [ ] Atualizar todos os endpoints com filtros
- [ ] Criar endpoints de cadastro de estúdio
- [ ] Criar endpoints de gerenciamento de colaboradores
- [ ] Criar página de cadastro de estúdio
- [ ] Adaptar menu lateral conforme role
- [ ] Adaptar páginas de listagem
- [ ] Adaptar formulários
- [ ] Executar migração de dados existentes
- [ ] Testar com múltiplos estúdios
- [ ] Testar isolamento de dados
- [ ] Testar permissões de cada role
