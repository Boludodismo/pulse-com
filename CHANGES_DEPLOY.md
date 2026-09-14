# Ajustes realizados para deploy de homologação

## Escopo preservado

Nenhuma tela do frontend, regra de estoque, agenda, clientes, financeiro, anamnese, fornecedores, SaaS ou fluxo visual foi refatorada. As mudanças foram limitadas à infraestrutura necessária para executar o mesmo sistema fora do ambiente Manus.

## Ajustes aplicados

1. **Migrações**
   - Registradas no journal as migrations 0045 a 0051 que já existiam no projeto.
   - Adicionado modo opcional `RUN_DB_MIGRATIONS=true` para aplicar migrations versionadas antes do servidor iniciar.

2. **Autenticação local standalone**
   - Corrigida a sessão local para funcionar sem exigir `VITE_APP_ID` do Manus.
   - Cookie usa `SameSite=Lax` em HTTP local e mantém `SameSite=None + Secure` em HTTPS.

3. **Storage de imagens e arquivos**
   - Mantido o provider Manus existente.
   - Adicionado provider `s3` compatível com Railway Buckets/R2/AWS S3 usando as dependências AWS SDK já presentes no projeto.
   - Como Railway Buckets são privados, URLs armazenadas no CRM usam proxy estável assinado por HMAC; o backend gera URL S3 temporária somente no momento do acesso.

4. **Docker/GitHub**
   - pnpm fixado em 10.4.1 para build reproduzível.
   - `VITE_AUTH_MODE=local` disponibilizado no build do Vite.
   - Workflow GitHub Actions adicionado para type-check e build.
   - `.env.example` atualizado para homologação standalone.

5. **Saúde e segurança**
   - Adicionado `/api/health` para healthcheck do host.
   - Removidos do pacote GitHub-ready: `.manus/` e `dist/` antigo.
   - `.manus/` foi removido porque continha metadata de infraestrutura do ambiente anterior; `dist/` será reconstruído no deploy.

## Validações executadas

- JSON de `package.json` e `drizzle/meta/_journal.json` válido.
- 51 entradas do journal conferidas e todos os respectivos arquivos SQL encontrados.
- Parse sintático dos arquivos TypeScript modificados realizado com TypeScript em modo `noCheck`.
- Varredura de credenciais executada após remoção de `.manus/`.
- Nenhum arquivo dentro de `client/` ou `shared/` foi alterado.

## Limitação da validação local

O ambiente de execução usado para preparar este pacote não tinha acesso ao registry do npm, portanto não foi possível baixar `node_modules` e executar o build completo localmente. O workflow `.github/workflows/ci.yml` fará essa validação automaticamente assim que o código for enviado ao GitHub.
