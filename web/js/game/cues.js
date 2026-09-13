/* Everything you can do to her, and what it actually drives.

   Each entry names annotated cell populations from the FlyWire release. The
   reaction you see is those neurons firing and the descending readout responding
   — not a scripted animation. Cues used for training are deliberately different
   sensory modalities, because tools/22_cue_separability.py showed the descending
   readout can tell modalities apart (100% leave-one-out) while it cannot tell two
   odours apart at all. */

export const CARE = {
  feed:  { types: ['LB3'],                  need: 'hunger', amount: 0.85, icon: 'sugar' },
  water: { classes: ['hygrosensory'],       need: 'thirst', amount: 0.85, icon: 'water' },
  clean: { types: ['BM_InOm'],              need: 'dirt',   amount: 0.80, icon: 'brush' },
};

export const CUES = {
  buzz:  { types: ['JO-B*'] },      // Johnston's organ: she hears it
  odour: { types: ['ORN_DM1', 'ORN_DM2'] },
  touch: { types: ['BM_InOm'] },
};

export const THREAT = { types: ['LPLC2'] };   // looming -> DNp01 giant fibre -> escape

/* resolve every population once the brain's annotations are loaded */
export function resolve(brain) {
  const out = { care: {}, cues: {}, threat: brain.byType(THREAT.types) };
  for (const [k, v] of Object.entries(CARE)) {
    out.care[k] = v.types ? brain.byType(v.types) : brain.byClass(v.classes);
  }
  for (const [k, v] of Object.entries(CUES)) out.cues[k] = brain.byType(v.types);
  return out;
}

/* Reflexes: what she does when nobody has taught her anything.
   Thresholds are in Hz over the named descending channels. */
export function instinct(brain) {
  const escape = brain.channel('escape');
  const pro = brain.channel('proboscis');
  const stop = brain.channel('stop');
  const walk = brain.channel('walk');
  const tl = brain.channel('turn', 'left'), tr = brain.channel('turn', 'right');
  const sat = (x, k) => 1 - Math.exp(-Math.max(0, x) / k);
  return {
    escape: sat(escape, 2), proboscis: sat(pro, 3), stop: sat(stop, 4),
    walk: sat(walk, 6), turn: Math.max(-1, Math.min(1, (tr - tl) / 6)),
    wing: Math.max(sat(brain.channel('wing'), 5), sat(escape, 2)),
    backward: sat(brain.channel('backward'), 4), groom: 0,
  };
}

/* Turn a policy action into the same drive object the body understands. */
export function actionDrive(action, conf) {
  const d = { walk: 0, turn: 0, stop: 0, backward: 0, escape: 0, proboscis: 0, wing: 0, groom: 0 };
  const w = 0.35 + 0.65 * conf;
  if (action === 'proboscis') d.proboscis = w;
  else if (action === 'walk') d.walk = w;
  else if (action === 'turn') { d.walk = w * 0.5; d.turn = w; }
  else if (action === 'jump') { d.escape = w; d.wing = w; }
  else if (action === 'freeze') d.stop = w;
  return d;
}
