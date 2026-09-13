/* The pet's state, and the part of it that keeps moving while the tab is shut.

   Rates are game rates, but the lifespan is the real one: a Drosophila
   melanogaster kept at 25 C lives around 50 days, and so does this one. */

const KEY = 'vial.state.v1';
const HOUR = 3600e3;
export const LIFESPAN_DAYS = 50;

const RATE = {      // per hour, 0..1 scale
  hunger: 0.135,    // ~7 h from fed to desperate
  thirst: 0.200,    // flies dehydrate fast for their size
  dirt:   0.090,
};

export const BLANK = () => ({
  name: '',
  born: Date.now(),
  lastSeen: Date.now(),
  hunger: 0.15, thirst: 0.15, dirt: 0.05, energy: 0.9,
  stress: 0,
  fed: 0, watered: 0, cleaned: 0, trials: 0, rewards: 0,
  policy: null,
  dead: null,          // timestamp, once she goes
  cause: null,
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.born === 'number') return s;
    }
  } catch (_) { /* private mode, or corrupt */ }
  return BLANK();
}

export function save(s) {
  s.lastSeen = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* private mode */ }
}

export const ageDays = s => (( (s.dead || Date.now()) - s.born) / 86400e3);
export const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* Advance the pet by `ms`. Used both for the live tick and for catching up on
   the time that passed while the page was closed. */
export function advance(s, ms) {
  if (s.dead) return s;
  const h = ms / HOUR;
  s.hunger = clamp01(s.hunger + RATE.hunger * h);
  s.thirst = clamp01(s.thirst + RATE.thirst * h);
  s.dirt   = clamp01(s.dirt   + RATE.dirt   * h);
  s.stress = clamp01(s.stress - 0.35 * h);

  // sleep follows the light you leave her in, not the wall clock
  s.energy = clamp01(s.energy + (s.lightOn === false ? 0.28 : -0.075) * h);

  // neglect is survivable for a while, then it is not
  const starving = Math.max(0, s.hunger - 0.88) + Math.max(0, s.thirst - 0.88);
  if (starving > 0) s.harm = clamp01((s.harm || 0) + starving * 0.55 * h);
  else s.harm = clamp01((s.harm || 0) - 0.18 * h);

  if (ageDays(s) >= LIFESPAN_DAYS) { s.dead = Date.now(); s.cause = 'age'; }
  else if ((s.harm || 0) >= 1) { s.dead = Date.now(); s.cause = 'neglect'; }
  return s;
}

export function catchUp(s) {
  const gap = Math.max(0, Date.now() - (s.lastSeen || Date.now()));
  // cap the catch-up so a month away does not instantly kill her on open
  return advance(s, Math.min(gap, 3 * 86400e3));
}

/* Worst unmet need, for the status line */
export function worst(s) {
  const c = [['hunger', s.hunger], ['thirst', s.thirst], ['dirt', s.dirt], ['energy', 1 - s.energy]];
  c.sort((a, b) => b[1] - a[1]);
  return c[0][1] > 0.55 ? c[0][0] : null;
}
export const wellbeing = s =>
  clamp01(1 - (s.hunger * 0.32 + s.thirst * 0.32 + s.dirt * 0.18 + (1 - s.energy) * 0.18) - (s.harm || 0) * 0.4);
