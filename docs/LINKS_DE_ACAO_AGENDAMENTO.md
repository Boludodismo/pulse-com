# Links de ação em confirmações de agendamento

Cada confirmação de agendamento pode receber três links públicos: **Confirmar presença**, **Avisar atraso** e **Solicitar remarcação**. O CRM emite links aleatórios por agendamento, guarda apenas o hash do token e expira os links no horário da sessão.

O clique abre uma página de confirmação; a ação só é consumida após o cliente tocar em **Confirmar esta ação**. Isso evita alterações causadas por prévias automáticas de links. Após o consumo, o token não pode ser reutilizado.

| Ação | Efeito no agendamento | Alerta interno |
|---|---|---|
| Confirmar presença | Marca a confirmação como confirmada. | O calendário informa que o cliente confirmou. |
| Avisar atraso | Marca a confirmação como atraso. | O calendário destaca o aviso para o profissional. |
| Solicitar remarcação | Mantém a data/hora original e muda o status para reagendado. | O calendário alerta o profissional para definir o novo horário. |

Os alertas são isolados por estúdio. Eles aparecem na parte superior do **Calendário Visual** e, ao abrir o alerta, direcionam para o agendamento correspondente e o marcam como visualizado. A emissão de links só ocorre quando uma mensagem de agendamento é enviada pela fila existente; esta funcionalidade não agenda nem dispara mensagens adicionais.

Depois de uma confirmação de presença ou aviso de atraso, o CRM gera ou reutiliza uma solicitação pública de anamnese vinculada ao agendamento e enfileira uma única mensagem com o link da ficha. A entrega continua sujeita ao opt-in de WhatsApp e à integração ativa do mesmo estúdio. Uma solicitação de remarcação não dispara a ficha, pois o profissional ainda precisa definir a nova data e horário.
