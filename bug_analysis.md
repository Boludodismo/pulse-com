# Análise de Bugs — PDF + pasted_content_5.txt

## Evidências do PDF (2 páginas)

### Página 1 — ClientProfile (https://tatuei.com/clients/1110176)
- Sidebar visível com todos os itens (Dashboard, Clientes, etc.) em texto cinza claro sobre fundo branco — **o PDF foi gerado em modo light/print, não dark**
- Área de conteúdo principal está CORTADA à direita — o card do cliente está sendo truncado (textos cortados: "Willian de Almei...", "Total Gas...", "Agendamento...desde", "jun de 2026")
- As abas (TabsList) NÃO aparecem na página 1 — foram empurradas para fora do viewport de impressão
- O conteúdo principal está sendo sobreposto/cortado pela sidebar

### Página 2 — Aba Agendamentos (continuação)
- Conteúdo da aba Agendamentos aparece cortado à esquerda (textos: "damentos", "atuagem", "ttoo", "essão realismo")
- O sidebar está sobrepondo o conteúdo principal — a área de conteúdo não tem margem/padding suficiente à esquerda
- Na parte inferior aparece "Agendamentos" com ícone POD — confirma que as abas estão no rodapé/sticky bottom

## Diagnóstico Principal

**Problema 1 — Layout:** O conteúdo principal está sendo cortado pela sidebar. Isso ocorre porque o `SidebarInset` ou o container principal não está respeitando a largura da sidebar quando ela está expandida.

**Problema 2 — Abas cortadas:** O TabsList sticky está funcionando mas o conteúdo das abas está sendo cortado pela sidebar (overflow hidden + largura incorreta).

**Problema 3 — Anamnese:** Usuário quer melhorias no fluxo de anamnese (Correções 2-7 do texto).

## Arquivos a Modificar

1. `client/src/components/DashboardLayout.tsx` — layout sidebar/main
2. `client/src/pages/ClientProfile.tsx` — abas, conteúdo cortado
3. `drizzle/schema.ts` — novos campos para anamnese (se necessário)
4. `server/routers.ts` ou `server/routers/anamnesis.ts` — lógica de anamnese
5. `client/src/index.css` — CSS global

## Correções Prioritárias

### ALTA PRIORIDADE (layout cortado)
- [ ] Corrigir overflow/largura do container principal para não ser cortado pela sidebar
- [ ] Garantir que o conteúdo não fique atrás da sidebar em nenhuma resolução

### MÉDIA PRIORIDADE (anamnese)
- [ ] Botões de reenvio/novo link de anamnese na aba Anamnese
- [ ] Campo "Tipo de procedimento" no novo agendamento
- [ ] Status expandido para fichas de anamnese
- [ ] Histórico de fichas com data/status/ações

### BAIXA PRIORIDADE (melhorias)
- [ ] Reaproveitamento de dados antigos na nova ficha
- [ ] Opção de confirmar/atualizar na ficha reenviada
