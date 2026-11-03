# MyDocx — Google Apps Script (marca-texto)

Este é o **script que funciona dentro do Google Docs**. Não é a extensão do navegador.

## Instalação

1. Abra um **documento Google Docs** (não o site inicial nem um projeto avulso Apps Script).
2. Acesse **Extensões → Apps Script**.
3. No arquivo **Código.gs**, substitua o conteúdo pelo arquivo [Codigo.gs](Codigo.gs) deste diretório.
4. Clique no **+** ao lado de Arquivos e escolha **HTML**. Chame o novo arquivo de **Painel** (a extensão \`.html\` é adicionada).
5. Cole o conteúdo de [Painel.html](Painel.html) no arquivo HTML.
6. Salve. Volte ao documento e **atualize a página**.
7. Use **MyDocx → Abrir paleta de cores**. Na primeira execução, conceda a autorização solicitada.

## Uso

- Selecione texto, escolha a cor e clique em **Marcar seleção**.
- Selecione texto e clique em **Remover marcação** para limpar o destaque.
- É possível informar qualquer cor em formato HEX \`#RRGGBB\`.
- O menu também permite reaplicar rapidamente a cor escolhida por último.

## Limitações

- Google Apps Script **não intercepta clique direito nem detecta a direção do arrasto**, e Google Docs não oferece \`onSelectionChange\` para scripts vinculados. Para esses gestos é necessária uma extensão.
- O código atua no **documento atual** e precisa ser colocado em cada documento desejado, a menos que no futuro seja empacotado como complemento do Google Workspace.
- O script **não cria nem organiza pastas do Google Drive**.
- A remoção usa \`Text.setBackgroundColor(inicio, fim, null)\` para retirar apenas a marcação.
- A funcionalidade segue as APIs oficiais do Google, mas a interface não foi testada aqui com uma conta Google em uso.
