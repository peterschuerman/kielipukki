// Module 6: relative pronouns in each case
// (joka, jonka, jota, jolla, jolle, jolta, jossa, josta, johon, jotka).
//
// Each scene shows people or houses that look the same. What tells them
// apart is who does what to whom, and only the relative pronoun in the
// tutor's sentence says which one is meant. Positions are shuffled every
// round, so where something stands never gives the answer away.

import m4 from './m4-vertailu.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const INK = '#111';

export const FORMS = {
  'm6.joka':  { label: 'joka (who, subject)', example: 'mies, joka katsoo koiraa' },
  'm6.jonka': { label: 'jonka (whose)', example: 'mies, jonka koira nukkuu' },
  'm6.jota':  { label: 'jota (whom, object)', example: 'mies, jota koira katsoo' },
  'm6.jolla': { label: 'jolla (who has)', example: 'mies, jolla on hattu' },
  'm6.jolle': { label: 'jolle (to whom)', example: 'mies, jolle nainen antaa hatun' },
  'm6.jolta': { label: 'jolta (from whom)', example: 'mies, jolta nainen ottaa hatun' },
  'm6.jossa': { label: 'jossa (in which)', example: 'talo, jossa mies asuu' },
  'm6.josta': { label: 'josta (out of which)', example: 'talo, josta mies tulee' },
  'm6.johon': { label: 'johon (into which)', example: 'talo, johon mies menee' },
  'm6.jotka': { label: 'jotka (who, plural)', example: 'lapset, jotka leikkivät' },
};

// From the diagnostic: jonka's meaning is recognized, its form not yet controlled.
export const INITIAL = { 'm6.jonka': 'recognized' };

// All the men look the same; so do the women.
const MAN = { kind: 'isa', height: 220, shirt: '#3e63dd', hair: '#5a3a1e' };
const WOMAN = { kind: 'aiti', height: 210, shirt: '#e5484d', hair: '#a0522d' };
const KID = { height: 140, shirt: '#46a758', hair: '#2b2b2b' };

// --- drawings that are not things to click ------------------------------------

function line(a, b, { dash = false, color = INK, width = 4, head = false, shorten = 0 } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const s = { x: a.x + ux * shorten, y: a.y + uy * shorten }, e = { x: b.x - ux * shorten, y: b.y - uy * shorten };
  let m = `<line x1="${s.x}" y1="${s.y}" x2="${e.x}" y2="${e.y}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dash ? 'stroke-dasharray="1 10"' : ''}/>`;
  if (head) {
    const L = 16, W = 9;
    m += `<polygon points="${e.x},${e.y} ${e.x - ux * L - uy * W},${e.y - uy * L + ux * W} ${e.x - ux * L + uy * W},${e.y - uy * L - ux * W}" fill="${color}"/>`;
  }
  return m;
}

// A dotted line from someone's eyes to what they look at.
const gaze = (a, b) => line(a, b, { dash: true, width: 7, head: true, shorten: 16 });

// A curved arrow over two people's heads, from one to the other.
function arc(a, b, lift = 70) {
  const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - lift;
  const ex = b.x, ey = b.y, dx = ex - mx, dy = ey - my, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
  return `<path d="M${a.x} ${a.y} Q${mx} ${my} ${ex - ux * 14} ${ey - uy * 14}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <polygon points="${ex},${ey} ${ex - ux * 24 - uy * 13},${ey - uy * 24 + ux * 13} ${ex - ux * 24 + uy * 13},${ey - uy * 24 - ux * 13}" fill="${INK}"/>`;
}

// A small speech bubble beside a head, with an arrow to the listener.
function speech(head, listener) {
  const dir = listener.x > head.x ? 1 : -1;
  const bx = head.x + dir * 38, by = head.y - 52;
  return `
    <path d="M${bx - 30} ${by - 20} h60 a12 12 0 0 1 12 12 v18 a12 12 0 0 1 -12 12 h-34 l-14 14 l2 -14 h-14 a12 12 0 0 1 -12 -12 v-18 a12 12 0 0 1 12 -12 z"
      fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round" transform="${dir < 0 ? `translate(${2 * bx} 0) scale(-1 1)` : ''}"/>
    <circle cx="${bx - 14}" cy="${by + 1}" r="4" fill="${INK}"/><circle cx="${bx}" cy="${by + 1}" r="4" fill="${INK}"/><circle cx="${bx + 14}" cy="${by + 1}" r="4" fill="${INK}"/>
    ${line({ x: bx + dir * 44, y: by }, { x: listener.x - dir * 10, y: listener.y - 40 }, { head: true, width: 4 })}`;
}

const zzz = (x, y) => `<text x="${x}" y="${y}" font-family="Nunito, sans-serif" font-size="22" font-weight="900" fill="${INK}">z</text>
  <text x="${x + 14}" y="${y - 16}" font-family="Nunito, sans-serif" font-size="16" font-weight="900" fill="${INK}">z</text>`;

// --- scenes ---------------------------------------------------------------------
// Each setup returns { stations: { key: { id, target } }, extra }. `id` is what
// the learner clicks; `target` is where a dragged thing goes (usually the same).

const LOOK = {
  noun: 'mies', partitive: 'miestä', allative: 'miehelle', bg: 'room',
  clauses: {
    S: { pron: 'joka', clause: 'joka katsoo koiraa', known: 'Mies katsoo koiraa.' },
    O: { pron: 'jota', clause: 'jota koira katsoo', known: 'Koira katsoo miestä.' },
    P: { pron: 'jonka', clause: 'jonka koira nukkuu', known: 'Miehen koira nukkuu.' },
  },
  setup(ctx) {
    const keys = shuffle(['S', 'O', 'P']), xs = [655, 870, 1085], stations = {};
    keys.forEach((k, i) => {
      const sx = xs[i];
      const man = ctx.addPerson(MAN, { x: sx - 42, bottom: ctx.floor });
      // The dog picture faces left: towards the man. The dog the man looks at faces away.
      const dog = ctx.addIcon('koira', { x: sx + 52, bottom: ctx.floor, size: 82 }, { flip: k === 'S' });
      const art = ctx.items[man].art;
      const face = ctx.at(man, { x: art.face.x + art.face.r * 0.5, y: art.face.y });
      const dogHead = { x: ctx.goat.props[dog].x - 22, y: ctx.goat.props[dog].y - 22 };
      if (k === 'S') ctx.deco(gaze(face, { x: ctx.goat.props[dog].x, y: ctx.goat.props[dog].y - 10 }));
      if (k === 'O') ctx.deco(gaze(dogHead, ctx.at(man, { x: art.face.r * 0.6, y: art.face.y + art.face.r * 2.6 })));
      if (k === 'P') {
        const hand = ctx.at(man, art.hand);
        ctx.deco(`<path d="M${hand.x} ${hand.y} Q ${(hand.x + dogHead.x) / 2} ${hand.y + 40} ${dogHead.x + 6} ${dogHead.y + 14}"
          fill="none" stroke="#8b5a2b" stroke-width="5" stroke-linecap="round"/>` + zzz(dogHead.x + 20, dogHead.y - 20));
      }
      stations[k] = { id: man, target: man };
    });
    return { stations };
  },
};

const HAT = {
  noun: 'mies', partitive: 'miestä', allative: 'miehelle', bg: 'room',
  clauses: {
    H: { pron: 'jolla', clause: 'jolla on hattu', known: 'Miehellä on hattu.' },
    G: { pron: 'jolle', clause: 'jolle nainen antaa hatun', known: 'Nainen antaa miehelle hatun.' },
    T: { pron: 'jolta', clause: 'jolta nainen ottaa hatun', known: 'Nainen ottaa mieheltä hatun.' },
  },
  setup(ctx) {
    const keys = shuffle(['H', 'G', 'T']), xs = [655, 875, 1090], stations = {};
    keys.forEach((k, i) => {
      const sx = xs[i];
      if (k === 'H') {
        const man = ctx.addPerson(MAN, { x: sx, bottom: ctx.floor });
        const head = ctx.at(man, ctx.items[man].art.head);
        const hat = ctx.iconMarkup('hattu', 66);
        ctx.deco(`<g transform="translate(${head.x} ${head.y - hat.half + 14})">${hat.markup}</g>`);
        stations[k] = { id: man, target: man };
        return;
      }
      const man = ctx.addPerson(MAN, { x: sx - 46, bottom: ctx.floor });
      const woman = ctx.addPerson(WOMAN, { x: sx + 46, bottom: ctx.floor });
      const from = ctx.at(k === 'G' ? woman : man, ctx.items[k === 'G' ? woman : man].art[k === 'G' ? 'leftHand' : 'hand']);
      const to = ctx.at(k === 'G' ? man : woman, ctx.items[k === 'G' ? man : woman].art[k === 'G' ? 'hand' : 'leftHand']);
      const hat = ctx.iconMarkup('hattu', 62);
      const headOf = id => { const a = ctx.items[id].art; return ctx.at(id, { x: 0, y: a.face.y - a.face.r - 18 }); };
      const giver = k === 'G' ? woman : man, taker = k === 'G' ? man : woman;
      ctx.deco(arc(headOf(giver), headOf(taker)));
      const g = ctx.deco(`<g>${hat.markup}</g>`).firstElementChild;
      // The hat travels from one hand to the other, over and over.
      ctx.loop(t => {
        const u = (t % 1.6) / 1.6;
        const x = from.x + (to.x - from.x) * u, y = from.y - 14 - Math.sin(u * Math.PI) * 22;
        g.setAttribute('transform', `translate(${x} ${y})`);
        g.setAttribute('opacity', u > 0.9 ? (1 - u) * 10 : 1);
      });
      stations[k] = { id: man, target: man };
    });
    return { stations };
  },
};

const TALK = {
  noun: 'mies', partitive: 'miestä', allative: 'miehelle', bg: 'room',
  clauses: {
    L: { pron: 'joka', clause: 'joka puhuu naiselle', known: 'Mies puhuu naiselle.', keys: ['puhu'],
         also: { pron: 'jota', clause: 'jota nainen kuuntelee', keys: ['kuunte'] } },
    R: { pron: 'jolle', clause: 'jolle nainen puhuu', known: 'Nainen puhuu miehelle.' },
    M: { pron: 'joka', clause: 'joka lukee', known: 'Mies lukee.', keys: ['luke', 'luki'] },
  },
  setup(ctx) {
    const order = pick([['L', 'W', 'R', 'M'], ['M', 'L', 'W', 'R'], ['R', 'W', 'L', 'M'], ['M', 'R', 'W', 'L']]);
    const xs = [650, 800, 950, 1100], ids = {};
    order.forEach((k, i) => { ids[k] = ctx.addPerson(k === 'W' ? WOMAN : MAN, { x: xs[i], bottom: ctx.floor }); });
    const head = id => { const a = ctx.items[id].art; return ctx.at(id, { x: 0, y: a.face.y - a.face.r }); };
    ctx.deco(speech(head(ids.L), head(ids.W)));
    ctx.deco(speech(head(ids.W), head(ids.R)));
    const book = ctx.iconMarkup('kirja', 46), hand = ctx.at(ids.M, ctx.items[ids.M].art.hand);
    ctx.deco(`<g transform="translate(${hand.x - 14} ${hand.y - 18})">${book.markup}</g>`);
    return { stations: { L: { id: ids.L, target: ids.L }, R: { id: ids.R, target: ids.R }, M: { id: ids.M, target: ids.M } } };
  },
};

const HOUSES = {
  noun: 'talo', partitive: 'taloa', illative: 'taloon', bg: 'street',
  clauses: {
    A: { pron: 'jossa', clause: 'jossa mies asuu', known: 'Mies asuu tässä talossa.' },
    B: { pron: 'josta', clause: 'josta mies tulee', known: 'Mies tulee tästä talosta.' },
    C: { pron: 'johon', clause: 'johon mies menee', known: 'Mies menee tähän taloon.' },
  },
  setup(ctx, { dog = false } = {}) {
    const keys = shuffle(['A', 'B', 'C']), xs = [690, 885, 1080], stations = {};
    keys.forEach((k, i) => {
      const h = ctx.addHouse({ w: 140, h: 160, door: k === 'A' ? 'closed' : 'open' }, { x: xs[i], bottom: ctx.floor });
      const art = ctx.items[h].art;
      if (k === 'A') {
        // Someone at home: a face in the window.
        const w = ctx.at(h, art.window), r = art.window.size * 0.32;
        ctx.deco(`<circle cx="${w.x}" cy="${w.y + 2}" r="${r}" fill="#f3d9c2" stroke="${INK}" stroke-width="4"/>
          <circle cx="${w.x - r * 0.35}" cy="${w.y}" r="2.5" fill="${INK}"/><circle cx="${w.x + r * 0.35}" cy="${w.y}" r="2.5" fill="${INK}"/>
          <path d="M${w.x - r * 0.45} ${w.y + r * 0.45} Q${w.x - r * 0.1} ${w.y + r * 0.6} ${w.x + r * 0.45} ${w.y + r * 0.45}" stroke="#5a3a1e" stroke-width="4" fill="none"/>`);
      } else {
        // Someone walking out of the door, or in through it, over and over.
        const door = ctx.at(h, art.door);
        const walker = ctx.addPerson({ ...MAN, height: 120 }, { x: door.x, bottom: ctx.floor });
        ctx.goat.props[walker].el.style.pointerEvents = 'none';
        const p = ctx.goat.props[walker], baseY = p.y;
        const out = k === 'B';
        ctx.deco(line({ x: door.x + (out ? 30 : 95), y: ctx.floor + 18 }, { x: door.x + (out ? 95 : 30), y: ctx.floor + 18 }, { head: true, width: 4 }));
        ctx.loop(t => {
          const u = (t % 2.4) / 2.4;
          p.x = out ? door.x + u * 85 : door.x + 85 - u * 85;
          p.y = baseY - Math.abs(Math.sin(u * Math.PI * 6)) * 4;
          p.el.style.opacity = out ? Math.min(1, u * 6) : Math.min(1, (1 - u) * 6);
        });
      }
      stations[k] = { id: h, target: h };
    });
    const extra = {};
    if (dog) extra.dog = ctx.addIcon('koira', { x: 585, bottom: ctx.floor, size: 70, draggable: true });
    return { stations, ...extra };
  },
};

const CHILDREN = {
  bg: 'room',
  clauses: {
    PP: { pron: 'jotka', clause: 'jotka leikkivät', known: 'Nämä lapset leikkivät.', keys: ['leikk'], what: 'Nämä ovat lapset, jotka leikkivät.', ask: 'Napauta lapsia, jotka leikkivät.' },
    SP: { pron: 'joka', clause: 'joka leikkii', known: 'Tämä lapsi leikkii.', keys: ['leikk'], what: 'Tämä on lapsi, joka leikkii.', ask: 'Napauta lasta, joka leikkii.' },
    PS: { pron: 'jotka', clause: 'jotka nukkuvat', known: 'Nämä lapset nukkuvat.', keys: ['nukku'], what: 'Nämä ovat lapset, jotka nukkuvat.', ask: 'Napauta lapsia, jotka nukkuvat.' },
  },
  setup(ctx) {
    const keys = shuffle(['PP', 'SP', 'PS']), xs = [675, 880, 1085], stations = {};
    keys.forEach((k, i) => {
      const sx = xs[i];
      const kinds = shuffle(['poika', 'tytto']);
      const members = k === 'SP'
        ? [ctx.addPerson({ ...KID, kind: kinds[0] }, { x: sx, bottom: ctx.floor })]
        : [-38, 38].map((dx, j) => ctx.addPerson({ ...KID, kind: kinds[j], asleep: k === 'PS' }, { x: sx + dx, bottom: ctx.floor }));
      if (k !== 'PS') {
        // A ball bouncing between the two, or up and down for one child.
        const ball = ctx.iconMarkup('pallo', 34);
        const g = ctx.deco(`<g>${ball.markup}</g>`).firstElementChild;
        const y0 = ctx.floor - 40;
        ctx.loop(t => {
          let x, y;
          if (k === 'PP') { const u = (Math.sin(t * 2.4) + 1) / 2; x = sx - 34 + 68 * u; y = y0 - 60 - Math.sin(u * Math.PI) * 40; }
          else { x = sx + 42; y = y0 - Math.abs(Math.sin(t * 3.2)) * 70; }
          g.setAttribute('transform', `translate(${x} ${y})`);
        });
      }
      stations[k] = { id: members[0], members, target: members[0] };
    });
    return { stations };
  },
};

const SCENES = { look: LOOK, hat: HAT, talk: TALK, houses: HOUSES, children: CHILDREN };

// Which station a clicked or dropped-on item belongs to.
const stationOf = (layout, id) => Object.keys(layout.stations).find(k => {
  const s = layout.stations[k];
  return s.id === id || s.members?.includes(id);
});

// --- tasks ----------------------------------------------------------------------

function clickTask(name) {
  return {
    id: `click-${name}`, stages: [2, 4],
    make(ctx) {
      const S = SCENES[name];
      ctx.background(S.bg);
      const L = S.setup(ctx);
      const key = pick(Object.keys(L.stations));
      const c = S.clauses[key];
      // Some people can be named two ways ("joka puhuu naiselle" / "jota nainen kuuntelee").
      const use = c.also && Math.random() < 0.4 ? c.also : c;
      const what = k => S.clauses[k].what || `Tämä on ${S.noun}, ${S.clauses[k].clause}.`;
      const choices = Object.values(L.stations).flatMap(s => s.members || [s.id]);
      return {
        kind: 'click', choices, hint: L.stations[key].id, forms: [`m6.${use.pron}`],
        say: c.ask && use === c ? c.ask : `Napauta ${S.partitive}, ${use.clause}.`,
        accept: a => stationOf(L, a.id) === key,
        describe: a => what(stationOf(L, a.id)),
      };
    },
  };
}

function bookTask(name) {
  return {
    id: `book-${name}`, stages: [3, 4],
    make(ctx) {
      const S = SCENES[name];
      ctx.background(S.bg);
      const L = S.setup(ctx);
      const book = ctx.addIcon('kirja', { x: 575, bottom: ctx.floor, size: 70, draggable: true });
      const key = pick(Object.keys(L.stations)), c = S.clauses[key];
      const targets = Object.values(L.stations).map(s => s.target);
      return {
        kind: 'drop', movable: [book], targets, hint: L.stations[key].id, forms: [`m6.${c.pron}`],
        say: `Anna kirja ${S.allative}, ${c.clause}.`,
        place: () => 'person',
        accept: a => stationOf(L, a.target) === key,
        describe: a => `Annoit kirjan ${S.allative}, ${S.clauses[stationOf(L, a.target)].clause}.`,
      };
    },
  };
}

const dogTask = {
  id: 'dog-houses', stages: [3, 4],
  make(ctx) {
    ctx.background('street');
    const L = HOUSES.setup(ctx, { dog: true });
    const key = pick(Object.keys(L.stations)), c = HOUSES.clauses[key];
    return {
      kind: 'drop', movable: [L.dog], targets: Object.values(L.stations).map(s => s.id), hint: L.stations[key].id,
      forms: [`m6.${c.pron}`],
      say: `Vie koira taloon, ${c.clause}.`,
      place: () => 'at',
      accept: a => stationOf(L, a.target) === key,
      describe: a => `Veit koiran taloon, ${HOUSES.clauses[stationOf(L, a.target)].clause}.`,
    };
  },
};

// --- stage 5: write it ------------------------------------------------------------

const plain = w => w.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o');

function writeTask(name) {
  return {
    make(ctx) {
      const S = SCENES[name];
      ctx.background(S.bg);
      const L = S.setup(ctx);
      const key = pick(Object.keys(L.stations));
      const named = Object.keys(L.stations).flatMap(k => {
        const c = S.clauses[k];
        return [c, c.also].filter(Boolean).map(x => ({ k, ...x }));
      });
      return {
        target: L.stations[key].id,
        forms: [`m6.${S.clauses[key].pron}`],
        match(alternatives) {
          for (const alt of alternatives) {
            const words = plain(alt).replace(/[.,!?]/g, ' ').split(/\s+/);
            // The pronoun must be there; where two people share a pronoun, a word
            // from the clause decides which one.
            const hits = named.filter(n => words.includes(n.pron) &&
              (!n.keys || n.keys.some(key => words.some(w => w.startsWith(key)))));
            if (hits.length) {
              const n = hits[0];
              return { id: L.stations[n.k].id, point: true, reply: S.clauses[n.k].what || `Tämä on ${S.noun}, ${n.clause}.` };
            }
          }
          return null;
        },
      };
    },
  };
}

// --- watch stage -------------------------------------------------------------------

function scene(name) {
  const S = SCENES[name];
  const line2 = k => {
    const c = S.clauses[k];
    return [c.known, c.what || `Tämä on ${S.noun}, ${c.clause}.`];
  };
  return {
    id: name,
    setup(ctx) { ctx.background(S.bg); return S.setup(ctx); },
    async watch(ctx, L, say) {
      for (const k of Object.keys(S.clauses)) {
        const st = L.stations[k];
        if (!st) continue;
        await ctx.goat.pointAt(st.id);
        for (const l of line2(k)) await say(l);
      }
      await ctx.goat.rest();
    },
    async narrate(ctx, L, id, say) {
      const k = stationOf(L, id);
      if (!k) return;
      await ctx.goat.pointAt(L.stations[k].id);
      for (const l of line2(k)) await say(l);
      await ctx.goat.rest();
    },
  };
}

export default {
  id: 'm6',
  number: 6,
  title: 'Relatiivipronominit',
  subtitle: 'Relative pronouns: joka, jonka, jota, jolla, jolle, jolta, jossa, josta, johon, jotka',
  writeHint: 'Write which one is glowing, for example "mies, jolla on hattu" or "talo, johon mies menee", and press Enter.',
  forms: FORMS,
  initial: INITIAL,
  mixWith: [m4],
  scenes: ['look', 'hat', 'talk', 'houses', 'children'].map(scene),
  tasks: [
    ...['look', 'hat', 'talk', 'houses', 'children'].map(clickTask),
    bookTask('look'), bookTask('hat'), bookTask('talk'), dogTask,
  ],
  speech: ['look', 'hat', 'talk', 'houses', 'children'].map(writeTask),
};
