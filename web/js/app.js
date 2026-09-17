import { Brain } from './game/brain.js';
import { Maze } from './maze/maze.js';
import { Senses, Policy, Body, ACTIONS } from './maze/agent.js';
import { Arena, PALETTES } from './maze/scene.js';
import { LOCALES, detectLocale, setLocale, getLocale, t, applyDom } from './i18n.js';

const $ = s => document.querySelector(s);
const DT_MS = 0.5;                 // simulation step; 0.993 cosine against 0.1 ms, twice the speed
const MAX_STEPS = 260;
const SAVE = 'vial.maze.v1';

const S = {
  brain: null, maze: null, senses: null, body: null, pol: null, arena: null,
  mode: 'real', running: false, training: false,
  ep: { steps: [], n: 0, found: 0, t0: 0 },
  curves: { real: [], shuf: [] },
  lastDecide: 0, lastTick: 0, sense: null, feats: null,
};

/* ---------------- theme ---------------- */
/* Three viewer states, like any page: an explicit light or dark choice, or auto,
   which follows the system. The 3D scene has its own palette per theme — the light
   one is not an inversion, it is the same rig with the room lights up. */
const THEME_KEY = 'vial.theme';
const media = matchMedia('(prefers-color-scheme: light)');

function themePref() {
  try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (_) { return 'auto'; }
}
function resolveTheme(pref = themePref()) {
  if (pref === 'light' || pref === 'dark') return pref;
  return media.matches ? 'light' : 'dark';
}
function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  document.querySelectorAll('[data-theme-set]').forEach(b =>
    b.classList.toggle('on', b.dataset.themeSet === pref));
  const want = resolveTheme(pref);
  if (S.arena && S.themeNow !== want) rebuildScene(want);
  S.themeNow = want;
}
function setTheme(pref) {
  try { localStorage.setItem(THEME_KEY, pref); } catch (_) {}
  applyTheme(pref);
}
/* A renderer is bound to its canvas and its palette is baked into the materials,
   so a theme change swaps in a fresh canvas rather than patching every material. */
function rebuildScene(theme) {
  const old = $('#stage');
  const fresh = old.cloneNode(false);
  old.replaceWith(fresh);
  try { S.arena.renderer.dispose(); } catch (_) {}
  S.arena = new Arena(fresh, theme);
  S.arena.build(S.maze);
}

/* ---------------- boot ---------------- */
async function boot() {
  setLocale(detectLocale());
  buildLang(); applyDom();
  const step = (k, f) => {
    $('#loadLabel').textContent = t('boot.' + k);
    $('#loadBar').style.width = `${Math.round(f * 100)}%`;
  };
  try {
    await loadBrain(step);
    S.themeNow = resolveTheme();
    S.arena = new Arena($('#stage'), S.themeNow);
    newMaze(1 + ((Math.random() * 9999) | 0));
    restore();
    buildUI();
    applyTheme(themePref());
    $('#boot').classList.add('done');
    setTimeout(() => $('#boot').remove(), 700);
    S.lastTick = performance.now();
    setRunning(true);
    requestAnimationFrame(loop);
  } catch (err) {
    $('#loadLabel').textContent = t('boot.failed');
    $('#loadDetail').innerHTML = `<strong>${esc(err.message)}</strong><br>${t('boot.failhint')}`;
    $('#loadDetail').classList.add('err');
    console.error(err);
  }
}

async function loadBrain(step) {
  if (S.brain?.worker) S.brain.worker.terminate();
  const suffix = S.mode === 'shuf' ? '.shuf' : '';
  S.brain = new Brain({ dt: DT_MS, connSuffix: suffix });
  await new Promise((res, rej) => {
    S.brain.onReady = res;
    S.brain.load(step).catch(rej);
  });
  S.brain.worker.postMessage({ cmd: 'speed', value: 24 });
}

function newMaze(seed) {
  S.maze = new Maze(9, 9, seed);
  S.maze.diffuse();
  S.senses = new Senses(S.brain, S.maze);
  S.body = new Body(S.maze);
  if (!S.pol) S.pol = new Policy(S.brain.featIdx.length);
  S.arena.build(S.maze);
  buildFeatStrip();
  resetEpisode();
}

function resetEpisode() {
  S.body.reset();
  S.ep.steps = [];
  S.ep.prevDist = S.body.distanceToFood();
  S.ep.stepCount = 0;
  if (S.senses) S.senses.clear();
}

/* ---------------- episode ---------------- */
function decide() {
  const b = S.body;
  const x = S.senses.evoked;
  S.feats = x;
  const explore = Math.max(0.7, 1.9 - S.pol.episodes * 0.02);
  const { action } = S.pol.act(x, explore);
  S.ep.action = action;

  const d = b.distanceToFood();
  const progress = S.ep.prevDist - d;
  S.ep.prevDist = d;
  let r = progress * 3.2 - 0.012;
  const done = d < 0.34;
  if (done) r += 6;
  S.ep.steps.push({ x: Float32Array.from(x), action, reward: r });
  S.ep.stepCount++;

  if (done || S.ep.stepCount >= MAX_STEPS) endEpisode(done);
}

function endEpisode(found) {
  S.pol.learn(S.ep.steps);
  S.ep.n++;
  if (found) S.ep.found++;
  const curve = S.curves[S.mode];
  curve.push({ found: found ? 1 : 0, steps: S.ep.stepCount });
  if (curve.length > 400) curve.shift();
  $('#dockStat').textContent = found
    ? t('stat.reached', { n: S.ep.stepCount }) : t('stat.lost');
  save();
  resetEpisode();
}

/* ---------------- loop ---------------- */
function loop(now) {
  const dt = Math.min((now - S.lastTick) / 1000, 0.05);
  S.lastTick = now;
  S.brain.tick(now);

  if (S.running || S.training) {
    // one decision per sniff: the readout is only informative during the transient
    if (S.senses.update(S.body.x, S.body.y, S.body.heading)) decide();
    S.sense = S.senses.last;
    const move = Math.min(dt, 0.05) * (S.training ? 3 : 1);
    S.body.step(S.ep.action || 0, move);
  }

  if (!S.training) {
    S.arena.update(S.body, dt, now / 1000);
    S.arena.render();
  }
  if (now - (S._paint || 0) > 180) { paint(); S._paint = now; }
  requestAnimationFrame(loop);
}

/* ---------------- ui ---------------- */
function buildLang() {
  const sel = $('#lang');
  sel.innerHTML = Object.keys(LOCALES).map(c => `<option value="${c}">${LOCALES[c]['lang.name']}</option>`).join('');
  sel.value = getLocale();
  sel.addEventListener('change', () => { setLocale(sel.value); applyDom(); repaint(); });
}

function buildFeatStrip() {
  $('#feats').innerHTML = Array.from({ length: S.brain.featIdx.length }, () => '<i></i>').join('');
  S.featEls = [...$('#feats').querySelectorAll('i')];
}

function buildUI() {
  document.querySelectorAll('[data-theme-set]').forEach(b =>
    b.addEventListener('click', () => setTheme(b.dataset.themeSet)));
  media.addEventListener('change', () => { if (themePref() === 'auto') applyTheme('auto'); });
  $('#btnRun').addEventListener('click', () => setRunning(!S.running));
  $('#btnTrain').addEventListener('click', () => setTraining(!S.training));
  $('#btnMaze').addEventListener('click', () => newMaze(1 + ((Math.random() * 9999) | 0)));
  $('#modeReal').addEventListener('click', () => switchBrain('real'));
  $('#modeShuf').addEventListener('click', () => switchBrain('shuf'));
  document.addEventListener('click', e => {
    const b = e.target.closest('.info'); const pop = $('#infoPop');
    if (!b) { if (!e.target.closest('#infoPop')) pop.classList.remove('open'); return; }
    if (pop.classList.contains('open') && pop.dataset.key === b.dataset.info) { pop.classList.remove('open'); return; }
    pop.dataset.key = b.dataset.info; paintInfo(); pop.classList.add('open');
    pop.style.visibility = 'hidden'; pop.style.left = '0'; pop.style.top = '0';
    const r = b.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    pop.style.left = `${Math.round(Math.min(Math.max(8, r.left + r.width / 2 - pr.width / 2), innerWidth - pr.width - 8))}px`;
    pop.style.top = `${Math.round(r.bottom + 8 + pr.height > innerHeight - 8 ? Math.max(8, r.top - pr.height - 8) : r.bottom + 8)}px`;
    pop.style.visibility = '';
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#infoPop').classList.remove('open'); });
  repaint();
}

function paintInfo() {
  const pop = $('#infoPop'); if (!pop.dataset.key) return;
  pop.querySelector('h4').textContent = t(`info.${pop.dataset.key}.t`);
  pop.querySelector('p').textContent = t(`info.${pop.dataset.key}.b`);
}

function setRunning(on) {
  S.running = on;
  if (on) S.training = false;
  repaint();
}
function setTraining(on) {
  S.training = on;
  if (on) S.running = false;
  $('#btnTrain').classList.toggle('on', on);
  repaint();
}
async function switchBrain(mode) {
  if (mode === S.mode) return;
  S.mode = mode;
  $('#modeReal').classList.toggle('on', mode === 'real');
  $('#modeShuf').classList.toggle('on', mode === 'shuf');
  $('#loadLabel').textContent = t('boot.connections');
  $('#boot').classList.remove('done'); $('#boot').style.display = 'grid';
  await loadBrain(() => {});
  S.pol = new Policy(S.brain.featIdx.length);
  S.senses = new Senses(S.brain, S.maze);
  buildFeatStrip();
  resetEpisode();
  $('#boot').classList.add('done');
  setTimeout(() => { $('#boot').style.display = 'none'; }, 700);
  repaint();
}

function paint() {
  const s = S.sense;
  if (s) {
    $('#barL').style.width = `${Math.round(Math.min(1, s.left) * 100)}%`;
    $('#barR').style.width = `${Math.round(Math.min(1, s.right) * 100)}%`;
    $('#hzL').textContent = s.hzLeft.toFixed(0);
    $('#hzR').textContent = s.hzRight.toFixed(0);
  }
  const l = S.brain.channel('turn', 'left'), r = S.brain.channel('turn', 'right');
  const cap = Math.max(20, l, r);
  $('#dnL').style.width = `${Math.round(l / cap * 100)}%`;
  $('#dnR').style.width = `${Math.round(r / cap * 100)}%`;
  $('#dnLv').textContent = l.toFixed(0);
  $('#dnRv').textContent = r.toFixed(0);
  if (S.feats && S.featEls) {
    for (let i = 0; i < S.featEls.length; i++) {
      const v = Math.min(1, S.feats[i]);
      S.featEls[i].style.background = v > 0.02
        ? `rgba(242,169,59,${(0.18 + v * 0.82).toFixed(2)})` : 'rgba(150,200,214,.12)';
    }
  }
  $('#mEpisode').textContent = S.pol.episodes;
  $('#mStep').textContent = S.ep.stepCount || 0;
  $('#mFound').textContent = S.ep.found;
  drawCurve();
}

function repaint() {
  $('#btnRun').textContent = t(S.running ? 'c.pause' : 'c.watch');
  applyDom(); paintInfo(); drawCurve();
  const c = S.curves[S.mode];
  $('#learnStat').textContent = c.length < 3 ? t('learn.none')
    : t('learn.rate', { p: Math.round(100 * c.slice(-20).reduce((a, e) => a + e.found, 0) / Math.min(20, c.length)) });
  if (S.training) $('#dockStat').textContent = t('stat.training', { n: S.pol.episodes });
}

function drawCurve() {
  const cv = $('#curve'); if (!cv) return;
  const dpr = Math.min(devicePixelRatio, 2);
  const w = cv.clientWidth, h = cv.clientHeight || 92;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(document.documentElement);
  g.strokeStyle = css.getPropertyValue('--line').trim() || 'rgba(150,200,214,.10)';
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const y = h * i / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const plot = (arr, colour) => {
    if (arr.length < 2) return;
    const win = 12;
    g.strokeStyle = colour; g.lineWidth = 1.6; g.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const a = Math.max(0, i - win + 1);
      let sum = 0;
      for (let k = a; k <= i; k++) sum += arr[k].found;
      const v = sum / (i - a + 1);
      const x = (i / Math.max(arr.length - 1, 1)) * w;
      const y = h - v * (h - 6) - 3;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  };
  plot(S.curves.shuf, css.getPropertyValue('--ink3').trim() || '#65808A');
  plot(S.curves.real, css.getPropertyValue('--amber').trim() || '#F2A93B');
}

/* ---------------- persistence ---------------- */
function save() {
  try {
    localStorage.setItem(SAVE, JSON.stringify({
      mode: S.mode, policy: S.pol.serialise(), curves: S.curves, found: S.ep.found,
    }));
  } catch (_) { /* private mode */ }
}
function restore() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE) || 'null');
    if (!raw) return;
    if (raw.curves) S.curves = { real: raw.curves.real || [], shuf: raw.curves.shuf || [] };
    S.ep.found = raw.found || 0;
    if (raw.policy) S.pol.restore(raw.policy);
  } catch (_) { /* corrupt or blocked */ }
}
addEventListener('beforeunload', save);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.vial = S;
boot();
