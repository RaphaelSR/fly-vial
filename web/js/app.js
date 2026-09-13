import { FlyView } from './engine/fly.js';
import { Brain } from './game/brain.js';
import * as Needs from './game/needs.js';
import { Policy, ACTIONS } from './game/learn.js';
import { resolve, instinct, actionDrive } from './game/cues.js';
import { LOCALES, detectLocale, setLocale, getLocale, t, applyDom } from './i18n.js';

const $ = s => document.querySelector(s);
const CUE_KEYS = ['buzz', 'odour', 'touch'];

const S = {
  pet: null, brain: null, fly: null, pol: null, pop: null,
  cue: 'buzz', want: 'proboscis',
  trial: null,          // {phase, x, action, t0}
  drive: null, lastTick: 0, lastSave: 0, stimUntil: 0,
};

/* ---------------- boot ---------------- */
async function boot() {
  setLocale(detectLocale());
  buildLang(); applyDom();
  S.pet = Needs.catchUp(Needs.load());
  const step = (k, f) => {
    $('#loadLabel').textContent = t('boot.' + k);
    $('#loadBar').style.width = `${Math.round(f * 100)}%`;
  };
  try {
    step('loading', 0.04);
    S.brain = new Brain();
    S.brain.onReady = start;
    await S.brain.load(step);
  } catch (err) {
    $('#loadLabel').textContent = t('boot.failed');
    $('#loadDetail').innerHTML = `<strong>${esc(err.message)}</strong><br>${t('boot.failhint')}`;
    $('#loadDetail').classList.add('err');
    console.error(err);
  }
}

function start() {
  S.pop = resolve(S.brain);
  S.pol = new Policy(S.brain.featIdx.length, S.pet.policy);
  try { S.fly = new FlyView($('#vial')); } catch (e) { console.warn(e); }
  buildUI();
  $('#boot').classList.add('done');
  setTimeout(() => $('#boot').remove(), 600);
  S.lastTick = performance.now();
  schedule();
}

/* ---------------- ui ---------------- */
function buildLang() {
  const sel = $('#lang');
  sel.innerHTML = Object.keys(LOCALES).map(c => `<option value="${c}">${LOCALES[c]['lang.name']}</option>`).join('');
  sel.value = getLocale();
  sel.addEventListener('change', () => { setLocale(sel.value); applyDom(); repaint(); });
}

function buildUI() {
  for (const k of ['feed', 'water', 'clean']) {
    $(`#care-${k}`).addEventListener('click', () => care(k));
  }
  $('#care-light').addEventListener('click', () => {
    S.pet.lightOn = S.pet.lightOn === false;
    repaint(); save();
  });
  $('#cues').innerHTML = CUE_KEYS.map(c =>
    `<button class="chip cue${c === S.cue ? ' on' : ''}" data-cue="${c}"></button>`).join('');
  $('#wants').innerHTML = ACTIONS.map(a =>
    `<button class="chip want${a === S.want ? ' on' : ''}" data-want="${a}"></button>`).join('');
  $('#cues').addEventListener('click', e => {
    const b = e.target.closest('[data-cue]'); if (!b) return;
    S.cue = b.dataset.cue; repaint();
  });
  $('#wants').addEventListener('click', e => {
    const b = e.target.closest('[data-want]'); if (!b) return;
    S.want = b.dataset.want; repaint();
  });
  $('#btnPresent').addEventListener('click', present);
  $('#btnReward').addEventListener('click', () => finish(1));
  $('#btnSkip').addEventListener('click', () => finish(0));
  $('#btnForget').addEventListener('click', () => {
    S.pol.forget(); S.pet.trials = 0; S.pet.rewards = 0; save(); repaint();
  });
  $('#btnNew').addEventListener('click', () => {
    S.pet = Needs.BLANK(); S.pol.forget(); save(); repaint();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('.info');
    const pop = $('#infoPop');
    if (!b) { if (!e.target.closest('#infoPop')) pop.classList.remove('open'); return; }
    if (pop.classList.contains('open') && pop.dataset.key === b.dataset.info) { pop.classList.remove('open'); return; }
    pop.dataset.key = b.dataset.info;
    pop.querySelector('h4').textContent = t(`info.${b.dataset.info}.t`);
    pop.querySelector('p').textContent = t(`info.${b.dataset.info}.b`);
    pop.classList.add('open');
    const r = b.getBoundingClientRect();
    pop.style.visibility = 'hidden'; pop.style.left = '0px'; pop.style.top = '0px';
    const pr = pop.getBoundingClientRect();
    pop.style.left = `${Math.round(Math.min(Math.max(8, r.left + r.width / 2 - pr.width / 2), innerWidth - pr.width - 8))}px`;
    pop.style.top = `${Math.round(r.bottom + 8 + pr.height > innerHeight - 8 ? Math.max(8, r.top - pr.height - 8) : r.bottom + 8)}px`;
    pop.style.visibility = '';
  });
  repaint();
}

/* ---------------- care ---------------- */
function care(kind) {
  if (S.pet.dead) return;
  const map = { feed: 'hunger', water: 'thirst', clean: 'dirt' };
  const amt = { feed: 0.85, water: 0.85, clean: 0.8 }[kind];
  S.pet[map[kind]] = Needs.clamp01(S.pet[map[kind]] - amt);
  S.pet[kind === 'feed' ? 'fed' : kind === 'water' ? 'watered' : 'cleaned']++;
  stim(S.pop.care[kind], 2200);
  save(); repaint();
}

function stim(idx, ms) {
  S.brain.stimulate(idx);
  S.stimUntil = performance.now() + ms;
}

/* ---------------- training ---------------- */
function present() {
  if (S.pet.dead || S.trial) return;
  // snapshot what her brain was already doing, so the cue is read as a change
  const base = S.brain.features();
  stim(S.pop.cues[S.cue], 3000);
  S.trial = { phase: 'sensing', t0: performance.now(), base };
  repaint();
}

function finish(reward) {
  if (!S.trial || S.trial.phase !== 'judge') return;
  const correct = ACTIONS[S.trial.action] === S.want;
  S.pol.reinforce(S.trial.x, S.trial.action, reward);
  S.pet.trials++; if (reward) S.pet.rewards++;
  if (reward) { S.pet.hunger = Needs.clamp01(S.pet.hunger - 0.10); stim(S.pop.care.feed, 1400); }
  else { S.brain.stimulate([]); S.stimUntil = 0; }
  S.trial = null;
  save(); repaint();
}

/* ---------------- loop ---------------- */
function loop(now) {
  const dt = Math.min((now - S.lastTick) / 1000, 0.1);
  S.lastTick = now;

  S.brain.tick(now);
  if (S.stimUntil && now > S.stimUntil) { S.brain.stimulate([]); S.stimUntil = 0; }
  if (!S.pet.dead) Needs.advance(S.pet, dt * 1000);

  // trial state machine: let the cue reach the descending neurons, then act
  if (S.trial) {
    const age = now - S.trial.t0;
    if (S.trial.phase === 'sensing' && age > 1100) {
      S.trial.x = S.brain.evoked(S.trial.base);
      const { action } = S.pol.act(S.trial.x);
      S.trial.action = action;
      S.trial.phase = 'acting';
      S.trial.actUntil = now + 1700;
      repaint();
    } else if (S.trial.phase === 'acting' && now > S.trial.actUntil) {
      S.trial.phase = 'judge';
      repaint();
    }
  }

  // what the body does: a taught action if one is playing, otherwise reflex
  let d;
  if (S.trial && (S.trial.phase === 'acting' || S.trial.phase === 'judge')) {
    d = actionDrive(ACTIONS[S.trial.action], S.pol.confidence(S.trial.x, S.trial.action));
  } else {
    d = instinct(S.brain);
    if (S.pet.dirt > 0.6) d.groom = Math.min(1, (S.pet.dirt - 0.6) * 2.2);
    if (S.pet.energy < 0.25 || S.pet.lightOn === false) { d.stop = 1; d.walk = 0; }
    else if (d.walk < 0.05 && !S.pet.dead) {
      // idle wandering so she is alive between interactions
      d.walk = 0.20 + 0.14 * Math.sin(now / 2600);
      d.turn = 0.5 * Math.sin(now / 3700);
    }
    if (S.pet.dead) d = { walk: 0, turn: 0, stop: 1, backward: 0, escape: 0, proboscis: 0, wing: 0, groom: 0 };
  }
  S.drive = d;
  if (S.fly) { S.fly.update(d, dt); S.fly.draw(); }

  if (now - S.lastSave > 8000) { save(); S.lastSave = now; }
  if (now - (S._paint || 0) > 400) { paintLive(); S._paint = now; }
  schedule();
}

/* rAF while visible, a timer while hidden. A pet whose clock stops the moment you
   switch tabs is not a pet, and the trial state machine would stall mid-trial. */
function schedule() {
  if (document.hidden) setTimeout(() => loop(performance.now()), 150);
  else requestAnimationFrame(loop);
}

/* ---------------- painting ---------------- */
function bar(id, v) {
  const el = $(id); if (!el) return;
  el.style.width = `${Math.round(Needs.clamp01(v) * 100)}%`;
  el.className = v > 0.8 ? 'critical' : v > 0.55 ? 'warn' : '';
}

function paintLive() {
  const p = S.pet;
  bar('#bar-hunger', p.hunger); bar('#bar-thirst', p.thirst);
  bar('#bar-dirt', p.dirt); bar('#bar-energy', 1 - p.energy);
  $('#day').textContent = t('state.day', { d: Math.floor(Needs.ageDays(p)) + 1, n: Needs.LIFESPAN_DAYS });
  $('#firing').textContent = t('brain.firing', { n: (S.brain.nActive || 0).toLocaleString(getLocale()) });

  let line;
  if (p.dead) line = t(p.cause === 'age' ? 'state.dead.age' : 'state.dead.neglect', { d: Math.floor(Needs.ageDays(p)) });
  else if ((p.harm || 0) > 0.25) line = t('state.weak');
  else if (p.lightOn === false || p.energy < 0.2) line = t('state.asleep');
  else {
    const w = Needs.worst(p);
    line = w ? t('state.' + w) : t('state.fine');
  }
  $('#status').textContent = line;
  $('#status').classList.toggle('bad', !!p.dead || (p.harm || 0) > 0.25);
  $('#dead').classList.toggle('on', !!p.dead);
}

function repaint() {
  const p = S.pet;
  document.querySelectorAll('[data-cue]').forEach(b => {
    b.textContent = t('cue.' + b.dataset.cue);
    b.classList.toggle('on', b.dataset.cue === S.cue);
  });
  document.querySelectorAll('[data-want]').forEach(b => {
    b.textContent = t('act.short.' + b.dataset.want);
    b.classList.toggle('on', b.dataset.want === S.want);
  });
  $('#care-light').textContent = t(p.lightOn === false ? 'care.light' : 'care.dark');

  const phase = S.trial ? S.trial.phase : 'idle';
  $('#btnPresent').disabled = phase !== 'idle' || !!p.dead;
  $('#judge').classList.toggle('on', phase === 'judge');
  $('#trialMsg').textContent =
    phase === 'sensing' || phase === 'acting' ? t('train.waiting')
    : phase === 'judge' ? t('train.did', { a: t('act.' + ACTIONS[S.trial.action]) })
    : '';
  $('#trials').textContent = t('train.trials', { n: S.pol.trials });

  // how likely is she to give you the behaviour you are after, for this cue?
  if (S.pol.trials > 0 && S.trial && S.trial.x) {
    $('#conf').textContent = t('train.conf', { p: Math.round(S.pol.confidence(S.trial.x, ACTIONS.indexOf(S.want)) * 100) });
  } else $('#conf').textContent = '';
  paintLive();
}

function save() {
  S.pet.policy = S.pol ? S.pol.serialise() : null;
  Needs.save(S.pet);
}
addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.vial = S;
boot();
