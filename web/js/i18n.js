/* Three locales for Vial. Flat keys; {x} placeholders filled by t(). */

const EN = {
  "app.sub": "A fruit fly finds food using her own connectome",
  "boot.detail": "Her brain is the real FlyWire wiring — 18,267 neurons on the path from odour to command. 1 MB, cached after the first visit.",
  "boot.annotations": "Reading cell types",
  "boot.connections": "Loading her connections",
  "boot.rebuild": "Wiring her up",
  "boot.renderer": "Building the arena",
  "boot.failed": "Could not start",
  "boot.failhint": "Needs WebGL2 and an http origin.",
  "m.episode": "episode",
  "m.step": "steps",
  "m.found": "found",
  "p.antennae": "Odour at her antennae",
  "p.steering": "Steering command",
  "p.learning": "Learning",
  "side.left": "Left",
  "side.right": "Right",
  "leg.real": "real connectome",
  "leg.shuf": "shuffled control",
  "c.train": "Train fast",
  "c.maze": "New maze",
  "c.brain": "Brain",
  "c.real": "real",
  "c.shuf": "shuffled",
  "c.watch": "Watch",
  "c.pause": "Pause",
  "stat.training": "training — {n} episodes",
  "stat.reached": "reached the food in {n} steps",
  "stat.lost": "ran out of time",
  "learn.none": "No episodes yet. Press Train fast.",
  "learn.rate": "{p}% of the last 20 episodes reached the food",
  "info.what.t": "What you are looking at",
  "info.what.b": "A fruit fly in a milled acrylic arena, hunting a drop of syrup by smell. Her brain is not scripted: 18,267 real neurons and 395,931 measured connections — the three-synapse path from her odour receptors to the neurons that command her body — are simulating in a worker. The haze is the odour spreading from the food. What learns is a small readout on top of her brain, not the brain itself; a connectome records wiring, not plasticity.",
  "info.antennae.t": "Two antennae, two readings",
  "info.antennae.b": "Her antennae sit apart on her head, so each samples the plume at a different point. Each side's odour receptors are driven at a firing rate set by the concentration there. That left-right difference is how a real fly climbs a gradient, and it is the only thing her brain is told about the world here.",
  "info.steering.t": "DNa02, the steering neurons",
  "info.steering.b": "DNa02 is a real, well-studied pair of descending neurons — one per side — whose imbalance sets which way a fly turns. Both survived into this subcircuit. The bar shows their live firing rates. The strip under it is the rest of the descending readout the policy reads, 34 cell types in all.",
  "info.learning.t": "Does the real wiring help?",
  "info.learning.b": "The policy is trained by REINFORCE on the descending readout. The interesting question is whether the connectome earns its place: switch the brain to shuffled and the same number of neurons and connections are rewired at random, keeping every in- and out-degree identical. If the amber curve beats the grey one, the real wiring is doing work. If they overlap, it is not — and that is worth knowing too.",
};

const PT = {
  "app.sub": "Uma mosca acha comida usando o próprio connectome",
  "boot.detail": "O cérebro dela é a fiação real do FlyWire — 18.267 neurônios no caminho do odor até o comando. 1 MB, em cache depois da primeira visita.",
  "boot.annotations": "Lendo tipos celulares",
  "boot.connections": "Carregando as conexões dela",
  "boot.rebuild": "Ligando a fiação",
  "boot.renderer": "Montando a arena",
  "boot.failed": "Não foi possível iniciar",
  "boot.failhint": "Precisa de WebGL2 e origem http.",
  "m.episode": "episódio",
  "m.step": "passos",
  "m.found": "achou",
  "p.antennae": "Odor nas antenas dela",
  "p.steering": "Comando de curva",
  "p.learning": "Aprendizado",
  "side.left": "Esquerda",
  "side.right": "Direita",
  "leg.real": "connectome real",
  "leg.shuf": "controle embaralhado",
  "c.train": "Treinar rápido",
  "c.maze": "Novo labirinto",
  "c.brain": "Cérebro",
  "c.real": "real",
  "c.shuf": "embaralhado",
  "c.watch": "Assistir",
  "c.pause": "Pausar",
  "stat.training": "treinando — {n} episódios",
  "stat.reached": "chegou na comida em {n} passos",
  "stat.lost": "acabou o tempo",
  "learn.none": "Nenhum episódio ainda. Aperte Treinar rápido.",
  "learn.rate": "{p}% dos últimos 20 episódios chegaram na comida",
  "info.what.t": "O que você está vendo",
  "info.what.b": "Uma mosca numa arena de acrílico fresado, caçando uma gota de xarope pelo cheiro. O cérebro dela não é roteirizado: 18.267 neurônios reais e 395.931 conexões medidas — o caminho de três sinapses dos receptores de odor até os neurônios que comandam o corpo — estão simulando num worker. A névoa é o odor se espalhando da comida. O que aprende é uma leitura pequena por cima do cérebro, não o cérebro; um connectome registra fiação, não plasticidade.",
  "info.antennae.t": "Duas antenas, duas leituras",
  "info.antennae.b": "As antenas dela ficam separadas na cabeça, então cada uma amostra a pluma num ponto diferente. Os receptores de odor de cada lado são estimulados numa taxa de disparo definida pela concentração ali. Essa diferença esquerda-direita é como uma mosca real sobe um gradiente, e é a única coisa que o cérebro dela sabe sobre o mundo aqui.",
  "info.steering.t": "DNa02, os neurônios de curva",
  "info.steering.b": "DNa02 é um par real e bem estudado de neurônios descendentes — um de cada lado — cujo desequilíbrio define para que lado a mosca vira. Os dois sobreviveram neste subcircuito. A barra mostra a taxa de disparo ao vivo. A faixa abaixo é o resto da leitura descendente que a política lê, 34 tipos celulares no total.",
  "info.learning.t": "A fiação real ajuda?",
  "info.learning.b": "A política é treinada por REINFORCE sobre a leitura descendente. A pergunta interessante é se o connectome justifica o lugar dele: troque o cérebro para embaralhado e o mesmo número de neurônios e conexões é religado ao acaso, mantendo todos os graus de entrada e saída idênticos. Se a curva âmbar ganhar da cinza, a fiação real está fazendo trabalho. Se coincidirem, não está — e isso também vale saber.",
};

const ES = {
  "app.sub": "Una mosca encuentra comida usando su propio conectoma",
  "boot.detail": "Su cerebro es el cableado real de FlyWire — 18.267 neuronas en el camino del olor al comando. 1 MB, en caché tras la primera visita.",
  "boot.annotations": "Leyendo tipos celulares",
  "boot.connections": "Cargando sus conexiones",
  "boot.rebuild": "Conectando el cableado",
  "boot.renderer": "Montando la arena",
  "boot.failed": "No se pudo iniciar",
  "boot.failhint": "Necesita WebGL2 y origen http.",
  "m.episode": "episodio",
  "m.step": "pasos",
  "m.found": "encontró",
  "p.antennae": "Olor en sus antenas",
  "p.steering": "Comando de giro",
  "p.learning": "Aprendizaje",
  "side.left": "Izquierda",
  "side.right": "Derecha",
  "leg.real": "conectoma real",
  "leg.shuf": "control barajado",
  "c.train": "Entrenar rápido",
  "c.maze": "Nuevo laberinto",
  "c.brain": "Cerebro",
  "c.real": "real",
  "c.shuf": "barajado",
  "c.watch": "Ver",
  "c.pause": "Pausar",
  "stat.training": "entrenando — {n} episodios",
  "stat.reached": "llegó a la comida en {n} pasos",
  "stat.lost": "se acabó el tiempo",
  "learn.none": "Aún no hay episodios. Pulsa Entrenar rápido.",
  "learn.rate": "{p}% de los últimos 20 episodios llegaron a la comida",
  "info.what.t": "Qué estás viendo",
  "info.what.b": "Una mosca en una arena de acrílico fresado, cazando una gota de jarabe por el olfato. Su cerebro no está guionizado: 18.267 neuronas reales y 395.931 conexiones medidas — el camino de tres sinapsis desde sus receptores de olor hasta las neuronas que mandan su cuerpo — están simulando en un worker. La neblina es el olor extendiéndose desde la comida. Lo que aprende es una lectura encima de su cerebro, no el cerebro; un conectoma registra cableado, no plasticidad.",
  "info.antennae.t": "Dos antenas, dos lecturas",
  "info.antennae.b": "Sus antenas están separadas en la cabeza, así que cada una muestrea la pluma en un punto distinto. Los receptores de olor de cada lado se estimulan a una tasa de disparo fijada por la concentración allí. Esa diferencia izquierda-derecha es cómo una mosca real sube un gradiente, y es lo único que su cerebro sabe del mundo aquí.",
  "info.steering.t": "DNa02, las neuronas de giro",
  "info.steering.b": "DNa02 es un par real y bien estudiado de neuronas descendentes — una por lado — cuyo desequilibrio define hacia dónde gira la mosca. Ambas sobrevivieron en este subcircuito. La barra muestra su tasa de disparo en vivo. La franja de abajo es el resto de la lectura descendente que lee la política, 34 tipos celulares en total.",
  "info.learning.t": "¿El cableado real ayuda?",
  "info.learning.b": "La política se entrena por REINFORCE sobre la lectura descendente. La pregunta interesante es si el conectoma se gana su lugar: cambia el cerebro a barajado y el mismo número de neuronas y conexiones se recablea al azar, manteniendo idénticos todos los grados de entrada y salida. Si la curva ámbar gana a la gris, el cableado real está haciendo trabajo. Si coinciden, no lo está — y eso también vale saberlo.",
};

EN['lang.name']='English'; PT['lang.name']='Português'; ES['lang.name']='Español';
export const LOCALES = { en: EN, pt: PT, es: ES };
let current = 'en';
export function detectLocale() {
  try { const s = localStorage.getItem('vial.lang'); if (s && LOCALES[s]) return s; } catch (_) {}
  const nav = (navigator.languages || [navigator.language || 'en']).map(s => s.slice(0,2).toLowerCase());
  return nav.find(l => LOCALES[l]) || 'en';
}
export function setLocale(c) {
  if (!LOCALES[c]) return;
  current = c;
  try { localStorage.setItem('vial.lang', c); } catch (_) {}
  document.documentElement.lang = c;
}
export const getLocale = () => current;
export function t(key, vars) {
  let s = LOCALES[current][key];
  if (s === undefined) s = LOCALES.en[key];
  if (s === undefined) return key;
  if (vars) for (const k in vars) s = s.split('{'+k+'}').join(vars[k]);
  return s;
}
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}
