// Estampille les imports avec la version (?v=1.22.0) : GitHub Pages sert les
// fichiers avec dix minutes de cache, et après une mise à jour le navigateur
// pouvait mélanger anciens et nouveaux modules (le jeu tournait avec l'ancien
// code alors que le labo avait le nouveau). À lancer après chaque changement
// de version.json : node scripts/stamp-version.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
const v = `?v=${version}`;
let changed = 0;
function stamp(file, patterns) {
  const path = join(root, file);
  const before = readFileSync(path, 'utf8');
  let s = before;
  for (const re of patterns) s = s.replace(re, (_, a, url, b) => `${a}${url}${v}${b}`);
  if (s !== before) { writeFileSync(path, s); changed++; }
}
// Les modules : `from './x.js'`, `import('./x.js')`
for (const f of readdirSync(join(root, 'js')).filter(f => f.endsWith('.js'))) {
  stamp(`js/${f}`, [
    /(from\s+')(\.{1,2}\/[^'?]+\.js)(?:\?v=[^']*)?(')/g,
    /(import\(\s*')(\.{1,2}\/[^'?]+\.js)(?:\?v=[^']*)?(')/g,
  ]);
}
// Les pages : scripts de modules et feuilles de style locales
for (const f of ['index.html', 'atelier.html', 'echelle.html']) {
  stamp(f, [
    /(<script type="module" src=")([^"?]+\.js)(?:\?v=[^"]*)?(")/g,
    /(<link rel="stylesheet" href=")((?!https?:)[^"?]+\.css)(?:\?v=[^"]*)?(")/g,
  ]);
}
console.log(`v${version} : ${changed} fichier(s) estampillé(s)`);
