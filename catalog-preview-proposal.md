# Proposta visual e funcional — Catálogo técnico de materiais

> **Nota de biossegurança:** este é um desenho de organização e rastreabilidade de estoque, não um protocolo médico. A inclusão e o uso de tintas, produtos de processamento e itens de barreira devem ser confirmados pelo responsável técnico e pela vigilância sanitária local, com base no rótulo, lote e documentação vigente.

## Objetivo

O estoque passará a ter duas camadas complementares. A primeira continuará registrando o que o estúdio possui, consome, compra e movimenta. A segunda será uma **biblioteca técnica de referência**, pesquisável por marca, linha, configuração ou SKU. Assim, o cadastro não depende de digitar descrições soltas e cada entrada mantém a origem da especificação.

## Como está hoje

O módulo atual tem uma única lista de materiais com busca por nome e filtro por categoria. O formulário de inclusão coleta nome, categoria, unidade, estoque atual e mínimo, custo médio, fornecedor e observações. Há controles de movimentação, histórico e kits de procedimento. No banco, existem **cinco materiais ativos em três categorias**: Agulhas, Equipamentos e Tintas.

| O que já funciona | Limitação identificada |
|---|---|
| Estoque atual, mínimo e alertas | Não diferencia produto de marca/linha da quantidade física em estoque. |
| Fornecedor e custo médio | Não registra fabricante, SKU, apresentação, lote, validade ou fonte técnica. |
| Busca pelo nome | Não encontra por marca, configuração, calibre, taper, cor, volume ou referência. |
| Movimentações e kits | Não preserva rastreabilidade técnica do item consumido. |
| Categorias gerais | Não permite campos próprios para tinta, cartucho, autoclave, barreira ou pós-tatuagem. |

## Como ficará dentro do sistema

A página continuará no menu **Estoque** e preservará o painel escuro, a barra lateral e os acentos laranja do CRM. A área principal terá duas abas: **Meu Estoque**, para a operação diária já existente, e **Catálogo técnico**, para consultar itens padronizados antes de adicioná-los ao estoque.

### Catálogo por marca, linha e variação

A prévia anterior evolui de cards resumidos para uma navegação em três níveis. O usuário primeiro escolhe uma categoria, depois filtra a **marca** e a **linha/modelo**, e por fim vê as variações reais organizadas em ordem técnica. Para cartuchos, cada linha de resultado representa a configuração publicada: grupo, formato, quantidade de pontas, diâmetro, taper, apresentação e indicação de aplicação. Para tintas, batoques e outros insumos, a variação será definida por cor, volume, material, capacidade, dimensão, formato ou SKU, conforme a categoria.

| Categoria | Caminho de navegação | Ordenação prevista |
|---|---|---|
| **Cartuchos** | Marca → linha → configuração → variação | Configuração; pontas em ordem crescente; diâmetro crescente; taper. |
| **Tintas** | Marca → linha → família cromática → cor/modelo → volume | Família cromática; nome; volume crescente. |
| **Batoques** | Marca → material → formato → medida/capacidade → embalagem | Material; formato; medida/capacidade crescente; quantidade. |
| **Barreiras e descartáveis** | Marca → função → modelo → dimensão/espessura → embalagem | Função; dimensão/espessura; tamanho; apresentação. |
| **Stencil e transferência** | Marca → tipo → modelo → tamanho/volume → compatibilidade | Tipo; formato; tamanho/volume; tecnologia/compatibilidade. |
| **Máquinas e energia** | Marca → família → modelo → revisão/acessório | Modelo; curso; alimentação; compatibilidade. |
| **Preparo, limpeza e pós-tattoo** | Marca → subcategoria → modelo → apresentação | Subcategoria; linha; volume/peso/dimensão crescente. |

O arquivo normalizado `materials-catalog-normalized.csv` contém **319 registros** resultantes de 304 referências-modelo coletadas e 19 desdobramentos seguros de variações de cartucho. Quando uma página apresenta uma lista de pontas e um único diâmetro inequívoco, as pontas foram separadas em registros próprios. Quando diâmetro, taper ou combinação não estiverem claramente vinculados ao SKU, a linha continuará como família/modelo, preservando a fonte e impedindo qualquer inferência indevida.

![Prévia conceitual do catálogo técnico granular](/manus-storage/preview-catalogo-granular-estoque_025cd6b4.png)

> A imagem é uma prévia visual não funcional. Não adiciona produtos, não altera o banco e não substitui a validação por SKU, lote e fornecedor.

### Revisão profissional — cartuchos e fornecedores

A nova prévia concentra a página em um catálogo técnico de cartuchos. O topo reúne busca global e filtros dependentes de **marca**, **linha/modelo**, **fornecedor**, **formato**, **pontas**, **diâmetro**, **taper** e **apresentação**. A tabela central mostra cada variação confirmada em vez de uma descrição genérica da marca. O painel direito reúne os fornecedores compatíveis, distinguindo explicitamente quem fornece a variação, quem trabalha com a marca e quem ainda não tem portfólio validado.

![Prévia profissional de busca por cartuchos e fornecedores](/manus-storage/preview-catalogo-cartuchos-fornecedores_aeeb3635.png)

| Elemento revisado | Como funcionará após a aprovação |
|---|---|
| **Busca por marca e modelo** | A consulta aceita marca, linha, SKU e parâmetros como `0,30`, `7RL`, `LT` ou `Caixa 20`, sem exigir ordem fixa. |
| **Árvore técnica** | Mostra marcas e linhas, como Cheyenne → Craft/Safety/Capillary ou Kwadron → Cartridge System/Hybrid, antes da tabela de variações. |
| **Tabela de variações** | Ordena modelo, formato, pontas, diâmetro, taper e embalagem; cada célula preserva a origem e não extrapola valores por marca. |
| **Painel de fornecedores** | Diferencia `Fornece esta variação`, `Trabalha com a marca` e `Sem portfólio validado`; o sistema não presume disponibilidade comercial. |
| **Vínculo comercial** | Permite cadastrar portfólio por marca, linha ou SKU, com fonte, status e data de verificação, antes de exibir compatibilidade. |
| **Entrada no estoque** | Ao escolher uma variação, a tela pré-preenche o dado técnico e solicita somente dados operacionais da compra — incluindo quantidade, custo informado pelo usuário, lote, validade e fornecedor. |

| Elemento da nova tela | Como funcionará |
|---|---|
| **Busca universal** | Pesquisa por marca, linha, categoria, nome comercial, SKU, configuração, diâmetro, taper, cor, volume e palavra-chave técnica. Exemplo: `0,30 7RL`, `Iron Works preto 30 ml`, `MBoah 110 ml`. |
| **Filtros de categoria** | Cartuchos e agulhas; tintas e pigmentos; máquinas e alimentação; stencil; descartáveis e barreiras; higienização e esterilização; preparo de pele; pós-tatuagem. |
| **Cards técnicos** | Exibem marca, linha, nome, apresentação e somente especificações documentadas. Cada card terá o selo de evidência: fabricante, fornecedor, pendente ou bloqueado. |
| **Adicionar ao estoque** | Cria o item operacional a partir do card de catálogo e pré-preenche nome, categoria, unidade e detalhes técnicos. O usuário somente informa dados da compra e do estoque. |
| **Cadastro manual** | Continua disponível quando a marca/linha ainda não existir. O novo item entra como `Pendente de validação técnica`, para não ser confundido com referência curada. |
| **Validação de entrada** | Para itens com lote, validade ou controle sanitário, a entrada exibirá lista de verificação de documento, lote/validade e situação regulatória aplicável. |

### Ficha de variação de cartucho

Ao abrir uma linha como `Cheyenne Craft`, `Kwadron Cartridge System` ou `Mast Ocean Heart`, o usuário verá uma tabela ordenada de variações. A ficha terá uma coluna de fonte e não esconderá lacunas documentais. O padrão abaixo ilustra como a interface apresentará o dado sem afirmar combinações além das publicadas.

| Linha | Configuração | Pontas | Diâmetro | Taper | Apresentação | Aplicação | Evidência |
|---|---:|---:|---:|---|---|---|---|
| Cheyenne Craft | Round Liner | 3 | 0,30 mm | Confirmar por SKU | Caixa de 20 | Linha e detalhe — uso usual | Fonte técnica modelada |
| Cheyenne Craft | Round Liner | 5 | 0,30 mm | Confirmar por SKU | Caixa de 20 | Linha e detalhe — uso usual | Fonte técnica modelada |
| Cheyenne Craft | Round Liner | 7 | 0,30 mm | Confirmar por SKU | Caixa de 20 | Linha e detalhe — uso usual | Fonte técnica modelada |
| Mast Ocean Heart | Round Liner | 1 | 0,30 mm | 5,0 mm | Caixa de 20 | Fineline e micropigmentação | Fonte de produto brasileira |
| Mast Ocean Heart | Round Liner | 3 | 0,30 mm | 5,0 mm | Caixa de 20 | Fineline e micropigmentação | Fonte de produto brasileira |

> A demonstração usa apenas combinações que foram encontradas nas fontes consultadas. A indicação marcada como “uso usual” continuará identificada como orientação conservadora e não como alegação do fabricante.

## Jornada de trabalho proposta

| Etapa | Ação no sistema | Resultado |
|---|---|---|
| 1. Localizar | O usuário pesquisa por marca, linha, configuração ou SKU. | A biblioteca retorna resultados técnicos, não apenas nomes livres. |
| 2. Conferir | O usuário abre o card e vê a fonte, os campos confirmados e o que depende do SKU. | A decisão de compra/cadastro deixa de depender de memória ou de descrição genérica. |
| 3. Adicionar | O usuário seleciona **Adicionar ao estoque**. | Marca, linha, categoria e especificações verificadas são carregadas automaticamente. |
| 4. Informar o lote físico | O usuário preenche fornecedor, quantidade, unidade, custo, lote, validade e estoque mínimo. | O registro operacional fica ligado à referência técnica. |
| 5. Consumir e auditar | Movimentações, kits e POD Session usam o mesmo material cadastrado. | Consumo, reposição e histórico permanecem coerentes. |

## Campos do cadastro por categoria

| Categoria | Campos técnicos que aparecerão | Campos do estoque que permanecem manuais |
|---|---|---|
| **Tintas e pigmentos** | Marca, linha, cor, volume, fabricante/importador, fonte, status de regularização. | Lote, validade, fornecedor, quantidade, custo e mínimo. |
| **Cartuchos e agulhas** | Marca, linha, grupo, diâmetro, número de pontas, taper, membrana quando documentada, apresentação. | Lote, validade, caixa/unidade, fornecedor, quantidade, custo e mínimo. |
| **Máquinas e alimentação** | Marca, modelo, tipo, curso, frequência, peso, dimensões, bateria/fonte, número de série, garantia. | Fornecedor, custo, data de compra, manutenção e localização. |
| **Stencil e transferência** | Marca, linha, tipo, apresentação, compatibilidade, tamanho/referência quando documentados. | Lote, validade, quantidade, custo e mínimo. |
| **Barreiras e descartáveis** | Material, tamanho/dimensão, apresentação, condição de uso único, CA/registro se declarado. | Lote, validade, quantidade, custo e mínimo. |
| **Higienização e esterilização** | Classe, ativo e concentração publicada, diluição, tempo de contato, compatibilidade, registro/ficha. | Lote, validade, fornecedor, quantidade, custo e mínimo. |
| **Preparo e pós-tatuagem** | Finalidade, composição/ativos quando publicados, apresentação, dimensão ou volume, condições específicas. | Lote, validade, quantidade, custo e mínimo. |

## Proteções de qualidade planejadas

O catálogo não preencherá automaticamente informações que variam por SKU. Um cartucho pode ter marca conhecida, mas sem diâmetro e taper definidos; uma tinta pode ter marca e cor, mas não lote e validade. Nesses casos, a interface mostrará **“Confirmar no rótulo/ficha do SKU”**, em vez de criar uma especificação aparente, porém imprecisa.

| Status | Significado | Tratamento proposto |
|---|---|---|
| **Confirmado por fabricante** | Linha e atributo técnico possuem fonte primária identificada. | Pode ser sugerido no card e pré-preenchido. |
| **Confirmado por fornecedor** | Evidência de comercialização ou apresentação, sem ficha técnica completa. | Mostra a informação com fonte; exige conferência antes de concluir entrada. |
| **Pendente de validação de SKU** | Marca/linha conhecida, mas atributo não publicado ou não vinculado ao SKU. | Não pré-preenche o dado e solicita rótulo/ficha. |
| **Bloqueado por regularização não comprovada** | Item sujeito a controle sem evidência documental mínima. | Não permite marcá-lo como referência validada; mantém apenas como rascunho interno. |

## Base inicial pesquisada

A biblioteca inicial foi organizada em oito categorias e inclui, entre outras, as marcas Electric Ink, Iron Works Brasil, StarBrite, Dynamic, Cheyenne, Kwadron, EZ Tattoo, WJX, Mast, Brother, Spirit, MBoah, Volk, BeCare, Medix, Vic Pharma, Kelldrin, Cristófoli, 3M e Bepantol. A lista detalhada, com linhas, apresentações e fontes, está em `materials-catalog-research.md`. A seleção evita declarar que todas as marcas têm a mesma disponibilidade ou regularização: o sistema guardará essa diferença por evidência e por SKU.

## Modelo de dados proposto para a próxima etapa

| Entidade | Finalidade | Exemplos de dados |
|---|---|---|
| **Marcas** | Cadastro único de fabricante/marca e origem. | Electric Ink, Cheyenne, MBoah. |
| **Itens de catálogo** | Registro de marca + linha + nome comercial + categoria. | Cheyenne Craft, MBoah Transfer 10X Pro. |
| **Especificações técnicas** | Pares de campo e valor vinculados ao item de catálogo e à fonte. | `diâmetro: 0,30 mm`, `curso: 3,5 mm`, `volume: 110 ml`. |
| **Fontes e validações** | URL/documento, tipo de evidência, data de verificação e status. | Página do fabricante, ficha técnica, rótulo, Anvisa. |
| **Itens de estoque** | Registro atual de quantidade e ponto de reposição. | Estoque atual, mínimo, custo, fornecedor. |
| **Lotes de estoque** | Rastreabilidade do recebimento e da validade. | Lote, fabricação, validade, quantidade, nota fiscal. |

## Escopo que será implementado após aprovação

Depois da aprovação, a implementação criará a aba de catálogo, busca combinada, filtros, cadastro de marcas/linhas, vínculo com o estoque existente, campos condicionais por categoria, lote/validade e o selo de validação. Os cinco materiais existentes permanecerão preservados e poderão ser gradualmente vinculados a uma referência de catálogo, sem perda das movimentações e kits já registrados.

## Fontes principais

As regras para tinta e rastreabilidade partem das orientações da Anvisa.[1] As especificações de fabricantes, distribuidores e fichas técnicas foram organizadas no relatório anexo de pesquisa. A relação completa de links e limitações por marca está em `materials-catalog-research.md`.

[1]: https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2016/conheca-as-tintas-de-tatuagem-autorizadas "Anvisa — Conheça as tintas de tatuagem autorizadas"
