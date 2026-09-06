# Lembretes automáticos via BotConversa

## Fluxo operacional

O CRM controla quando uma mensagem de agendamento, aniversário ou lembrete individual deve ser criada. A cada minuto, a rotina Heartbeat verifica as configurações do estúdio e registra somente jobs idempotentes na fila persistente. Em seguida, a mesma execução processa os jobs prontos pelo BotConversa.

O reenvio de falhas no Histórico é um fluxo independente. Ele nunca define o horário, ativa ou bloqueia os lembretes automáticos.

| Automação | Regra de criação | Destinatário | Antiduplicidade |
|---|---|---|---|
| Agendamento | Dia configurado antes da sessão, a partir do horário configurado | Cliente do agendamento | Integração + agendamento + data-alvo |
| Aniversário | Data de nascimento coincide com a data local do estúdio | Cliente aniversariante | Integração + cliente + data |
| Lembrete individual | Data/hora definida no agendamento | Cliente do agendamento | Integração + lembrete individual |
| Uma hora antes | Agendamento entre 59 e 61 minutos à frente | Cliente com opt-in e artista atribuído | Integração + agendamento + ocorrência + destinatário |

## Controles obrigatórios

O job somente é entregue quando a integração do mesmo estúdio estiver ativa. Em produção, o cliente deve estar identificado e possuir opt-in de WhatsApp ativo na integração, sem opt-out. Se essas condições não estiverem presentes, a automação não faz chamada ao provedor.

As preferências ficam em **Configurações → Notificações**. O horário é aplicado no fuso `America/Sao_Paulo`; após salvar, a rotina passa a considerar os novos valores no ciclo seguinte. Antes de ativar o envio para um cliente, registre a autorização dele em **Central de Mensagens → Opt-in**. Reenvios de falhas ficam somente na **Central de Mensagens → Histórico**.

O aviso de uma hora fica desligado por padrão após a atualização, evitando qualquer envio inesperado. Quando ativado, cria no máximo um job para o cliente e um job separado para o artista indicado no agendamento. O cliente precisa de opt-in; o artista precisa estar ativo e ter telefone cadastrado. Os horários dos lembretes de véspera, aniversário e lembretes individuais são selecionados em lista de 00:00 a 23:00.

## Monitoramento

Use a aba **Histórico** para acompanhar mensagens enfileiradas, processadas, reenviadas ou com erro. Os registros são isolados por estúdio, exibem o telefone mascarado e preservam tentativas e auditoria.
