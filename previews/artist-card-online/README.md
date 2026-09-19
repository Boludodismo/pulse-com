# Cartão do artista — prévia online isolada

Snapshot do protótipo aprovado Base_Cartao_Artista_Tatuei.zip, publicado somente para revisão visual e teste de preenchimento em uma aba de navegador. Não é a integração React/tRPC com o cadastro do CRM, nem uma atualização de produção.

## Conteúdo

Mesmo layout editorial, pilha Helvetica Neue/Helvetica/Arial, preto/carvão/cinza/laranja #F97316, biografia e ficha profissional separadas, galeria e links HTTPS. Fotografias sintéticas da arte aprovada, otimizadas em WebP. Nenhuma imagem, credencial ou contato privado de um cadastro real foi incluído. A barra identifica a prévia e oferece Testar preenchimento. Edições/fotos permanecem em memória nesta aba; recarregar restaura o exemplo.

## Isolamento

Servidor Node sem dependências e sem importação do CRM. Somente GET/HEAD; nenhum endpoint de escrita, acesso a banco, armazenamento remoto, autenticação, webhook, integração externa ou fila. Não exige variáveis além do PORT opcional. CSP bloqueia connect-src e submissão de formulários. Não definir credenciais do CRM neste serviço. Não alterar o serviço courageous-hope nem seu domínio. Usar uma nova instância exclusiva em staging-custos e domínio Railway próprio.

## Snapshot verificável

A página autocontida está compactada em Brotli e dividida em três partes, sem perda após a otimização das fotos. O servidor concatena as partes e valida o SHA-256 do HTML descompactado antes de abrir a porta: f1c733770f8de84e224762bc93c9b8a1fd8ac0577cd4dd8cc775cee3ce72ce8d. Para extrair o HTML: node --input-type=module -e "import{readFileSync,writeFileSync}from'node:fs';import{brotliDecompressSync}from'node:zlib';writeFileSync('index.html',brotliDecompressSync(Buffer.concat([1,2,3].map(n=>readFileSync('page.'+n+'.brpart')))))".

## Validação local

28 verificações aprovadas: renderização Chromium em 320/390/768/1024/1440 pixels, ausência de rolagem horizontal, imagens carregadas, ausência de formulário de captação no cartão, edição de nome/biografia/formação, ampliação de fotos e Escape, restauração ao recarregar, nenhuma solicitação de rede externa durante o teste e HTTP/health do servidor. O Chromium local não permite navegar para localhost nesta sessão, então a verificação visual usou set_content com os mesmos bytes, e HTTP foi testado separadamente por urllib. Não houve teste em iPhone físico, banco de dados, permissões reais do CRM nem envio de mensagens. A integração ao cadastro persistente continua pendente.
