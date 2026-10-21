# Janelas visuais da Sessão Tattoo — 21/10/2026

Escopo: apenas apresentação e gerenciamento das janelas do cockpit da sessão.
Sem mudanças de esquema, APIs, permissões, baixas, finanças ou regras da agenda.

## Implementação

- Preferências, preparação, materiais, consumo, receitas, amostras, nova camada,
  notas e revisão da conclusão usam a mesma janela translúcida.
- Arraste por mouse/toque/caneta e setas do teclado, com limites calculados a partir
  da posição inicial e do tamanho real do cockpit/viewport visual.
- Minimizar preserva os componentes/campos montados. Pílulas têm restauração e
  fechamento; abrir novamente pela ferramenta restaura sua janela.
- Ferramentas independentes podem coexistir e recebem foco/z-index ao interagir.
  Consumo, receita e amostra mantêm exclusão mútua porque compartilham o rascunho
  existente; isso preserva o fluxo original desses editores.
- Cada ação assíncrona fecha sua própria janela, mesmo se outra ganhar foco
  durante a operação. Escape fecha a janela ativa; toque fora recolhe as janelas.
- Rolagem interna independente e espaço reservado para pílulas minimizadas,
  evitando sobreposição com botões de confirmação.
- Cabeçalho mede sua altura ao quebrar nomes longos. Redimensionamento/orientação
  reajusta as janelas. Preferências de tamanho e opacidade continuam aplicadas.
- A descrição flutuante de material permite tocar no botão que estiver atrás
  dela em telas estreitas; o fechamento da descrição permanece interativo.

## Validação

- TypeScript: `tsc --noEmit --target ES2022 --incremental false` aprovado.
- 91 testes de regressão de sessão, gestos, cores, materiais e janelas aprovados.
- Vite e bundle do servidor compilados.
- `scripts/session-glass-regression.mjs`: cockpit real com RPCs locais simulados,
  sem banco ou mensagens externas, em Chromium: 320×568, 390×844, 667×320,
  768×1024 e 1440×900. Verifica limites, overflow de texto, rolagem, minimizar,
  restaurar, maximizar, valores dos campos, receitas, payload de consumo, callbacks
  de tempo/conclusão, camadas, amostras, notas e redimensionamento.
- Notas e conclusão assíncrona testadas nas larguras em que o botão já está
  disponível no layout existente (acima de 620px).
- A validação em navegador usa fixtures. Não substitui o teste com uma sessão
  real no dispositivo do usuário; publicação é verificada separadamente.

Para executar: primeiro `pnpm build`; depois `node scripts/session-glass-regression.mjs`
com Playwright instalado, ou `PLAYWRIGHT_MODULE_ROOT=/caminho/node_modules`.
`BROWSER_ENGINE=webkit` seleciona WebKit quando esse navegador estiver disponível.
