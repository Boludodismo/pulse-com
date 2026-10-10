# Tatuei — segurança e MFA, 10/10/2026

Base: versão publicada 99e223b09618ab6a3dd3b8c6319d96db09433880. O cadastro rápido e a autorização WhatsApp permanecem nesta versão.

## Comportamento

- Menu da conta → Segurança da conta (`/account/security`), para todos os usuários locais, inclusive artistas convidados e superadministradores.
- Aplicativo autenticador TOTP, chave de configuração manual, confirmação do primeiro código antes de ativar. Cada código é aceito uma vez, janela de 30 segundos com tolerância de um período.
- E-mail opcional via Resend quando `AUTH_EMAIL_API_KEY` e `AUTH_EMAIL_FROM` estão configurados. Remetente deve ter domínio verificado no provedor. Essa configuração não foi encontrada em produção: envio real precisa de configuração e teste de entrega.
- Superadministrador usa autenticador; depois de ativar, só pode substituir o fator com senha e fator atual/código de recuperação. Não há desativação nem troca para e-mail nessa conta.
- Dez códigos de recuperação aleatórios, 96 bits cada, armazenados como HMAC e consumidos de forma atômica. Exibidos somente ao ativar/substituir o método, com download opcional. Recuperação preserva a exigência de senha.
- Desafios de login, configuração e gestão separados, ligados ao usuário, senha e versão do fator. Validade de cinco minutos, máximo de cinco tentativas, consumo único. Limites adicionais de autenticação por IP e conta persistem no banco, inclusive após reiniciar o aplicativo.
- Sessões locais: duração máxima de 12 horas e inatividade máxima de 30 minutos. Sessões persistidas permitem revogar dispositivos e todas as sessões. Trocar/redefinir senha, mudar perfil/e-mail/status ou ativar/substituir MFA revoga as sessões anteriores. A ativação de MFA reemite apenas a sessão que confirmou o código.
- Login sem segundo fator ativo continua funcionando. Senhas já cadastradas continuam válidas. Novas senhas: mínimo de 15 caracteres e máximo de 72 bytes UTF-8 para evitar truncamento pelo bcrypt; novos hashes usam custo 12.
- Recuperação por e-mail envia ao titular, nunca ao proprietário global. Token armazenado como HMAC, válido uma hora. Consumo e troca da senha ocorrem na mesma transação; outros tokens são invalidados e MFA é mantido. Links emitidos pelo mecanismo antigo não são aceitos.
- Cookie local HttpOnly, SameSite=Lax, Secure em HTTPS. POSTs de autenticação/tRPC rejeitam origens diferentes; OAuth mantém o comportamento anterior do cookie.
- Fichas de anamnese exigem cliente do estúdio e, para colaborador, cliente/artista ou agendamento vinculado. Consulta pública por requestId também exige token válido da mesma solicitação. Novos links usam randomBytes(32); links existentes continuam válidos até expirar. Leituras públicas por token continuam limitadas pelo próprio token.
- Rotas admin/superadmin também passam pela verificação de conta ativa/expiração. Dados de cadastro de cliente deixaram de ser impressos nos logs.

## Chaves e implantação

Criar `AUTH_SECURITY_KEY` com 32 bytes aleatórios (hex de 64 caracteres) no ambiente production, junto da nova versão. Ela separa a autenticação local/MFA dos usos legados de JWT_SECRET, como links e armazenamento. **Preservar a chave em armazenamento seguro e no plano de recuperação: trocar essa chave sem migração torna os segredos TOTP existentes indecifráveis.** Não publicar segredos no repositório.

Bootstrap aditivo e idempotente cria cinco tabelas InnoDB: auth_security, auth_challenges, auth_recovery_codes, auth_sessions, auth_rate_limits. Não altera colunas existentes nem reescreve senhas ou dados de clientes. Limpa apenas sessões/desafios/limites expirados. O usuário não fica com MFA ativo sem confirmar o primeiro código.

A publicação invalida as sessões locais do mecanismo antigo: será necessário fazer login novamente. Reverter apenas o código restaura o mecanismo anterior, mais fraco; depois de usuários ativarem MFA, não reverter para uma versão que ignora o fator. As novas tabelas e a chave devem ser preservadas.

## Validação

Testes criptográficos com os vetores SHA-1 do RFC 6238; acesso às fichas pelas rotas tRPC; regressão de orçamento, cadastro/WhatsApp e convites. Integração opt-in em MariaDB 10.11 local descartável com dados fictícios: bootstrap repetido, concorrência, replay, limite de tentativas, recuperação, transação de reset, sessão, CSRF e login HTTP real. Interface verificada em Chromium local, desktop/superadmin e celular/artista convidado, com respostas de API fictícias: configuração, confirmação, exibição/aceite dos códigos de recuperação, ausência de desativação para superadmin e largura da tela. Essa verificação de interface não é um teste de entrega real de e-mail. O banco local não é o MySQL de produção; não houve teste invasivo ou criação de clientes reais.

Executar a integração somente com um banco descartável em 127.0.0.1:33079 chamado tatuei_security_test:

```sh
SECURITY_TEST_DATABASE_URL=mysql://root@127.0.0.1:33079/tatuei_security_test pnpm exec vitest run server/security/security.integration.test.ts
```

O teste é desabilitado sem essa variável e recusa qualquer URL fora desse endereço/nome. O teste SaaS tinha uma expectativa anterior ao módulo de orçamentos (`quotes`); a expectativa foi atualizada, sem alterar a lista de módulos do produto.

## Pendências da auditoria

Este pacote não constitui certificação ASVS. Passkeys/WebAuthn não foram implementadas. O e-mail ainda exige credencial, remetente validado e teste de entrega. Proteção de branches no GitHub não pôde ser confirmada com as permissões do conector. Backup automático, retenção, cópia externa e restauração do MySQL e do bucket permanecem sem comprovação; não declarar backup verificado antes de executar restauração isolada. Varredura histórica de segredos e revisão completa das demais rotas/permissões permanecem necessárias. Nenhuma chave de integração existente foi trocada sem verificar seus usos.

Referências técnicas: OWASP MFA Cheat Sheet; RFC 6238; NIST SP 800-63B-4; API de envio de e-mails do Resend.
