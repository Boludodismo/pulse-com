# Compartilhamento de artista e avisos operacionais — 19/10/2026

## Escopo

Base confirmada em produção: `ca6e78e2b3b5baada2f2665c94d182226ecfb5f6`, serviço Railway `courageous-hope`, branch `fix/artist-contact-complete-20261011`.

- O cartão mantém a rota `/artista/:token`, o token existente e a publicação explícita. Salvar um cartão novo já gera seu token; pausar continua impedindo o acesso público.
- O visitante pode compartilhar por WhatsApp, copiar o endereço e exibir o QR do mesmo perfil. Nome e endereço são preenchidos a partir do cartão público. O WhatsApp abre sem destinatário fixo, para o visitante escolher e confirmar o envio.
- O editor reutiliza o mesmo painel de indicação e mantém contato nativo, QR de contato, QR de perfil e PDF existentes.
- Criação/edição de agendamento, ações públicas de confirmação/adiantamento/atraso/remarcação, respostas textuais e ações dos orçamentos enfileiram avisos ao artista responsável. Anexos recebidos pelos canais compartilhados Meta/Z-API geram aviso de mídia sem inventar transcrição.
- Sem integração individual ativa de produção, o canal de produção do próprio estúdio envia o aviso ao telefone cadastrado do artista. Essa regra operacional é automática e não depende da opção de lembretes adicionais.
- Integrações ativadas por um colaborador vinculado ao artista são individuais; canais de outros colaboradores nunca são emprestados. A consulta restringe estúdio, canal ativo, habilitado e fora de homologação. As preferências existentes continuam valendo para canal individual e lembretes opcionais.
- A fila valida novamente telefone, artista ativo, canal e vínculo atual de cliente/agendamento/orçamento imediatamente antes do envio. Mudança de responsável bloqueia o aviso antigo. Eventos recebidos e criação de agendamento usam chaves estáveis; edições independentes são eventos novos.
- As falhas de aviso não desfazem gravação ou resposta do cliente. Filas, retentativas, auditoria, consentimento de mensagens aos clientes, autenticação, publicação do cartão e demais módulos continuam no fluxo existente.
- Não há migração, alteração de dados existentes ou envio retroativo. Não foram disparadas mensagens reais de teste.

## Autorização de exibição e botão final de salvar

Revisão adicional solicitada em 19/10/2026:

- O artista autoriza a exibição de compartilhamento e QR Code por uma opção própria no editor. A autorização só vale depois de salvar o cartão.
- A preferência `sharingEnabled` é opcional no JSON existente de apresentação. Sua ausência ou valor falso mantém esses recursos ocultos para visitantes; cartões antigos continuam válidos sem ativação automática.
- Quando autorizados, WhatsApp, cópia do link e QR Code visível aparecem no final do cartão público, depois de salvar o contato na agenda e antes do rodapé.
- A escolha fica salva para o cartão inteiro e seus envios, pode ser editada/revogada depois e mantém o token e o endereço público. Salvar outras alterações sem enviar essa preferência preserva seu valor.
- O botão principal “Salvar cartão” fica depois das fotos, do portfólio e da autorização. Ele continua ligado ao formulário original para salvar o cadastro e as edições; os controles de fotos continuam no fluxo existente.
- Validados: persistência de verdadeiro/falso, preservação da preferência em edições anteriores, compatibilidade dos cartões antigos, renderização pública condicionada e associação/posição final do botão.
- Publicação ainda pendente: o envio ao GitHub foi bloqueado pela revisão automática; não foi feita nova tentativa após essa revisão local.

## Verificação

- Build de produção local concluído.
- 303 testes passaram em 50 arquivos nas áreas de cartões, agendamento, propostas, isolamento e mensagens, incluindo validação da entrega da fila com provedor simulado.
- Simulação DOM executada: geração real do QR local, cópia exata do link com feedback, compartilhamento nativo e conteúdo do link WhatsApp.
- A checagem TypeScript padrão possui 87 diagnósticos já presentes no commit base; a comparação não acrescentou diagnósticos. A configuração existente não foi alterada.
- O teste legado `messaging.botconversa-provider.test.ts` já falha na base: expectativa de criar assinante/opt-in não corresponde ao comportamento atual do provedor. Foi reproduzido isoladamente no commit base e excluído da rodada verde. O teste de formato da chave recebeu uma chave efêmera exclusivamente de teste, sem uso de credenciais de produção.
- A navegação ao CRM confirmou que a interface administrativa exige autenticação; nenhum dado ou cartão real foi alterado para testar.

## Matriz de cenários

Nenhum destes testes cria etiquetas novas. A fila atual mantém `pendente/enviada/erro` e `pending/completed/retry/failed`; o vínculo do atendimento continua pertencendo ao artista original.

| Entrada | Comportamento esperado/verificado | Campo atualizado | Próxima etapa |
| --- | --- | --- | --- |
| Caminho ideal: novo agendamento | Aviso pelo canal do estúdio ao artista vinculado | Filas existentes | Entrega e auditoria |
| Resposta incompleta | Encaminha texto ao artista, sem inventar confirmação | Fila de aviso | Atendimento existente |
| Várias mensagens | Eventos diferentes mantêm suas chaves; repetição do mesmo evento não duplica | Chave do job/evento | Fila existente |
| Áudio no canal compartilhado | Avisa que chegou áudio, sem transcrição | Fila de aviso | Bot/atendimento existentes |
| Imagem no canal compartilhado | Avisa que chegou imagem, sem interpretação inventada | Fila de aviso | Bot/atendimento existentes |
| Cliente muda de ideia | Remarcação usa a ação existente e avisa o artista | Status existente + fila | Fluxo existente |
| Cliente volta etapas | Cada resposta identificada mantém o fluxo existente | Fila correspondente | Atendimento existente |
| Cliente pede humano | Encaminha texto ao artista e preserva resultado do Bot | Fila correspondente | Atendimento existente |
| Cliente não responde | Não cria aviso de resposta inexistente | Nenhum | Lembretes opcionais existentes |
| Pagamento falha | Fora do escopo; fluxo financeiro não é alterado | Nenhum novo | Tratamento financeiro existente |
| Provedor não responde | Retenta pela fila sem desfazer o agendamento | Job `retry` | Retentativa existente |
| Horário deixa de estar disponível | Fora do escopo; nenhuma regra de reserva foi alterada | Nenhum novo | Validação de conflito existente |
| Cliente já existe | Usa cliente identificado do mesmo estúdio | Vínculo mantido | Fila do artista correto |
| Mesmo evento entra duas vezes | Reaproveita chave de idempotência | Nenhuma duplicação | Resultado existente |
| Dado obrigatório ausente | Não inventa destinatário; telefone inválido ou vínculo ausente impede envio | Sem novo aviso | Correção do cadastro |
| Regra não prevista | Gatilho desconhecido não recebe exceção de aviso obrigatório | Preferências existentes | Fluxo existente |

## Recuperação

A mudança é apenas de código e não exige reversão de banco. A versão anterior confirmada é o commit base acima. Eventual reversão de produção deve usar o fluxo normal de release; não há necessidade de excluir registros ou reescrever cartões.
