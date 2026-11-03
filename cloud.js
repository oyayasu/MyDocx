(function () {
"use strict";
const $ = (id) => document.getElementById(id);
const FOLDER = "application/vnd.google-apps.folder";
const DOC = "application/vnd.google-apps.document";
const KEY_LINKED = "mydocxCloudLinked";
const $manifest = chrome.runtime.getManifest();
const clientId = $manifest.oauth2?.client_id || "";
const configured = /^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(clientId);
const apiBase = "https://www.googleapis.com/drive/v3/";
const fallbackColor = "#8eabd0";
let token = null, linked = false, connected = false, busy = false, rootId = null;
let entries = [], folders = [], documents = [], folderMap = new Map(), entryMap = new Map();
let view = "root", layout = "grid", query = "", currentForm = null, lastSync = 0, renderLimit = 180;
let toastTimer = null, searchTimer = null;

function textNode(parent, tag, cls, value) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.textContent = value;
  parent.appendChild(el);
  return el;
}
function notify(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4800);
}
function msg(error) { return error instanceof Error ? error.message : String(error); }
function errorMessage(error) {
  const value = msg(error);
  if (/OAuth2|client.?id|invalid_client|unauthorized_client/i.test(value)) return "Credenciais OAuth inválidas. Confira o Client ID e o ID desta extensão no Google Cloud.";
  if (/identity|not allowed|not supported|disabled/i.test(value)) return "Ative o login Google para extensões nas configurações do Brave e tente novamente. " + value;
  if (/access_denied|canceled|cancelled|user rejected/i.test(value)) return "A conexão não foi autorizada.";
  return value;
}
function setBusy(on) {
  busy = on;
  for (const id of ["refresh-button", "connect-button", "new-folder", "new-document", "sidebar-add-folder"]) $(id).disabled = on;
  $("refresh-button").textContent = on ? "◌" : "↻";
}
function showConnected(on) {
  connected = on;
  $("workspace").hidden = !on;
  $("connect-screen").hidden = on;
  $("search").disabled = !on;
  $("sidebar-add-folder").disabled = !on;
  if (!on) {
    $("account-name").textContent = "Google Drive";
    $("account-email").textContent = configured ? "Não conectado" : "Configuração pendente";
    $("account-avatar").textContent = "G";
  }
}
function showSetup() {
  $("setup-panel").hidden = false;
  $("extension-id").textContent = chrome.runtime.id || "indisponível";
}
function docsUrl(file) {
  const url = file.webViewLink || "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.hostname === "docs.google.com" && parsed.pathname.startsWith("/document/")) return parsed.toString();
  } catch (_) { /* fallback */ }
  return "https://docs.google.com/document/d/" + encodeURIComponent(file.id) + "/edit";
}
function safeFolderColor(value) { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallbackColor; }
function openDocument(file) {
  const url = docsUrl(file);
  if (chrome.tabs?.create) chrome.tabs.create({ url });
  else window.open(url, "_blank", "noopener");
}
function isValidId(id) { return typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id); }
function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    if (!chrome.identity?.getAuthToken) return reject(new Error("A API de identidade não está disponível neste navegador."));
    chrome.identity.getAuthToken({ interactive }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      const value = typeof response === "string" ? response : response?.token;
      if (!value) return reject(new Error("O Google não retornou uma autorização."));
      resolve(value);
    });
  });
}
function forgetToken(value) {
  return new Promise((resolve) => {
    if (!value || !chrome.identity?.removeCachedAuthToken) return resolve();
    chrome.identity.removeCachedAuthToken({ token: value }, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}
async function authorize(interactive) {
  if (!configured) throw new Error("Configure o Client ID no manifest.json antes de conectar sua conta.");
  if (token) return token;
  token = await getAuthToken(interactive);
  return token;
}
async function drive(path, options = {}, retry = true) {
  const auth = await authorize(false);
  const opts = { method: options.method || "GET", headers: { Authorization: "Bearer " + auth } };
  if (options.body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(options.body);
  }
  const response = await fetch(apiBase + path, opts);
  if (response.status === 401 && retry) {
    await forgetToken(token);
    token = null;
    return drive(path, options, false);
  }
  let payload;
  try { payload = await response.json(); } catch (_) { payload = {}; }
  if (!response.ok) throw new Error(payload.error?.message || "Google Drive retornou o erro " + response.status + ".");
  return payload;
}
async function listFiles() {
  const collected = [];
  let next = "", count = 0;
  const seen = new Set();
  do {
    const params = new URLSearchParams({
      q: "trashed = false and (mimeType = '" + FOLDER + "' or mimeType = '" + DOC + "')",
      pageSize: "1000",
      fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,parents,webViewLink,modifiedTime,starred,folderColorRgb,capabilities(canEdit,canAddChildren,canTrash,canMoveItemWithinDrive))"
    });
    if (next) params.set("pageToken", next);
    const page = await drive("files?" + params.toString());
    collected.push(...(page.files || []));
    next = page.nextPageToken || "";
    if (next && seen.has(next)) throw new Error("O Google Drive retornou paginação repetida.");
    if (next) seen.add(next);
    count++;
    if (count > 500) throw new Error("A biblioteca é grande demais para uma única sincronização.");
  } while (next);
  return collected;
}
function rebuild(files) {
  entries = files;
  entryMap = new Map(files.map((x) => [x.id, x]));
  folders = files.filter((f) => f.mimeType === FOLDER);
  documents = files.filter((f) => f.mimeType === DOC);
  folderMap = new Map(folders.map((x) => [x.id, x]));
  if (!["root", "all", "recent", "starred"].includes(view) && !folderMap.has(view)) view = "root";
}
async function sync() {
  if (busy) return;
  setBusy(true);
  try {
    await authorize(false);
    const files = await listFiles();
    rebuild(files);
    connected = true;
    linked = true;
    await chrome.storage.local.set({ [KEY_LINKED]: true });
    const about = await drive("about?fields=user(displayName,emailAddress,photoLink)").catch(() => ({}));
    const user = about.user || {};
    $("account-name").textContent = user.displayName || "Conta Google";
    $("account-email").textContent = user.emailAddress || "Google Drive conectado";
    const avatar = $("account-avatar");
    avatar.textContent = (user.displayName || "G").charAt(0).toUpperCase();
    // Avoid injecting remote HTML or using a third-party image request.
    lastSync = Date.now();
    showConnected(true);
    render();
  } catch (e) {
    notify("Não foi possível sincronizar: " + errorMessage(e));
    if (!connected) {
      showConnected(false);
      $("connect-hint").textContent = errorMessage(e);
    }
  } finally {
    setBusy(false);
  }
}
async function connect() {
  if (!configured) { showSetup(); notify("Adicione o Client ID OAuth ao manifest.json da extensão."); return; }
  setBusy(true);
  try { await authorize(true); }
  catch (e) { notify(errorMessage(e)); $("connect-hint").textContent = errorMessage(e); setBusy(false); return; }
  setBusy(false);
  await sync();
}
async function disconnect() {
  if (!confirm("Desconectar a conta do MyDocx neste navegador? Os arquivos continuarão no Google Drive.")) return;
  setBusy(true);
  try {
    await forgetToken(token);
    token = null; linked = false; rootId = null; entries = []; folders = []; documents = [];
    folderMap.clear(); entryMap.clear();
    await chrome.storage.local.set({ [KEY_LINKED]: false });
    showConnected(false);
    $("connect-hint").textContent = "A conexão é direta com o Google. Nenhum documento foi apagado.";
    notify("Conta desconectada do MyDocx.");
  } finally { setBusy(false); }
}
function folderParent(item) {
  return (item.parents || []).find((id) => folderMap.has(id)) || null;
}
function folderChildren(parent) {
  return folders.filter((f) => folderParent(f) === parent).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
function isDescendant(id, ancestor) {
  const seen = new Set();
  let current = folderMap.get(id);
  while (current && !seen.has(current.id)) {
    if (current.id === ancestor) return true;
    seen.add(current.id); current = folderMap.get(folderParent(current));
  }
  return false;
}
function chooseView(next) {
  view = next;
  query = "";
  $("search").value = "";
  renderLimit = 180;
  closeMenu();
  render();
}
function breadcrumb(label, next) {
  const el = textNode($("breadcrumbs"), "button", "crumb", label);
  el.type = "button";
  el.addEventListener("click", () => chooseView(next));
  enableDrop(el, next === "root" ? null : next);
}
function renderBreadcrumbs() {
  const parent = $("breadcrumbs");
  parent.replaceChildren();
  breadcrumb("MyDocx", "root");
  if (["all", "recent", "starred"].includes(view)) {
    textNode(parent, "span", "crumb-sep", "›");
    breadcrumb(view === "all" ? "Documentos" : view === "recent" ? "Recentes" : "Favoritos", view);
  } else if (view !== "root") {
    const chain = [], seen = new Set();
    let current = folderMap.get(view);
    while (current && !seen.has(current.id)) {
      seen.add(current.id); chain.unshift(current); current = folderMap.get(folderParent(current));
    }
    for (const item of chain) {
      textNode(parent, "span", "crumb-sep", "›");
      breadcrumb(item.name, item.id);
    }
  } else {
    textNode(parent, "span", "crumb-sep", "›");
    breadcrumb("Meu Drive", "root");
  }
}
function renderTree() {
  const tree = $("folder-tree");
  tree.replaceChildren();
  const seen = new Set();
  function walk(parent, depth) {
    if (depth > 25) return;
    for (const folder of folderChildren(parent)) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      const row = textNode(tree, "button", "folder-row" + (view === folder.id ? " selected" : ""), "");
      row.type = "button";
      row.title = folder.name;
      row.style.paddingLeft = (12 + depth * 12) + "px";
      const icon = textNode(row, "span", "mini-folder", "");
      icon.style.setProperty("--folder-color", safeFolderColor(folder.folderColorRgb));
      textNode(row, "span", "", folder.name);
      row.onclick = () => chooseView(folder.id);
      row.oncontextmenu = (e) => openMenu(e, folder);
      draggable(row, folder);
      enableDrop(row, folder.id);
      walk(folder.id, depth + 1);
    }
  }
  walk(null, 0);
  // Orphaned or cyclic folders must remain reachable from the sidebar.
  for (const folder of folders) {
    if (!seen.has(folder.id)) {
      const row = textNode(tree, "button", "folder-row", "▸  " + folder.name);
      row.onclick = () => chooseView(folder.id);
    }
  }
}
function selectedFiles() {
  const q = query.toLocaleLowerCase("pt-BR");
  let f = [], d = [];
  if (q) {
    f = folders.filter((x) => x.name.toLocaleLowerCase("pt-BR").includes(q));
    d = documents.filter((x) => x.name.toLocaleLowerCase("pt-BR").includes(q));
  } else if (view === "all") d = [...documents];
  else if (view === "recent") d = [...documents].sort((a, b) => (b.modifiedTime || "").localeCompare(a.modifiedTime || ""));
  else if (view === "starred") {
    f = folders.filter((x) => x.starred);
    d = documents.filter((x) => x.starred);
  } else {
    const parent = view === "root" ? null : view;
    f = folders.filter((x) => folderParent(x) === parent);
    d = documents.filter((x) => folderParent(x) === parent);
  }
  if (view !== "recent") {
    f.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    d.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  return [...f, ...d];
}
function card(item) {
  const isFolder = item.mimeType === FOLDER;
  const el = textNode($("items"), "article", "file-card", "");
  el.tabIndex = 0;
  el.setAttribute("aria-label", item.name);
  const top = textNode(el, "div", "file-top", "");
  if (isFolder) {
    const art = textNode(top, "span", "folder-art", "");
    art.style.setProperty("--folder-color", safeFolderColor(item.folderColorRgb));
  } else {
    const art = textNode(top, "span", "document-art", "");
    art.appendChild(document.createElement("i"));
  }
  const more = textNode(top, "button", "file-menu-button", "•••");
  more.type = "button";
  more.setAttribute("aria-label", "Opções para " + item.name);
  more.onclick = (e) => openMenu(e, item);
  textNode(el, "div", "file-title", item.name || "Sem título");
  const dated = item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";
  textNode(el, "div", "file-meta", (isFolder ? "Pasta" : "Google Docs") + (item.starred ? "  ★" : "") + (dated ? " · " + dated : ""));
  el.onclick = (e) => {
    if (e.target.closest("button")) return;
    if (isFolder) chooseView(item.id);
    else openDocument(item);
  };
  el.onkeydown = (e) => { if (e.key === "Enter") el.click(); };
  el.oncontextmenu = (e) => openMenu(e, item);
  draggable(el, item);
  if (isFolder) enableDrop(el, item.id);
}
function render() {
  if (!connected) return;
  renderTree();
  renderBreadcrumbs();
  document.querySelectorAll("[data-view]").forEach((el) => el.classList.toggle("selected", el.dataset.view === view));
  document.querySelectorAll("[data-layout]").forEach((el) => el.classList.toggle("active", el.dataset.layout === layout));
  $("items").className = "items" + (layout === "list" ? " list" : "");
  const searching = Boolean(query);
  const title = searching ? "Resultados da pesquisa" : ({ root: "Meu Drive", all: "Documentos", recent: "Recentes", starred: "Favoritos" }[view] || folderMap.get(view)?.name || "Meu Drive");
  $("page-title").textContent = title;
  $("page-subtitle").textContent = searching ? "Pesquisa por nomes no Google Drive." : view === "root" ? "Suas pastas e documentos sincronizados." : view === "all" ? "Todos os documentos Google Docs acessíveis." : view === "recent" ? "Documentos ordenados pela última edição." : view === "starred" ? "Itens marcados com estrela no Drive." : "Conteúdo desta pasta.";
  const items = selectedFiles();
  $("item-count").textContent = items.length + (items.length === 1 ? " item" : " itens");
  $("sync-label").textContent = lastSync ? "Sincronizado às " + new Date(lastSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  $("items").replaceChildren();
  for (const item of items.slice(0, renderLimit)) card(item);
  if (items.length > renderLimit) {
    const btn = textNode($("items"), "button", "button secondary", "Mostrar mais (" + (items.length - renderLimit) + ")");
    btn.type = "button";
    btn.onclick = () => { renderLimit += 180; render(); };
  }
  $("empty").hidden = items.length > 0;
  $("empty-title").textContent = searching ? "Nenhum resultado" : "Nada por aqui";
  $("empty-message").textContent = searching ? "Tente outro nome de documento ou pasta." : "Crie uma pasta ou um documento no Google Drive.";
}
function draggable(element, item) {
  element.draggable = true;
  element.addEventListener("dragstart", (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-mydocx-drive", item.id);
  });
}
function enableDrop(element, parentId) {
  element.addEventListener("dragover", (e) => {
    if (!Array.from(e.dataTransfer.types).includes("application/x-mydocx-drive")) return;
    e.preventDefault(); element.classList.add("dragover");
  });
  element.addEventListener("dragleave", () => element.classList.remove("dragover"));
  element.addEventListener("drop", async (e) => {
    e.preventDefault(); e.stopPropagation(); element.classList.remove("dragover");
    const id = e.dataTransfer.getData("application/x-mydocx-drive");
    if (!isValidId(id) || !entryMap.has(id)) return;
    try { await moveFile(entryMap.get(id), parentId); } catch (err) { notify(errorMessage(err)); }
  });
}
function closeMenu() {
  $("context-menu").hidden = true;
  $("context-menu").replaceChildren();
}
function menuAction(title, handler, danger = false) {
  const btn = textNode($("context-menu"), "button", danger ? "danger" : "", title);
  btn.type = "button";
  btn.onclick = () => { closeMenu(); Promise.resolve().then(handler).catch((err) => notify(errorMessage(err))); };
}
function openMenu(e, item) {
  e.preventDefault(); e.stopPropagation();
  closeMenu();
  const isFolder = item.mimeType === FOLDER;
  if (isFolder) menuAction("Abrir pasta", () => chooseView(item.id));
  else menuAction("Abrir documento", () => openDocument(item));
  menuAction(item.starred ? "Remover dos favoritos" : "Adicionar aos favoritos", () => mutate(item.id, { starred: !item.starred }, "Favoritos atualizados."));
  if (item.capabilities?.canEdit !== false) {
    menuAction("Renomear", () => editDialog(isFolder ? "rename-folder" : "rename-doc", item));
    if (isFolder) menuAction("Alterar cor", () => editDialog("color-folder", item));
    menuAction("Mover para…", () => editDialog(isFolder ? "move-folder" : "move-doc", item));
    if (item.capabilities?.canTrash !== false) menuAction("Mover para a lixeira", () => trash(item), true);
  }
  const menu = $("context-menu");
  menu.hidden = false;
  menu.style.left = Math.max(8, Math.min(e.clientX, innerWidth - menu.offsetWidth - 12)) + "px";
  menu.style.top = Math.max(8, Math.min(e.clientY, innerHeight - menu.offsetHeight - 12)) + "px";
}
function getParentsOptions(selected, excludeId) {
  const select = $("item-parent");
  select.replaceChildren();
  const root = document.createElement("option");
  root.value = ""; root.textContent = "Meu Drive (raiz)";
  select.appendChild(root);
  const walked = new Set();
  function walk(parent, depth) {
    if (depth > 25) return;
    for (const folder of folderChildren(parent)) {
      if (walked.has(folder.id)) continue;
      walked.add(folder.id);
      if (folder.id === excludeId || (excludeId && isDescendant(folder.id, excludeId))) continue;
      const o = document.createElement("option");
      o.value = folder.id;
      o.textContent = "　".repeat(depth) + folder.name;
      select.appendChild(o);
      walk(folder.id, depth + 1);
    }
  }
  walk(null, 0);
  select.value = selected || "";
}
function editDialog(mode, item = null) {
  if (!connected) return notify("Conecte sua conta Google primeiro.");
  currentForm = { mode, item };
  const isFolder = mode.includes("folder"), isMove = mode.startsWith("move-"), isRename = mode.startsWith("rename-"), isColor = mode === "color-folder";
  $("dialog-title").textContent = isMove ? "Mover item" : isRename ? "Renomear" : isColor ? "Cor da pasta" : isFolder ? "Nova pasta" : "Novo documento";
  $("name-field").hidden = isMove || isColor;
  $("item-name").required = !(isMove || isColor);
  $("item-name").value = item?.name || "";
  $("parent-field").hidden = isRename || isColor;
  $("color-field").hidden = !isFolder || isMove || isRename;
  $("item-color").value = /^#[a-f0-9]{6}$/i.test(item?.folderColorRgb || "") ? item.folderColorRgb : fallbackColor;
  getParentsOptions(item ? folderParent(item) : (!["root", "all", "starred", "recent"].includes(view) ? view : null), isFolder && item ? item.id : null);
  $("dialog-note").textContent = "Esta alteração será salva diretamente no Google Drive.";
  $("dialog-error").hidden = true;
  $("dialog-save").disabled = false;
  $("dialog-save").textContent = isMove ? "Mover" : "Salvar";
  $("edit-dialog").showModal();
  setTimeout(() => (isMove ? $("item-parent") : isColor ? $("item-color") : $("item-name")).focus(), 0);
}
async function mutate(id, body, text) {
  if (!isValidId(id)) throw new Error("ID de arquivo inválido.");
  await drive("files/" + encodeURIComponent(id) + "?fields=id", { method: "PATCH", body });
  await sync();
  notify(text);
}
async function getRootId() {
  if (rootId) return rootId;
  const root = await drive("files/root?fields=id");
  rootId = root.id;
  return rootId;
}
async function moveFile(item, dest) {
  if (busy) return;
  if (item.id === dest || (dest && item.mimeType === FOLDER && isDescendant(dest, item.id))) throw new Error("Não é possível colocar uma pasta dentro dela mesma.");
  if (dest && !folderMap.has(dest)) throw new Error("Pasta de destino não encontrada.");
  if (item.capabilities?.canEdit === false) throw new Error("Você não tem permissão para mover este item.");
  const target = dest || await getRootId();
  const parent = (item.parents || [])[0] || "";
  if (target === parent) return;
  const params = new URLSearchParams({ fields: "id,parents", addParents: target });
  if (parent) params.set("removeParents", parent);
  await drive("files/" + encodeURIComponent(item.id) + "?" + params.toString(), { method: "PATCH", body: {} });
  await sync();
  notify("Item movido no Google Drive.");
}
async function trash(item) {
  if (!confirm("Mover \"" + item.name + "\" para a lixeira do Google Drive?" + (item.mimeType === FOLDER ? " Os itens dentro da pasta também serão afetados." : ""))) return;
  await mutate(item.id, { trashed: true }, "Item movido para a lixeira.");
}
async function saveForm(e) {
  e.preventDefault();
  if (!currentForm) return;
  const { mode, item } = currentForm;
  const name = $("item-name").value.trim();
  const parent = $("item-parent").value || null;
  if (!mode.startsWith("move-") && mode !== "color-folder" && !name) return;
  const btn = $("dialog-save");
  btn.disabled = true;
  $("dialog-error").hidden = true;
  try {
    if (mode === "new-folder" || mode === "new-doc") {
      const isFolder = mode === "new-folder";
      const body = { name, mimeType: isFolder ? FOLDER : DOC };
      if (parent) body.parents = [parent];
      if (isFolder) body.folderColorRgb = $("item-color").value;
      const created = await drive("files?fields=id,webViewLink,mimeType", { method: "POST", body });
      $("edit-dialog").close();
      currentForm = null;
      await sync();
      notify(isFolder ? "Pasta criada no Google Drive." : "Documento criado no Google Drive.");
      if (!isFolder) openDocument(created);
    } else if (mode.startsWith("rename-")) {
      await drive("files/" + encodeURIComponent(item.id) + "?fields=id", { method: "PATCH", body: { name } });
      $("edit-dialog").close(); currentForm = null; await sync(); notify("Nome atualizado no Google Drive.");
    } else if (mode === "color-folder") {
      await drive("files/" + encodeURIComponent(item.id) + "?fields=id", { method: "PATCH", body: { folderColorRgb: $("item-color").value } });
      $("edit-dialog").close(); currentForm = null; await sync(); notify("Cor da pasta atualizada.");
    } else if (mode.startsWith("move-")) {
      await moveFile(item, parent);
      $("edit-dialog").close(); currentForm = null;
    }
  } catch (err) {
    $("dialog-error").textContent = errorMessage(err);
    $("dialog-error").hidden = false;
  } finally { btn.disabled = false; }
}
$("connect-button").addEventListener("click", connect);
$("refresh-button").addEventListener("click", () => { if (connected) sync(); else if (configured) connect(); else showSetup(); });
$("account-button").addEventListener("click", () => { if (connected) disconnect(); else connect(); });
$("new-folder").addEventListener("click", () => editDialog("new-folder"));
$("sidebar-add-folder").addEventListener("click", () => editDialog("new-folder"));
$("new-document").addEventListener("click", () => editDialog("new-doc"));
$("edit-form").addEventListener("submit", saveForm);
$("dialog-close").addEventListener("click", () => $("edit-dialog").close());
$("dialog-cancel").addEventListener("click", () => $("edit-dialog").close());
$("edit-dialog").addEventListener("close", () => { currentForm = null; });
$("search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const value = e.target.value;
  searchTimer = setTimeout(() => { query = value.trim().toLocaleLowerCase("pt-BR"); renderLimit = 180; render(); }, 170);
});
document.querySelectorAll("[data-view]").forEach((el) => el.addEventListener("click", () => chooseView(el.dataset.view)));
document.querySelectorAll("[data-layout]").forEach((el) => el.addEventListener("click", () => { layout = el.dataset.layout; render(); }));
function openLocal() { window.location.href = chrome.runtime.getURL("dashboard.html"); }
$("offline-button").addEventListener("click", openLocal);
$("local-button").addEventListener("click", openLocal);
$("copy-extension-id").addEventListener("click", () => navigator.clipboard.writeText(chrome.runtime.id).then(() => notify("ID copiado."), () => notify("Não foi possível copiar.")));
document.addEventListener("pointerdown", (e) => { if (!$("context-menu").hidden && !e.target.closest("#context-menu")) closeMenu(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && connected && !busy && Date.now() - lastSync > 60000) sync(); });
$("extension-id").textContent = chrome.runtime.id || "";
if (!configured) {
  showSetup();
  $("connect-hint").textContent = "Para conectar, configure primeiro o OAuth no Google Cloud.";
}
chrome.storage.local.get(KEY_LINKED).then((data) => {
  linked = data[KEY_LINKED] === true;
  showConnected(false);
  if (linked && configured) sync();
}).catch(() => showConnected(false));
})();