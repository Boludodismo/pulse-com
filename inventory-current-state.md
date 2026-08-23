# Diagnóstico inicial do estoque

Data da análise: 13 de agosto de 2026.

O módulo existente já oferece cadastro manual de materiais, categorias genéricas, unidade, estoque atual e mínimo, custo médio, fornecedor, observações, movimentações e kits de procedimento. A tabela `materials` ainda não possui campos estruturados para marca, linha, tipo técnico, configuração, lote, validade, esterilidade, registro sanitário, cor, calibre, compatibilidade, embalagem, código/SKU ou ficha de especificações.

Na interface atual, a busca considera apenas o nome e o filtro considera somente a categoria. A inclusão de um material é feita por formulário curto, sem mecanismo de seleção de catálogo, enriquecimento técnico, busca por marca ou proteção contra itens tecnicamente ambíguos. A navegação já posiciona o estoque como módulo administrativo e usa um painel escuro com destaque laranja; a proposta será desenhada dentro desse padrão.

No banco atual existem cinco materiais ativos em três categorias: três registros em Agulhas, um em Equipamentos e um em Tintas. O diagnóstico confirma que a mudança deverá preservar estoque, mínimos, custos, fornecedores, movimentações e kits já existentes; ela acrescentará uma camada de catálogo técnico para tornar esses registros encontráveis e padronizados.
