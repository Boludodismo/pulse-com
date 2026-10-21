# Sessão: cronômetro e consumo lateral

O marcador de tempo chama as mesmas ações de iniciar, pausar e retomar já utilizadas pela sessão. O clique fica indisponível durante uma requisição e depois da conclusão. A tela principal e os modos normal e foco do painel usam esse fluxo. O servidor fornece segundos efetivos, preservando a precisão ao retomar sessões curtas e descontando pausas abertas/encerradas.

Os editores de consumo e mistura foram movidos para uma aba ao lado da barra de materiais. A aba tem rolagem própria e recolhimento; controles de gotas oferecem slider e entrada numérica. Mover o slider apenas prepara a quantidade. Confirmar registra a baixa e mantém a aba disponível para o próximo uso. Os demais submenus conservam as janelas de vidro arrastáveis, minimização, limites da tela e preservação dos rascunhos.

Misturas originais têm atalhos na barra. Repor mostra as cores desse batoque e o histórico, começando sem gotas novas selecionadas. Cada confirmação grava somente as adições em outro registro, com `refillRecipeId` apontando para a mistura original. Uma reposição não pode descontar outro recipiente. Os registros anteriores e seus custos permanecem preservados.

O vínculo exige mistura original ativa, mesma sessão/empresa e tamanho do batoque. Estoque, histórico e chave de repetição continuam na mesma transação. Falta de saldo em uma cor desfaz toda a operação. Repetir uma requisição já registrada não desconta novamente. Não é permitido desfazer a mistura original enquanto houver reposições ativas. Desfazer/refazer pela interface conserva as operações individuais.

A coluna nullable `procedure_ink_recipes.refillRecipeId` é criada pelo bootstrap aditivo da sessão antes de atender requisições. Não há migração ou modificação das misturas históricas. As alterações anteriores de cadastro/notificações permanecem na mesma árvore de código.

Validação: testes de estoque/receitas, precisão do tempo, acesso e funcionalidades anteriores, TypeScript ES2022 e build de produção. `scripts/session-glass-regression.mjs` executa o cockpit real no Chromium com RPCs locais, em 320×568, 390×844, 667×320, 768×1024 e 1440×900; verifica limites, textos, rolagem, arraste/minimização, cronômetro e os payloads de consumo e reposição. Não usa clientes/estoque reais nem confirma publicação em produção. `BROWSER_SINGLE_PROCESS=1` permite executar em ambientes sem sockets Unix; `PLAYWRIGHT_MODULE_ROOT` pode indicar dependências externas de teste.
