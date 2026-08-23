# 📦 Guia de Exportação - Tattoo Studio CRM

Este documento contém instruções para exportar e usar o projeto fora do ambiente Manus.

---

## ✅ O Que Foi Entregue

### **1. Documentação Completa**
- ✅ `README.md` - Documentação completa do projeto
- ✅ `.env.example` - Template de variáveis de ambiente
- ✅ `.gitignore` - Arquivos a ignorar no Git
- ✅ `GUIA_DE_TESTES.md` - Guia para testes do sistema
- ✅ `PROJECT_STRUCTURE.txt` - Árvore completa do projeto

### **2. Schema do Banco de Dados**
- ✅ `database/schema.sql` - DDL completo com todas as tabelas, índices e foreign keys
- ✅ 16 tabelas principais
- ✅ Relacionamentos completos
- ✅ Índices otimizados

### **3. Código Fonte Organizado**
- ✅ **Frontend** (`client/`) - React 19 + Vite + TypeScript
- ✅ **Backend** (`server/`) - Node.js + Express + tRPC
- ✅ **Database** (`drizzle/`) - Schema TypeScript + Migrations
- ✅ **Shared** (`shared/`) - Tipos e constantes compartilhados

---

## 🚀 Como Exportar o Projeto

### **Opção 1: Download via Interface Manus**

1. Acesse o painel de gerenciamento do projeto
2. Vá em **Code** → **Download All Files**
3. Extraia o ZIP em sua máquina local

### **Opção 2: Clone via Git (Recomendado)**

```bash
# Se o projeto já estiver no GitHub
git clone <url-do-repositorio>
cd tattoo_crm

# Ou exporte para GitHub via interface Manus
# Settings → GitHub → Export to Repository
```

---

## ⚙️ Configuração Local

### **1. Instale as Dependências**

```bash
# Certifique-se de ter Node.js 22+ e pnpm instalados
pnpm install
```

### **2. Configure as Variáveis de Ambiente**

```bash
# Copie o template
cp .env.example .env

# Edite o arquivo .env com suas credenciais
nano .env  # ou use seu editor preferido
```

**Variáveis obrigatórias:**
- `DATABASE_URL` - String de conexão MySQL
- `JWT_SECRET` - Chave secreta para JWT
- `OAUTH_SERVER_URL` - URL do servidor OAuth da Manus
- `VITE_OAUTH_PORTAL_URL` - URL do portal OAuth
- `VITE_APP_ID` - ID da aplicação Manus

### **3. Configure o Banco de Dados**

```bash
# Opção A: Crie o banco MySQL local
mysql -u root -p
CREATE DATABASE tattoo_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Opção B: Use Docker
docker-compose up -d mysql

# Aplique o schema
mysql -u root -p tattoo_crm < database/schema.sql

# Ou use Drizzle (recomendado)
pnpm db:push
```

### **4. Execute o Projeto**

```bash
# Modo desenvolvimento (frontend + backend)
pnpm dev

# Ou execute separadamente:
# Terminal 1 - Backend
pnpm dev:server

# Terminal 2 - Frontend
pnpm dev:client
```

### **5. Acesse a Aplicação**

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api/trpc

---

## 🔄 Integração com Google Cloud / AI Studio

### **1. Prepare o Projeto para Deploy**

```bash
# Build de produção
pnpm build

# Teste o build localmente
pnpm start
```

### **2. Configure Cloud SQL (MySQL)**

```bash
# No Google Cloud Console:
# 1. Crie uma instância Cloud SQL (MySQL 8.0)
# 2. Crie o banco de dados 'tattoo_crm'
# 3. Importe o schema: database/schema.sql
# 4. Anote a string de conexão
```

### **3. Deploy no Google Cloud Run**

```bash
# Instale o gcloud CLI
gcloud auth login

# Configure o projeto
gcloud config set project YOUR_PROJECT_ID

# Build e deploy
gcloud run deploy tattoo-crm \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="mysql://..." \
  --set-env-vars JWT_SECRET="..." \
  # ... adicione todas as env vars necessárias
```

### **4. Integração com AI Studio**

O projeto já possui integração com LLM via `server/_core/llm.ts`.

Para usar com Google AI Studio:

```typescript
// server/_core/llm.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export async function invokeLLM(params) {
  const result = await model.generateContent(params.messages);
  return result.response;
}
```

---

## 🧪 Executar Testes

```bash
# Rodar todos os testes
pnpm test

# Testes em modo watch
pnpm test:watch

# Testes com coverage
pnpm test:coverage
```

---

## 📊 Estrutura do Projeto

```
tattoo_crm/
├── client/              # Frontend React
│   ├── src/
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── pages/       # Páginas da aplicação
│   │   ├── hooks/       # Custom hooks
│   │   ├── contexts/    # React contexts
│   │   └── lib/         # Utilitários
│   └── public/          # Arquivos estáticos
│
├── server/              # Backend Node.js
│   ├── _core/          # Núcleo (auth, trpc, etc)
│   ├── routers.ts      # Rotas tRPC
│   ├── db.ts           # Queries do banco
│   └── *.test.ts       # Testes unitários
│
├── drizzle/            # Schema e migrations
│   ├── schema.ts       # Schema TypeScript
│   └── *.sql           # Migrations SQL
│
├── database/           # Schema SQL exportado
│   └── schema.sql      # DDL completo
│
├── shared/             # Código compartilhado
│   ├── const.ts        # Constantes
│   └── types.ts        # Tipos TypeScript
│
├── README.md           # Documentação principal
├── .env.example        # Template de env vars
└── package.json        # Dependências
```

---

## 🔐 Segurança

### **Variáveis de Ambiente**

- ✅ **NUNCA** commite o arquivo `.env` no Git
- ✅ Use `.env.example` como template
- ✅ Rotacione secrets regularmente em produção
- ✅ Use diferentes valores para dev/staging/prod

### **Banco de Dados**

- ✅ Use SSL para conexões em produção
- ✅ Configure backup automático
- ✅ Limite permissões do usuário do banco
- ✅ Use prepared statements (Drizzle faz isso automaticamente)

### **Autenticação**

- ✅ JWT_SECRET deve ser forte (min 32 caracteres)
- ✅ Tokens expiram após 30 dias
- ✅ Cookies são httpOnly e secure em produção

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
  "test:watch": "Testes em modo watch",
  "test:coverage": "Testes com coverage",
  "db:push": "Aplica schema no banco",
  "db:generate": "Gera nova migration",
  "lint": "Executa linter",
  "type-check": "Verifica tipos TypeScript"
}
```

---

## 🐛 Troubleshooting

### **Erro: Cannot find module**
```bash
# Reinstale as dependências
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### **Erro: Database connection failed**
```bash
# Verifique se o MySQL está rodando
mysql -u root -p -e "SELECT 1"

# Verifique a string de conexão no .env
echo $DATABASE_URL
```

### **Erro: Port already in use**
```bash
# Mate o processo na porta 3000
lsof -ti:3000 | xargs kill -9

# Ou use outra porta
PORT=3001 pnpm dev
```

### **Erro: TypeScript errors**
```bash
# Limpe o cache do TypeScript
rm -rf node_modules/.cache
npx tsc --noEmit
```

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte o `README.md` principal
2. Verifique os logs de erro
3. Revise as variáveis de ambiente
4. Entre em contato com o desenvolvedor

---

## ✅ Checklist de Exportação

Antes de usar o projeto externamente, certifique-se de:

- [ ] Baixar todos os arquivos do projeto
- [ ] Instalar Node.js 22+ e pnpm
- [ ] Copiar `.env.example` para `.env`
- [ ] Configurar todas as variáveis de ambiente
- [ ] Criar banco de dados MySQL
- [ ] Importar `database/schema.sql`
- [ ] Executar `pnpm install`
- [ ] Executar `pnpm dev` e verificar funcionamento
- [ ] Executar `pnpm test` e verificar testes
- [ ] Configurar Git para versionamento
- [ ] Fazer commit inicial
- [ ] Configurar CI/CD (opcional)

---

## 🎯 Próximos Passos Sugeridos

Após exportar e configurar o projeto:

1. **Versionamento**: Inicialize Git e faça commits regulares
2. **CI/CD**: Configure GitHub Actions ou Google Cloud Build
3. **Monitoramento**: Adicione Sentry ou Google Cloud Monitoring
4. **Backup**: Configure backup automático do banco
5. **Documentação**: Adicione documentação específica do seu negócio
6. **Testes**: Expanda cobertura de testes
7. **Performance**: Configure CDN para assets estáticos
8. **Segurança**: Adicione rate limiting e WAF

---

**✅ Estrutura pronta para exportação e uso fora do Manus.**

**Desenvolvido com ❤️ para estúdios de tatuagem**
