# Cartão editorial — atualização localizada

Base: produção 7928a2fe81263c0293d4a4a63330cadfb18764fe. O conteúdo visual e os procedimentos foram revisados a partir da branch isolada de testes, sem copiar scripts de demonstração, dados fictícios ou dist gerado.

## Contrato

Mesma rota /artista/:token, mesmos tokens e controle published. Campos antigos permanecem. presentation é TEXT nullable, versão 1. Salvamentos de clientes antigos não apagam a extensão. Salvar textos nunca permite substituir mídia por URL arbitrária. Uploads de capa, biografia e processo são independentes do portfólio, usando validação e armazenamento já existentes. Alterar enquadramento ou excluir uma foto exige a chave atual para rejeitar operações antigas. Reordenar o portfólio exige a sequência vigente. A consulta pública projeta explicitamente os campos publicados, sem devolver chaves de mídia como propriedades adicionais ou dados internos do artista.

## Interface

Artistas > Cartão virtual. Fotografias da apresentação oferece três seletores de arquivo e enquadramento. JPG/PNG/WebP até 5 MB. Fotos e ordem são salvas imediatamente, como o portfólio antigo; texto/publicação dependem de Salvar cartão. Ver prévia usa o mesmo renderer público. Paleta preta/carvão/cinza/laranja #F97316, fonte Helvetica Neue/Helvetica/Arial isolada por CSS Modules. Sem formulário de contato. Redes vazias não aparecem. Nenhuma credencial, imagem ou biografia fictícia vira dado inicial.

## Liberação

Após testes e autorização, a imagem nova pode executar uma única vez `node server/artistCardRelease.mjs` como pre-deploy do serviço real. O programa valida o serviço/ambiente, salva somente artist_cards em snapshot AES-256-GCM no bucket privado existente, lê de volta e verifica os bytes descriptografados, e só então adiciona/verifica a coluna nullable. Ele não gera URL pública do backup, não copia dados de clientes e não publica nenhum cartão. O objeto de recuperação é registrado no log operacional; a chave de criptografia é derivada do JWT_SECRET vigente com HKDF e sal aleatório. Preservar esse segredo no gerenciador seguro para recuperação. Não colocar snapshots ou segredos no GitHub.

A migração 0059 é idempotente; a execução por pre-deploy e pelo mecanismo existente de migrations não causa coluna duplicada. Não habilitar migrations globais nem alterar parâmetros de agendamento para esta tarefa. Retirar o comando temporário de pre-deploy depois de verificar o rollout, restaurando a configuração anterior.

## Reversão

Retornar ao deployment estável af7d303f-f3ca-4620-9610-747f27018c9a / commit 7928a2fe81263c0293d4a4a63330cadfb18764fe. Deixar a coluna presentation e seus dados intactos; a versão anterior não depende dela. Não restaurar o banco inteiro nem apagar uploads. Recuperação de dados, se necessária, exige decryptCardSnapshot com o segredo vigente no momento do backup e reconciliação seletiva por um operador autorizado, para não desfazer alterações legítimas posteriores. O helper não oferece restauração automática.

## Limites da validação

Registrar separadamente build, diagnóstico de tipos comparado à base, testes de contratos/HTML e testes HTTP com banco/armazenamento isolados. Testes de navegador em Chromium não equivalem a teste em iPhone físico. Nenhum teste deve enviar mensagens reais nem usar o cadastro de clientes como fixture.
