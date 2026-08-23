# Diagnóstico de fornecedores para o catálogo técnico

Data de verificação: 13 de agosto de 2026.

O banco atual possui dois fornecedores ativos. **Art Hand’s** tem cinco materiais ativos associados; quatro são registros de cartucho descritos de forma livre e um é tinta preta. **Flávio Material BH** está ativo, mas ainda não possui materiais associados. Hoje, a relação é apenas `material → supplierId`; não há tabela de marcas, catálogo de linhas, modelos ou uma ligação formal `fornecedor → marca`.

| Fornecedor ativo | Materiais atualmente vinculados | O que a estrutura permite afirmar | O que ainda não pode afirmar |
|---|---:|---|---|
| Art Hand’s | 5 | O fornecedor já forneceu os cinco materiais cadastrados. | Quais marcas, linhas, configurações ou modelos comerciais ele trabalha. |
| Flávio Material BH | 0 | O fornecedor está cadastrado e pode ser pesquisado. | Marcas e itens efetivamente comercializados. |

## Consequência para a busca proposta

A prévia mostrará fornecedores em três níveis de evidência, para não fazer uma associação comercial fictícia:

| Evidência do fornecedor | Regra de exibição no resultado | Estado atual |
|---|---|---|
| **Fornece este item** | O fornecedor já está associado ao mesmo material/SKU, ou a uma futura referência de catálogo específica. | Art Hand’s pode ser mostrado nos cinco itens já vinculados. |
| **Trabalha com a marca** | O fornecedor possui uma futura associação explícita com a marca. | Ainda não existe no banco; será cadastro próprio. |
| **Fornecedor cadastrado sem portfólio validado** | O fornecedor aparece em seção separada, sem selo de compatibilidade. | Flávio Material BH; não será exibido como vendedor da marca/modelo até validação. |

## Estrutura necessária após aprovação

Para que a busca por marca/modelo encontre fornecedores com precisão, a implementação criará registros próprios de **portfólio de fornecedor**. Cada vínculo terá fornecedor, marca, linha opcional, item de catálogo opcional, SKU opcional, status, URL/fonte, última verificação e observação comercial. Isso permitirá que um fornecedor esteja ligado à marca inteira, a uma linha ou a uma variação específica, sem confundir histórico de compra com disponibilidade atual.
