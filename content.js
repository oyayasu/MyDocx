(function () {
  "use strict";
  if (window.__mydocxLoaded) return;
  window.__mydocxLoaded = true;
  const KEY = "mydocxV1";
  const SWATCHES = ["#ffff00", "#fff2a8", "#f4cccc", "#fce5cd", "#d9ead3", "#d0e0e3", "#cfe2f3", "#d9d2e9", "#ead1dc", "#eeeeee", "#a8dbca", "#f6d8b8"];
  let settings = { highlightColor: "#ffff00", highlightEnabled: true };
  let drag = null, activeSelection = false, toastTimer = null;
  const isEditor = () => /^\/document\/d\/[a-zA-Z0-9_-]+\/edit/.test(location.pathname) || /^\/document\/d\/[a-zA-Z0-9_-]+$/.test(location.pathname);

  const launcher = document.createElement("button");
  launcher.id = "mydocx-launcher"; launcher.type = "button";
  const mark = document.createElement("span"); mark.className = "mydocx-mark"; mark.textContent = "M";
  launcher.append(mark, document.createTextNode("MyDocx"));
  launcher.title = "Abrir biblioteca MyDocx";
  launcher.addEventListener("click", async () => {
    if (isEditor()) await addCurrentDocument();
    toggleOverlay();
  });
  document.body.appendChild(launcher);

  let overlay = null;
  function toggleOverlay() {
    if (overlay) { overlay.remove(); overlay = null; return; }
    overlay = document.createElement("div");
    overlay.id = "mydocx-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Biblioteca MyDocx");
    const panel = document.createElement("div");
    panel.className = "mydocx-panel";
    const close = document.createElement("button");
    close.type = "button"; close.className = "mydocx-close"; close.textContent = "×";
    close.setAttribute("aria-label", "Fechar biblioteca MyDocx");
    close.addEventListener("click", toggleOverlay);
    const frame = document.createElement("iframe");
    frame.title = "MyDocx — biblioteca de documentos";
    frame.src = chrome.runtime.getURL("cloud.html");
    panel.append(frame, close); overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) toggleOverlay(); });
    document.body.appendChild(overlay);
  }

  const palette = document.createElement("div"); palette.id = "mydocx-colors"; palette.hidden = true;
  const title = document.createElement("strong"); title.textContent = "Cor do marca-texto"; palette.appendChild(title);
  const grid = document.createElement("div"); grid.className = "mydocx-swatches"; palette.appendChild(grid);
  const control = document.createElement("label"); control.className = "mydocx-control"; control.textContent = "Cor personalizada";
  const picker = document.createElement("input"); picker.type = "color"; picker.setAttribute("aria-label", "Escolher cor personalizada");
  control.appendChild(picker); palette.appendChild(control);
  const remove = document.createElement("button"); remove.className = "mydocx-remove"; remove.type = "button"; remove.textContent = "Remover marcação"; palette.appendChild(remove);
  document.documentElement.appendChild(palette);
  const hint = document.createElement("div"); hint.id = "mydocx-hint"; hint.hidden = true; document.documentElement.appendChild(hint);

  function notify(message) {
    hint.textContent = message; hint.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { hint.hidden = true; }, 3800);
  }
  function editorArea(target) {
    return Boolean(target instanceof Element && target.closest(".kix-appview-editor, .kix-page, .kix-page-paginated, .kix-page-content-wrapper, .kix-canvas-tile-content, .kix-canvas-tile"));
  }
  function saveSettings() {
    return chrome.storage.local.get(KEY).then((data) => {
      const old = data[KEY] && typeof data[KEY] === "object" ? data[KEY] : {};
      const next = Object.assign({ folders: [], documents: [], settings: {} }, old);
      next.settings = Object.assign({}, old.settings || {}, settings);
      return chrome.storage.local.set({ [KEY]: next });
    });
  }
  function setColor(color, applyNow) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    settings.highlightColor = color.toLowerCase(); picker.value = settings.highlightColor;
    Array.from(grid.children).forEach((button) => button.classList.toggle("active", button.dataset.color === settings.highlightColor));
    saveSettings().catch(() => notify("Não foi possível salvar a cor."));
    palette.hidden = true;
    if (applyNow) setTimeout(() => applyHighlight(settings.highlightColor), 80);
  }
  for (const color of SWATCHES) {
    const button = document.createElement("button"); button.type = "button"; button.className = "mydocx-swatch";
    button.style.backgroundColor = color; button.dataset.color = color.toLowerCase(); button.title = color;
    button.addEventListener("click", () => setColor(color, activeSelection));
    grid.appendChild(button);
  }
  picker.addEventListener("input", (e) => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
      settings.highlightColor = e.target.value.toLowerCase();
    }
  });
  picker.addEventListener("change", (e) => setColor(e.target.value, activeSelection));
  remove.addEventListener("click", () => { palette.hidden = true; if (activeSelection) applyHighlight("none"); else notify("Selecione um trecho do documento antes de remover a marcação."); });

  function browserClick(el) {
    if (!el) return;
    for (const type of ["mouseover", "mousedown", "mouseup", "click"]) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  function visible(el) { return !!el && el.getClientRects().length > 0; }
  function colorCell(color) {
    const all = Array.from(document.querySelectorAll("td[aria-label]")).filter(visible);
    const hex = color.toLowerCase();
    const custom = all.filter((el) => (el.getAttribute("aria-label") || "").toLowerCase().includes("custom color " + hex));
    if (custom.length) return custom[custom.length - 1];
    if (hex === "#ffff00") {
      const id = document.getElementById("docs-material-colorpalette-cell-103");
      if (visible(id)) return id;
      return all.find((el) => /^yellow$/i.test((el.getAttribute("aria-label") || "").trim()));
    }
    return null;
  }
  async function applyHighlight(color) {
    if (!isEditor() || !settings.highlightEnabled) return;
    const dropdown = document.getElementById("bgColorButton");
    if (!dropdown) { notify("Barra de destaque não localizada nesta versão do Google Docs."); return; }
    // O editor do Google Docs é renderizado em canvas. Esta integração usa sua barra nativa.
    browserClick(dropdown);
    await new Promise((resolve) => setTimeout(resolve, 65));
    if (color === "none") {
      const none = Array.from(document.querySelectorAll(".goog-menuitem.colormenuitems-no-color, .colormenuitems-no-color")).filter(visible).pop();
      if (!none) { notify("Opção para remover destaque não encontrada."); return; }
      browserClick(none.querySelector(".goog-menuitem-content") || none);
      return;
    }
    const existing = colorCell(color);
    if (existing) { browserClick(existing); return; }
    const add = Array.from(document.querySelectorAll('td[aria-label]')).filter(visible).find((el) => {
      const label = (el.getAttribute("aria-label") || "").toLowerCase();
      return label.includes("add a custom color") || label.includes("adicionar uma cor personalizada") || label.includes("adicionar cor personalizada");
    });
    if (!add) { notify("Paleta personalizada não encontrada. Escolha uma cor na barra do Docs."); return; }
    browserClick(add);
    await new Promise((resolve) => setTimeout(resolve, 90));
    const hexInput = Array.from(document.querySelectorAll(".docs-material-hsv-color-picker-input")).filter(visible).pop();
    if (!hexInput) { notify("Campo de cor não encontrado."); return; }
    hexInput.value = color;
    for (const type of ["input", "change", "keyup"]) hexInput.dispatchEvent(new Event(type, { bubbles: true }));
    const ok = Array.from(document.querySelectorAll(".docs-material-button-content, button")).filter(visible).find((el) => /^(ok|aplicar|apply)$/i.test((el.textContent || "").trim()));
    if (!ok) { notify("Botão para confirmar cor não encontrado."); return; }
    browserClick(ok);
  }
  function selectPalette(x, y) {
    activeSelection = true; palette.hidden = false; picker.value = settings.highlightColor;
    Array.from(grid.children).forEach((button) => button.classList.toggle("active", button.dataset.color === settings.highlightColor));
    palette.style.left = Math.max(8, Math.min(x, innerWidth - 228)) + "px";
    palette.style.top = Math.max(8, Math.min(y, innerHeight - 300)) + "px";
  }
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || !isEditor() || !settings.highlightEnabled || !editorArea(e.target)) { drag = null; return; }
    palette.hidden = true;
    drag = { x: e.clientX, y: e.clientY, time: Date.now() };
  }, true);
  document.addEventListener("mouseup", (e) => {
    if (!drag || e.button !== 0) return;
    const start = drag; drag = null;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) < 12 || (Math.abs(dx) < 24 && Math.abs(dy) > 24)) return;
    if (!editorArea(e.target)) return;
    activeSelection = true;
    setTimeout(() => applyHighlight(dx > 0 ? settings.highlightColor : "none"), 80);
  }, true);
  document.addEventListener("contextmenu", (e) => {
    if (!isEditor() || !settings.highlightEnabled || !editorArea(e.target)) return;
    e.preventDefault(); e.stopPropagation(); selectPalette(e.clientX, e.clientY);
  }, true);
  document.addEventListener("mousedown", (e) => {
    if (!palette.hidden && !palette.contains(e.target) && e.target !== palette) palette.hidden = true;
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") palette.hidden = true; });

  async function addCurrentDocument() {
    const match = location.pathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return;
    const id = match[1], url = "https://docs.google.com/document/d/" + id + "/edit";
    const title = (document.querySelector("#docs-title-input")?.value || document.title.replace(/\s*-\s*Google Docs.*$/i, "") || "Documento").trim();
    try {
      const data = await chrome.storage.local.get(KEY);
      const db = data[KEY] && typeof data[KEY] === "object" ? data[KEY] : { folders: [], documents: [] };
      if (!Array.isArray(db.documents)) db.documents = [];
      if (!Array.isArray(db.folders)) db.folders = [];
      if (!db.documents.some((d) => d.url === url)) {
        db.documents.push({ id: crypto.randomUUID(), title, url, folderId: null, favorite: false, createdAt: Date.now() });
        await chrome.storage.local.set({ [KEY]: db });
      }
    } catch { notify("Não foi possível adicionar o documento."); }
  }
  chrome.storage.local.get(KEY).then((data) => {
    settings = Object.assign(settings, data[KEY]?.settings || {});
    picker.value = /^#[0-9a-f]{6}$/i.test(settings.highlightColor) ? settings.highlightColor : "#ffff00";
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) settings = Object.assign(settings, changes[KEY].newValue?.settings || {});
  });
})();