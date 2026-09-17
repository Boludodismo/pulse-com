# Catálogo de teste e estimativas — 17/09/2026

Solicitação: popular todas as referências de exemplo com saldo fictício, mínimo para alerta e estimativa de custo. A importação exige administrador, permissão de estoque e artista ativo do mesmo estúdio.

## Limites da pesquisa

Não foram obtidas 909 cotações individuais. Foram consultados anúncios brasileiros de cartuchos, tintas, descartáveis, fontes, máquinas e cuidados pós-tattoo. `shared/inventoryTestCatalog.ts` conserva os preços-base, apresentações e links. A extrapolação por família/similar não confirma o preço de cada SKU. Conversões entre embalagens e unidades estão visíveis na ficha. Itens sem referência comparável confirmada ficam com preço pendente (campo zero, não gratuito), explicitamente identificado; não recebem fatores de preço inventados. Máquinas de marcas e faixas diferentes não são equiparadas. Não inclui frete e não associa uma loja pesquisada como fornecedor contratado.

Exemplos: Skin Ink RL/Fine Line R$189/20 = R$9,45/un; BIG R$189/10 = R$18,90/un; referência nitrílica Unigloves R$39,90/50 pares = R$0,798/par; tinta Electric Ink 30 ml R$89,90 = R$2,9967/ml. Os valores correspondem a anúncios consultados, não a uma média estatística do mercado nem a uma recomendação de compra.

## Saldos e repetição

906 das 909 referências podem ser importadas. As três Dynamic bloqueadas são excluídas pela regra existente. Nenhum status sanitário ou evidência técnica é alterado. Não se inventam lote, validade ou fornecedor.

Novos registros pertencem ao artista escolhido; cada entrada recebe histórico e identificação de teste. Cartuchos: 20 un, mínimo 5. Líquidos: apresentação do catálogo ou ao menos 30 ml. Demais consumíveis: apresentação ou ao menos 10 unidades-base. Mínimo inicial: 25%. Equipamentos: 2 un, mínimo 1. Valores são convenções de teste, não previsão de consumo real.

Registros existentes de mesma marca/linha/SKU são preservados, inclusive inativos. Saldos não são repostos ao repetir. Custos zero são preenchidos uma única vez com movimentação sem alteração de quantidade; custos positivos, mínimos existentes, proprietário e fornecimento permanecem. Cada bloco de 25 referências é transacional, com lock do estúdio para evitar duplicação entre importações simultâneas. Não há alteração de mensagens, lembretes ou aniversários.
