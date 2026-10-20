# Atendimento pela agenda e WhatsApp

Base de produção: `baff7b8e18e33393be97352ab78ea7a602d16410` na branch `fix/artist-contact-complete-20261011`.

## Comportamento

- Cada agendamento pode habilitar os avisos de atendimento e escolher o destinatário: artista responsável ou telefone do estúdio. Novos agendamentos têm o acompanhamento habilitado. O artista precisa estar vinculado por ID e ter telefone válido; a conexão do estúdio é utilizada quando não há uma conexão pessoal ativa. A opção estúdio usa o telefone de suas configurações e um canal de produção do estúdio.
- O agendador existente verifica a chegada do horário e o término previsto, com chave de idempotência por agendamento, versão dos dados e momento. A retomada envia a pergunta de término até 24 horas depois; não envia uma pergunta de chegada quando o horário de término já passou. O marco de ativação evita disparar retrospectivamente os novos avisos de atendimentos que começaram antes da instalação.
- Os links são capacidades aleatórias de 256 bits, limitadas a um agendamento e válidas por sete dias. Somente o hash é armazenado. Alterar cliente, artista, horário, duração ou configuração dos avisos invalida o link; cancelar/remarcar o agendamento também impede as ações. Abrir o link é somente leitura. A alteração exige um POST explícito, com revisão do registro, e tem limite de frequência.
- Presença, atraso, falta, início, andamento e conclusão são distintos. “Finalizar sessão · precisa de outras sessões” conclui a sessão atual e registra a continuidade do projeto. As ações ficam na ficha do cliente; o submenu abre o formulário já existente da agenda, com cliente e artista selecionados. Salvar outro horário continua exigindo acesso ao CRM e sua validação de conflitos.
- Presença, início ou conclusão insere uma única referência em `care_sessions`, compartilhando a chave do agendamento com o fluxo antigo de conclusão e POD. O primeiro registro de realização permanece como referência dos prazos. Início/finalização posterior, edições e conferência de materiais não reiniciam os prazos nem baixam estoque.
- Cada falta é uma ocorrência única por agendamento. A etiqueta “Não compareceu” é automática e protegida da edição manual das etiquetas. A contagem é exibida na ficha e ao selecionar o cliente para agendar. Corrigir a falta para presença mantém a trilha de ações e recalcula a etiqueta.
- Cliente/artista não podem ser substituídos num agendamento que já tenha uma ocorrência de atendimento; outro agendamento preserva o histórico. Os dados do atendimento são transacionais e protegidos por bloqueio do agendamento/cliente e revisão otimista.
- A anamnese oferece uma opção separada, desmarcada e opcional, para receber WhatsApp de agendamento, acompanhamento e aniversário. O envio do formulário registra a escolha automaticamente, com cliente, telefone, origem e horário. Formulários antigos, data de nascimento e termos gerais não concedem autorização. Uma recusa bloqueia o contato, mesmo se o telefone foi removido. Um opt-out anterior não é revertido pela automação. A autorização explícita manual permanece disponível no painel.
- A preferência fica preservada caso ainda não haja integração. Aniversário/pós-venda aplicam uma autorização válida do mesmo cliente e telefone à integração atual, limpando identificadores do provedor antigo. Telefones iguais em cadastros diferentes não compartilham consentimento.
- Aniversários e pós-venda começam às 09h no fuso do estúdio e recuperam pendências até antes das 20h, sem novos envios noturnos. Aniversário é somente do dia; pós-venda mantém o limite anterior de hoje/ontem e a restrição de regras criadas antes do atendimento. Regras desativadas permanecem desativadas. O histórico distingue fila, envio ao provedor, falha e cancelamento; “enviada” não é prova de leitura do cliente.

## Validação executada

- 71 arquivos de teste selecionados: 492 aprovados, um teste antigo já marcado como ignorado.
- Cobertura inclui transições reais do serviço com banco simulado, transação/rollback, revisão desatualizada, correção de falta, integridade da referência de pós-venda, destinatário artista/estúdio, deduplicação, expiração e conteúdo limitado do link, escolha do formulário e opt-outs, telefone compartilhado, canal alterado e renderização dos controles.
- Build Vite e os três bundles esbuild concluídos.
- TypeScript comparado à base de produção: os mesmos 87 diagnósticos preexistentes, nenhum novo.
- A suíte legada `messaging.botconversa-provider.test.ts`, com falha já constatada na base, ficou fora desta seleção.
- O runner de testes usa o runtime JSX automático, como o Vite de produção, para executar também os testes existentes dos cartões.
- Não houve disparo de teste para telefones reais nem simulação de confirmação de cliente em produção. A efetiva entrega pelo provedor depende de conexão ativa, telefone válido e, para o cliente, autorização válida e regra habilitada.

## Matriz de fluxo

A tabela distingue testes simulados e inspeção do código; não representa execução de cada cenário numa conta real.

| Cenário | Entrada → comportamento esperado → registro → etiqueta → próxima etapa | Verificação |
|---|---|---|
| Caminho ideal | Horário → aviso → presença/início/fim → sessão e referência única → sem falta → pós-venda ativo | Serviço e transições simulados |
| Resposta incompleta | Ação/revisão ausente → rejeitar sem gravar → nada → nada → completar a ação | Validação Zod e revisão |
| Várias mensagens/cliques | Mesma ocorrência → não duplicar → uma ocorrência/referência → uma etiqueta → manter resultado | Teste de repetição |
| Áudio | Não aplicável: este link recebe ações, não interpreta áudio; o atendimento WhatsApp existente é preservado | Fora do novo fluxo |
| Imagem | Não aplicável: o novo link não recebe mídia nem altera a anamnese ou POD | Fora do novo fluxo |
| Mudar de ideia | Falta corrigida para presença → atualizar estado e referência → manter trilha → recalcular etiqueta → atendimento | Teste de correção |
| Voltar etapas | Sessão finalizada → rejeitar regressão → preservar finalização → preservar histórico → novo agendamento | Teste de transição |
| Pedir humano | Link indisponível → abrir agenda do CRM → acesso autenticado → nenhuma etiqueta automática → conferência do estúdio | Link de retorno presente |
| Sem resposta | Nenhum clique → não inventar presença/falta → estado pendente → sem etiqueta → aguardar conferência | GET não escreve |
| Falha no pagamento | Não aplicável: ações não registram pagamento, caixa ou consumo | Código e regressões preservados |
| Sistema externo indisponível | Sem canal/envio recusado → manter possibilidade de nova tentativa → não registrar envio fictício → nenhuma → fila existente | Roteamento e regressões da fila |
| Horário indisponível | Nova sessão → formulário existente/confere conflito → não sobrepor indevidamente → nenhuma → escolher outro horário | Regressões da agenda |
| Cliente existente | Abrir continuidade → mesmo cliente/artista selecionados → criar só outro agendamento → preservar etiquetas → novo horário | Integração com EventModal |
| Entrar duas vezes | Link aberto novamente → ler estado atual → sem alterações por GET → sem duplicidade → próxima ação válida | Teste de leitura/repetição |
| Dado obrigatório ausente | Token/telefone/vínculo inválido → recusar ou pular aviso → não autorizar outro cliente → nenhuma → conferir cadastro | Validação de token/consentimento |
| Regra não prevista | Ação fora do enum ou estado incompatível → rejeitar → preservar registro → preservar etiqueta → atualizar/conferir no CRM | Enum e transições |

## Instalação

`ensureAttendanceSchema` cria somente as tabelas do novo módulo, duas colunas com padrão em `appointments` e, se necessário, troca o antigo índice único por telefone pelo índice de consulta já utilizado pelo consentimento atual. Não exclui dados existentes. O scheduler continua no mesmo processo e frequência; não são adicionados serviços, planos ou workers externos.
