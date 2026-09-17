# Respostas manuais na Central Inteligente

A conta proprietária pode abrir uma conversa recebida, escrever até 4.000 caracteres e clicar em **Enviar resposta**. A resposta fica no histórico como aceita pelo BotConversa, não enviada ou sem confirmação. Aceitação pelo provedor não comprova entrega no celular.

O destinatário e a conexão vêm da conversa no servidor. A rota não aceita telefone, estúdio ou integração fornecidos pelo navegador. Acesso permanece restrito ao proprietário configurado e à conexão dele na empresa ativa. É necessário haver mensagem recebida, cliente com telefone correspondente e consentimento ativo na conexão; a homologação continua restrita ao telefone de teste. A consulta do assinante não cria contatos nem altera opt-in.

Cada tentativa tem UUID persistido antes do envio, com unicidade no banco. Cliques concorrentes e consultas posteriores não repetem o POST. Falhas de rede após iniciar o POST ficam sem confirmação; não há repetição automática. O navegador guarda a tentativa na sessão para permitir **Verificar envio** após recarregar. Para escrever outra resposta após resultado incerto, o usuário precisa conferir a conversa no BotConversa. Um processo interrompido pode deixar a tentativa em andamento e também exige essa conferência.

Não há mudança de scheduler, lembretes, aniversários, fluxos do bot, credenciais, consentimentos ou tabelas. O bloqueio global de envio em staging continua aplicado. A Central não gera respostas automáticas nem pausa um assistente que esteja ativo no BotConversa.

Recebimento continua dependente do webhook: a Central exibe apenas mensagens encaminhadas ao CRM. A configuração atual não comprova captura de todas as mensagens durante atendimento por IA/humano. O teste sintético anterior não comprova captura de mensagens reais.

Validação: testes de escopo privado, consentimento revogado, telefone divergente, homologação, concorrência, repetição de tentativas, resultado incerto e contrato do provedor com fetch simulado; regressão dos lembretes, TypeScript e build. Nenhuma mensagem real é enviada por esses testes. O teste final de entrega deve ser feito pelo proprietário para seu próprio número.
