# MyDocx — marca-texto dentro do Google Docs

## Instalação mais simples (um único arquivo)

1. Abra um **documento Google Docs**.
2. Clique em **Extensões → Apps Script**.
3. No arquivo **Código.gs**, apague o exemplo `myFunction()` e cole o conteúdo integral de **[MyDocx-UNICO.gs](MyDocx-UNICO.gs)**.
4. Salve. Volte ao documento e atualize a página.
5. Use **MyDocx → Abrir paleta de cores** e autorize o script se solicitado.
6. Selecione um trecho, escolha a cor e clique em **Marcar seleção**, ou clique em **Remover marcação**.

Você pode usar qualquer cor HEX (`#RRGGBB`). A última cor escolhida fica disponível no menu de marcação rápida.

### Importante

- Não é extensão de navegador nem exige conexão com ChatGPT.
- Google Apps Script não intercepta o **botão direito** nem detecta a **direção do arrasto**. Para isso seria necessária uma extensão do navegador.
- O código é vinculado ao **documento atual**, não a toda a conta do Google Docs.
- O Apps Script pode manipular pastas reais com acesso ao Drive, mas não adicionar pastas nativas à página inicial do Google Docs.
- Código também disponível separado em [Codigo.gs](Codigo.gs) e [Painel.html](Painel.html), caso queira personalizar a interface.
- Sintaxe e lógica básica testadas de forma simulada; execução no Google Docs ainda depende de teste em uma conta real.
