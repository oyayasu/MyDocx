/**
 * MyDocx — marque textos dentro do Google Docs.
 * Abra este documento > Extensões > Apps Script.
 * Cole neste arquivo Código.gs e crie outro HTML chamado Painel.
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
  const html = HtmlService.createHtmlOutputFromFile('Painel')
    .setTitle('MyDocx — Marca-texto');
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
