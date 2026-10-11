# Personalização do cartão do artista

## Resultado

O painel privado do cartão permite recortar e posicionar as fotos de apresentação e do portfólio, ajustar o zoom e escolher cor ou preto e branco por imagem. O processamento usa Sharp no servidor; a original fica preservada para novas edições ou restauração. O editor funciona por arraste e gesto de pinça no celular.

O artista escolhe explicitamente telefone e e-mail públicos. Esses campos alimentam o contato `.vcf`, o QR Code de contato e a página pública. Dados privados da conta não são copiados automaticamente. A importação na agenda depende da confirmação do cliente no aplicativo do aparelho.

O painel também oferece pausa/publicação, cópia e compartilhamento do link, QR Code do perfil, QR Code do contato e PDF. O QR de contato contém dados do contato e pode ser lido sem internet; abrir o perfil atualizado exige internet. Pausar o cartão impede a consulta pública, mas não revoga arquivos que já foram baixados. O PDF usa o proxy interno existente para imagens do armazenamento; se uma imagem externa estiver indisponível, o download informa a ausência.

## Compatibilidade e autorização

- Sem migração de banco, alteração de variáveis ou regravação em massa. Metadados de edição e contato são opcionais no JSON do cartão.
- Cartões antigos continuam válidos na nova versão. Fotos antigas da apresentação mantêm o efeito visual anterior até uma escolha explícita do artista; portfólio antigo permanece colorido.
- As três novas mutações exigem autenticação, estúdio e permissão sobre o artista. Artista convidado só edita o próprio cartão.
- Chaves do armazenamento são verificadas pelo prefixo do estúdio/artista antes de ler a original. O cliente não escolhe uma URL para o servidor buscar.
- Atualizações usam bloqueio da linha e chave esperada da imagem; edições sobre fotos substituídas retornam conflito. Textos, ordem e legendas são preservados nas edições.
- A resposta pública omite chaves, referências à original e parâmetros privados de edição. O cliente não recebe os controles de configuração.
- Originais e cópias derivadas não são apagadas automaticamente. Operações interrompidas podem deixar cópias sem referência, sem substituir a imagem anterior.

## Verificação antes da publicação

- `npm run check`: passou.
- Build de produção: passou.
- 112 testes em oito arquivos: processamento real de imagem, orientação EXIF de celular, recorte, cor, limite de resolução, restauração, autorização, conflitos, projeção pública, vCard e regressões de cadastro/convites/autenticação.
- Interface em Chromium, computador 1440×1000 e celular 390×844 com toque: upload com ajuste antes de salvar, recorte, arraste/pinça, zoom, preto e branco, restauração, contatos, pausa/publicação e downloads. Dados fictícios e API em memória; processamento Sharp real. Nenhum registro de cliente foi alterado nesses testes.
- Leitura dos PNGs de QR Code confirmou os conteúdos do perfil e do contato. PDFs gerados tiveram três páginas e seis imagens incorporadas; o texto incluiu apenas o e-mail público. Primeira página inspecionada visualmente.
- Importação física na agenda de um iPhone ou Android e compartilhamento nativo dependem do aparelho e devem ser conferidos pelo usuário após a publicação.

## Publicação e reversão

Base: `70ac15c4083cfe89a8ed3571d0b2cfbfdee50c35`. Publicar somente o serviço CRM no ambiente de produção, preservando o banco e as variáveis de segurança existentes. Confirmar o commit exato, status `SUCCESS`, saúde HTTP e bloqueio de chamadas privadas sem sessão.

Uma reversão à base preserva os arquivos e registros, mas o validador estrito da versão anterior não reconhece o novo campo de contato: a apresentação dos cartões já editados pode deixar de aparecer temporariamente. Preferir correção aditiva a uma reversão que remova suporte aos novos metadados. Nenhuma limpeza automática de dados é parte da reversão.

Bot, sincronização financeira/calendários e configuração de autenticação em dois fatores não fazem parte desta entrega.
