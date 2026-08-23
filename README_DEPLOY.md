# POD CRM - Guia de Deploy para Google Cloud Run

Este guia descreve como fazer deploy do POD CRM no Google Cloud Run.

## 📋 Pré-requisitos

- Conta no Google Cloud Platform
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) instalado
- Docker instalado (para testes locais)
- Node.js 22+ e pnpm (para desenvolvimento)

## 🚀 Teste Local com Docker

### 1. Configurar Variáveis de Ambiente

```bash
# Copiar template
cp .env.example .env

# Editar .env com suas configurações
# Mínimo necessário para teste local:
AUTH_MODE=local
LOCAL_ADMIN_EMAIL=admin@podcrm.local
LOCAL_ADMIN_PASSWORD=admin123
STORAGE_PROVIDER=disabled
```

### 2. Iniciar com Docker Compose

```bash
# Subir banco de dados + aplicação
docker compose up

# Ou em background
docker compose up -d

# Ver logs
docker compose logs -f app

# Parar
docker compose down
```

### 3. Acessar Aplicação

- URL: http://localhost:8080
- Login: `admin@podcrm.local` / `admin123`

## ☁️ Deploy no Google Cloud Run

### Passo 1: Configurar Projeto no Google Cloud

```bash
# Login no Google Cloud
gcloud auth login

# Criar projeto (ou usar existente)
gcloud projects create podcrm-production --name="POD CRM"

# Definir projeto ativo
gcloud config set project podcrm-production

# Ativar APIs necessárias
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

### Passo 2: Criar Banco de Dados (Cloud SQL for MySQL)

```bash
# Criar instância MySQL
gcloud sql instances create podcrm-db \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_ROOT_PASSWORD

# Criar banco de dados
gcloud sql databases create podcrm --instance=podcrm-db

# Criar usuário
gcloud sql users create podcrm \
  --instance=podcrm-db \
  --password=YOUR_DB_PASSWORD

# Obter connection name (necessário para Cloud Run)
gcloud sql instances describe podcrm-db --format="value(connectionName)"
# Exemplo de output: podcrm-production:us-central1:podcrm-db
```

### Passo 3: Executar Migrations do Banco

```bash
# Conectar ao banco via Cloud SQL Proxy
gcloud sql connect podcrm-db --user=podcrm --database=podcrm

# Ou usar cliente MySQL local
mysql -h <INSTANCE_IP> -u podcrm -p podcrm

# Executar schema (arquivo drizzle/schema.sql se existir)
# Ou usar drizzle-kit push:
DATABASE_URL="mysql://podcrm:PASSWORD@INSTANCE_IP:3306/podcrm" pnpm db:push
```

### Passo 4: Configurar Secrets

```bash
# Criar secrets no Secret Manager
echo -n "your-jwt-secret-min-32-chars" | \
  gcloud secrets create jwt-secret --data-file=-

echo -n "admin@podcrm.local" | \
  gcloud secrets create local-admin-email --data-file=-

echo -n "admin123" | \
  gcloud secrets create local-admin-password --data-file=-

# Dar permissão para Cloud Run acessar secrets
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Passo 5: Build e Deploy da Aplicação

```bash
# Build da imagem Docker e push para Container Registry
gcloud builds submit --tag gcr.io/podcrm-production/podcrm-app

# Deploy no Cloud Run
gcloud run deploy podcrm-app \
  --image gcr.io/podcrm-production/podcrm-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "AUTH_MODE=local,STORAGE_PROVIDER=disabled,NODE_ENV=production" \
  --set-secrets "JWT_SECRET=jwt-secret:latest,LOCAL_ADMIN_EMAIL=local-admin-email:latest,LOCAL_ADMIN_PASSWORD=local-admin-password:latest" \
  --set-env-vars "DATABASE_URL=mysql://podcrm:YOUR_DB_PASSWORD@/podcrm?unix_socket=/cloudsql/CONNECTION_NAME" \
  --add-cloudsql-instances CONNECTION_NAME

# CONNECTION_NAME = output do Passo 2 (ex: podcrm-production:us-central1:podcrm-db)
```

### Passo 6: Verificar Deploy

```bash
# Obter URL do serviço
gcloud run services describe podcrm-app --region us-central1 --format="value(status.url)"

# Testar
curl https://podcrm-app-XXXXX-uc.a.run.app/
```

## 🔐 Configurações de Segurança

### Alterar Senha do Admin

```bash
# Atualizar secret
echo -n "nova-senha-segura" | gcloud secrets versions add local-admin-password --data-file=-

# Fazer novo deploy para aplicar
gcloud run services update podcrm-app --region us-central1
```

### Habilitar HTTPS (automático no Cloud Run)

Cloud Run fornece HTTPS automaticamente. Para domínio customizado:

```bash
# Mapear domínio
gcloud run domain-mappings create --service podcrm-app --domain podcrm.seudominio.com.br --region us-central1

# Configurar DNS conforme instruções exibidas
```

## 📊 Monitoramento

### Ver Logs

```bash
# Logs em tempo real
gcloud run services logs tail podcrm-app --region us-central1

# Logs recentes
gcloud run services logs read podcrm-app --region us-central1 --limit 100
```

### Métricas

Acesse o [Cloud Console](https://console.cloud.google.com/run) para ver:
- Requisições por segundo
- Latência
- Uso de memória/CPU
- Erros

## 🔄 Atualizações

```bash
# Rebuild e redeploy
gcloud builds submit --tag gcr.io/podcrm-production/podcrm-app
gcloud run deploy podcrm-app --image gcr.io/podcrm-production/podcrm-app --region us-central1
```

## 🗄️ Backup do Banco de Dados

```bash
# Criar backup manual
gcloud sql backups create --instance=podcrm-db

# Configurar backups automáticos
gcloud sql instances patch podcrm-db --backup-start-time=03:00
```

## 💰 Estimativa de Custos

Para uso médio (< 1000 usuários):
- Cloud Run: ~$5-20/mês (pay-per-use)
- Cloud SQL (db-f1-micro): ~$7/mês
- Storage/Network: ~$1-5/mês

**Total estimado: $13-32/mês**

## 🐛 Troubleshooting

### Erro de Conexão com Banco

```bash
# Verificar se Cloud SQL Connector está configurado
gcloud run services describe podcrm-app --region us-central1 --format="value(spec.template.spec.containers[0].env)"

# Testar conexão manualmente
gcloud sql connect podcrm-db --user=podcrm
```

### Erro 502/503

```bash
# Verificar logs
gcloud run services logs read podcrm-app --region us-central1 --limit 50

# Aumentar memória/CPU se necessário
gcloud run services update podcrm-app --memory 1Gi --cpu 2 --region us-central1
```

### Aplicação não inicia

```bash
# Verificar variáveis de ambiente
gcloud run services describe podcrm-app --region us-central1

# Testar localmente
docker build -t podcrm-test .
docker run -p 8080:8080 --env-file .env podcrm-test
```

## 📚 Recursos Adicionais

- [Documentação Cloud Run](https://cloud.google.com/run/docs)
- [Documentação Cloud SQL](https://cloud.google.com/sql/docs)
- [Melhores Práticas Cloud Run](https://cloud.google.com/run/docs/best-practices)

## 🆘 Suporte

Para problemas específicos do POD CRM, consulte a documentação principal ou abra uma issue no repositório.
