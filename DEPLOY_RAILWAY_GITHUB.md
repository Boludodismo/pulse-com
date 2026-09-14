# POD CRM — Deploy de teste via GitHub + Railway

Este pacote foi preparado para um **ambiente de homologação/teste**, preservando a estrutura funcional do CRM. As alterações são apenas de infraestrutura: inicialização do banco, autenticação standalone, storage S3 compatível, healthcheck e previsibilidade do build.

## Arquitetura recomendada para o primeiro teste

- **GitHub:** repositório do código-fonte.
- **Railway App Service:** executa o Dockerfile deste projeto.
- **Railway MySQL:** banco de dados persistente.
- **Railway Storage Bucket:** imagens, assinaturas, PDFs e anexos via S3 compatível.
- **HTTPS/Domínio Railway:** primeiro use o domínio temporário; depois conecte `crm.tatuei.com` quando a homologação estiver estável.

## 1. Enviar o código ao GitHub

Crie um repositório privado vazio e envie **o conteúdo desta pasta como raiz do repositório**. Não envie `.env` nem senhas.

## 2. Criar o projeto no Railway

1. New Project → Deploy from GitHub Repo.
2. Selecione o repositório do POD CRM.
3. O Railway detectará o `Dockerfile` automaticamente.
4. No mesmo projeto, adicione **MySQL**.
5. No mesmo projeto, adicione um **Storage Bucket**.

## 3. Variáveis mínimas no serviço do CRM

Use referências do Railway sempre que possível.

```env
NODE_ENV=production
AUTH_MODE=local
VITE_AUTH_MODE=local
RUN_DB_MIGRATIONS=true
DATABASE_URL=${{MySQL.MYSQL_URL}}

LOCAL_ADMIN_EMAIL=SEU_EMAIL
LOCAL_ADMIN_PASSWORD=UMA_SENHA_FORTE
LOCAL_ADMIN_NAME=Administrador
JWT_SECRET=UM_SEGREDO_ALEATORIO_LONGO

STORAGE_PROVIDER=s3
```

No Bucket, use a opção de **auto-inject credentials** para disponibilizar ao app:

```env
AWS_ENDPOINT_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET_NAME
AWS_DEFAULT_REGION
AWS_S3_URL_STYLE
```

Se o Railway injetar os nomes curtos (`ENDPOINT`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `BUCKET`, `REGION`), o código também aceita esses nomes.

## 4. Gerar o domínio temporário

No serviço do CRM: Settings → Networking → Generate Domain.

Depois adicione ao serviço:

```env
APP_BASE_URL=https://SEU-DOMINIO.up.railway.app
PUBLIC_URL=https://SEU-DOMINIO.up.railway.app
```

O código também reconhece `RAILWAY_PUBLIC_DOMAIN`, mas definir `APP_BASE_URL` deixa links de anamnese, recuperação, calendário e arquivos determinísticos.

## 5. Primeiro deploy

Com `RUN_DB_MIGRATIONS=true`, o servidor aplica somente as migrations já versionadas no repositório antes de aceitar tráfego. Se a migração falhar, o processo não inicia — isso evita publicar uma versão com schema incompleto.

O endpoint de healthcheck é:

```text
/api/health
```

No Railway, configure esse caminho como Healthcheck Path.

## 6. Login inicial

Use os valores definidos em:

- `LOCAL_ADMIN_EMAIL`
- `LOCAL_ADMIN_PASSWORD`

O usuário superadministrador é criado automaticamente apenas se ainda não existir. Reiniciar o sistema **não sobrescreve** a senha de um admin já cadastrado.

## 7. Checklist de homologação

Antes de apontar `crm.tatuei.com`, valide:

- Login/logout e recuperação de senha.
- Cadastro/edição de clientes.
- Agenda e links de confirmação.
- Anamnese e PDFs.
- Upload e visualização de imagens.
- Estoque, catálogo técnico e fornecedores.
- Financeiro e relatórios.
- Usuários, permissões e isolamento por estúdio.
- BotConversa/webhooks, caso as secrets sejam configuradas.

## 8. Importante sobre dados reais

Para o primeiro teste, use um banco de homologação. Não reutilize automaticamente o banco de produção do Manus. A migração de dados reais deve ser feita separadamente, com backup e teste de restauração, depois que a versão hospedada estiver validada.
