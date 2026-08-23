# Especificação da busca por marca, modelo e fornecedor

## Princípio de precisão comercial

Um fornecedor somente será mostrado como compatível com uma marca ou variação quando existir um vínculo explícito de portfólio ou um item de estoque correspondente. O sistema não usará a mera existência de um fornecedor cadastrado para afirmar que ele vende Cheyenne, Kwadron, Electric Ink ou qualquer outra marca.

## Busca combinada

| Controle | Comportamento | Exemplo |
|---|---|---|
| **Busca global** | Localiza marca, linha, SKU, formato, número de pontas, diâmetro, taper, cor, apresentação e fornecedor. | `WJX Acme 1207RLT`, `Cheyenne 0,30 7RL`, `Art Hand's`. |
| **Filtro Marca** | Mostra somente marcas do catálogo. Ao selecionar uma marca, restringe linhas, modelos e fornecedores validados. | `Kwadron`. |
| **Filtro Linha/Modelo** | Depende da marca quando ela estiver selecionada, mas também permite procura direta. | `Revolution Curved Magnum`. |
| **Filtro de configuração** | Aparece somente para cartuchos: formato, pontas, diâmetro, taper e apresentação. | `RL · 7 pontas · 0,30 mm · LT`. |
| **Filtro Fornecedor** | Mostra apenas fornecedores com vínculo de portfólio ou histórico correspondente. | `Fornece este item`, `Trabalha com a marca`, `Sem portfólio validado`. |
| **Modo de resultado** | Alterna entre tabela de variações e painel de fornecedores. | `Ver variações` / `Ver fornecedores`. |

### Critério de correspondência

A busca será normalizada para aceitar maiúsculas, acentos e códigos sem pontuação. Ela dividirá a consulta em tokens e retornará o resultado quando cada token ocorrer em algum campo pesquisável. Assim, `0,30 7RL`, `030 7 rl` e `7 RL Cheyenne` encontrarão a mesma variação quando esses atributos forem confirmados.

## Resultado de cartucho

Ao pesquisar ou selecionar uma combinação, a tabela terá os campos abaixo. Campos não documentados serão mostrados como **Confirmar SKU**, e não como valores estimados.

| Coluna | Regra |
|---|---|
| Marca e linha | Link para a ficha técnica da família. |
| SKU/modelo | Código publicado; se houver somente família, o sistema identifica a limitação. |
| Formato | RL, RS, Flat, Magnum, Soft Edge, Curved, Textured, Open ou Power. |
| Pontas, diâmetro e taper | Valores exatos da variação; em ordem numérica. |
| Apresentação | Unidade, 5, 10, 20, 50 ou outra quantidade publicada. |
| Aplicação | Descrição curta com origem da informação. |
| Fornecedores | Chips por nível de evidência; o chip abre a ficha comercial do fornecedor. |
| Ação | `Adicionar ao estoque` pré-preenche o item técnico e pede lote, validade, custo e quantidade. |

## Painel de fornecedores no resultado

Depois de selecionar uma marca ou modelo, o painel lateral terá três seções:

| Seção | Quando aparece | Informações exibidas |
|---|---|---|
| **Fornece esta variação** | Há vínculo com SKU ou item de catálogo específico. | Fornecedor, telefone/WhatsApp, última verificação, embalagem e observação de compra. |
| **Trabalha com esta marca** | Há vínculo da marca, mas não da variação exata. | Fornecedor, linhas cobertas, fonte/URL e data de verificação. |
| **Fornecedores cadastrados sem portfólio validado** | O fornecedor está ativo, mas não possui associação confirmada. | Nome e contato, com ação `Cadastrar portfólio`; não recebe selo de compatibilidade. |

No estado atual, **Art Hand’s** será apresentado apenas como fornecedor histórico dos cinco materiais já vinculados. **Flávio Material BH** aparecerá como fornecedor ativo sem portfólio validado. Nenhum deles será associado automaticamente a uma marca do catálogo até a validação do portfólio.

## Modelo de dados proposto para a implementação posterior

| Entidade | Campos centrais | Finalidade |
|---|---|---|
| `catalog_brands` | id, nome, origem, site, ativo | Evitar duplicação de marcas. |
| `catalog_product_lines` | id, brandId, nome, categoria | Representar Craft, Revolution, Acme, Pro Universal e demais linhas. |
| `catalog_variants` | id, lineId, SKU, formato, pontas, diâmetro, taper, apresentação, aplicação, status de evidência | Registrar a variação pesquisável e ordenável. |
| `supplier_catalog_offerings` | id, supplierId, brandId, lineId?, variantId?, URL, status, última verificação, observação | Vincular fornecedor à marca, linha ou SKU sem ambiguidade. |
| `materials` (extensão) | catalogVariantId?, supplierId já existente | Vincular o estoque físico à referência técnica e manter compatibilidade com os materiais atuais. |

## Cadastro do portfólio do fornecedor

O formulário de fornecedor ganhará uma seção **Marcas e linhas comercializadas**. Nela, o usuário seleciona marca, linha opcional, variação opcional, URL/nota de evidência, status e data da última confirmação. Preço não será pré-preenchido: será informado pelo usuário em cada compra ou recebimento.

## Estados vazios e proteção de qualidade

Quando a busca não encontrar uma variação, ela oferecerá `Cadastrar referência pendente`, sem criar uma associação comercial. Quando encontrar uma marca sem fornecedor confirmado, mostrará o alerta **“Nenhum fornecedor cadastrado com portfólio validado para esta marca”** e o atalho `Vincular fornecedor`. Para dados técnicos incompletos, a mesma regra vale: o sistema aceita o registro como pendente, mas não apresenta valores inferidos como se fossem ficha de fabricante.
