# Autorizações de tatuagem para menores

No cadastro do cliente, “Enviar anamnese ou autorização” permite selecionar o termo para menor. A data de nascimento sugere a seleção, sem substituir a conferência documental. O modelo do artista prevalece sobre o do estúdio. O profissional pode revisar logo, identificação, endereço, contato, texto e procedimento antes de gerar um link de sete dias.

Cada solicitação preserva seu modelo e procedimento. O link aleatório tem 256 bits e só o hash é armazenado. O formulário exige identificação, assentimento do menor, autorização e declaração de legitimidade do responsável, documentos de ambos e prova de tutela/guarda quando indicada. A anamnese vinculada deve estar concluída; uma cópia de suas respostas e os hashes dos anexos entram no registro recebido. Datas e CPF/CIN são validados. O envio encerra a edição pública; mudanças na arte exigem nova solicitação.

Assinaturas desenhadas são identificadas como eletrônicas simples. Na opção externa, o menor registra seu assentimento no PDF preparado pelo servidor e o responsável assina o arquivo com gov.br ou ICP-Brasil. O PDF devolvido é preservado byte a byte, sem carimbo, mesclagem, compressão ou reconstrução posterior. Mudanças nos dados, anamnese ou documentos de identidade após preparar o PDF exigem nova preparação e assinatura. A marca de recebimento não certifica a assinatura: o artista deve conferir o conteúdo, os signatários e o resultado do VALIDAR/ITI, anexar o relatório PDF e registrar sua análise. O sistema distingue recebimento de conferência manual.

Os anexos são privados. Downloads exigem sessão, permissão de anamnese, vínculo com cliente, estúdio e artista. Os endpoints genéricos de armazenamento recusam os prefixos deste módulo. O servidor limita tamanho, tipo, quantidade total de bytes e frequência dos envios. O WhatsApp recebe apenas aviso e link ao cadastro autenticado, sem documentos ou dados de saúde. Os destinatários são resolvidos no servidor pelos números atuais do artista e do estúdio; a fila existente realiza o envio e o histórico mostra falhas e pendências de configuração. Avisos ao artista respeitam sua preferência operacional. Não há garantia de entrega sem integração ativa ou fora das condições aceitas pelo provedor.

Os materiais são um complemento técnico posterior. O PDF assinado não é refeito; atualizações ficam no histórico com autor e data. O backup por revisão contém os dados, os anexos originais, a anamnese capturada, o histórico e os avisos. É armazenado criptografado com AES-256-GCM no bucket privado e relido para verificar integridade. A tarefa reprocessa pendências. Isso complementa os backups do banco; não declara existir cópia externa independente do bucket. A conservação e os pedidos de eliminação devem observar as obrigações legais, o exercício regular de direitos e o melhor interesse do menor.

Para verificar um backup baixado, execute no ambiente administrativo com a AUTH_SECURITY_KEY original:

```bash
node scripts/restore-consent-backup.mjs --input autorizacao-backup.enc
node scripts/restore-consent-backup.mjs --input autorizacao-backup.enc --output /caminho/novo-diretorio
```

O comando confere a autenticação do arquivo e os hashes de todos os anexos. A extração gera arquivos privados e um registro JSON; nunca escreve no banco de produção. A chave original precisa integrar o procedimento administrativo de recuperação e rotação de segredos.

As tabelas são aditivas e criadas na inicialização: tattoo_consent_templates, minor_consent_requests, minor_consent_files, minor_consent_events e minor_consent_notices. Não há inclusão de clientes, dados pessoais de exemplo ou alteração de registros anteriores na migração.

Referências oficiais: [ECA](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm), [Código Civil](https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm), [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [MP 2.200-2](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm), [Código de Saúde de MG](https://www.almg.gov.br/legislacao-mineira/texto/LEI/13317/1999/atualizado), [Resolução SES/MG 8.115/2022](https://www.saude.mg.gov.br/wp-content/uploads/2022/05/RESOLUCAO-SES-8115-PDF-85e.pdf), [ITI sobre assinatura avançada](https://www.gov.br/iti/pt-br/assuntos/assinatura-eletronica-avancada) e [VALIDAR](https://validar.iti.gov.br). Consulta em 17/10/2026. As normas gerais, o consentimento familiar e a conferência manual não afastam restrições específicas do estado ou município. Não se anuncia integração direta com a API gov.br, destinada a aplicações públicas autorizadas.
