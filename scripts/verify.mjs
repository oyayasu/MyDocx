import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.manifest_version, 3, 'Manifest V3 is required');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.ok(manifest.permissions.includes('storage'), 'Local storage required');
assert.ok(!manifest.permissions.includes('<all_urls>'), 'Disallow broad privileges');
assert.equal(manifest.action.default_title, 'Abrir MyDocx');
const assets = new Set([
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((script) => [...script.js, ...script.css]),
  ...manifest.web_accessible_resources.flatMap((rule) => rule.resources),
  'manifest.json',
  'README.md',
  'INSTALLAR.txt'
]);
for (const name of assets) {
  assert.ok(fs.existsSync(path.join(root, name)), `Missing: ${name}`);
  console.log('OK asset:', name);
}
const html = read('dashboard.html');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const asset = match[1];
  if (/^(https?:|mailto:)/.test(asset)) continue;
  assert.ok(assets.has(asset) && fs.existsSync(path.join(root, asset)), `Unpackaged HTML reference: ${asset}`);
}
for (const id of ['item-form','item-name','item-url','item-parent','item-color','folder-tree','items','context-menu']) {
  assert.ok(html.includes(`id="${id}"`), `Missing dashboard element: ${id}`);
}
for (const file of ['background.js', 'content.js', 'dashboard.js']) {
  assert.ok(read(file).length > 100, `Empty JS asset: ${file}`);
}
console.log('MyDocx extension structure verified:', manifest.version);
