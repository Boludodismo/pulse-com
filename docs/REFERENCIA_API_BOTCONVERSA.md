# Referência operacional da API BotConversa

> Fonte oficial: [Swagger BotConversa](https://backend.botconversa.com.br/swagger?format=openapi), consultado em 1º de setembro de 2026.

A especificação oficial expõe o cadastro de assinante e informa que o campo `has_opt_in_whatsapp` é obrigatório e deve ser verdadeiro para criar um contato apto a receber mensagens WhatsApp. O CRM valida esse consentimento antes de chamar o provedor.

| Finalidade | Método e rota |
|---|---|
| Consultar assinante | `GET /api/v1/webhook/subscriber/get_by_phone/{telefone}/` |
| Criar assinante | `POST /api/v1/webhook/subscriber/` |
| Enviar texto | `POST /api/v1/webhook/subscriber/{subscriberId}/send_message/` |

O teste controlado confirmou que a consulta de telefone requer o formato E.164 com sinal de adição, por exemplo `+5531996531316`, codificado na URL. Tokens e respostas completas do provedor não são armazenados nesta documentação.
