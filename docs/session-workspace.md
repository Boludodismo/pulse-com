# Modo Sessão responsivo

A sessão POD oferece **Modo Sessão** ao lado do cronômetro. A interface usa a área disponível (`100dvh` e safe areas), painéis com altura limitada e controles de pelo menos 44 px. O botão de tela cheia usa a API do navegador quando disponível; o modo expandido funciona mesmo sem essa API.

## Recursos

- Coluna compacta, painéis de materiais/camadas/paleta arrastáveis pelo cabeçalho (também pelas setas do teclado), recolhimento e restauração da organização.
- Upload persistente via `procedures.uploadImage`: referência, contraste, decalque PNG transparente e paleta. Composição com visibilidade, ordem, nome, cópia, exclusão apenas da composição e opacidade individual. Alinhamento por pan/pinça/rotação e controles de escala/ângulo.
- Bloqueio da navegação separado do bloqueio das camadas; transformar a composição mantém o alinhamento relativo.
- Preferências de composição, enquadramento, atalhos e posições salvos **neste navegador**, separados por usuário, estúdio e procedimento. Os arquivos são armazenados pelo serviço já existente. As preferências não são sincronizadas entre dispositivos.
- Atalhos originados dos materiais planejados e busca no estoque permitido ao artista. Primeiro configurar lote/quantidade (sem consumir), depois tocar para registrar; estoque e histórico usam as transações existentes. Remover atalho não reverte consumo. Desfazer usa a reversão auditada.
- Sem retry automático de consumo, trava síncrona durante pedido e bloqueio de nova tentativa após resultado incerto até conferência do histórico.
- Ficha resumida com consulta de anamnese respeitando permissões; prontuário completo abre em outra aba. Cronômetro permanece ativo até pausa explícita.

## Verificação

`tsc --noEmit`, build Vite, testes `FloatingPanel.test.ts`, `podSaas.test.ts`, `inventoryAccess.test.ts` e `inventoryWorkflowRules.test.ts`.

Não modifica schema, disparos de mensagens, lembretes ou aniversários. Testes de interação devem usar homologação e materiais fictícios. Gestos em iPad físico devem ser confirmados pelo artista.
