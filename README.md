# Vial

Keep a fruit fly alive for fifty days and teach her tricks. Her reactions are not
animations — they are the real *Drosophila melanogaster* connectome running in
your browser.

**[Open the vial →](https://raphaelsr.github.io/fly-vial/)**

Built on the engine from [fly-brain-bench](https://github.com/RaphaelSR/fly-brain-bench).

---

## What makes it different from a Tamagotchi

Every act of care drives a real, annotated population of neurons, and what happens
next is the wiring answering:

| you do | it drives | she answers |
|---|---|---|
| sugar | `LB3` labellar taste bristles | proboscis motor neurons fire at ~12 Hz and the proboscis comes out |
| brush | `BM_InOm` eye bristle mechanosensors | grooming |
| a shadow | `LPLC2` looming detectors | `DNp01`, the giant fibre, and she jumps |
| a buzz | `JO-B` Johnston's organ | she hears it |
| an odour | `ORN_DM1/DM2` | she smells it |

No lookup tables, no scripted reactions. 138,639 neurons and 2,700,513 measured
connections are simulating in a worker while you play.

**Her lifespan is the real one.** A *Drosophila* kept at 25 °C lives about fifty
days, and so does she — in real time, whether the tab is open or not. Neglect can
end it sooner.

---

## Teaching her

Operant conditioning, the way you would train a real fly: give a signal, watch what
she does, reward only what you wanted.

- Her **brain** does the sensing. Each signal drives a different sense and leaves a
  different pattern in the descending neurons that command her body.
- A **policy** on top picks an action from that pattern and is nudged by your
  reward — a linear softmax over 58 descending cell types, trained with REINFORCE.

This is reinforcement learning, not synapses changing, and the interface says so. A
connectome records wiring, not plasticity. Real flies genuinely can be operantly
conditioned, so the behaviour is honest even though the mechanism is ours.

### Measured

Contrastive training, buzz → proboscis and puff → jump, alternating:

| | after 28 trials |
|---|---|
| buzz | **proboscis, 87%** |
| puff | **jump, 87%** |
| odour *(never taught)* | proboscis, 65% |

Chance is 20%. A real fly needs roughly twenty trials, which is the same order.
Generalising to the untrained odour is expected: its evoked pattern sits closer to
the buzz than to the puff (cosine 0.44 versus 0.01).

### The bug that made it work

The first version learned a bias, not a trick: after training one signal she gave
the same answer to all three. Her brain never falls silent — activity from earlier
interactions keeps a large background going, so a cue is only a small increment on
top of it. Measured live, two different cues sat at **cosine 0.85**.

Reading the **evoked response** instead — subtracting the pattern from just before
the cue, the way physiology reports evoked activity rather than raw rates — dropped
that to **0.007**, and cue-conditional learning appeared immediately.

---

## Status: parked

This is finished as far as it goes and it works, but I stopped developing it.

I then tried rebuilding it as a maze-foraging simulation — the fly hunting a drop
of syrup by smell, with reinforcement learning on her descending readout. That
attempt lives on the [`maze-experiment`](../../tree/maze-experiment) branch and is
**not finished**. It renders, she walks with a real tripod gait, and the sniffing
mechanism below does work, but the learning never convincingly beat chance and I
did not take it further.

What that attempt found, which is the part worth keeping:

- **Sustained stimulation destroys the signal.** Drive the odour receptors
  continuously and within ~80 ms the network saturates — 18,110 of 18,267 neurons
  active — and the descending readout stops reflecting the input. Two opposite
  odour patterns measured at **cosine 0.9995**, and the readout was flat from 1 Hz
  to 60 Hz. One bit of information, which is not enough to navigate anything.
- **Brief pulses keep it.** A 20 ms pulse read 40 ms after onset, against the
  pattern from just before it, measures **cosine 0.29**. So the side information is
  there; sustained drive is what erases it.
- The olfactory→descending subcircuit is 18,267 neurons and 395,931 edges, 0.99 MB
  packed — about an eighth of the full brain, built by `tools/` in fly-brain-lab.

The measurement scripts are on that branch. If anyone picks this up, start there
rather than repeating it.

## Honest limits

- The brain has **no plasticity**. Nothing you do changes a synapse. Only the
  policy layer learns.
- The body is an **engineered interface**. Which descending neurons exist and what
  each does is published biology; the mapping from firing rate to a leg angle is
  ours. Every embodied fly simulation makes some version of this choice.
- **Light is not a usable signal** and is deliberately absent. Driving all 2,650
  R7/R8 photoreceptors for 3 s leaves 106 of 77,530 optic neurons firing and
  nothing at all downstream: real photoreceptors are histaminergic and
  sign-inverting, which the model's transmitter set cannot express. Looming works
  because `LPLC2` is driven directly, past the break. See
  `tools/23_light_latency.py`.
- Connections below 5 synapses are dropped to keep the download at 7.7 MB. Against
  the full model this keeps 92.5% of responding neurons and a firing-rate
  correlation of 0.988.

---

## Running it

```bash
git clone https://github.com/RaphaelSR/fly-vial.git
cd fly-vial/web
python3 -m http.server 8000
```

Needs WebGL2 and http — ES modules and workers do not load from `file://`.

```
web/
  js/engine/     connectome simulation and the 3D fly (shared with fly-brain-bench)
  js/game/       brain.js (evoked response), needs.js (state + real-time ageing),
                 learn.js (REINFORCE policy), cues.js (what each action drives)
  data/          7.7 MB packed connectome
tools/           the separability and pathway checks quoted above
```

State lives in `localStorage` and ages while the tab is closed. Structured so a
native wrapper can reuse `js/` as-is.

## Credits

Connectome: Dorkenwald et al., FlyWire v783 (CC-BY). Annotations: Schlegel et al.
Model constants: Shiu et al. Independent project, not affiliated with those groups.

## Licence

Code MIT. The connectome data under `web/data/` stays CC-BY 4.0.
