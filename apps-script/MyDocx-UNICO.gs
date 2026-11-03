/**
 * MyDocx — marque textos dentro do Google Docs.
 * Abra este documento > Extensões > Apps Script.
 * Cole todo este conteúdo no Código.gs. Nenhum outro arquivo é necessário.
 */
const MYDOCX_COR_PADRAO = '#FFF2A8';

function onOpen() {
  DocumentApp.getUi()
    .createMenu('MyDocx')
    .addItem('Abrir paleta de cores', 'abrirPaletaMyDocx')
    .addSeparator()
    .addItem('Marcar seleção com a cor atual', 'marcarCorAtualMyDocx')
    .addItem('Remover marcação', 'removerMarcacaoMenuMyDocx')
    .addToUi();
}

function abrirPaletaMyDocx() {
  const html = HtmlService.createHtmlOutput(`
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  :root{font-family:Arial,sans-serif;color:#33485d}
  *{box-sizing:border-box}
  body{margin:0;padding:20px;background:#fff;font-size:13px}
  h2{font-size:18px;margin:0 0 6px;letter-spacing:-.4px}
  .subtitle{font-size:12px;color:#81919f;line-height:1.6;margin-bottom:23px}
  .label{font-size:11px;font-weight:700;color:#8293a1;letter-spacing:.5px;margin:18px 0 9px}
  #cores{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
  .cor{appearance:none;border:1px solid #dfe6eb;height:32px;border-radius:9px;cursor:pointer}
  .cor.ativa{outline:2px solid #5b7f9f;outline-offset:2px}
  .personalizar{display:flex;gap:9px;align-items:center}
  #personalizada{width:47px;height:37px;padding:2px;border:1px solid #e0e7ed;border-radius:9px;background:#fff;cursor:pointer}
  #hex{border:1px solid #dfe6eb;border-radius:9px;padding:10px;font-size:12px;min-width:0;flex:1}
  button.acao{width:100%;display:block;border-radius:10px;padding:12px 8px;cursor:pointer;font-size:12px;font-weight:700}
  #marcar{background:#58789a;border:1px solid #58789a;color:white;margin-top:24px}
  #remover{background:white;border:1px solid #dce4ea;color:#61778c;margin-top:9px}
  button:disabled{opacity:.55;cursor:wait}
  #mensagem{font-size:12px;line-height:1.5;margin:15px 0;min-height:19px;color:#5e8c73}
  #mensagem.erro{color:#b84b54}
  .help{font-size:11px;color:#99a5b1;line-height:1.65;border-top:1px solid #edf1f4;padding-top:15px}
</style>
</head>
<body>
  <h2>MyDocx</h2>
  <p class="subtitle">Selecione um trecho no documento para marcar ou remover o destaque.</p>
  <div class="label">CORES</div><div id="cores"></div>
  <div class="label">COR PERSONALIZADA</div>
  <div class="personalizar">
    <input id="personalizada" type="color" value="#FFF2A8" aria-label="Escolher cor">
    <input id="hex" type="text" maxlength="7" value="#FFF2A8" aria-label="Cor hexadecimal">
  </div>
  <button id="marcar" class="acao" type="button">Marcar seleção</button>
  <button id="remover" class="acao" type="button">Remover marcação</button>
  <p id="mensagem" role="status" aria-live="polite"></p>
  <p class="help">Selecione o texto no documento e clique no botão desejado. A barra lateral não detecta direção de arrasto nem intercepta o clique direito.</p>
<script>
  const cores = ['#FFF2A8','#FFE08A','#F7C9C8','#F9D7B5','#D1E9D1','#C8E8EC','#CFE0F8','#DDD2F2','#EBCFE1','#E6E6E6','#A6D8C4','#CABEDC'];
  let escolhida = '#FFF2A8';
  const el = id => document.getElementById(id);
  function mensagem(texto, erro) {
    el('mensagem').textContent = texto;
    el('mensagem').classList.toggle('erro', !!erro);
  }
  function escolher(cor) {
    cor = String(cor || '').trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(cor)) {
      mensagem('Use o formato #RRGGBB.', true);
      return false;
    }
    escolhida = cor;
    el('hex').value = cor;
    el('personalizada').value = cor;
    document.querySelectorAll('.cor').forEach(b => b.classList.toggle('ativa', b.dataset.cor === cor));
    mensagem('', false);
    return true;
  }
  cores.forEach(cor => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'cor';
    botao.dataset.cor = cor;
    botao.title = cor;
    botao.setAttribute('aria-label', 'Selecionar cor ' + cor);
    botao.style.backgroundColor = cor;
    botao.addEventListener('click', () => escolher(cor));
    el('cores').appendChild(botao);
  });
  el('personalizada').addEventListener('input', e => escolher(e.target.value));
  el('hex').addEventListener('change', e => escolher(e.target.value));
  function executar(metodo) {
    if (metodo === 'marcar' && !escolher(el('hex').value)) return;
    el('marcar').disabled = true;
    el('remover').disabled = true;
    mensagem('Aplicando...', false);
    const chamada = google.script.run
      .withSuccessHandler(retorno => {
        el('marcar').disabled = false;
        el('remover').disabled = false;
        mensagem(retorno, false);
      })
      .withFailureHandler(erro => {
        el('marcar').disabled = false;
        el('remover').disabled = false;
        mensagem(erro.message || 'Não foi possível aplicar.', true);
      });
    if (metodo === 'marcar') chamada.marcarSelecaoMyDocx(escolhida);
    else chamada.removerMarcacaoMyDocx();
  }
  el('marcar').addEventListener('click', () => executar('marcar'));
  el('remover').addEventListener('click', () => executar('remover'));
  escolher(escolhida);
  google.script.run.withSuccessHandler(cor => escolher(cor)).corAtualMyDocx();
</script>
</body>
</html>
  `).setTitle('MyDocx — Marca-texto');
  DocumentApp.getUi().showSidebar(html);
}

function corAtualMyDocx() {
  const cor = PropertiesService.getUserProperties().getProperty('MYDOCX_COR');
  return /^#[0-9a-f]{6}$/i.test(cor || '') ? cor : MYDOCX_COR_PADRAO;
}

function marcarSelecaoMyDocx(cor) {
  if (typeof cor !== 'string' || !/^#[0-9a-f]{6}$/i.test(cor)) {
    throw new Error('Cor inválida: use #RRGGBB.');
  }
  const n = alterarMarcacaoMyDocx_(cor.toUpperCase());
  PropertiesService.getUserProperties().setProperty('MYDOCX_COR', cor.toUpperCase());
  return n + ' caractere(s) marcado(s).';
}

function removerMarcacaoMyDocx() {
  const n = alterarMarcacaoMyDocx_(null);
  return 'Marcação removida de ' + n + ' caractere(s).';
}

function marcarCorAtualMyDocx() {
  try {
    marcarSelecaoMyDocx(corAtualMyDocx());
  } catch (err) {
    DocumentApp.getUi().alert(err.message);
  }
}

function removerMarcacaoMenuMyDocx() {
  try {
    removerMarcacaoMyDocx();
  } catch (err) {
    DocumentApp.getUi().alert(err.message);
  }
}

function alterarMarcacaoMyDocx_(cor) {
  const selecao = DocumentApp.getActiveDocument().getSelection();
  if (!selecao) {
    throw new Error('Selecione um trecho do documento antes de marcar ou remover.');
  }

  let total = 0;
  for (const intervalo of selecao.getRangeElements()) {
    const elemento = intervalo.getElement();
    if (elemento.getType() === DocumentApp.ElementType.TEXT) {
      const texto = elemento.asText();
      const inicio = intervalo.isPartial() ? intervalo.getStartOffset() : 0;
      const fim = intervalo.isPartial()
        ? intervalo.getEndOffsetInclusive()
        : texto.getText().length - 1;
      if (inicio >= 0 && fim >= inicio && fim < texto.getText().length) {
        texto.setBackgroundColor(inicio, fim, cor);
        total += fim - inicio + 1;
      }
    } else if (!intervalo.isPartial()) {
      total += marcarElementoMyDocx_(elemento, cor);
    }
  }

  if (!total) {
    throw new Error('A seleção não contém texto editável.');
  }
  return total;
}

function marcarElementoMyDocx_(elemento, cor) {
  if (elemento.getType() === DocumentApp.ElementType.TEXT) {
    const texto = elemento.asText();
    const n = texto.getText().length;
    if (n) texto.setBackgroundColor(0, n - 1, cor);
    return n;
  }
  if (typeof elemento.getNumChildren !== 'function') return 0;
  let total = 0;
  for (let i = 0; i < elemento.getNumChildren(); i++) {
    total += marcarElementoMyDocx_(elemento.getChild(i), cor);
  }
  return total;
}
