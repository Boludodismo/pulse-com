# Consulta de referência: assinantes BotConversa

Data da consulta: 2026-09-04.

- A Swagger oficial está disponível em `https://backend.botconversa.com.br/swagger` com base `https://backend.botconversa.com.br/api/v1/webhook`.
- A referência lista `POST /subscriber/` para criar assinante, `GET /subscriber/get_by_phone/{phone}/` para consulta e `POST /subscriber/{subscriber_id}/send_message/` para envio.
- A documentação pública orienta usar telefone no padrão E.164 brasileiro, com `+55`, DDD e número.
- O diagnóstico do cliente do lembrete 1020001 retornou HTTP 404 na consulta de assinante; o job posterior registrou HTTP 400, compatível com a etapa de criação de assinante que ocorre após a consulta 404.
- A resposta detalhada do provedor não é persistida nem exibida para evitar exposição de dados operacionais. A integração permanece com token criptografado.
