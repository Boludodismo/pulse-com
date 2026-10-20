# Preservar o atendimento e criar outra sessão

Base publicada: `3bd682690770baf496a095e51987a0d4204fc470`.

## Problema e resultado

O botão de continuidade registrava a necessidade de outras sessões, mas mantinha o editor do atendimento original aberto. Preencher ali uma nova data podia atualizar a mesma linha do agendamento. O editor também permitia mudar horário/calendário após registrar presença.

Agora “mais sessões” salva a situação da sessão atual e abre explicitamente **Agendar nova sessão**. A nova data fica vazia para escolha e o botão é **Criar nova sessão**. O cliente, artista, serviço, duração e calendário são preparados a partir da origem; pagamentos, imagens temporárias e rascunhos de materiais anteriores são limpos. O agendamento novo tem outro ID e guarda `continuationOfAppointmentId`.

A criação passa pela rota existente de novos agendamentos e suas validações. A origem é conferida por empresa, cliente e artista; o novo horário precisa ser posterior ao da origem. A nova linha começa como agendada, mesmo se um cliente de API enviar o status concluído da origem. A origem não é atualizada nem removida para criar a nova sessão.

O calendário mantém a semana do atendimento de origem ao abrir a continuidade. Assim o atendimento anterior continua consultável no dia original. A confirmação de presença permanece na tela atual; somente a escolha de outras sessões abre o novo cadastro.

## Proteção do histórico

- Ao existir uma ocorrência operacional (presença, atraso, falta, início ou conclusão), data, duração, calendário, cliente e artista do agendamento original ficam preservados. O editor exibe a orientação e bloqueia os respectivos campos.
- O servidor verifica os dados dentro de uma transação, bloqueando o agendamento antes de consultar a ocorrência. Uma tela desatualizada não consegue mudar o horário por edição ou arraste.
- O arraste também reconfere a conclusão dentro do bloqueio. Uma conclusão em outra tela não permite que a movimentação que já estava aberta altere o horário.
- Correções de notas, valores e demais campos continuam possíveis sem mudar o atendimento de dia. Uma confirmação prévia do cliente para um atendimento futuro, sem ocorrência operacional, continua permitindo reagendamento legítimo.
- A indicação de outras sessões pode ser adicionada depois da conclusão. Isso preserva conclusão, data e referência de pós-venda; não reabre a sessão nem reinicia prazos.
- Não há reconstrução automática de datas que já tenham sido alteradas antes desta correção. Não se presume o horário original a partir do momento de um clique.

## Verificação

- 508 testes aprovados em 73 arquivos selecionados; um teste legado já ignorado permanece ignorado. A suíte antiga `messaging.botconversa-provider.test.ts`, com falha previamente constatada na base, continua fora desta seleção.
- Testes específicos cobrem nova criação com ID distinto e origem preservada, status agendado sem herdar conclusão, origem de outra empresa/cliente/artista, data anterior, bloqueio da edição e do arraste, corrida com a conclusão, edição legítima anterior à presença e correção de campos sem mover o horário.
- Renderização do editor verifica o modo de criação mesmo com um ID antigo presente no chamador, os campos de horário bloqueados no histórico e o encaminhamento para o novo cadastro apenas depois de salvar a indicação de continuidade.
- Build de produção concluído. TypeScript comparado à base: os mesmos 87 diagnósticos preexistentes, nenhum novo.
- Testes do fluxo usam dados simulados. Nenhum agendamento real foi movido/criado e nenhuma mensagem de teste foi disparada para validar esta correção.

## Instalação

O inicializador existente adiciona somente a coluna opcional `appointments.continuationOfAppointmentId` sob o mesmo bloqueio de esquema. Nenhuma migração de datas ou substituição de registros existentes é executada.
