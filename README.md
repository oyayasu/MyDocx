# MyDocx — organizador para Google Docs

Extensão para **Brave e Chrome** (Manifest V3), sem servidor, sem login adicional e **sem integração com ChatGPT**.

## O que faz (v0.1)

- Biblioteca de atalhos para arquivos Google Docs, salva localmente no navegador.
- Criação de pastas e subpastas, com nomes e cores personalizadas.
- Mover documentos e pastas arrastando-os, ou pelo menu de contexto.
- Favoritos, busca, renomeação e remoção (sem excluir os arquivos reais).
- Ao abrir um documento do Google Docs, botão **MyDocx** para cadastrá-lo e abrir a biblioteca.
- Marca-texto experimental no editor Google Docs:
  - seleção arrastada da esquerda para a direita → aplica a cor atual;
  - seleção arrastada da direita para a esquerda → remove o destaque;
  - botão direito sobre a área do documento → paleta de cores e escolha de hexadecimal;
  - ativação e escolha da cor padrão na biblioteca.

## Instalação (Brave / Chrome)

1. No GitHub, use **Code → Download ZIP** e extraia o projeto.
2. Abra **brave://extensions** ou **chrome://extensions**.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta que contém o arquivo \`manifest.json\`.
5. Clique no ícone da extensão para abrir a biblioteca, ou acesse um documento Google Docs e use o botão **MyDocx** no canto inferior.

Não há processo de compilação: são HTML, CSS e JavaScript.

## Limitações importantes

- **Pastas são virtuais e locais.** Elas organizam links, não modificam as pastas reais do Google Drive. Dados locais não sincronizam automaticamente entre navegadores e podem ser perdidos ao limpar os dados da extensão.
- Para mover pastas reais ou buscar toda a lista de documentos automaticamente, seria necessária autorização direta para a **API do Google Drive**, independente do ChatGPT.
- **Marca-texto: experimental.** O editor do Google Docs utiliza canvas e a extensão não recebe uma seleção de texto comum via \`window.getSelection()\`. O protótipo detecta a direção aproximada do arrasto e usa a barra nativa do Docs (\`#bgColorButton\`). Mudanças na interface do Google, localização da paleta, seleção em várias linhas e o momento da seleção podem comprometer o funcionamento. Teste primeiro em um documento descartável. Nunca altera texto por APIs privadas, não coleta conteúdo nem usa OCR.
- O clique direito no documento substitui o menu de contexto padrão apenas quando o modo de marcação está ativo.
- Um documento é cadastrado na biblioteca ao clicar no botão MyDocx enquanto ele estiver aberto. Links também podem ser adicionados manualmente.

## Segurança e privacidade

Somente a permissão \`storage\` é pedida. A extensão executa seu script apenas nas páginas \`docs.google.com/document/*\`. Não acessa e-mails, não envia conteúdo a servidores próprios e não solicita credenciais do Google.

## Desenvolvimento

- \`manifest.json\`: configuração da extensão.
- \`dashboard.html\`, \`dashboard.css\`, \`dashboard.js\`: biblioteca de pastas e links.
- \`content.js\`, \`content.css\`: botão de abertura e integração experimental do marca-texto.
- \`background.js\`: abertura da biblioteca.
- \`.github/workflows/package.yml\`: empacota ZIP para download como artefato em GitHub Actions.

Para testar a sintaxe JS localmente: \`node --check dashboard.js && node --check content.js && node --check background.js\`.
