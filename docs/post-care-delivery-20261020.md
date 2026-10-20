# Recuperação e roteamento do pós-venda

O ciclo escolhia a primeira conexão ativa do estúdio, inclusive homologação ou canal pessoal de outro artista. Agora a consulta considera apenas conexões de produção ativas e habilitadas; cada acompanhamento usa o canal do artista responsável, com fallback para o canal do estúdio. Não usa canais de outros artistas. O consentimento é validado para o canal selecionado.

Pendências de sessão podem ser recuperadas por até sete dias após o vencimento, entre 09h e 20h no fuso do estúdio. Aniversários continuam restritos ao próprio dia. Modelos inativos, recusas e sessões anteriores à criação do modelo mantêm seu comportamento. Presença efetiva e conclusão mantêm a mesma origem idempotente de atendimento; nova sessão não altera a anterior.

O ciclo registra contagens sem dados pessoais: enfileirados, sem canal, telefone, consentimento e falhas. A tela informa quando não existe modelo de pós-venda ativo. Não há ativação indiscriminada de modelos nem importação de consentimentos antigos.

Validação: oito cenários novos executam o ciclo com banco/provedor simulados, verificando escolha de canal, isolamento de artista, filtro de produção, consentimento, primeiro nome, link de feedback, sucesso/falha da fila, janela de recuperação, horário e aniversário. Também executada a regressão de agenda, atendimento, consentimento e mensagens. Nenhum teste envia mensagens reais ou altera agendamentos reais.

Limites de operação: o serviço Railway atual pode dormir para reduzir custos; o temporizador interno só roda quando a aplicação está ativa. Esta alteração não adiciona infraestrutura nem muda o plano. Logs técnicos e testes não comprovam entrega a um cliente real nem permitem verificar configurações privadas do estúdio sem acesso autenticado ao CRM.
