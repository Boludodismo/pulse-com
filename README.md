# 🎨 Tattoo Studio CRM - Sistema de Gestão para Estúdios de Tatuagem

Sistema completo de gestão para estúdios de tatuagem com autenticação hierárquica, isolamento de dados entre estúdios e funcionalidades completas de CRM.

---

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Banco de Dados](#banco-de-dados)
- [Testes](#testes)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)

---

## 🎯 Sobre o Projeto

Sistema de CRM desenvolvido especificamente para estúdios de tatuagem, oferecendo gestão completa de clientes, agendamentos, colaboradores e relatórios. O sistema implementa autenticação hierárquica com 3 níveis de acesso e isolamento total de dados entre estúdios.

### **Níveis Hierárquicos:**

1. **SUPERADMIN**: Acesso global a todos os estúdios
2. **ADMIN**: Acesso total ao próprio estúdio
3. **COLLABORATOR**: Acesso restrito aos próprios clientes

---

## 🛠️ Tecnologias Utilizadas

### **Frontend**
- **React 19** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **TailwindCSS 4** - Framework CSS
- **shadcn/ui** - Componentes UI
- **Wouter** - Roteamento
- **tRPC Client** - Cliente type-safe para API
- **React Query** - Gerenciamento de estado servidor

### **Backend**
- **Node.js 22** - Runtime JavaScript
- **Express 4** - Framework web
- **tRPC 11** - API type-safe
- **Drizzle ORM** - ORM TypeScript-first
- **MySQL/TiDB** - Banco de dados
- **SuperJSON** - Serialização de dados
- **Vitest** - Framework de testes

### **Autenticação**
- **Manus OAuth** - Sistema de autenticação OAuth
- **JWT** - Tokens de sessão

### **Infraestrutura**
- **Docker** - Containerização
- **pnpm** - Gerenciador de pacotes
- **ESLint** - Linter
- **TypeScript** - Type checking

---

## 📁 Estrutura do Projeto

```
tattoo_crm/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/       # Componentes React reutilizáveis
│   │   │   ├── ui/          # Componentes base (shadcn/ui)
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── GlobalSearch.tsx
│   │   │   └── ...
│   │   ├── pages/           # Páginas da aplicação
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── Schedule.tsx
│   │   │   └── ...
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   ├── lib/            # Utilitários e configurações
│   │   │   ├── trpc.ts     # Cliente tRPC
│   │   │   └── utils.ts
│   │   ├── App.tsx         # Componente raiz
│   │   ├── main.tsx        # Entry point
│   │   └── index.css       # Estilos globais
│   ├── public/             # Arquivos estáticos
│   └── index.html          # HTML base
│
├── server/                   # Backend Node.js
│   ├── _core/              # Núcleo do sistema
│   │   ├── trpc.ts         # Configuração tRPC
│   │   ├── context.ts      # Context builder
│   │   ├── oauth.ts        # Autenticação OAuth
│   │   ├── env.ts          # Variáveis de ambiente
│   │   ├── llm.ts          # Integração LLM
│   │   ├── notification.ts # Sistema de notificações
│   │   └── ...
│   ├── routers.ts          # Rotas tRPC principais
│   ├── db.ts               # Queries e helpers do banco
│   ├── storage.ts          # Integração S3
│   └── *.test.ts           # Testes unitários
│
├── drizzle/                 # Migrations e schema do banco
│   ├── schema.ts           # Schema TypeScript
│   ├── relations.ts        # Relacionamentos
│   ├── meta/               # Metadata das migrations
│   └── *.sql               # Arquivos de migration
│
├── shared/                  # Código compartilhado
│   ├── const.ts            # Constantes
│   ├── types.ts            # Tipos TypeScript
│   └── _core/              # Utilitários compartilhados
│
├── database/                # Schema SQL exportado
│   └── schema.sql          # DDL completo do banco
│
├── package.json            # Dependências raiz
├── vite.config.ts          # Configuração Vite
├── drizzle.config.ts       # Configuração Drizzle ORM
├── tsconfig.json           # Configuração TypeScript
├── vitest.config.ts        # Configuração Vitest
├── .env.example            # Exemplo de variáveis de ambiente
├── .gitignore              # Arquivos ignorados pelo Git
└── README.md               # Este arquivo
```

---

## ✅ Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0 (ou npm/yarn)
- **MySQL** >= 8.0 ou **TiDB** (compatível com MySQL)
- **Git** (para versionamento)

### **Instalação do pnpm (se necessário):**

```bash
npm install -g pnpm
```

---

## 🚀 Instalação

### **1. Clone o repositório**

```bash
git clone <url-do-repositorio>
cd tattoo_crm
```

### **2. Instale as dependências**

```bash
# Instalar dependências raiz e de todos os workspaces
pnpm install
```

Isso instalará as dependências do frontend, backend e raiz do projeto.

---

## ⚙️ Configuração

### **1. Configure as variáveis de ambiente**

Copie o arquivo `.env.example` para `.env` na raiz do projeto:

```bash
cp .env.example .env
```

### **2. Edite o arquivo `.env`**

Abra o arquivo `.env` e configure as variáveis necessárias:

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/tattoo_crm

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# OAuth (Manus)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
VITE_APP_ID=your-app-id

# Owner Info
OWNER_OPEN_ID=your-owner-openid
OWNER_NAME=Your Name

# Manus Built-in APIs
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im

# Analytics (optional)
VITE_ANALYTICS_ENDPOINT=https://analytics.example.com
VITE_ANALYTICS_WEBSITE_ID=your-website-id

# App Config
VITE_APP_TITLE=POD CRM - Estúdios de Tatuagem
VITE_APP_LOGO=/logo.png
```

### **3. Configure o banco de dados**

#### **Opção A: Usando MySQL local**

```bash
# Crie o banco de dados
mysql -u root -p
CREATE DATABASE tattoo_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

#### **Opção B: Usando Docker**

```bash
docker-compose up -d mysql
```

### **4. Aplique o schema no banco**

```bash
# Opção 1: Usando Drizzle (recomendado)
pnpm db:push

# Opção 2: Importando SQL diretamente
mysql -u root -p tattoo_crm < database/schema.sql
```

### **5. (Opcional) Popule com dados de teste**

```bash
# Execute o script de seed (se disponível)
node scripts/seed.mjs
```

---

## 🏃 Executando o Projeto

### **Modo Desenvolvimento**

#### **Opção 1: Rodar tudo junto (recomendado)**

```bash
# Na raiz do projeto
pnpm dev
```

Isso iniciará:
- Frontend em `http://localhost:5173`
- Backend em `http://localhost:3000`

#### **Opção 2: Rodar separadamente**

**Terminal 1 - Backend:**
```bash
pnpm dev:server
```

**Terminal 2 - Frontend:**
```bash
pnpm dev:client
```

### **Modo Produção**

```bash
# Build do projeto
pnpm build

# Iniciar servidor de produção
pnpm start
```

### **Acessando a aplicação**

- **Frontend**: http://localhost:5173 (dev) ou http://localhost:3000 (prod)
- **Backend API**: http://localhost:3000/api/trpc

---

## 🎯 Funcionalidades

### **1. Dashboard**
- Visão geral do estúdio
- Métricas principais (clientes, agendamentos, receita)
- Top 5 clientes
- Aniversariantes do mês

### **2. Gestão de Clientes**
- CRUD completo de clientes
- Sistema de fidelidade (Bronze, Prata, Ouro, Platina, Diamante)
- Histórico de atendimentos
- Busca e filtros avançados
- Vinculação com artista responsável

### **3. Agenda**
- Gerenciamento de agendamentos (lista)
- Filtros por status, artista, período
- Criação, edição e exclusão de agendamentos
- Indicadores de status (agendado, confirmado, concluído, cancelado)

### **4. Calendário Visual**
- Visualização mensal de agendamentos
- Navegação entre meses
- Modal com detalhes do agendamento
- Cores por status

### **5. Relatórios**
- Relatórios financeiros
- Relatórios de agendamentos
- Relatórios de clientes
- Gráficos de performance
- Exportação para PDF

### **6. Notificações**
- Sistema de notificações em tempo real
- Alertas de aniversários
- Lembretes de agendamentos
- Notificações de sistema

### **7. Alertas de Risco**
- Sistema baseado em fichas de anamnese
- Níveis de risco (Baixo, Médio, Alto, Crítico)
- Dashboard de alertas
- Filtros por nível de risco

### **8. Gestão de Usuários**
- CRUD de usuários
- Controle de permissões (superadmin/admin/collaborator)
- Vinculação de colaborador com artista
- Ativação/desativação de usuários

### **9. Auditoria**
- Log completo de ações no sistema
- Filtros por usuário, ação, entidade
- Exportação de logs
- Dashboard de auditoria

### **10. Configurações**
- Configurações do estúdio
- Preferências do sistema
- Integrações

---

## 🏗️ Arquitetura

### **Frontend (React + Vite)**

O frontend é uma SPA (Single Page Application) construída com React 19 e Vite. Utiliza tRPC para comunicação type-safe com o backend.

**Fluxo de dados:**
```
User → React Component → tRPC Hook → tRPC Client → Backend API
```

**Principais bibliotecas:**
- **React Query**: Cache e sincronização de dados do servidor
- **Wouter**: Roteamento client-side
- **TailwindCSS**: Estilização
- **shadcn/ui**: Componentes UI prontos

### **Backend (Node.js + Express + tRPC)**

O backend é uma API REST/tRPC construída com Node.js e Express. Utiliza Drizzle ORM para acesso ao banco de dados.

**Fluxo de requisição:**
```
HTTP Request → Express Middleware → tRPC Router → Procedure → DB Query → Response
```

**Principais componentes:**
- **tRPC Routers**: Definição de endpoints type-safe
- **Middlewares**: Autenticação, autorização, logging
- **Drizzle ORM**: Acesso type-safe ao banco de dados
- **Context**: Injeção de dependências (user, db, etc.)

### **Autenticação**

O sistema utiliza OAuth 2.0 da Manus para autenticação:

1. Usuário clica em "Sign in"
2. Redirecionado para portal OAuth da Manus
3. Após autenticação, retorna com código de autorização
4. Backend troca código por token JWT
5. Token armazenado em cookie httpOnly
6. Cada requisição valida o token e injeta usuário no context

### **Isolamento de Dados**

Cada estúdio possui um `studioId` único. Todas as queries filtram automaticamente por `studioId` baseado no usuário logado:

- **SUPERADMIN**: Sem filtro (vê todos os estúdios)
- **ADMIN**: Filtra por `studioId` do usuário
- **COLLABORATOR**: Filtra por `studioId` + `artistId` do usuário

---

## 🗄️ Banco de Dados

### **Schema**

O banco de dados utiliza MySQL 8+ com as seguintes tabelas principais:

- **studios**: Estúdios cadastrados
- **users**: Usuários do sistema
- **clients**: Clientes dos estúdios
- **artists**: Artistas/tatuadores
- **appointments**: Agendamentos
- **transactions**: Transações financeiras
- **auditLogs**: Logs de auditoria
- **anamnesisRecords**: Fichas de anamnese
- **notifications**: Notificações do sistema

### **Relacionamentos**

```
studios 1:N users
studios 1:N clients
studios 1:N artists
studios 1:N appointments

users N:1 studios
users N:1 artists (opcional, para collaborators)

clients N:1 studios
clients N:1 artists (opcional)

appointments N:1 studios
appointments N:1 clients

transactions N:1 studios
transactions N:1 clients
```

### **Migrations**

O projeto utiliza Drizzle Kit para gerenciar migrations:

```bash
# Gerar nova migration
pnpm db:generate

# Aplicar migrations
pnpm db:push

# Ver status das migrations
pnpm db:check
```

### **Schema SQL Completo**

O schema completo está disponível em `database/schema.sql` e pode ser importado diretamente no MySQL.

---

## 🧪 Testes

O projeto utiliza Vitest para testes unitários e de integração.

### **Executar testes**

```bash
# Rodar todos os testes
pnpm test

# Rodar testes em modo watch
pnpm test:watch

# Rodar testes com coverage
pnpm test:coverage

# Rodar teste específico
pnpm test server/auth.logout.test.ts
```

### **Estrutura de testes**

Os testes estão localizados junto aos arquivos que testam:

```
server/
├── routers.ts
├── auth.logout.test.ts
├── clients.test.ts
├── audit.test.ts
└── ...
```

### **Exemplo de teste**

```typescript
import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';

describe('Auth', () => {
  it('should logout user', async () => {
    const caller = appRouter.createCaller(mockContext);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
```

---

## 🚢 Deploy

### **Deploy com Docker**

```bash
# Build da imagem
docker build -t tattoo-crm .

# Rodar container
docker run -p 3000:3000 --env-file .env tattoo-crm
```

### **Deploy com Docker Compose**

```bash
# Subir todos os serviços (app + mysql)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

### **Deploy em Cloud**

O projeto pode ser deployado em:

- **Vercel** (frontend estático + serverless functions)
- **Railway** (fullstack com banco de dados)
- **Google Cloud Run** (containers)
- **AWS ECS** (containers)
- **DigitalOcean App Platform**

### **Variáveis de Ambiente em Produção**

Certifique-se de configurar todas as variáveis do `.env.example` no ambiente de produção.

---

## 🤝 Contribuindo

### **Fluxo de Contribuição**

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### **Padrões de Código**

- **TypeScript**: Sempre tipar variáveis e funções
- **ESLint**: Seguir regras do `.eslintrc`
- **Commits**: Usar conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Testes**: Adicionar testes para novas funcionalidades

### **Estrutura de Commits**

```
feat: adiciona nova funcionalidade X
fix: corrige bug Y
docs: atualiza documentação Z
refactor: refatora código W
test: adiciona testes para V
chore: atualiza dependências
```

---

## 📝 Scripts Disponíveis

```json
{
  "dev": "Inicia dev server (frontend + backend)",
  "dev:client": "Inicia apenas frontend",
  "dev:server": "Inicia apenas backend",
  "build": "Build de produção",
  "start": "Inicia servidor de produção",
  "test": "Executa testes",
  "test:watch": "Executa testes em modo watch",
  "test:coverage": "Executa testes com coverage",
  "db:push": "Aplica schema no banco",
  "db:generate": "Gera nova migration",
  "db:check": "Verifica status das migrations",
  "lint": "Executa linter",
  "type-check": "Verifica tipos TypeScript"
}
```

---

## 📄 Licença

Este projeto é proprietário e confidencial. Todos os direitos reservados.

---

## 👥 Autores

- **Willian A Cunha** - Proprietário e desenvolvedor principal

---

## 📞 Suporte

Para suporte, entre em contato através de:
- Email: [seu-email@exemplo.com]
- Issues: [GitHub Issues]

---

## 🔄 Changelog

### **v1.0.0** (2026-01-13)
- ✅ Sistema de autenticação hierárquica implementado
- ✅ Isolamento de dados entre estúdios validado
- ✅ 10 funcionalidades principais operacionais
- ✅ Testes unitários implementados
- ✅ Documentação completa

---

## 🎯 Roadmap

- [ ] Sistema de cadastro de novos estúdios
- [ ] Página de registro público
- [ ] Redesign visual (preto + dourado)
- [ ] Integração com WhatsApp
- [ ] App mobile (React Native)
- [ ] Sistema de pagamentos (Stripe)
- [ ] Relatórios avançados com BI

---

**Desenvolvido com ❤️ para estúdios de tatuagem**
