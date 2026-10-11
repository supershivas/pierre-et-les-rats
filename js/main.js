/* L'app : l'en-tête, l'écran d'accueil, le prologue, le HUD, les commandes
   (clavier et pouce), les réglages, la sauvegarde et la mise à jour. */
import { startUpdateCheck, loadVersion, loadChangelog, downloadJSON } from './app-update.js?v=1.0.2';
import { makeCity } from './city.js?v=1.0.2';
import { loadCity, readDraft } from './city-store.js?v=1.0.2';
import { createGame } from './game.js?v=1.0.2';
import { makeFlute } from './audio.js?v=1.0.2';
import { MOVE, keyIs, stopTypeahead } from './keys.js?v=1.0.2';

const SAVE_KEY = 'pierre:partie';
const PREFS_KEY = 'pierre:prefs';
const $ = id => document.getElementById(id);

const readJSON = (k, d) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch { return d; } };
const writeJSON = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* plein ou bloqué */ } };

const prefs = { music: 70, zoom: 0, ...readJSON(PREFS_KEY, {}) };
const savePrefs = () => writeJSON(PREFS_KEY, prefs);

// ─── Toast ───
let toastTimer = 0;
function toast(text, ms = 3200) {
  const el = $('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ─── Version, historique, mise à jour automatique ───
startUpdateCheck({ onUpdated: v => toast(`Mis à jour en v${v}`) });
loadVersion().then(v => { if (v) $('version').textContent = `v${v}`; });
loadChangelog().then(entries => {
  $('changelog').innerHTML = entries.map(e => `<li><p class="changelog-head">v${e.version} <span class="hint-text">${e.date}</span></p><ul>${e.changes.map(c => `<li>${c.replace(/</g, '&lt;')}</li>`).join('')}</ul></li>`).join('');
});

// ─── Le monde ───
const { data, draft } = await loadCity();
const city = makeCity(data);
const flute = makeFlute();
flute.setVolume(prefs.music / 100);
let save = readJSON(SAVE_KEY, null);
let game = null;
let state = 'title'; // 'title' | 'prologue' | 'play'

function newGameObject(fromSave) {
  if (game) game.destroy();
  game = createGame({
    canvas: $('game'), city, save: fromSave,
    onRats: n => updateCount(n),
    onMessage: m => showMessage(m),
  });
  game.setZoom(prefs.zoom);
  updateCount(game.army);
}
newGameObject(save);
game.setAttract(true);
game.resume();
if (draft) $('draft-note').hidden = false;

function updateCount(n) {
  $('rat-count').textContent = n.toLocaleString('fr-FR');
  $('rat-label').textContent = n > 1 ? 'rats' : 'rat';
}
let messageTimer = 0;
function showMessage(text) {
  const el = $('message');
  el.textContent = text;
  el.classList.remove('gone');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => el.classList.add('gone'), 4200);
}

// ─── Sauvegarde : régulière, et à la fermeture ───
function saveGame() {
  if (!game || state !== 'play') return;
  save = { v: 1, ...game.snapshot(), savedAt: new Date().toISOString() };
  writeJSON(SAVE_KEY, save);
}
setInterval(saveGame, 5000);
addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { saveGame(); stopPlaying(); flute.suspend(); }
});

// ─── Accueil ───
function showTitle() {
  saveGame();
  stopPlaying();
  closeSettings();
  state = 'title';
  $('title').hidden = false;
  $('prologue').hidden = true;
  $('hud').hidden = true; $('play').hidden = true; $('hint').classList.add('gone');
  $('title-resume').hidden = !save;
  $('title-new').classList.remove('confirm');
  $('title-new').querySelector('span').textContent = 'Nouvelle partie';
  game.setAttract(true);
  game.resume();
}
function enterPlay() {
  state = 'play';
  $('title').hidden = true;
  $('hud').hidden = false; $('play').hidden = false;
  game.setAttract(false);
  game.resume();
  $('game').focus?.();
  const hint = $('hint');
  hint.classList.remove('gone');
  setTimeout(() => hint.classList.add('gone'), 7000);
}
function playPrologue() {
  state = 'prologue';
  $('title').hidden = true;
  const pro = $('prologue');
  pro.hidden = false; pro.classList.remove('out');
  const lines = [...pro.querySelectorAll('p')];
  lines.forEach(p => p.classList.remove('on'));
  const timers = lines.map((p, k) => setTimeout(() => p.classList.add('on'), 400 + k * 2600));
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    pro.removeEventListener('click', finish);
    removeEventListener('keydown', finish);
    pro.classList.add('out');
    enterPlay();
    setTimeout(() => { pro.hidden = true; }, 1200);
  };
  timers.push(setTimeout(finish, 400 + lines.length * 2600 + 1800));
  pro.addEventListener('click', finish);
  setTimeout(() => addEventListener('keydown', finish), 300);
}

$('title-resume').addEventListener('click', () => { newGameObject(save); enterPlay(); });
$('title-new').addEventListener('click', e => {
  const btn = e.currentTarget;
  if (save && !btn.classList.contains('confirm')) {
    btn.classList.add('confirm');
    btn.querySelector('span').textContent = 'Effacer la partie ?';
    return;
  }
  startNewGame();
});
function startNewGame() {
  save = null;
  writeJSON(SAVE_KEY, null);
  newGameObject(null);
  playPrologue();
}
$('title-settings').addEventListener('click', openSettings);
$('home').addEventListener('click', e => { e.preventDefault(); showTitle(); });

// ─── La flûte ───
function startPlaying() {
  if (state !== 'play' || game.paused) return;
  flute.start();
  game.setPlaying(true);
  $('play').classList.add('on');
}
function stopPlaying() {
  flute.stop();
  game?.setPlaying(false);
  $('play').classList.remove('on');
}
flute.onNote = () => { if (game.playing) game.note(); };
(function loop() { flute.tick(); requestAnimationFrame(loop); })();

const playBtn = $('play');
playBtn.addEventListener('pointerdown', e => { e.preventDefault(); playBtn.setPointerCapture(e.pointerId); startPlaying(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) playBtn.addEventListener(ev, stopPlaying);
playBtn.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); startPlaying(); } });
playBtn.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') stopPlaying(); });
playBtn.addEventListener('contextmenu', e => e.preventDefault());

// ─── Clavier ───
stopTypeahead();
addEventListener('keydown', e => {
  if (state !== 'play' || settings.open) return;
  if (e.target.closest?.('input, select, textarea')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  for (const [dir, codes] of Object.entries(MOVE)) if (codes.includes(e.code)) { game.input[dir] = 1; game.input.target = null; e.preventDefault(); }
  if (e.key === 'Shift') game.input.run = true;
  if (e.repeat) return;
  if ((e.code === 'Space' && !e.target.closest?.('button, a')) || keyIs(e, 'e')) { e.preventDefault(); startPlaying(); }
});
addEventListener('keyup', e => {
  for (const [dir, codes] of Object.entries(MOVE)) if (codes.includes(e.code)) game.input[dir] = 0;
  if (e.key === 'Shift') game.input.run = false;
  if (e.code === 'Space' || keyIs(e, 'e')) stopPlaying();
});
addEventListener('blur', () => { for (const k of ['up', 'down', 'left', 'right']) game.input[k] = 0; game.input.run = false; stopPlaying(); });

// ─── Au pouce ou à la souris : Pierre marche vers le point touché ───
const canvas = $('game');
let pointerId = null;
canvas.addEventListener('pointerdown', e => {
  if (state !== 'play') return;
  pointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  const r = canvas.getBoundingClientRect();
  game.input.target = game.screenToWorld(e.clientX - r.left, e.clientY - r.top);
  game.input.hold = true;
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== pointerId) return;
  const r = canvas.getBoundingClientRect();
  game.input.target = game.screenToWorld(e.clientX - r.left, e.clientY - r.top);
});
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { if (e.pointerId === pointerId) { pointerId = null; game.input.hold = false; } });

addEventListener('resize', () => game.resize());

// ─── Réglages ───
const settings = $('settings');
function openSettings() {
  stopPlaying();
  game.pause();
  $('stat-rats').textContent = game.army.toLocaleString('fr-FR');
  $('stat-time').textContent = Math.floor((game.snapshot().playSeconds || 0) / 60);
  $('opt-music').value = prefs.music;
  $('opt-zoom').value = String(prefs.zoom);
  resetNewGameButton();
  if (!settings.open) settings.showModal();
}
function closeSettings() { if (settings.open) settings.close(); }
settings.addEventListener('close', () => { if (state !== 'prologue') game.resume(); if (location.hash === '#reglages') history.replaceState(null, '', location.pathname); });
settings.addEventListener('click', e => { if (e.target === settings) closeSettings(); });
$('open-settings').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', closeSettings);
$('opt-music').addEventListener('input', e => { prefs.music = +e.target.value; flute.setVolume(prefs.music / 100); savePrefs(); });
$('opt-zoom').addEventListener('change', e => { prefs.zoom = +e.target.value; game.setZoom(prefs.zoom); savePrefs(); });
function resetNewGameButton() {
  const b = $('new-game');
  b.classList.remove('confirm');
  b.querySelector('span').textContent = 'Nouvelle partie';
}
$('new-game').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.querySelector('span').textContent = 'Effacer la partie et recommencer ?'; return; }
  closeSettings();
  startNewGame();
});
$('export').addEventListener('click', () => {
  saveGame();
  downloadJSON({
    app: 'pierre-et-les-rats',
    version: $('version').textContent.replace(/^v/, ''),
    exportedAt: new Date().toISOString(),
    partie: readJSON(SAVE_KEY, null),
    reglages: prefs,
    villeBrouillon: readDraft(),
  }, `pierre-et-les-rats-${new Date().toISOString().slice(0, 10)}.json`);
});
if (location.hash === '#reglages') openSettings();

showTitle();
