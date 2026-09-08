# Mapeamento de infraestrutura e cenários de custo

**Data de referência:** 1º de setembro de 2026. Este é um diagnóstico técnico e uma estimativa de operação; não constitui orçamento contratado nem garante valores futuros. Preços externos estão em USD e variam com câmbio, impostos, consumo e alterações dos fornecedores.

## 1. Arquitetura confirmada no projeto atual

| Camada | Implementação confirmada | Observação operacional |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, Wouter, TanStack Query e componentes Radix/shadcn | SPA compilada pelo Vite. |
| Backend | Node.js, TypeScript, Express 4 e tRPC 11 | API e frontend pertencem ao mesmo repositório e são publicados juntos. |
| ORM e validação | Drizzle ORM, `mysql2` e Zod | Contratos tipados entre UI e API. |
| Banco relacional | TiDB Serverless v8.5.3, compatível com MySQL 8.0 | A aplicação usa o driver MySQL; não é PostgreSQL. |
| Autenticação | Manus/OAuth e modo de autenticação local existente | Não há serviço de identidade externo independente configurado. |
| Mensageria | BotConversa por API REST externa, webhook assinado, fila persistente e Heartbeat | A instância WhatsApp não roda no servidor do CRM. |
| Mídia | Object Storage compatível com S3, por `storagePut` | Uploads de POD/referências são gravados em objeto e referenciados por URL/chave; não há `/uploads` ou `multer` no backend analisado. |

O Tattoo CRM é um **monólito modular**: cliente e API são separados em diretórios, mas são construídos e publicados como uma única aplicação Node.js. O build gera o frontend Vite e empacota o servidor Express no mesmo artefato. Não há `Dockerfile`, `docker-compose.yml` ou `compose.yaml` controlado pelo repositório atual.

## 2. Banco, arquivos e recuperação

No código analisado não existe uma política própria de dump automático, retenção de backup externo ou recuperação point-in-time para o TiDB. Checkpoints de código não devem ser tratados como backup operacional do banco. A recomendação inicial é definir RPO de 24 horas e RTO de até 4 horas, com dump lógico diário criptografado, quatro cópias semanais e retenção mensal por 90 dias em object storage separado. A cada trimestre, execute uma restauração de ensaio em ambiente isolado.

Para um SLA mais rigoroso, o próximo nível seria RPO de minutos por PITR e RTO inferior a uma hora; isso exige banco gerenciado que ofereça logs/PITR ou arquitetura de réplica. Por exemplo, o plano Pro da Supabase inclui backup diário com sete dias de retenção, enquanto PITR de sete dias é cobrado separadamente [3]. Na plataforma Manus, uma exportação de dados é uma fotografia estática do momento da exportação, não uma sincronização contínua; para contas eventualmente afetadas por políticas de backup da plataforma, a notificação da conta é a fonte de verdade [6].

O armazenamento atual segue a direção correta para fotos e referências: bytes em object storage e metadados no banco. Ainda não há estimativa de volume inicial nem crescimento mensal; portanto, não há base técnica para projetar custo de mídia com precisão.

## 3. Integrações externas

A integração ativa de WhatsApp é o **BotConversa**, um provedor externo gerenciado. O CRM conserva token e segredo de webhook criptografados, recebe eventos em endpoint exclusivo e processa saídas por fila persistente. A aplicação não hospeda Evolution API, Baileys, WppConnect ou uma instância própria do WhatsApp.

Em produção, cada envio exige empresa correta, cliente identificado e consentimento ativo de WhatsApp. A liberação de produção não habilita campanhas em massa e o reenvio de falhas requer confirmação explícita. Esses controles devem permanecer em qualquer migração de infraestrutura.

## 4. Cenários de operação e custo

| Cenário | Infraestrutura | Faixa de referência atual | Benefício principal | Custo/risco técnico |
|---|---|---:|---|---|
| A. Manter no Manus | Aplicação, TiDB, secrets, domínio, storage e Heartbeat atuais | Cobrança da plataforma não foi estimada neste documento | Sem migração imediata; domínio e funções atuais preservados | Limite de 1 vCPU/512 MB por instância; backup externo e telemetria devem ser planejados. |
| B. PaaS com Railway | Serviço Node + banco compatível + bucket S3 | Hobby com mínimo de US$ 5/mês; CPU/RAM, disco e tráfego são medidos; object storage US$ 0,015/GB-mês [1] | Deploy, secrets, logs e rollback gerenciados | Migração de TiDB/MySQL, storage, autenticação e agendamentos; total depende de banco e uso. |
| C. PaaS com Render | Web service Node + banco gerenciado + object storage | Web Starter: US$ 7/mês; Standard 1 vCPU/2 GB: US$ 25/mês; Postgres Basic 1 GB: US$ 19/mês [2] | Operação simples, cron, logs e banco com PITR conforme plano | Troca de MySQL/TiDB para Postgres ou inclusão de MySQL externo; custo não inclui mídia/WhatsApp/impostos. |
| D. Banco Supabase + app separado | Postgres/Auth/Storage no Supabase e API Node hospedada à parte | Pro: US$ 25/mês; inclui créditos para Micro, 8 GB de disco, 100 GB de storage e backup diário de 7 dias [3] | Banco, storage e auth consolidados | Não é migração direta: TiDB/MySQL e tRPC/Express exigem conversão e testes; ainda há custo do backend. |
| E. VPS + Coolify | VPS, Docker, Coolify, app, banco, backup e bucket sob gestão própria | DigitalOcean Basic 2 vCPU/4 GB: US$ 24/mês; backup diário percentual: 30% do valor do Droplet [4] | Maior controle e custo previsível de compute | Patch de SO, firewall, Docker, banco, monitoramento, backup e incidentes passam a ser responsabilidade operacional. |

Uma referência de partida para a opção VPS é 2 vCPU/4 GB RAM/80 GB SSD, pois o Coolify recomenda pelo menos 2 cores, 2 GB de RAM e 30 GB livres apenas para sua própria operação [5]. O exemplo de US$ 24 mais backup diário de 30% resulta em **US$ 31,20/mês apenas para o Droplet e backup**, antes de object storage, domínio, e-mail transacional, monitoramento, banco gerenciado, suporte técnico, impostos e BotConversa [4].

## 5. Recomendação técnica provisória

Enquanto a base estiver em validação e sem números de escala, a menor exposição operacional é manter o projeto no ambiente gerenciado atual e instituir rotina de backup/exportação e monitoramento. O Heartbeat e a fila atual removem a necessidade imediata de VPS apenas para jobs de WhatsApp.

Caso seja necessária independência da plataforma, escolha **PaaS gerenciado** para a primeira migração externa, não VPS: o projeto contém autenticação, banco, S3, webhooks, cron e dados de clientes. A VPS com Coolify é adequada somente se houver alguém responsável por administração Linux, atualizações de segurança, testes de restauração e atendimento de incidentes. A migração deve ser planejada como projeto separado, com exportação de banco, validação de anexos, rotação de secrets, troca de callback OAuth/webhook, homologação BotConversa e rollback DNS.

## 6. Premissas necessárias para fechar capacidade e preço

| Dado necessário | Mês 1 | Mês 6 | Motivo |
|---|---:|---:|---|
| Estúdios pagantes/teste | A informar | A informar | Dimensiona tenants, suporte e receita. |
| Artistas e colaboradores ativos | A informar | A informar | Dimensiona usuários e permissões. |
| Acessos simultâneos no pico | A informar | A informar | Dimensiona CPU, conexões e autoscaling. |
| Mensagens BotConversa/mês e pico diário | A informar | A informar | Dimensiona fila, API e custo do provedor. |
| Fotos/referências existentes e crescimento mensal | A informar | A informar | Dimensiona storage, backup e egress. |
| Janela de suporte e disponibilidade desejada | A informar | A informar | Define RPO/RTO, monitoramento e contingência. |
| Teto mensal de infraestrutura, sem impostos | A informar | A informar | Permite selecionar o cenário economicamente viável. |

Para formar o preço de assinatura do SaaS depois de preenchida a tabela, use como piso operacional: **(infraestrutura + storage + backup + monitoramento + BotConversa + custo de suporte + reserva de risco) ÷ número mínimo de estúdios pagantes**. Aplique margem somente após definir a capacidade de suporte e o nível de serviço oferecido.

## Referências

[1]: https://railway.com/pricing "Railway Pricing"
[2]: https://render.com/pricing "Render Pricing"
[3]: https://supabase.com/pricing "Supabase Pricing"
[4]: https://www.digitalocean.com/pricing/droplets "DigitalOcean Droplet Pricing"
[5]: https://coolify.io/docs/get-started/installation "Coolify Installation Requirements"
[6]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "Manus — How to Back Up Your Data"
