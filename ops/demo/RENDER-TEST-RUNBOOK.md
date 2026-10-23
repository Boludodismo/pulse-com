# Roteiro de publicação separado — somente uma NOVA homologação fictícia

Este documento não autoriza nem executa publicação. A revisão local parte de `3a42c456fa65a7adaa31820f4c0062d421cab0fb`. Consulte o REVIEW.md da entrega para o commit final e suas limitações. A versão ativa no Render não foi consultada nem validada neste trabalho.

## Limites do destino

- Criar, somente no ambiente com autorização específica de publicação, um NOVO serviço de teste. Não reutilizar nem editar o serviço histórico `srv-dbd1sfavcj2c739cu4tg`.
- Preservar o serviço atual, Railway, bancos reais, volumes, backups, DNS, domínio e main. Não importar dados reais nem vincular banco externo.
- Usar uma branch de publicação própria quando sua criação remota e publicação forem autorizadas separadamente. A branch desta entrega é LOCAL e não tem remote configurado. Não ligar a publicação automática à main ou à branch histórica.
- Selecionar somente plano gratuito, sem disco persistente e sem banco pago. Se essa modalidade deixar de existir, parar essa operação e pedir uma decisão; não fazer upgrade.
- Deixar Auto-Deploy desligado no NOVO serviço. Conferir o commit antes de cada deploy manual. Não habilitar PR previews ou sincronizações de outros projetos.

## Conferência do pacote e build

1. Conferir SHA-256 dos arquivos e o manifesto do pacote. O patch original de 1A deve continuar com 886 linhas, 57.756 bytes e SHA-256 `1771f7c95c58c8116d18545189e861b43f29f47070ce7b7040bc229fca66d5f5`.
2. Para aplicar somente o patch cumulativo, usar um checkout limpo da base exata. Rodar `git apply --check render-test-complete.patch` antes de aplicar. O patch cumulativo JÁ inclui 1A: não aplicar ambos sobre a mesma cópia.
3. O código-fonte contém um `dist/index.js` antigo que já era versionado na base; ele foi preservado no histórico. É obrigatório reconstruir. Não iniciar esse arquivo antigo diretamente. A pasta `compiled/` da entrega contém a saída nova validada, separada dos arquivos versionados e sem dependências instaladas.
4. Runtime de referência: Node 24.19.0 e pnpm 10.4.1. Usar `pnpm install --frozen-lockfile`, `pnpm check` e `VITE_AUTH_MODE=local pnpm build`. O comando padrão de TypeScript usa agora o alvo ES2022 no tsconfig do projeto. Nenhuma configuração do ambiente Codex foi salva.
5. Para a demonstração, usar runtime Docker, contexto raiz e `Dockerfile.demo`. O estágio de build já define VITE_AUTH_MODE=local e executa o build. A imagem instala MariaDB e inicia o supervisor descartável. Não trocar pelo start genérico de produção.

## Build, start e verificação

- Build da aplicação: `VITE_AUTH_MODE=local pnpm build`.
- Start da demonstração: `node ops/demo/start.mjs` (CMD já definido no Dockerfile.demo).
- Start genérico `pnpm start` é somente o servidor compilado: NÃO cria nem isola o banco da demonstração. Não usá-lo isoladamente em homologação.
- Health check: `GET /api/health`, sem autenticação. A resposta comprova que o processo HTTP atende; não comprova sozinha a integridade dos fluxos ou do banco.
- Acesso de teste: HTTP Basic, usuário `demo`; login da aplicação `demo@example.invalid`. As duas etapas usam a senha exclusiva do NOVO serviço.

## Variáveis: nomes, sem valores secretos

Configurar no NOVO serviço somente `DEMO_MODE`, `LOCAL_ADMIN_PASSWORD`, `JWT_SECRET` e `AUTH_SECURITY_KEY`. DEMO_MODE deve habilitar a demonstração; a senha deve ser aleatória, exclusiva e ter pelo menos 16 caracteres. Gerar novos segredos no destino autorizado; não reutilizar valores locais ou de produção. Não copiar .env de outro ambiente.

A plataforma fornece `PORT` e `RENDER_EXTERNAL_URL`. O supervisor gera internamente `DATABASE_URL`, `DEMO_UPLOAD_DIR`, `AUTH_MODE`, `VITE_AUTH_MODE`, `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_NAME`, `LOCAL_STUDIO_NAME`, `OWNER_OPEN_ID`, `OUTBOUND_MESSAGING_DISABLED`, `SCHEDULER_MODE`, `RUN_DB_MIGRATIONS`, `STORAGE_PROVIDER`, `STORAGE_STARTUP_CHECK`, `INTELLIGENT_INBOX_ENABLED`, `APP_BASE_URL`, `NODE_ENV` e `TZ`. A URL do banco contém credencial nova, é criada em runtime e não deve ser definida ou divulgada pelo operador.

Não configurar AWS/S3, Forge, BotConversa, pagamentos, SMTP, AUTH_EMAIL_API_KEY, OAuth, Google Calendar, webhooks, heartbeat, tokens Railway ou credenciais de serviços reais. O supervisor usa um ambiente reduzido, bloqueia conexões externas Node e deixa workers e tarefas externas desligados. Não iniciar os executáveis de workers gerados pelo build.

## Dados e limites

Cada partida do supervisor cria um diretório novo em /tmp/tatuei-demo-*, um banco local vazio e usuários, clientes, artistas, agendamentos e materiais fictícios. Os três materiais sintéticos do estúdio são explicitamente fornecidos aos dois artistas fictícios pelo esquema de permissões já existente. Isso não compartilha clientes nem altera materiais reais.

A inicialização reproduz o esquema existente e os preparadores de schema já usados pela aplicação apenas nesse banco descartável. Não há nova migration ou definição estrutural nesta correção. RUN_DB_MIGRATIONS permanece desabilitado. Não usar este processo com um banco preexistente.

Uploads no provedor demo: até 10 MiB por arquivo e 64 MiB de objetos publicados, incluindo os respectivos metadados. Ao atingir a cota, recusar uploads; não evictar arquivos. Bytes e MIME são publicados juntos por rename atômico. Escritas e exclusões são serializadas em um único processo Node, como neste supervisor. Durante substituição, um arquivo temporário pode ocupar até mais 10 MiB antes do rename; isso não amplia a cota lógica. Não compartilhar esse diretório entre processos ou instâncias. O formato anterior continua legível; não existe migração automática.

Anexos de compromissos têm o limite próprio já existente de 2 MB e cinco anexos por série, gravados no banco; não fazem parte da cota de objetos do diretório. Não foi criada uma cota global para o banco.

A infraestrutura gratuita pode suspender, reiniciar, reconstruir e perder todo o banco e os uploads. Não prometer persistência, recuperação de dados, disponibilidade ou desempenho. Não há backup de dados reais nesta modalidade.

## Aceite obrigatório no NOVO serviço, após publicação autorizada

Conferir commit ativo, health, barreira Basic, senha incorreta, login real, isolamento dos dois estúdios e artistas, recusas diretas à API, sessão sem artista, criação com artistId explícito, cronômetro e pausa após reload, agenda concorrente e contígua, lançamento e consumo sem gravação parcial, cota concorrente, imagem/canvas, anexos e PDFs, desktop e viewport móvel. Tentar webhook/heartbeat e confirmar bloqueio. Conferir logs sem segredos e consumo de RAM sob carga no plano gratuito. Os resultados locais não certificam MariaDB em contêiner, proxy HTTPS, suspensão ou limite de RAM do Render.

## Voltar à versão anterior

Guardar os identificadores do deploy anterior e do commit realmente ativo no NOVO serviço antes da publicação. Se o candidato falhar, usar rollback manual desse NOVO serviço para o último deploy que tenha sido validado ali, ou parar o NOVO serviço. Não alterar o serviço histórico como rollback. A revisão histórica informada não é prova de qual commit está ativo hoje.

Rollback de código não recupera dados descartáveis. Cada reinício pode criar fixtures novas. Não tentar restaurar, reconciliar ou importar dados históricos. Revisar novamente as barreiras de acesso e de integrações após o rollback.
