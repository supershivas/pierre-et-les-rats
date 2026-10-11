/* Où vit le quartier : data/ville.json (publié dans le dépôt, la source de
   vérité) et, dans ce navigateur, le brouillon de l'atelier tant qu'il n'est
   pas publié. Le jeu lit le brouillon s'il y en a un, et le signale. */
import { generateQuarter } from './city.js?v=1.0.1';

export const DRAFT_KEY = 'pierre:ville-brouillon';
export const PUBLISHED_URL = 'data/ville.json';

export async function loadPublished() {
  try {
    const res = await fetch(PUBLISHED_URL, { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch { /* hors ligne */ }
  return generateQuarter(1815);
}

export function readDraft() {
  try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function writeDraft(data) {
  try { data ? localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) : localStorage.removeItem(DRAFT_KEY); } catch { /* plein */ }
}

export const sameCity = (a, b) => !!a && !!b && a.w === b.w && a.h === b.h && a.rows.join('') === b.rows.join('') && String(a.start) === String(b.start);

// Le quartier à jouer : { data, draft } (draft vrai si c'est un brouillon non publié)
export async function loadCity() {
  const published = await loadPublished();
  const draft = readDraft();
  if (draft && !sameCity(draft, published)) return { data: draft, draft: true, published };
  return { data: published, draft: false, published };
}

// Le texte de data/ville.json : une ligne par rangée, lisible dans un diff
export function formatCity(d) {
  return `{\n  "w": ${d.w},\n  "h": ${d.h},\n  "seed": ${d.seed},\n  "start": [${d.start.join(', ')}],\n  "rows": [\n${d.rows.map(r => `    "${r}"`).join(',\n')}\n  ]\n}\n`;
}
