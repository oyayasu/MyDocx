import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const manifest = JSON.parse(read("manifest.json"));

assert.equal(manifest.manifest_version, 3, "Manifest V3 required");
assert.match(manifest.version, /^\\d+\\.\\d+\\.\\d+$/);
assert.ok(manifest.permissions.includes("storage"));
assert.ok(manifest.permissions.includes("identity"));
assert.ok(manifest.host_permissions.includes("https://www.googleapis.com/*"));
assert.ok(!manifest.permissions.includes("<all_urls>"));
assert.equal(manifest.action.default_title, "Abrir MyDocx");
assert.deepEqual(manifest.oauth2.scopes, [
  "https://www.googleapis.com/auth/drive.metadata",
  "https://www.googleapis.com/auth/drive.file"
]);

const assets = new Set([
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((script) => [...script.js, ...script.css]),
  ...manifest.web_accessible_resources.flatMap((rule) => rule.resources),
  "manifest.json", "README.md", "SETUP-GOOGLE.md", "INSTALLAR.txt"
]);
for (const name of assets) {
  assert.ok(fs.existsSync(path.join(root, name)), "Missing asset: " + name);
  console.log("OK asset:", name);
}
for (const file of ["dashboard.html", "cloud.html"]) {
  const html = read(file);
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const asset = match[1];
    if (/^(https?:|mailto:)/.test(asset)) continue;
    assert.ok(assets.has(asset), "Unpackaged reference: " + asset);
  }
}
for (const id of ["item-form", "item-name", "item-url", "item-parent", "item-color", "folder-tree", "items", "context-menu"]) {
  assert.ok(read("dashboard.html").includes('id="' + id + '"'), "Missing legacy element: " + id);
}
for (const id of ["connect-button", "workspace", "folder-tree", "items", "edit-dialog", "edit-form", "account-button"]) {
  assert.ok(read("cloud.html").includes('id="' + id + '"'), "Missing cloud element: " + id);
}
for (const file of ["background.js", "content.js", "dashboard.js", "cloud.js"]) {
  assert.ok(read(file).length > 100, "Empty JS asset: " + file);
}
assert.ok(read("cloud.js").includes("getAuthToken"), "OAuth support missing");
assert.ok(read("cloud.js").includes("nextPageToken"), "Drive pagination missing");
console.log("MyDocx extension structure verified:", manifest.version);
