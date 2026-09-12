# Operação BotConversa em produção

## Liberação controlada

A integração somente pode sair do modo de homologação quando estiver ativa, possuir credencial criptografada, tiver passado no teste de conexão, possuir ao menos um envio confirmado e não houver job pendente, em processamento ou em nova tentativa. A ação exige a confirmação literal `LIBERAR PRODUCAO` no painel e registra a data e o usuário responsável pela ativação.

A liberação remove somente a restrição ao telefone de teste. Ela **não** remove os controles de segurança do CRM: cada envio de produção continua vinculado ao estúdio correto, exige destinatário identificado e depende do consentimento ativo de WhatsApp (opt-in) do cliente. A liberação não dispara mensagens e não agenda campanhas.

## Histórico operacional

A aba **Histórico** da Central de Mensagens permite filtrar por integração e situação. Cada registro exibe o destinatário de forma mascarada, o conteúdo, o status de entrega, a quantidade de tentativas, possíveis erros sanitizados e o estado da auditoria. Os dados são sempre limitados ao estúdio da sessão, salvo o escopo administrativo já permitido ao Superadministrador.

| Situação | Significado operacional |
|---|---|
| Na fila | Mensagem criada e aguardando processamento. |
| Processando | Job reservado por uma execução da fila durável. |
| Enviada | O provedor confirmou a chamada e a fila foi concluída. |
| Nova tentativa | Houve falha transitória; o job será reavaliado conforme o limite de tentativas. |
| Erro | O envio não foi concluído; o painel apresenta o motivo sanitizado. |
| Auditoria processada | O evento outbound correspondente foi consolidado para rastreabilidade. |
