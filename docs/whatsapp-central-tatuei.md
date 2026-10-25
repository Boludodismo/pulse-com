# Central de atendimento WhatsApp — Tatuei

Implementação isolada a partir de `93fbe423be93b127549b2a8ebf56eb4a0bb26146`, sem alteração das branches publicadas. Não contém credenciais de produção. Esta entrega adiciona código; não representa publicação nem pareamento de um número real.

## Uso

Em **Bot Tatuei → Conexões**, escolha:

1. **QR Code próprio:** conector Baileys hospedado pelo Tatuei, sem assinatura do BotConversa ou de outro gateway. Clique em conectar e leia o código em WhatsApp → Aparelhos conectados. O QR expira e se atualiza. O pareamento não ativa sozinho a automação.
2. **API oficial Meta:** use o cadastro de Meta já existente em Canais conectados, informe as credenciais pelo formulário protegido, configure e valide o webhook assinado e selecione o canal para o bot. A janela de atendimento continua sendo aplicada.

A tela unifica os dois conectores na mesma central. A conexão QR não oficial não deve ser anunciada como integração oficial, nem como proteção contra bloqueios. A infraestrutura continua tendo custos, mesmo sem assinatura de gateway.

**Conversas** permite pesquisar, filtrar abertas/não lidas/minhas/equipe/bot/encerradas, responder, enviar anexos, ver recibos disponíveis, carregar mensagens anteriores e abrir a ficha. A ficha contém notas internas, etiquetas, responsável e assistente. Notas nunca são enviadas ao cliente.

O responsável só pode ser uma pessoa já autorizada a ver aquela conversa. Atribuir um responsável não muda o proprietário do cadastro nem concede acesso a outro artista. Para alterar o vínculo de cadastro/artista, use “Vincular cadastro / artista” na ficha, com validação do mesmo telefone; a central não modifica cadastros silenciosamente.

Responder manualmente assume a conversa e pausa o bot por prazo indeterminado. Também é possível pausar por 15/30/60 minutos, prazo personalizado de até sete dias ou até retomada manual. O prazo usa UTC no banco e é exibido no fuso do navegador. O worker verifica expirações a cada ciclo de oito segundos.

Ao expirar uma pausa ou retomar manualmente, o histórico permanece, mas o estoque de mensagens da pausa não dispara respostas antigas. Opt-out nunca é desfeito pela expiração. Encerrar cancela automações da conversa; reabrir mantém atendimento humano. Uma nova mensagem do cliente reabre uma conversa encerrada com a equipe no controle.

**Assistentes de IA** permite cadastrar nome, instruções e conhecimento e vincular um assistente ativo à conversa. A seleção pausa o bot para revisão. A chave de IA e a cota continuam sendo as já configuradas pelo estúdio; não há criação ou troca automática de chaves nesta entrega. Os assistentes usam o motor existente. Não foram adicionadas permissões para a IA confirmar pagamentos, fazer diagnósticos ou efetivar reservas. Essas ações exigem ferramentas transacionais próprias e validação específica.

## Instalação no ambiente isolado

- Usar banco e credenciais exclusivos de homologação e a mesma chave de criptografia em todas as réplicas desse ambiente. Não apontar `DATABASE_URL` para o banco antigo.
- Instalar dependências com o pnpm da versão declarada no projeto e rodar `pnpm check`, os testes abaixo e `pnpm build`.
- As tabelas e colunas aditivas são criadas por `ensureNativeBotSchema` no mecanismo de inicialização já existente. Não há remoção nem reescrita do histórico. Fazer snapshot do banco de homologação antes da primeira inicialização. A execução contra MySQL real ainda precisa ser validada no VPS.
- Configurar `NATIVE_BOT_ENCRYPTION_KEY` pelo gerenciador de segredos: 32 bytes aleatórios em base64, estáveis entre reinícios. Não colocar chaves em Git, logs ou mensagens.
- Manter `NATIVE_BOT_QR_ENABLED` ausente ou `false` até preparar o pareamento. Habilitar com `true` somente no ambiente e número escolhidos para o teste.
- `OUTBOUND_MESSAGING_DISABLED=true` bloqueia tanto o pareamento externo quanto o processamento e os envios. Para um teste real controlado, liberar explicitamente essa variável apenas na cópia de homologação e usar um número dedicado. Nunca copiar sessões reais do ambiente antigo.
- O QR usa WebSocket de saída para o WhatsApp, não webhook público. A conexão oficial requer `APP_BASE_URL` com HTTPS e webhook acessível pela Meta.
- Nginx/proxy deve preservar a sessão e desabilitar buffering em `/api/native-bot/events`. O cliente usa EventSource e possui consulta periódica de recuperação. As réplicas compartilham uma revisão persistente por estúdio e consultam alterações em lote a cada segundo; a entrega do evento ao navegador ocorre no ciclo seguinte. Eventos são invalidações; as leituras continuam autenticadas e limitadas por estúdio/artista.
- Cada sessão QR mantém uma conexão MySQL dedicada para um `GET_LOCK`, além do pool normal. Dimensionar `max_connections` de acordo com os números conectados. Todas as réplicas precisam acessar o mesmo servidor primário que oferece locks de sessão; não usar um proxy que troque a conexão de backend. Bancos sem essas garantias precisam de outro mecanismo de posse antes da habilitação.
- O supervisor restaura sessões selecionadas após reinício e usa recuo nas reconexões. A réplica proprietária envia as mensagens; outras réplicas deixam a fila para ela. Ao encerrar o processo, o socket e o lock são liberados.

## Dados e segurança

Sessões, chaves do protocolo, QR temporário e bytes dos anexos ficam cifrados com a proteção por estúdio existente. O QR não aparece no terminal. Os endpoints de download verificam login, acesso ativo, estúdio e propriedade da conversa; não retornam URLs públicas permanentes. Anexos aceitos: JPEG, PNG, WebP, PDF, OGG, MP3, M4A e MP4, até 5 MB. O banco precisa aceitar pacotes compatíveis com o conteúdo cifrado, aproximadamente 10 MB por arquivo no limite; conferir `max_allowed_packet` no ambiente de teste.

Não há importação integral do histórico anterior ao pareamento. Eventos de sincronização não iniciam fluxos. Grupos, status e newsletters não viram atendimentos. Identificadores LID são resolvidos pelo telefone fornecido pelo protocolo ou pelo mapa de contatos; números não são inferidos a partir de um LID. Mídia expirada, acima do limite ou não suportada mantém um aviso no histórico. A IA atual encaminha mídia para avaliação da equipe; não faz análise multimodal nesta entrega.

Mensagens repetidas são deduplicadas pelo identificador externo e envios manuais usam chave idempotente. Envio sem confirmação não é repetido automaticamente. Recibos fora de ordem não rebaixam mensagens lidas; recibos que chegam antes da confirmação são reconciliados. Respostas automáticas vencidas há mais de 15 minutos são canceladas. Eventos antigos recebidos depois de uma queda são preservados sem reexecutar o fluxo. Respostas manuais permanecem registradas na fila e exigem supervisão durante indisponibilidade prolongada.

Uma operação de pausa pode esperar uma chamada de IA que já esteja processando sob o lock da conversa; o servidor retorna conflito se o lock não ficar disponível no prazo. Um envio já aceito pelo WhatsApp antes da pausa pode concluir. A pausa confirmada cancela respostas automáticas ainda pendentes.

## Validação executada e pendências

Validação local: TypeScript, build e testes automatizados sem credenciais ou chamadas reais. Os testes dos conectores usam HTTP e serviços simulados; não comprovam disponibilidade da Meta/WhatsApp. A tentativa de SSH para a HostGator retornou rede indisponível nesta sessão. Não houve implantação, execução de DDL no VPS, mudança de domínio nem envio a clientes. A interface foi exercitada em Chromium com respostas de API simuladas, em desktop e celular: sem erros JavaScript, sem transbordamento horizontal em 390 px e com disparo das operações de resposta manual e pausa. Isso não substitui o teste com sessão autenticada, banco e WhatsApp reais.

Comando dos testes relevantes:

```sh
pnpm exec vitest run server/nativeBot server/messaging/channels.test.ts server/messaging/channelInbound.test.ts server/privateConnectionAccess.test.ts server/manualInboxReply.test.ts server/privateInboxScope.test.ts server/manualInboxProvider.test.ts
```

Antes de publicar, executar os cenários abaixo no ambiente isolado e registrar evidências:

| Entrada/cenário                           | Comportamento esperado                                     | Campo/etiqueta/etapa                         |
| ----------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| QR válido e QR expirado                   | Conectar ou renovar, sem ativar o bot sozinho              | `wa_status`, QR temporário                   |
| Meta válida/assinatura inválida           | Receber ou rejeitar evento sem persistir indevidamente     | Canal, histórico                             |
| Caminho ideal de texto                    | Persistir, mostrar ao vivo e responder uma vez             | Mensagem, estado de envio                    |
| Resposta incompleta                       | Aplicar regras do perfil ou encaminhar                     | Modo bot/humano                              |
| Várias mensagens seguidas                 | Registrar em ordem e respeitar limite do motor             | Histórico, encaminhamento                    |
| Áudio/imagem/documento                    | Mostrar anexo permitido e encaminhar avaliação para equipe | Origem mídia, modo humano                    |
| Cliente muda de ideia/volta etapa         | Manter histórico e regras do motor existente               | Não há novo editor de fluxos nesta entrega   |
| Pedido de humano                          | Suspender automação e registrar transferência              | `mode=human`                                 |
| Cliente não responde                      | Não criar lembrete extra sem regra habilitada              | Regras existentes                            |
| Pagamento falha                           | Não confirmar pagamento por IA                             | Integração financeira fora desta mudança     |
| Agenda indisponível/horário ocupado       | Não inventar horário nem reservar por prompt               | Ferramentas transacionais fora desta mudança |
| Sistema externo não responde              | Registrar falha/resultado incerto sem duplicar envio       | Status e erro                                |
| Cliente já existe                         | Vincular somente cadastro inequívoco do estúdio            | `client_id`, `artist_id`                     |
| Evento repetido/cliente entra duas vezes  | Não duplicar mensagem e efeito                             | ID externo/idempotência                      |
| Dado ausente/regra desconhecida           | Rejeitar entrada inválida ou encaminhar                    | Validação/humano                             |
| Pausa com reinício do servidor            | Manter prazo no banco e descartar backlog na retomada      | `pause_until`, revisão                       |
| Pausa durante resposta e duas abas        | Respeitar lock/revisão, não produzir resposta concorrente  | Fila, revisão                                |
| Bot geral desligado                       | Continuar permitindo atendimento manual autorizado         | `enabled=0`, mensagens staff                 |
| Transferência a pessoa não autorizada     | Rejeitar sem ampliar acesso                                | Responsável inalterado                       |
| Outro estúdio/artista pede conversa/anexo | Negar acesso                                               | Nenhuma exposição                            |
| Assistente trocado/desativado             | Cancelar saída antiga e exigir revisão/retomada            | `assistant_id`, revisão                      |
| Desconexão/reconexão em réplicas          | Uma única proprietária por sessão, sem replay antigo       | Lock, sessão cifrada                         |
| Opt-out antes de expirar pausa            | Não reativar automaticamente                               | `opted_out=1`                                |

Reversão: desabilitar QR, desconectar a sessão pelo painel, parar a nova versão e restaurar a imagem anterior no ambiente de teste. Preservar as novas tabelas até conferir o histórico; não executar `DROP` para reverter a interface.

Referências técnicas consultadas: [Baileys](https://github.com/WhiskeySockets/Baileys), [conexão e autenticação](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/connecting.md), [mídias](https://github.com/WhiskeySockets/docs/blob/main/messaging/media-messages.mdx), [Meta — mensagens](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages).
