(function () {
  "use strict";
  const KEY = "mydocxV1";
  const $ = (id) => document.getElementById(id);
  const DEFAULT = { folders: [], documents: [], settings: { highlightColor: "#ffff00", highlightEnabled: true } };
  const PALETTE = ["#91a9c6", "#8dab9b", "#d5af82", "#be9bac", "#a9a0d2", "#c1bbb0", "#85b5c5", "#d6a1a1"];
  let state = structuredClone(DEFAULT);
  let view = "root";
  let query = "";
  let editorMode = null;
  let contextItem = null;
  let toastTimer = null;

  function normalize(data) {
    const d = data && typeof data === "object" ? data : {};
    return {
      folders: Array.isArray(d.folders) ? d.folders.filter((x) => x && typeof x.id === "string") : [],
      documents: Array.isArray(d.documents) ? d.documents.filter((x) => x && typeof x.id === "string") : [],
      settings: Object.assign({}, DEFAULT.settings, d.settings || {})
    };
  }
  function makeId() { return crypto.randomUUID(); }
  function getFolder(id) { return state.folders.find((f) => f.id === id); }
  function getDoc(id) { return state.documents.find((d) => d.id === id); }
  function persist() { return chrome.storage.local.set({ [KEY]: state }); }
  function update() { render(); persist().catch(() => notice("Não foi possível salvar.")); }
  function notice(text) {
    $("toast").textContent = text; $("toast").hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3300);
  }
  function folderTitle(id) { return getFolder(id)?.name || "Minhas pastas"; }
  function isDescendant(childId, ancestorId) {
    let current = getFolder(childId), seen = new Set();
    while (current && current.parentId && !seen.has(current.id)) {
      if (current.parentId === ancestorId) return true;
      seen.add(current.id); current = getFolder(current.parentId);
    }
    return false;
  }
  function selectView(v) { view = v; $("search").value = ""; query = ""; hideMenu(); render(); }
  function addText(parent, tag, cls, text) {
    const el = document.createElement(tag); if (cls) el.className = cls;
    el.textContent = text; parent.appendChild(el); return el;
  }
  function hideMenu() { $("context-menu").hidden = true; $("context-menu").replaceChildren(); contextItem = null; }
  function menuButton(menu, title, cb) {
    const btn = addText(menu, "button", "", title); btn.type = "button";
    btn.addEventListener("click", () => { hideMenu(); cb(); }); return btn;
  }
  function showMenu(e, type, id) {
    e.preventDefault(); e.stopPropagation(); hideMenu();
    const menu = $("context-menu"); contextItem = { type, id };
    if (type === "folder") {
      menuButton(menu, "Abrir", () => selectView(id));
      menuButton(menu, "Renomear", () => openForm("rename-folder", id));
      const label = addText(menu, "label", "", "Cor da pasta");
      const input = document.createElement("input"); input.type = "color"; input.value = getFolder(id)?.color || PALETTE[0];
      input.addEventListener("input", () => { const folder = getFolder(id); if (!folder) return; folder.color = input.value; update(); });
      label.appendChild(input);
      menuButton(menu, "Mover para…", () => openForm("move-folder", id));
      menuButton(menu, "Excluir pasta", () => {
        const folder = getFolder(id); if (!folder) return;
        if (!confirm("Excluir \"" + folder.name + "\"? Os itens dentro dela serão movidos para a pasta anterior.")) return;
        state.folders.forEach((f) => { if (f.parentId === id) f.parentId = folder.parentId || null; });
        state.documents.forEach((d) => { if (d.folderId === id) d.folderId = folder.parentId || null; });
        state.folders = state.folders.filter((f) => f.id !== id);
        if (view === id) view = folder.parentId || "root";
        update();
      });
    } else {
      const doc = getDoc(id); if (!doc) return;
      menuButton(menu, "Abrir no Google Docs", () => window.open(doc.url, "_blank", "noopener"));
      menuButton(menu, doc.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos", () => { doc.favorite = !doc.favorite; update(); });
      menuButton(menu, "Renomear", () => openForm("rename-doc", id));
      menuButton(menu, "Mover para…", () => openForm("move-doc", id));
      menuButton(menu, "Remover da biblioteca", () => {
        if (!confirm("Remover \"" + doc.title + "\" da biblioteca? O arquivo no Google Docs não será excluído.")) return;
        state.documents = state.documents.filter((d) => d.id !== id); update();
      });
    }
    menu.hidden = false;
    menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + "px";
    menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 12) + "px";
  }
  function enableDrop(element, folderId) {
    element.addEventListener("dragover", (e) => { if (!e.dataTransfer.types.includes("application/x-mydocx")) return; e.preventDefault(); element.classList.add("dragover"); });
    element.addEventListener("dragleave", () => element.classList.remove("dragover"));
    element.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation(); element.classList.remove("dragover");
      let payload; try { payload = JSON.parse(e.dataTransfer.getData("application/x-mydocx")); } catch { return; }
      if (!payload || typeof payload.id !== "string") return;
      if (payload.type === "doc") {
        const doc = getDoc(payload.id); if (doc) { doc.folderId = folderId || null; update(); notice("Documento movido."); }
      } else if (payload.type === "folder") {
        const folder = getFolder(payload.id);
        if (!folder || payload.id === folderId || (folderId && isDescendant(folderId, payload.id))) { notice("Não é possível mover a pasta para dentro dela mesma."); return; }
        folder.parentId = folderId || null; update(); notice("Pasta movida.");
      }
    });
  }
  function makeDraggable(el, type, id) {
    el.draggable = true;
    el.addEventListener("dragstart", (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("application/x-mydocx", JSON.stringify({ type, id })); });
  }
  function renderFolders(parentId, root, depth) {
    if (depth > 30) return;
    const children = state.folders.filter((f) => (f.parentId || null) === parentId).sort((a,b) => a.name.localeCompare(b.name, "pt-BR"));
    for (const folder of children) {
      const line = document.createElement("button"); line.type = "button";
      line.className = "folder-line" + (view === folder.id ? " active" : ""); line.style.paddingLeft = (12 + depth * 14) + "px";
      const icon = addText(line, "span", "folder-dot", ""); icon.style.background = folder.color || PALETTE[0];
      addText(line, "span", "", folder.name); line.title = folder.name;
      line.onclick = () => selectView(folder.id); line.oncontextmenu = (e) => showMenu(e, "folder", folder.id);
      makeDraggable(line, "folder", folder.id); enableDrop(line, folder.id);
      root.appendChild(line); renderFolders(folder.id, root, depth + 1);
    }
  }
  function addCard(type, obj) {
    const card = document.createElement("article"); card.className = "item"; card.tabIndex = 0;
    const top = addText(card, "div", "item-top", "");
    if (type === "folder") {
      const icon = addText(top, "span", "folder-icon", ""); icon.style.background = obj.color || PALETTE[0];
    } else addText(top, "span", "file-icon", "≡");
    const more = addText(top, "button", "item-more", "···"); more.type = "button"; more.setAttribute("aria-label", "Opções"); more.onclick = (e) => showMenu(e, type, obj.id);
    addText(card, "div", "item-title", type === "folder" ? obj.name : obj.title);
    addText(card, "div", "item-meta", type === "folder" ? state.documents.filter((d) => d.folderId === obj.id).length + " documento(s)" : (obj.favorite ? "★ Favorito · " : "") + "Google Docs");
    card.onclick = (e) => {
      if (e.target.closest("button")) return;
      type === "folder" ? selectView(obj.id) : window.open(obj.url, "_blank", "noopener");
    };
    card.onkeydown = (e) => { if (e.key === "Enter") card.click(); };
    card.oncontextmenu = (e) => showMenu(e, type, obj.id);
    makeDraggable(card, type === "folder" ? "folder" : "doc", obj.id);
    if (type === "folder") enableDrop(card, obj.id);
    $("items").appendChild(card);
  }
  function pathFor(id) {
    const path = [], visited = new Set(); let f = getFolder(id);
    while (f && !visited.has(f.id)) { visited.add(f.id); path.unshift(f); f = getFolder(f.parentId); }
    return path;
  }
  function render() {
    $("folder-tree").replaceChildren(); renderFolders(null, $("folder-tree"), 0);
    document.querySelectorAll(".nav-button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    const isGeneral = view === "all" || view === "favorites" || view === "root";
    const base = view === "all" ? "Todos os documentos" : view === "favorites" ? "Favoritos" : view === "root" ? "Minhas pastas" : folderTitle(view);
    $("page-title").textContent = query ? "Resultados da pesquisa" : base;
    $("page-subtitle").textContent = query ? "Resultados locais da sua biblioteca." : "Organize seus links do Google Docs sem mover os arquivos originais.";
    const crumbs = $("breadcrumbs"); crumbs.replaceChildren();
    function crumb(name, destination) {
      const btn = addText(crumbs, "button", "crumb" + (destination === "root" ? " drop-root" : ""), name); btn.type = "button"; btn.onclick = () => selectView(destination);
      crumbs.appendChild(btn);
      if (destination === "root") enableDrop(btn, null);
    }
    crumb("Biblioteca", "root");
    if (!isGeneral) for (const f of pathFor(view)) { addText(crumbs, "span", "crumb-sep", "/"); crumb(f.name, f.id); }
    let folders = [], docs = [];
    if (query) {
      folders = state.folders.filter((f) => f.name.toLocaleLowerCase("pt-BR").includes(query));
      docs = state.documents.filter((d) => d.title.toLocaleLowerCase("pt-BR").includes(query));
    } else if (view === "all") docs = state.documents.slice();
    else if (view === "favorites") docs = state.documents.filter((d) => d.favorite);
    else {
      const parent = view === "root" ? null : view;
      folders = state.folders.filter((f) => (f.parentId || null) === parent);
      docs = state.documents.filter((d) => (d.folderId || null) === parent);
    }
    folders.sort((a,b) => a.name.localeCompare(b.name, "pt-BR"));
    docs.sort((a,b) => a.title.localeCompare(b.title, "pt-BR"));
    $("items").replaceChildren();
    folders.forEach((x) => addCard("folder", x));
    docs.forEach((x) => addCard("doc", x));
    $("count").textContent = (folders.length + docs.length) + " item(ns)";
    $("empty").hidden = folders.length + docs.length !== 0;
    $("empty-message").textContent = query ? "Não encontramos esse nome na sua biblioteca." : "Crie uma pasta ou adicione o link de um documento.";
    $("highlight-color").value = /^#[0-9a-f]{6}$/i.test(state.settings.highlightColor) ? state.settings.highlightColor : "#ffff00";
    $("highlight-enabled").checked = state.settings.highlightEnabled !== false;
  }
  function setOptions(select, selected, forbidden) {
    select.replaceChildren();
    let opt = document.createElement("option"); opt.value = ""; opt.textContent = "Minhas pastas (raiz)"; select.appendChild(opt);
    function walk(parent, depth, seen) {
      for (const f of state.folders.filter((x) => (x.parentId || null) === parent).sort((a,b) => a.name.localeCompare(b.name, "pt-BR"))) {
        if (seen.has(f.id)) continue;
        const exclusion = forbidden && (f.id === forbidden || isDescendant(f.id, forbidden));
        if (!exclusion) { opt = document.createElement("option"); opt.value = f.id; opt.textContent = "　".repeat(depth) + f.name; select.appendChild(opt); }
        walk(f.id, depth + 1, new Set([...seen, f.id]));
      }
    }
    walk(null, 0, new Set()); select.value = selected || "";
  }
  function openForm(mode, id) {
    hideMenu(); editorMode = { mode, id };
    const isFolder = mode.includes("folder"), isMove = mode.startsWith("move-"), isRename = mode.startsWith("rename-");
    const folder = isFolder && id ? getFolder(id) : null, doc = !isFolder && id ? getDoc(id) : null;
    $("form-title").textContent = isMove ? "Mover " + (isFolder ? "pasta" : "documento") : isRename ? "Renomear " + (isFolder ? "pasta" : "documento") : isFolder ? "Nova pasta" : "Adicionar documento";
    $("item-name").value = folder?.name || doc?.title || ""; $("item-url").value = doc?.url || "";
    $("item-name").parentElement; $("item-name").hidden = isMove;
    $("item-name").previousElementSibling.hidden = isMove;
    $("item-name").required = !isMove;
    $("url-row").hidden = isFolder || isMove || isRename;
    $("folder-row").hidden = isRename;
    $("item-color").parentElement.querySelector('label[for="item-color"]').hidden = !isFolder || isMove;
    $("item-color").hidden = !isFolder || isMove;
    $("item-color").value = folder?.color || PALETTE[0];
    const selected = folder?.parentId || doc?.folderId || (!isMove && !isRename && !["all", "favorites", "root"].includes(view) ? view : "");
    setOptions($("item-parent"), selected, isFolder && id ? id : null);
    $("form-error").hidden = true; $("form-dialog").showModal();
    setTimeout(() => (isMove ? $("item-parent") : $("item-name")).focus(), 0);
  }
  function safeDocsUrl(value) {
    try {
      const u = new URL(value.trim());
      if (u.protocol !== "https:" || u.hostname !== "docs.google.com" || !/^\/document\/d\/[a-zA-Z0-9_-]+(?:\/|$)/.test(u.pathname)) return null;
      return u.origin + u.pathname.split("/").slice(0, 4).join("/") + "/edit";
    } catch { return null; }
  }
  $("item-form").addEventListener("submit", (e) => {
    e.preventDefault(); if (!editorMode) return;
    const { mode, id } = editorMode, name = $("item-name").value.trim(), parent = $("item-parent").value || null;
    const isMove = mode.startsWith("move-"), isRename = mode.startsWith("rename-");
    if (!isMove && !name) return;
    if (mode.includes("folder")) {
      if (isRename) { const f = getFolder(id); if (f) f.name = name; }
      else if (isMove) { const f = getFolder(id); if (f && parent !== id && (!parent || !isDescendant(parent, id))) f.parentId = parent; }
      else state.folders.push({ id: makeId(), name, parentId: parent, color: $("item-color").value, createdAt: Date.now() });
    } else if (isRename) { const d = getDoc(id); if (d) d.title = name; }
    else if (isMove) { const d = getDoc(id); if (d) d.folderId = parent; }
    else {
      const url = safeDocsUrl($("item-url").value);
      if (!url) { $("form-error").textContent = "Cole um link válido de documento do Google Docs."; $("form-error").hidden = false; return; }
      const existing = state.documents.find((d) => d.url === url);
      if (existing) { $("form-error").textContent = "Este documento já existe na sua biblioteca."; $("form-error").hidden = false; return; }
      state.documents.push({ id: makeId(), title: name, url, folderId: parent, favorite: false, createdAt: Date.now() });
    }
    $("form-dialog").close(); editorMode = null; update();
  });
  $("cancel-dialog").onclick = () => $("form-dialog").close();
  $("close-dialog").onclick = () => $("form-dialog").close();
  $("form-dialog").addEventListener("close", () => { editorMode = null; });
  $("new-folder").onclick = () => openForm("new-folder");
  $("add-folder-sidebar").onclick = () => openForm("new-folder");
  $("new-doc").onclick = () => openForm("new-doc");
  $("empty-add").onclick = () => openForm("new-doc");
  $("search").addEventListener("input", (e) => { query = e.target.value.trim().toLocaleLowerCase("pt-BR"); render(); });
  document.querySelectorAll(".nav-button").forEach((b) => b.addEventListener("click", () => selectView(b.dataset.view)));
  $("highlight-color").addEventListener("input", (e) => { state.settings.highlightColor = e.target.value; persist(); });
  $("highlight-enabled").addEventListener("change", (e) => { state.settings.highlightEnabled = e.target.checked; persist(); });
  document.addEventListener("pointerdown", (e) => { if (!$("context-menu").hidden && !e.target.closest("#context-menu")) hideMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideMenu(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KEY]) return;
    state = normalize(changes[KEY].newValue); render();
  });
  chrome.storage.local.get(KEY).then((data) => { state = normalize(data[KEY]); render(); }).catch(() => notice("Falha ao ler a biblioteca."));
})();