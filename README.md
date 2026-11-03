# MyDocx v0.3

Extensão Brave / Chrome para organizar Google Docs no Google Drive em uma interface clara, minimalista e inspirada no Finder do macOS.

## Funcionalidades

- Conexão com conta Google via OAuth 2.0 e carregamento automático de pastas e documentos Google Docs existentes.
- Criação, renomeação, cores e subpastas reais do Drive.
- Mover documentos e pastas com arrastar e soltar ou pelo menu de opções.
- Favoritos sincronizados com as estrelas do Google Drive, ordenação por recentes, busca por nome.
- Grade/lista, navegação em árvore, breadcrumbs e atualização manual/ao voltar para a janela.
- Acesso direto ao Google Docs, abrindo os documentos no site oficial.
- A biblioteca local anterior foi preservada e pode ser aberta pelo botão Biblioteca local.
- A marcação experimental de texto dentro do editor Google Docs continua disponível.
- Sem servidor próprio e sem conexão com o ChatGPT.

## Instalação

1. Na aba Actions do GitHub, abra a execução bem-sucedida de Package MyDocx.
2. Baixe MyDocx-v0.3, extraia o ZIP e selecione a pasta do manifest.json em brave://extensions ou chrome://extensions > Carregar sem compactação.
3. Se estiver atualizando, coloque a nova versão na mesma pasta da anterior para preservar dados locais e o ID.
4. Para conectar uma conta, siga [SETUP-GOOGLE.md](SETUP-GOOGLE.md) e configure o Client ID OAuth. Nenhuma credencial Google vem incorporada ao projeto.
5. Abra MyDocx e clique em Conectar com Google. Até lá, a Biblioteca local funciona sem conta.

## Estrutura

- cloud.html / cloud.css / cloud.js: nova interface Google Drive e API oficial.
- dashboard.html / dashboard.css / dashboard.js: organizador local legado.
- background.js: abre a interface conectada.
- content.js / content.css: acesso ao MyDocx a partir do Google Docs e marca-texto experimental.
- scripts/verify.mjs: verificações de estrutura.

Apenas metadados dos documentos existentes são acessados pela extensão. Não há acesso ao conteúdo dos textos através da integração do Drive. O marca-texto baseado na interface do editor continua experimental, já que o Google Docs usa canvas.

## Testes

Execute node --check cloud.js; node --check dashboard.js; node --check content.js; node --check background.js; node scripts/verify.mjs.

Não há migração automática das pastas virtuais locais para as pastas reais do Google Drive, para evitar alterações silenciosas nos documentos. Exclusões na nova interface enviam itens à lixeira REAL do Google Drive.
