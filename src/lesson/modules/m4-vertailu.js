// Module 4: comparative and superlative (isompi, isoin).
//
// Every task shows things that share one word (boxes, books, coats, flowers,
// children) and differ in one property. Only the adjective form in the
// tutor's sentence decides which one is meant.

const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap = s => s[0].toUpperCase() + s.slice(1);

// Adjective forms. c comparative, s superlative, cg/sg genitive,
// ci/si illative ("into"), ca/sa allative ("to").
export const A = {
  iso:         { base: 'iso', c: 'isompi', s: 'isoin', cg: 'isomman', sg: 'isoimman', ci: 'isompaan', si: 'isoimpaan', ca: 'isommalle', sa: 'isoimmalle' },
  pieni:       { base: 'pieni', c: 'pienempi', s: 'pienin', cg: 'pienemmän', sg: 'pienimmän', ci: 'pienempään', si: 'pienimpään', ca: 'pienemmälle', sa: 'pienimmälle' },
  vanha:       { base: 'vanha', c: 'vanhempi', s: 'vanhin', cg: 'vanhemman', sg: 'vanhimman', ca: 'vanhemmalle', sa: 'vanhimmalle' },
  nuori:       { base: 'nuori', c: 'nuorempi', s: 'nuorin', cg: 'nuoremman', sg: 'nuorimman', ca: 'nuoremmalle', sa: 'nuorimmalle' },
  pitka:       { base: 'pitkä', c: 'pidempi', s: 'pisin', cg: 'pidemmän', sg: 'pisimmän', ca: 'pidemmälle', sa: 'pisimmälle' },
  lyhyt:       { base: 'lyhyt', c: 'lyhyempi', s: 'lyhin', cg: 'lyhyemmän', sg: 'lyhimmän', ca: 'lyhyemmälle', sa: 'lyhimmälle' },
  halpa:       { base: 'halpa', c: 'halvempi', s: 'halvin', cg: 'halvemman', sg: 'halvimman' },
  kallis:      { base: 'kallis', c: 'kalliimpi', s: 'kallein', cg: 'kalliimman', sg: 'kalleimman' },
  kaunis:      { base: 'kaunis', c: 'kauniimpi', s: 'kaunein', cg: 'kauniimman', sg: 'kauneimman' },
  ruma:        { base: 'ruma', c: 'rumempi', s: 'rumin', cg: 'rumemman', sg: 'rumimman' },
  kiinnostava: { base: 'kiinnostava', c: 'kiinnostavampi', s: 'kiinnostavin', cg: 'kiinnostavamman', sg: 'kiinnostavimman' },
  tylsa:       { base: 'tylsä', c: 'tylsempi', s: 'tylsin', cg: 'tylsemmän', sg: 'tylsimmän' },
  hyva:        { base: 'hyvä', c: 'parempi', s: 'paras', cg: 'paremman', sg: 'parhaan' },
  huono:       { base: 'huono', c: 'huonompi', s: 'huonoin', cg: 'huonomman', sg: 'huonoimman' },
};

const N = {
  laatikko: { n: 'laatikko', g: 'laatikon' },
  kirja: { n: 'kirja', g: 'kirjan' },
  takki: { n: 'takki', g: 'takin' },
  kukka: { n: 'kukka', g: 'kukan' },
  lapsi: { n: 'lapsi', g: 'lapsen', a: 'lapselle' },
  poika: { n: 'poika', g: 'pojan', a: 'pojalle' },
};

export const FORMS = {
  'm4.comp':     { label: 'Comparative', example: 'isompi laatikko, halvempi kirja' },
  'm4.sup':      { label: 'Superlative', example: 'isoin laatikko, kallein takki' },
  'm4.comp-gen': { label: 'Comparative + päälle', example: 'isomman päälle' },
  'm4.sup-gen':  { label: 'Superlative + päälle', example: 'isoimman päälle' },
  'm4.comp-ill': { label: 'Comparative, "into"', example: 'pienempään laatikkoon' },
  'm4.sup-ill':  { label: 'Superlative, "into"', example: 'isoimpaan laatikkoon' },
  'm4.comp-all': { label: 'Comparative, "to"', example: 'vanhemmalle pojalle, pidemmälle' },
  'm4.sup-all':  { label: 'Superlative, "to"', example: 'nuorimmalle lapselle' },
  'm4.stem':     { label: 'Stem changes', example: 'pidempi, pisin, kalliimpi, kallein' },
  'm4.hyva':     { label: 'hyvä, parempi, paras', example: 'parempi kirja, paras kirja' },
};

// From the diagnostic: the comparative's meaning is recognized, its forms not yet controlled.
export const INITIAL = {
  'm4.comp': 'recognized', 'm4.comp-gen': 'recognized', 'm4.comp-ill': 'recognized', 'm4.comp-all': 'recognized',
};

function formsFor(adj, degree, extra = []) {
  const f = [degree === 'c' ? 'm4.comp' : 'm4.sup', ...extra];
  if (adj === 'pitka' || adj === 'lyhyt' || adj === 'kallis') f.push('m4.stem');
  if (adj === 'hyva') f.push('m4.hyva');
  return f;
}

// --- layouts: things ranked by one property ----------------------------------
// setup(ctx, n) returns { ids: [lowest ... highest], up, down, noun, home }.

const SIZES = [{ w: 96, h: 70 }, { w: 136, h: 100 }, { w: 184, h: 136 }];
const SHIRTS = ['#3e63dd', '#e5484d', '#46a758', '#f5a524', '#8e4ec6', '#12a594'];
const HAIR = ['#5a3a1e', '#2b2b2b', '#d9a441', '#a0522d'];

function choose(n, from) {
  const idx = shuffle(from.map((_, i) => i)).slice(0, n).sort((a, b) => a - b);
  return idx.map(i => from[i]);
}

function finish(ctx, ids, rest) {
  const home = {};
  for (const id of ids) home[id] = { x: ctx.goat.props[id].x, y: ctx.goat.props[id].y };
  return { ids, home, n: ids.length, ...rest };
}

const LAYOUTS = {
  boxes: {
    bg: 'table', up: 'iso', down: 'pieni', noun: N.laatikko, mid: { n: 'keskikokoinen', g: 'keskikokoisen' },
    setup(ctx, n, opts = {}) {
      const xs = ctx.slots(n, { left: 680, right: 1060, ...opts.slots });
      const ids = choose(n, SIZES).map((size, i) => ctx.addBox(size, { x: xs[i], draggable: opts.draggable }));
      return finish(ctx, ids, this);
    },
  },
  booksPrice: {
    bg: 'shop', up: 'kallis', down: 'halpa', noun: N.kirja,
    setup(ctx, n) {
      const xs = ctx.slots(n);
      const prices = choose(n, [4, 6, 9, 12, 16, 22, 28]);
      const ids = prices.map((price, i) => ctx.addIcon('kirja', { x: xs[i] }, { price }));
      return finish(ctx, ids, { ...this, prices });
    },
  },
  coats: {
    bg: 'shop', up: 'kallis', down: 'halpa', noun: N.takki,
    setup(ctx, n) {
      const xs = ctx.slots(n);
      const prices = choose(n, [29, 45, 60, 89, 120, 150]);
      const ids = prices.map((price, i) => ctx.addIcon('takki', { x: xs[i] }, { price }));
      return finish(ctx, ids, { ...this, prices });
    },
  },
  booksStars: {
    bg: 'shop', up: 'hyva', down: 'huono', noun: N.kirja,
    setup(ctx, n) {
      const xs = ctx.slots(n);
      const ids = choose(n, [1, 2, 3]).map((s, i) => ctx.addIcon('kirja', { x: xs[i], bottom: ctx.floor }, { stars: s }));
      return finish(ctx, ids, this);
    },
  },
  flowers: {
    bg: 'shop', up: 'kaunis', down: 'ruma', noun: N.kukka,
    setup(ctx, n) {
      const xs = ctx.slots(n);
      const ids = choose(n, [1, 0.5, 0]).map((wilt, i) => ctx.addIcon('kukka', { x: xs[i] }, { wilt }));
      return finish(ctx, ids, this);
    },
  },
  booksInterest: {
    bg: 'shop', up: 'kiinnostava', down: 'tylsa', noun: N.kirja,
    setup(ctx, n) {
      const xs = ctx.slots(n);
      const ids = choose(n, [0, 1, 2]).map((reader, i) => ctx.addIcon('kirja', { x: xs[i] }, { reader }));
      return finish(ctx, ids, this);
    },
  },
  children: {
    bg: 'room', up: 'vanha', down: 'nuori', noun: N.lapsi, people: true,
    setup(ctx, n = 3, opts = {}) {
      const xs = ctx.slots(3, { left: 700, right: 1110, ...opts.slots });
      const kinds = shuffle(['poika', 'tytto', pick(['poika', 'tytto'])]);
      const shirts = shuffle(SHIRTS);
      const ids = [125, 170, 215].map((height, i) => ctx.addPerson(
        { kind: kinds[i], height, shirt: shirts[i], hair: pick(HAIR) }, { x: xs[i], bottom: ctx.floor }));
      return finish(ctx, ids, this);
    },
  },
  boys: {
    bg: 'room', up: 'vanha', down: 'nuori', noun: N.poika, people: true,
    setup(ctx, n = 2, opts = {}) {
      const xs = ctx.slots(2, { left: 760, right: 1060, ...opts.slots });
      const shirts = shuffle(SHIRTS);
      const ids = [160, 220].map((height, i) => ctx.addPerson(
        { kind: 'poika', height, shirt: shirts[i], hair: pick(HAIR) }, { x: xs[i], bottom: ctx.floor }));
      return finish(ctx, ids, this);
    },
  },
  adults: {
    bg: 'room', up: 'pitka', down: 'lyhyt', people: true,
    setup(ctx, n = 2, opts = {}) {
      const xs = ctx.slots(2, { left: 760, right: 1060, ...opts.slots });
      const dadTaller = Math.random() < 0.6;
      const shirts = shuffle(SHIRTS);
      const isa = ctx.addPerson({ kind: 'isa', height: dadTaller ? 330 : 280, shirt: shirts[0], hair: pick(HAIR) }, { x: xs[0], bottom: ctx.floor });
      const aiti = ctx.addPerson({ kind: 'aiti', height: dadTaller ? 285 : 325, shirt: shirts[1], hair: pick(HAIR) }, { x: xs[1], bottom: ctx.floor });
      const ids = dadTaller ? [aiti, isa] : [isa, aiti];
      return finish(ctx, ids, { ...this, names: { [isa]: 'isä', [aiti]: 'äiti' } });
    },
  },
};

// Where an item stands in its layout: 'up' (highest), 'down' (lowest) or 'mid'.
const rel = (L, id) => {
  const i = L.ids.indexOf(id);
  return i === L.n - 1 ? 'up' : i === 0 ? 'down' : 'mid';
};
const adjOf = (L, r) => (r === 'up' ? L.up : L.down);
const idOf = (L, r) => (r === 'up' ? L.ids[L.n - 1] : L.ids[0]);

function setScene(ctx, L) {
  ctx.background(L.bg);
}

// "Otit isomman laatikon." / "Annoit minulle kalleimman takin." / middle item
function describeChoice(L, id, verb, askedAdj) {
  const r = rel(L, id);
  if (r === 'mid') {
    if (L.mid) return `${verb} ${L.mid.g} ${L.noun.g}.`;
    return `Tämä ${L.noun.n} ei ole ${A[askedAdj].s}.`;
  }
  const a = A[adjOf(L, r)];
  return `${verb} ${L.n === 2 ? a.cg : a.sg} ${L.noun.g}.`;
}

// --- task builders -------------------------------------------------------------

function rankedClick(name) {
  return {
    id: `click-${name}`, stages: [2, 4],
    make(ctx) {
      const base = LAYOUTS[name];
      ctx.background(base.bg);
      const L = base.setup(ctx, pick([2, 3]));
      const r = pick(['up', 'down']), adj = adjOf(L, r), deg = L.n === 2 ? 'c' : 's';
      return {
        kind: 'click', choices: L.ids, hint: idOf(L, r), forms: formsFor(adj, deg),
        say: `Ota ${A[adj][deg]} ${L.noun.n}.`,
        accept: a => a.id === idOf(L, r),
        describe: a => describeChoice(L, a.id, 'Otit', adj),
      };
    },
  };
}

function rankedGive(name, { n, context } = {}) {
  return {
    id: `give-${name}`, stages: [3, 4],
    make(ctx) {
      const base = LAYOUTS[name];
      ctx.background(base.bg);
      const L = base.setup(ctx, n || pick([2, 3]));
      const r = pick(['up', 'down']), adj = adjOf(L, r), deg = L.n === 2 ? 'c' : 's';
      const t = {
        kind: 'give', choices: L.ids, hint: idOf(L, r), forms: formsFor(adj, deg),
        say: `Anna minulle ${A[adj][deg]} ${L.noun.n}.`,
        accept: a => a.id === idOf(L, r),
        describe: (a, ok) => ok
          ? (L.n === 2 ? `Kiitos! Tämä ${L.noun.n} on ${A[adj].c}.` : `Kiitos! Tämä on ${A[adj].s} ${L.noun.n}.`)
          : describeChoice(L, a.id, 'Annoit minulle', adj),
      };
      // "Tämä kirja on kalliimpi kuin tuo." said while pointing, before the request.
      if (context && L.n === 2) {
        t.intro = async (goat, say) => {
          goat.pointAt(L.ids[1], { hold: 1400 });
          await say(`Tämä ${L.noun.n} on ${A[L.up].c} kuin tuo.`);
        };
      }
      return t;
    },
  };
}

function peopleClick(name) {
  return {
    id: `click-${name}`, stages: [2, 4],
    make(ctx) {
      const base = LAYOUTS[name];
      ctx.background(base.bg);
      const L = base.setup(ctx);
      const r = pick(['up', 'down']), adj = adjOf(L, r);
      let say, describe, deg;
      if (name === 'children') {
        deg = 's';
        say = `Kuka on perheen ${A[adj].s} lapsi?`;
        describe = a => {
          const ar = rel(L, a.id);
          return ar === 'mid' ? `Tämä lapsi ei ole perheen ${A[adj].s}.` : `Tämä on perheen ${A[adjOf(L, ar)].s} lapsi.`;
        };
      } else if (name === 'boys') {
        deg = 'c';
        say = `Kumpi poika on ${A[adj].c}?`;
        describe = a => `Tämä poika on ${A[adjOf(L, rel(L, a.id))].c}.`;
      } else {
        deg = 'c';
        say = `Kumpi on ${A[adj].c}, isä vai äiti?`;
        describe = a => `${cap(L.names[a.id])} on ${A[adjOf(L, rel(L, a.id))].c}.`;
      }
      return { kind: 'click', choices: L.ids, hint: idOf(L, r), forms: formsFor(adj, deg), say, accept: a => a.id === idOf(L, r), describe };
    },
  };
}

const boxStack = {
  id: 'stack', stages: [3, 4],
  make(ctx) {
    ctx.background('table');
    const L = LAYOUTS.boxes.setup(ctx, pick([2, 3]), { draggable: true });
    const deg = L.n === 2 ? 'c' : 's', g = deg + 'g';
    // Usually small on big; sometimes the other way round, so the form decides.
    const [top, under] = Math.random() < 0.7 ? ['down', 'up'] : ['up', 'down'];
    const ta = adjOf(L, top), ua = adjOf(L, under);
    const name = (id, form) => (rel(L, id) === 'mid' ? (form === 'n' ? 'keskikokoinen' : 'keskikokoisen') : A[adjOf(L, rel(L, id))][deg + (form === 'n' ? '' : 'g')]);
    return {
      kind: 'drop', movable: L.ids, targets: L.ids, hint: idOf(L, top),
      forms: [...formsFor(ta, deg), deg === 'c' ? 'm4.comp-gen' : 'm4.sup-gen'],
      say: `Laita ${A[ta][deg]} laatikko ${A[ua][g]} päälle.`,
      place: () => 'on',
      accept: a => a.id === idOf(L, top) && a.target === idOf(L, under),
      describe: a => `Laitoit ${name(a.id, 'g')} laatikon ${name(a.target, 'g')} päälle.`,
    };
  },
};

const appleIn = {
  id: 'apple', stages: [3, 4],
  make(ctx) {
    ctx.background('table');
    const L = LAYOUTS.boxes.setup(ctx, pick([2, 3]), { slots: { left: 730, right: 1060 } });
    const apple = ctx.addIcon('omena', { x: 600, draggable: true, size: 70 });
    const deg = L.n === 2 ? 'c' : 's', r = pick(['up', 'down']), adj = adjOf(L, r);
    const into = id => (rel(L, id) === 'mid' ? 'keskikokoiseen' : A[adjOf(L, rel(L, id))][deg + 'i']);
    return {
      kind: 'drop', movable: [apple], targets: L.ids, hint: idOf(L, r),
      forms: [...formsFor(adj, deg), deg === 'c' ? 'm4.comp-ill' : 'm4.sup-ill'],
      say: `Laita omena ${A[adj][deg + 'i']} laatikkoon.`,
      place: () => 'in',
      accept: a => a.target === idOf(L, r),
      describe: a => `Laitoit omenan ${into(a.target)} laatikkoon.`,
    };
  },
};

function thingToPeople(name, thing) {
  return {
    id: `${thing}-${name}`, stages: [3, 4],
    make(ctx) {
      const base = LAYOUTS[name];
      ctx.background(base.bg);
      const L = base.setup(ctx, undefined, { slots: { left: name === 'children' ? 720 : 780, right: 1110 } });
      const item = ctx.addIcon(thing, { x: 600, bottom: ctx.floor, draggable: true, size: thing === 'hattu' ? 90 : 70 });
      const r = pick(['up', 'down']), adj = adjOf(L, r);
      const obj = thing === 'hattu' ? 'hatun' : 'pallon', nom = thing === 'hattu' ? 'hattu' : 'pallo';
      let say, describe, forms, intro;
      if (name === 'children') {
        forms = formsFor(adj, 's', ['m4.sup-all']);
        say = `Anna ${nom} perheen ${A[adj].sa} lapselle.`;
        describe = a => {
          const ar = rel(L, a.target);
          return ar === 'mid' ? `Tämä lapsi ei ole perheen ${A[adj].s}.` : `Annoit ${obj} perheen ${A[adjOf(L, ar)].sa} lapselle.`;
        };
      } else if (name === 'boys') {
        forms = formsFor(adj, 'c', ['m4.comp-all']);
        say = `Anna ${nom} ${A[adj].ca} pojalle.`;
        describe = a => `Annoit ${obj} ${A[adjOf(L, rel(L, a.target))].ca} pojalle.`;
      } else {
        forms = formsFor(adj, 'c', ['m4.comp-all']);
        say = `Anna ${nom} ${A[adj].ca}.`;
        describe = a => `Annoit ${obj} ${A[adjOf(L, rel(L, a.target))].ca}.`;
        // "Isä on pidempi kuin äiti." first, about half of the time.
        if (Math.random() < 0.5) {
          const tall = L.names[L.ids[1]], short = L.names[L.ids[0]];
          intro = async (goat, say) => { await say(`${cap(tall)} on ${A.pitka.c} kuin ${short}.`); };
        }
      }
      return {
        kind: 'drop', movable: [item], targets: L.ids, hint: idOf(L, r), forms, say, intro,
        place: () => 'person', accept: a => a.target === idOf(L, r), describe,
      };
    },
  };
}

// --- stage 5: write it --------------------------------------------------------

// "pienempää" and "pienempaa" match the same word, for keyboards without ä and ö.
// His reply always uses the correct spelling.
const plain = w => w.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/å/g, 'a');

function rankedSpeech(name) {
  return {
    make(ctx) {
      const base = LAYOUTS[name];
      ctx.background(base.bg);
      const L = base.setup(ctx, pick([2, 3]));
      const deg = L.n === 2 ? 'c' : 's';
      const target = pick([L.ids[0], L.ids[L.n - 1]]);
      const word = { [L.ids[L.n - 1]]: A[L.up][deg], [L.ids[0]]: A[L.down][deg] };
      return {
        target,
        forms: formsFor(adjOf(L, rel(L, target)), deg),
        match(alternatives) {
          for (const alt of alternatives) {
            const words = alt.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).map(plain);
            for (const [id, w] of Object.entries(word)) {
              if (words.includes(plain(w))) {
                return {
                  id, home: L.home[id],
                  reply: L.n === 2 ? `Tämä ${L.noun.n} on ${w}.` : `Tämä on ${w} ${L.noun.n}.`,
                };
              }
            }
          }
          return null;
        },
      };
    },
  };
}

// --- watch stage ----------------------------------------------------------------

async function pointSay(goat, id, line, say) {
  await goat.pointAt(id);
  await say(line);
}

function rankedNarrate(L, goat, id, say) {
  const r = rel(L, id), noun = L.noun;
  if (L.n === 2) return pointSay(goat, id, `Tämä ${noun.n} on ${A[adjOf(L, r)].c}.`, say);
  if (r !== 'mid') return pointSay(goat, id, `Tämä on ${A[adjOf(L, r)].s} ${noun.n}.`, say);
  if (L.mid) return pointSay(goat, id, `Tämä ${noun.n} on ${L.mid.n}.`, say);
  return (async () => {
    await pointSay(goat, id, `Tämä ${noun.n} on ${A[L.up].c} kuin tuo.`, say);
    await goat.pointAt(L.ids[0], { hold: 900 });
  })();
}

function rankedScene(name, lines, n = 3) {
  return {
    id: name,
    setup(ctx) {
      const base = LAYOUTS[name];
      ctx.background(base.bg);
      return base.setup(ctx, n);
    },
    async watch(ctx, L, say) {
      for (let i = 0; i < L.n; i++) await pointSay(ctx.goat, L.ids[i], lines(L)[i], say);
      await ctx.goat.rest();
    },
    narrate: (ctx, L, id, say) => rankedNarrate(L, ctx.goat, id, say).then(() => ctx.goat.rest()),
  };
}

const boxesScene = {
  id: 'boxes',
  setup(ctx) {
    ctx.background('table');
    const L = LAYOUTS.boxes.setup(ctx, 3, { slots: { left: 730, right: 1060 } });
    // Sorted left to right for the first look.
    const xs = L.ids.map(id => ctx.goat.props[id].x).sort((a, b) => a - b);
    L.ids.forEach((id, i) => { ctx.goat.props[id].x = xs[i]; L.home[id].x = xs[i]; });
    L.apple = ctx.addIcon('omena', { x: 600, size: 70 });
    return L;
  },
  async watch(ctx, L, say) {
    const g = ctx.goat;
    await pointSay(g, L.ids[0], 'Tämä laatikko on pieni.', say);
    await pointSay(g, L.ids[1], 'Tämä laatikko on isompi.', say);
    await pointSay(g, L.ids[2], 'Tämä laatikko on isoin.', say);
    await g.rest();
    await say('Laitan omenan isoimpaan laatikkoon.');
    await g.pickUp(L.apple);
    const t = ctx.top(L.ids[2]);
    await g.putDown({ x: t.x, y: t.y + ctx.items[L.apple].half * 0.15 });
    const boxEl = g.props[L.ids[2]].el;
    boxEl.parentNode.insertBefore(g.props[L.apple].el, boxEl);
    await say('Omena on isoimmassa laatikossa.');
  },
  narrate(ctx, L, id, say) {
    if (!L.ids.includes(id)) return null;
    return rankedNarrate(L, ctx.goat, id, say).then(() => ctx.goat.rest());
  },
};

const familyScenes = [
  {
    id: 'adults',
    setup(ctx) { ctx.background('room'); return LAYOUTS.adults.setup(ctx); },
    async watch(ctx, L, say) {
      const [short, tall] = L.ids;
      const isa = Object.keys(L.names).find(id => L.names[id] === 'isä'), aiti = Object.keys(L.names).find(id => L.names[id] === 'äiti');
      await pointSay(ctx.goat, isa, 'Tämä on isä.', say);
      await pointSay(ctx.goat, aiti, 'Tämä on äiti.', say);
      await pointSay(ctx.goat, tall, `${cap(L.names[tall])} on pidempi kuin ${L.names[short]}.`, say);
      await pointSay(ctx.goat, short, `${cap(L.names[short])} on lyhyempi.`, say);
      await ctx.goat.rest();
    },
    narrate(ctx, L, id, say) {
      const r = rel(L, id);
      return pointSay(ctx.goat, id, `Tämä on ${L.names[id]}. ${cap(L.names[id])} on ${A[adjOf(L, r)].c}.`, say).then(() => ctx.goat.rest());
    },
  },
  {
    id: 'boys',
    setup(ctx) { ctx.background('room'); return LAYOUTS.boys.setup(ctx); },
    async watch(ctx, L, say) {
      await pointSay(ctx.goat, L.ids[0], 'Tämä poika on nuorempi.', say);
      await pointSay(ctx.goat, L.ids[1], 'Tämä poika on vanhempi.', say);
      await ctx.goat.rest();
    },
    narrate: (ctx, L, id, say) => pointSay(ctx.goat, id, `Tämä poika on ${A[adjOf(L, rel(L, id))].c}.`, say).then(() => ctx.goat.rest()),
  },
  {
    id: 'children',
    setup(ctx) { ctx.background('room'); return LAYOUTS.children.setup(ctx); },
    async watch(ctx, L, say) {
      await pointSay(ctx.goat, L.ids[0], 'Tämä on perheen nuorin lapsi.', say);
      await pointSay(ctx.goat, L.ids[2], 'Tämä on perheen vanhin lapsi.', say);
      await ctx.goat.rest();
    },
    narrate(ctx, L, id, say) {
      const r = rel(L, id);
      const line = r === 'mid' ? 'Tämä lapsi on vanhempi kuin tuo.' : `Tämä on perheen ${A[adjOf(L, r)].s} lapsi.`;
      return pointSay(ctx.goat, id, line, say).then(async () => {
        if (r === 'mid') await ctx.goat.pointAt(L.ids[0], { hold: 900 });
        await ctx.goat.rest();
      });
    },
  },
];

export default {
  id: 'm4',
  number: 4,
  title: 'Vertailu',
  subtitle: 'Comparative and superlative',
  forms: FORMS,
  initial: INITIAL,
  scenes: [
    boxesScene,
    rankedScene('booksPrice', L => [`Tämä kirja maksaa ${priceOf(L, 0)} euroa.`, `Tämä kirja maksaa ${priceOf(L, 1)} euroa. Tämä kirja on kalliimpi.`], 2),
    rankedScene('coats', () => ['Tämä takki on halpa.', 'Tämä takki on kalliimpi.', 'Tämä takki on kallein.']),
    rankedScene('booksStars', () => ['Tämä kirja on hyvä.', 'Tämä kirja on parempi.', 'Tämä kirja on paras.']),
    rankedScene('flowers', () => ['Tämä kukka on ruma.', 'Tämä kukka on kauniimpi.', 'Tämä kukka on kaunein.']),
    rankedScene('booksInterest', () => ['Tämä kirja on tylsä.', 'Tämä kirja on kiinnostavampi.', 'Tämä kirja on kiinnostavin.']),
    ...familyScenes,
  ],
  tasks: [
    rankedClick('boxes'), rankedClick('booksPrice'), rankedClick('coats'), rankedClick('booksStars'),
    rankedClick('flowers'), rankedClick('booksInterest'),
    peopleClick('children'), peopleClick('boys'), peopleClick('adults'),
    boxStack, appleIn,
    rankedGive('boxes', { n: 3 }), rankedGive('booksPrice', { n: 2, context: true }), rankedGive('coats', { n: 3 }),
    rankedGive('booksStars'), rankedGive('flowers'), rankedGive('booksInterest'),
    thingToPeople('boys', 'pallo'), thingToPeople('adults', 'hattu'), thingToPeople('children', 'pallo'),
  ],
  speech: ['boxes', 'coats', 'booksStars', 'flowers', 'booksInterest', 'booksPrice'].map(rankedSpeech),
};

// The price on a book in the price layout, for the watch narration.
function priceOf(L, i) {
  return L.prices?.[i] ?? '';
}
