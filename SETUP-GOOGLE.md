# Configurar Google Drive no MyDocx

O MyDocx usa a API oficial do Google Drive e OAuth 2.0 diretamente no Brave/Chrome. Você nunca deve informar sua senha ao aplicativo.

## Configuração inicial

1. Instale a extensão pelo ZIP do GitHub Actions. Se já usa MyDocx, mantenha a mesma pasta da extensão antiga para preservar o ID e a biblioteca local.
2. Em brave://extensions ou chrome://extensions, copie o ID exibido na extensão. A tela inicial do MyDocx também permite copiá-lo.
3. Acesse https://console.cloud.google.com/ e crie um projeto.
4. Em APIs e serviços > Biblioteca, ative Google Drive API.
5. Configure a tela de consentimento em Google Auth Platform. Para uso pessoal, selecione modo de teste e adicione seu e-mail em Usuários de teste.
6. Em Clientes OAuth / Credenciais, crie um cliente do tipo Extensão do Chrome (Chrome Extension) e informe o ID exato da extensão obtido no passo 2.
7. Configure os escopos https://www.googleapis.com/auth/drive.metadata e https://www.googleapis.com/auth/drive.file no projeto.
8. Copie o Client ID (por exemplo 123456789-abcdef.apps.googleusercontent.com) e substitua REPLACE_WITH_YOUR_CLIENT_ID.apps.googleusercontent.com dentro do arquivo manifest.json na pasta da extensão. Não inclua client secret.
9. Atualize a extensão em brave://extensions ou chrome://extensions e clique em Conectar com Google.
10. No Brave, talvez seja necessário ativar Permitir login do Google para extensões em brave://settings/extensions.

Na primeira conexão a biblioteca é preenchida automaticamente. Ao abrir a extensão novamente, ela tenta sincronizar sem solicitar outra autorização. Há também atualização manual pelo ícone circular.

## Permissões e limites

- drive.metadata: permite consultar e alterar metadados de documentos e pastas existentes (nome, pasta pai, cor, favoritos, lixeira). NÃO permite ler o conteúdo dos arquivos.
- drive.file: permite criar novos arquivos/pastas por meio do MyDocx. Não oferece leitura irrestrita do conteúdo de documentos antigos.
- Os dados da conta são obtidos diretamente dos servidores do Google. Tokens não são salvos no armazenamento local pelo MyDocx; o navegador gerencia a autorização.
- drive.metadata é um escopo restrito. A Google pode exigir verificação para distribuição pública. Modo de teste pode exigir reautorização periódica.
- As operações são reais no Google Drive. Mover para a lixeira afeta os arquivos reais e não somente os atalhos.
- Biblioteca local é independente, não convertida ou mesclada automaticamente. O marca-texto experimental continua disponível.

## Solução de problemas

- Client ID inválido: confirme que corresponde ao ID da extensão carregada, não a outro navegador/instalação.
- Conta ou app não verificados: inclua seu próprio e-mail em Usuários de teste e confira a configuração OAuth.
- Erro 403: habilite a Google Drive API, verifique os escopos e se você tem permissão de editar o arquivo.
- Mudança de diretório: extensões sem chave fixa podem receber outro ID; ajuste o OAuth ao ID da instalação atual.
- Brave: ative a opção de permitir login do Google para extensões.
