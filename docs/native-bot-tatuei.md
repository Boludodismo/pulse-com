# Bot Tatuei nativo

Módulo em `/bot-tatuei`, integrado à sessão e aos clientes do CRM. A marca usa o arquivo oficial enviado e laranja #ff5200. O efeito de inclinação e brilho respeita a preferência de movimento reduzido. Não inclui precificação.

## Operação

O gestor habilita o módulo e libera cada artista em Equipe e acesso. Artistas veem somente seus clientes e conversas; permissões de assistente, mensagens, automações e cadastros são independentes. Configurações têm controle de versão para evitar sobrescritas entre telas. O módulo começa pausado; artistas começam sem acesso. Teste as mensagens no Simulador antes de ativar.

Conversas permitem resposta manual, assumir o atendimento, retomar o bot e acompanhar a situação de cada envio. Aceitação pelo provedor não significa entrega ou leitura. Falhas incertas não são reenviadas automaticamente. Eventos repetidos são deduplicados. Mudanças de responsável, pausa ou tomada de atendimento invalidam mensagens pendentes do bot. Ao transferir um cliente, o gestor deve revisar o vínculo da conversa; a tela informa que o novo responsável terá acesso ao histórico dessa conversa.

O cliente pode escrever `parar` para interromper mensagens e revogar a autorização de automações. `retomar atendimento` libera novamente a conversa, mas não restaura a autorização de automações. Lembretes, pós-atendimento e aniversários exigem autorização registrada e regra habilitada. Agendamentos cancelados ou modificados são revalidados antes do envio. Lembretes usam os links existentes de confirmação e anamnese do CRM. Datas usam America/Sao_Paulo; expediente cruza somente o mesmo dia. Regras processam eventos do dia a partir do horário configurado, sem recuperação de dias anteriores. A varredura suporta até 1.000 candidatos por perfil/regra/dia.

## Conexões

O bot não usa a conta, as credenciais ou os fluxos do BotConversa. A conexão por QR desta versão usa uma instância Z-API dedicada, com Instance ID, token da instância e Client-Token. É um conector externo, não a API oficial da Meta. O QR vem do provedor; não há QR fictício. Verificar conexão também registra o webhook HTTPS exclusivo do estúdio. Uma instância já usada pela Central de Mensagens não pode ser reutilizada no mesmo estúdio. Remover a conexão no CRM não encerra a instância no provedor.

IA é opcional e usa uma chave OpenAI por estúdio, modelo e limite diário. O simulador só consulta IA real quando a opção correspondente é marcada. Respostas determinísticas, FAQ e encaminhamento humano funcionam sem IA. A IA não altera agenda nem faz precificação. Falhas ou respostas inválidas encaminham à equipe. Credenciais são criptografadas por estúdio; nunca voltam para o navegador. A chave mestra `NATIVE_BOT_ENCRYPTION_KEY` (Base64, 32 bytes) é preferida, com compatibilidade com o material criptográfico já configurado em `BOTCONVERSA_ENCRYPTION_KEY`. Isso não usa a API do BotConversa.

## Implementação e validação

Seis tabelas `tatuei_bot_*` são criadas de forma aditiva no início do servidor. Falha no módulo não impede o CRM de iniciar. Não há alteração destrutiva nas tabelas existentes. O worker usa travas do MySQL e fila persistente; homologação bloqueia envios externos. A entrada de webhook tem limite próprio de 256 KB. Mídias são registradas como aviso e encaminhadas à equipe; visualização dos arquivos permanece no aplicativo WhatsApp. Grupos, newsletters e identificadores sem número reconhecível são ignorados.

Testes: `vitest run server/nativeBot/nativeBot.test.ts`. O verificador `dist/nativeBotIntegration.js` usa o banco de homologação, cria dados isolados, valida os procedimentos reais e remove somente esses dados. Só executa com o ID conhecido de staging, `OUTBOUND_MESSAGING_DISABLED=true` e `BOT_RUN_INTEGRATION_CHECK=true`. Não é chamado no início da produção. Chamadas reais aos provedores precisam ser verificadas após o gestor cadastrar suas próprias credenciais.
