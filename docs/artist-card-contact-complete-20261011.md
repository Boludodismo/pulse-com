# Contato completo do cartão

Correção sobre `519f624ccd6c4c53115e8cfaaabd076c7236eede`.

- Acrescenta campos públicos opcionais de telefone/nome do estúdio e endereço (rua, número/complemento, cidade, estado, CEP, país). Mantém os contatos e cartões antigos válidos, sem migração ou regravação de registros.
- O painel oferece usar o telefone cadastrado do artista ou os dados cadastrados do estúdio. A consulta privada verifica a permissão sobre o artista e restringe ambas as fontes ao estúdio da sessão. Só retorna os campos necessários; não envia o e-mail privado do artista ou outros campos da conta.
- A escolha preenche o formulário, sem gravar ou publicar automaticamente. O artista confere e salva explicitamente. A resposta pública usa apenas os dados salvos no cartão, sem fallback automático para dados privados.
- O arquivo vCard 3.0 usa `TEL` para os telefones, `ORG` para o estúdio, `ADR` estruturado para o endereço, `EMAIL` e `URL` para contato e sites. Os links são agrupados com `X-ABLabel` para preservar seus nomes onde há suporte; inclui link de WhatsApp derivado exclusivamente do telefone público escolhido, sem duplicar um link já cadastrado. As redes também aparecem em `NOTE`, como alternativa para aplicativos que mostram menos campos de site. URLs são normalizadas como URI e textos são escapados; linhas são dobradas em 75 octetos UTF-8.
- O botão de contato abre uma URL `.vcf` com tipo `text/vcard`, disposição inline e sem cache, para oferecer importação nativa do celular. O endpoint consulta somente cartões publicados de artistas ativos e incorpora uma miniatura JPEG da foto pública disponível, lendo apenas chaves do armazenamento do estúdio e sem buscar URLs fornecidas pelo cliente. Se a foto estiver indisponível, os demais campos continuam disponíveis. Não copia dados dos prints nem inventa links de PIX.
- O QR de contato agora inclui todas as redes sociais salvas. Se o conteúdo exceder a capacidade do QR, a interface orienta usar o `.vcf` completo. O PDF e a seção pública também recebem o endereço e os dados públicos do estúdio.

Validação: TypeScript, build de produção, 119 testes em oito arquivos, interface Chromium em computador e celular com dados fictícios. Importação na agenda de aparelhos iOS/Android físicos permanece para conferência do usuário; o site não grava contatos silenciosamente no aparelho.

Referências de formato e importação: [RFC 2426](https://www.rfc-editor.org/rfc/rfc2426.html), [Apple](https://support.apple.com/en-ie/guide/iphone/iph356499f31/ios), [Google Contatos](https://support.google.com/contacts/answer/15147365?co=GENIE.Platform%3DAndroid&hl=pt-br).

Publicar exclusivamente a fonte do serviço CRM em produção. Sem alterações de variáveis, banco, bot, permissões de outros módulos ou registros de clientes. A aparência e os rótulos exibidos dependem do aplicativo de contatos. As opções de criar ou adicionar contato pertencem ao sistema operacional.

A versão anterior não reconhece novos campos de contato por usar validação estrita; preferir correções aditivas a uma reversão que remova o suporte a esses campos.
