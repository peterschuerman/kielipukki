// Lesson engine: runs the five stages of a grammar module with Kielipukki as
// the tutor.
//
//   Stage 1 Watch     the tutor acts and narrates; clicking things narrates them
//   Stage 2 Choose    the tutor says a sentence; the learner clicks
//   Stage 3 Carry out the tutor gives an instruction; the learner drags
//   Stage 4 Mixed     tasks from stages 2 and 3 in random order
//   Stage 5 Speech    optional: the learner says the sentence
//
// Design rules this follows: the tutor speaks only Finnish, never says
// "wrong", describes what the learner actually did, and repeats the request
// after a mismatch.

import { EASE } from '../kielipukki.js';
import { box, person, iconImage, priceTag, stars, readerFace } from './art.js';

export const STAGES = [
  { n: 1, name: 'Watch' },
  { n: 2, name: 'Choose' },
  { n: 3, name: 'Carry out' },
  { n: 4, name: 'Mixed' },
  { n: 5, name: 'Speech' },
];
const TASKS_PER_STAGE = { 2: 6, 3: 6, 4: 10, 5: 4 };

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Stopped extends Error {}

/**
 * What a module sees while building scenes and tasks: helpers for putting
 * things on the stage and finding what is under a point.
 */
export class SceneContext {
  constructor(goat, { iconHref, words }) {
    this.goat = goat;
    this.iconHref = iconHref;
    this.words = words;
    this.items = {};        // id -> { kind, half, halfW, data }
    this._types = new Set();
    this._count = 0;
    this.floor = 592;       // table top
  }

  /** Remove everything from the stage except the tutor. */
  clear() {
    for (const h of Object.values(this.goat.hands)) if (h.holding) this.goat.removeProp(h.holding.id);
    for (const id of Object.keys(this.goat.props)) this.goat.removeProp(id);
    this.items = {};
    this.goat.hideBubble();
    this.goat.rest();
    this.goat.lookAt(null);
  }

  /** Draw a background: 'table', 'shop' or 'room'. */
  background(kind) {
    const table = `
      <rect x="560" y="596" width="620" height="22" rx="11" fill="#c9a77c" stroke="#111" stroke-width="7"/>
      <path d="M600 618 L600 700 M1140 618 L1140 700" stroke="#111" stroke-width="10"/>`;
    const shop = `
      <rect x="600" y="30" width="200" height="64" rx="12" fill="#fff6d6" stroke="#111" stroke-width="6"/>
      <text x="700" y="75" text-anchor="middle" font-family="Nunito, sans-serif" font-size="36" font-weight="900" fill="#111">KAUPPA</text>`;
    const room = `<path d="M520 668 H1190" stroke="#111" stroke-width="7" stroke-linecap="round"/>
      <rect x="520" y="672" width="670" height="28" fill="#e9e1d3"/>`;
    this.goat.layers.background.innerHTML = `<rect x="0" y="0" width="1200" height="700" fill="#fff"/>` +
      (kind === 'room' ? room : table) + (kind === 'shop' ? shop : '');
    this.floor = kind === 'room' ? 668 : 592;
  }

  _define(key, art, label) {
    const type = `lesson-${key}`;
    if (!this._types.has(type)) {
      this.goat.registerProp(type, art.markup, { label, bottom: art.half, grip: [0, art.half * 0.4] });
      this._types.add(type);
    }
    return type;
  }

  _put(type, art, kind, { id, x, bottom = this.floor, draggable = false, data = {} }) {
    id = id || `${kind}-${++this._count}`;
    this.goat.addProp(type, { id, x, bottom, scale: 1 });
    this.goat.props[id].draggable = draggable;
    this.items[id] = { kind, half: art.half, halfW: art.halfW, art, data };
    return id;
  }

  /** A box; size is { w, h }. */
  addBox(size, opts = {}) {
    const art = box(size);
    return this._put(this._define(`box-${size.w}x${size.h}`, art, 'laatikko'), art, 'box', opts);
  }

  /**
   * One of the vocabulary icons. extras: { price, stars, reader, wilt }
   * add a price tag, a star rating, a reader's face or a wilted look.
   */
  addIcon(wordId, opts = {}, extras = {}) {
    const w = this.words[wordId];
    const size = opts.size || 128;
    const wilt = extras.wilt || 0;
    const ic = iconImage(this.iconHref(w.files[0]), w.boxes?.[0], size, wilt ? {
      style: `filter: grayscale(${wilt * 0.85}) brightness(${1 - wilt * 0.08})`,
      transform: `rotate(${wilt * 24} 0 ${size / 2})`,
    } : {});
    let markup = ic.markup, half = ic.half, top = -ic.half;
    if (extras.price != null) markup += priceTag(`${extras.price} €`, ic.halfW * 0.4, top + 8);
    if (extras.stars != null) { markup += stars(extras.stars, half + 24); half += 42; }
    if (extras.reader != null) markup += readerFace(extras.reader, 0, top - 38);
    const art = { markup, half, halfW: ic.halfW };
    const key = `${wordId}-${size}-${extras.price ?? ''}-${extras.stars ?? ''}-${extras.reader ?? ''}-${wilt}`;
    return this._put(this._define(key, art, w.fi), art, wordId, opts);
  }

  /** A person: spec for art.person ({ kind, height, shirt, hair, ... }). */
  addPerson(spec, opts = {}) {
    const art = person(spec);
    const key = `person-${spec.kind}-${spec.height}-${spec.shirt}-${spec.hair}`;
    return this._put(this._define(key, art, spec.kind), art, 'person', { ...opts, data: { ...spec, ...(opts.data || {}) } });
  }

  /** The item whose outline contains a stage point (among ids, if given). */
  targetAt(point, ids, exclude) {
    let best = null, bestArea = Infinity;
    for (const id of ids || Object.keys(this.items)) {
      if (id === exclude || !this.goat.props[id]) continue;
      const p = this.goat.props[id], it = this.items[id];
      const hw = it.halfW * p.scale + 14, hh = it.half * p.scale + 14;
      if (Math.abs(point.x - p.x) <= hw && Math.abs(point.y - p.y) <= hh && hw * hh < bestArea) {
        best = id; bestArea = hw * hh;
      }
    }
    return best;
  }

  /** Stage position of an item's top centre. */
  top(id) {
    const p = this.goat.props[id], it = this.items[id];
    return { x: p.x, y: p.y - it.half * p.scale };
  }

  /** Move an item so it sits on top of another (stacking). */
  async placeOn(id, targetId, ms = 300) {
    const t = this.top(targetId), it = this.items[id], p = this.goat.props[id];
    await this.goat.tween(p, { x: t.x, y: t.y - it.half * p.scale + 4 }, ms, EASE.out);
    this.goat.sound?.play('drop', 0.6);
  }

  /** Put an item into an open box: it sinks in and the box's front covers its lower part. */
  async placeIn(id, boxId, ms = 300) {
    const t = this.top(boxId), it = this.items[id], p = this.goat.props[id];
    await this.goat.tween(p, { x: t.x, y: t.y + it.half * p.scale * 0.15 }, ms, EASE.out);
    const boxEl = this.goat.props[boxId].el;
    boxEl.parentNode.insertBefore(p.el, boxEl);
    this.goat.sound?.play('drop', 0.6);
  }

  /** Give a thing to a person: a hat goes on the head, anything else to the hand. */
  async giveTo(id, personId, ms = 320) {
    const pp = this.goat.props[personId], art = this.items[personId].art, p = this.goat.props[id];
    const it = this.items[id];
    let to;
    if (this.items[id].kind === 'hattu') {
      to = { x: pp.x + art.head.x * pp.scale, y: pp.y + art.head.y * pp.scale + it.half * p.scale * 0.55 };
    } else {
      to = { x: pp.x + art.hand.x * pp.scale, y: pp.y + art.hand.y * pp.scale - it.half * p.scale * 0.3 };
    }
    await this.goat.tween(p, to, ms, EASE.out);
    this.goat.sound?.play('grab', 0.6);
    // A small happy jump.
    await this.goat.tween(pp, { y: pp.y - 16 }, 120, EASE.out);
    await this.goat.tween(pp, { y: pp.y + 16 }, 140, EASE.in);
  }

  /** The thing hops towards the viewer: "you took it". */
  async taken(id) {
    const p = this.goat.props[id], s = p.scale, y = p.y;
    this.goat.sound?.play('grab', 0.6);
    await this.goat.tween(p, { scale: s * 1.18, y: y + 14 }, 160, EASE.out);
    await sleep(350);
    await this.goat.tween(p, { scale: s, y }, 200, EASE.inOut);
  }

  /** Move an item back to where it was. */
  async back(id, from, ms = 300) {
    if (!this.goat.props[id]) return;
    await this.goat.tween(this.goat.props[id], { x: from.x, y: from.y }, ms, EASE.inOut);
  }

  /** Shuffled x positions for n items across the scene area. */
  slots(n, { left = 650, right = 1070 } = {}) {
    const xs = n === 1 ? [(left + right) / 2] : Array.from({ length: n }, (_, i) => left + ((right - left) * i) / (n - 1));
    return shuffle(xs);
  }
}

/**
 * Runs a module. ui is an object of optional callbacks:
 *   state({ stage, mode, index, count, mismatches, done, message })
 *   progressChanged()
 */
export class Lesson {
  constructor({ goat, module, progress, words, iconHref, ui = {} }) {
    this.goat = goat;
    this.module = module;
    this.progress = progress;
    this.ui = ui;
    this.ctx = new SceneContext(goat, { iconHref, words });
    this.stage = null;
    this._run = 0;
    this._hooksOff();
  }

  _state(extra) {
    this.ui.state?.({ stage: this.stage, ...extra });
  }

  // --- hooks on the tutor ---------------------------------------------------

  _hooksOff() {
    const g = this.goat;
    g.enableDragging(false);
    g.onPropClick = null;
    g.onDrop = null;
    g.canReceive = () => false;
    g.onGiven = null;
    g.canDrag = null;
  }

  _check(run) {
    if (run !== this._run) throw new Stopped();
  }

  /** Stop whatever stage is running. */
  stop() {
    this._run++;
    this._pending?.reject(new Stopped());
    this._pending = null;
    this._hooksOff();
    this.goat.hideBubble();
    this.goat.sound?.stopSpeaking();
    this.stage = null;
    this._state({ mode: 'idle' });
  }

  _wait() {
    return new Promise((resolve, reject) => { this._pending = { resolve, reject }; });
  }

  _resolve(value) {
    const p = this._pending;
    this._pending = null;
    p?.resolve(value);
  }

  async _say(run, text, opts) {
    this._check(run);
    for (const line of [].concat(text)) {
      await this.goat.say(line, { hold: 500, ...opts });
      this._check(run);
    }
  }

  /** The learner asks to hear the sentence again. A second ask also points at the answer. */
  async repeat() {
    const t = this._task;
    if (!t || this._busy) return;
    t.repeats = (t.repeats || 0) + 1;
    const run = this._run;
    try {
      if (t.repeats >= 2 && t.hint) {
        t.firstTry = false;   // a pointed-out answer does not count as understood
        this.goat.pointAt(t.hint, { hold: 1600 });
      }
      const rate = this.goat.sound?.rate;
      if (this.goat.sound) this.goat.sound.rate = Math.max(0.6, rate - 0.15);
      await this._say(run, t.say, { hold: 1500 });
      if (this.goat.sound) this.goat.sound.rate = rate;
    } catch (e) { if (!(e instanceof Stopped)) throw e; }
  }

  /** Continue after the watch stage's narration (the learner's "next"). */
  next() {
    if (this._watchNext) { const r = this._watchNext; this._watchNext = null; r(); }
  }

  // --- stages ---------------------------------------------------------------

  async runStage(n) {
    this.stop();
    const run = ++this._run;
    this.stage = n;
    try {
      if (n === 1) await this._watch(run);
      else if (n === 5) await this._speech(run);
      else await this._tasks(run, n);
    } catch (e) {
      if (e instanceof Stopped) return null;
      throw e;
    } finally {
      if (run === this._run) this._hooksOff();
    }
  }

  async _watch(run) {
    const scenes = this.module.scenes.filter(s => s.watch);
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      this._state({ mode: 'watch', index: i + 1, count: scenes.length });
      this.ctx.clear();
      const layout = scene.setup(this.ctx, { watch: true });
      this._check(run);
      await sleep(300);
      await scene.watch(this.ctx, layout, (t, o) => this._say(run, t, o));
      this._check(run);
      // The learner may click things to hear about them, then goes on.
      this.goat.onPropClick = prop => {
        if (this._narrating) return;
        this._narrating = true;
        Promise.resolve(scene.narrate?.(this.ctx, layout, prop.id, (t, o) => this._say(run, t, o)))
          .catch(e => { if (!(e instanceof Stopped)) console.error(e); })
          .finally(() => { this._narrating = false; });
      };
      this._state({ mode: 'watch-wait', index: i + 1, count: scenes.length });
      await new Promise(r => { this._watchNext = r; });
      this.goat.onPropClick = null;
      this._check(run);
    }
    this.ctx.clear();
    this.progress.recordStage(this.module.id, 1);
    this._state({ mode: 'done' });
    this.ui.progressChanged?.();
  }

  async _tasks(run, stage) {
    const pool = this.module.tasks.filter(t => t.stages.includes(stage));
    const count = TASKS_PER_STAGE[stage];
    // Spread the tasks over the task types, in random order.
    const order = [];
    while (order.length < count) order.push(...shuffle(pool));
    const list = order.slice(0, count);
    let mismatches = 0;
    for (let i = 0; i < list.length; i++) {
      this._state({ mode: 'task', index: i + 1, count, mismatches });
      mismatches += await this._runTask(run, list[i], stage, () => this._state({ mode: 'task', index: i + 1, count, mismatches: mismatches + 1 }));
    }
    this.ctx.clear();
    const counted = this.progress.recordStage(this.module.id, stage, { tasks: count, mismatches });
    await this.goat.setEmotion('veryHappy');
    this.goat.hop();
    this._state({ mode: 'done', count, mismatches, counted });
    this.ui.progressChanged?.();
  }

  // Runs one task; returns the number of mismatches.
  async _runTask(run, def, stage, onMismatch) {
    const ctx = this.ctx, goat = this.goat;
    ctx.clear();
    await goat.setEmotion('happy', { ms: 0 });
    const t = def.make(ctx);
    t.firstTry = true;
    this._task = t;
    this._check(run);
    await sleep(350);
    let mismatches = 0;
    if (t.intro) await t.intro(goat, (x, o) => this._say(run, x, o));
    await this._say(run, t.say, { hold: 1500 });
    for (;;) {
      const action = await this._action(run, t);
      this._busy = true;
      try {
        this._check(run);
        const ok = t.accept(action);
        await this._show(run, t, action, ok);
        if (ok) {
          if (t.firstTry && (stage === 2 || stage === 3)) this.progress.recordCorrect(t.forms);
          goat.sound?.play('ding', 0.6);
          await goat.setEmotion('veryHappy', { ms: 150 });
          await goat.nod(1);
          await sleep(500);
          break;
        }
        mismatches++;
        t.firstTry = false;
        onMismatch?.();
        await goat.setEmotion('neutral', { ms: 150 });
        await this._undo(run, t, action);
        await this._say(run, t.repeatSay || t.say, { hold: 1500 });
      } finally {
        this._busy = false;
      }
    }
    this._task = null;
    return mismatches;
  }

  // Wait for the learner's action and report it as { type, id, target?, from }.
  _action(run, t) {
    const g = this.goat, ctx = this.ctx;
    this._hooksOff();
    const waiting = this._wait();
    if (t.kind === 'click') {
      g.onPropClick = prop => { if (t.choices.includes(prop.id)) this._resolve({ type: 'click', id: prop.id }); };
    } else if (t.kind === 'drop') {
      for (const id of t.movable) if (g.props[id]) g.props[id].draggable = true;
      g.enableDragging(true);
      g.canDrag = prop => t.movable.includes(prop.id);
      g.onDrop = (prop, point, from) => {
        const target = ctx.targetAt(point, t.targets, prop.id);
        if (!target) return false;
        this._resolve({ type: 'drop', id: prop.id, target, from });
        return true;
      };
    } else if (t.kind === 'give') {
      for (const id of t.choices) if (g.props[id]) g.props[id].draggable = true;
      g.enableDragging(true);
      g.canDrag = prop => t.choices.includes(prop.id);
      g.canReceive = prop => t.choices.includes(prop.id);
      g.onGiven = async (prop, hand, from) => { this._resolve({ type: 'give', id: prop.id, from }); };
    }
    return waiting.finally(() => { if (run === this._run) this._hooksOff(); });
  }

  // Play what the learner did, then the tutor describes it.
  async _show(run, t, action, ok) {
    const ctx = this.ctx, goat = this.goat;
    if (action.type === 'click') {
      goat.lookAt(action.id);
      await ctx.taken(action.id);
    } else if (action.type === 'drop') {
      const how = t.place(action);
      if (how === 'in') await ctx.placeIn(action.id, action.target);
      else if (how === 'person') await ctx.giveTo(action.id, action.target);
      else await ctx.placeOn(action.id, action.target);
      goat.lookAt(action.target);
    } else if (action.type === 'give') {
      await goat.holdUp();
      goat.lookAt(action.id);
    }
    this._check(run);
    await this._say(run, t.describe(action, ok), { hold: ok ? 900 : 700 });
  }

  // Put things back after a mismatch, so the learner can try again.
  async _undo(run, t, action) {
    const goat = this.goat;
    if (action.type === 'give') {
      await goat.putDown(action.from);
    } else if (action.type === 'drop') {
      const p = goat.props[action.id];
      goat.layers.props.appendChild(p.el);
      await this.ctx.back(action.id, action.from);
    }
    goat.lookAt(null);
    this._check(run);
  }

  // --- stage 5: speech --------------------------------------------------------

  /** Whether this browser can listen (Chrome and Edge, served from a page that may use the microphone). */
  static speechAvailable() {
    return !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
  }

  async _speech(run) {
    const pool = this.module.speech || [];
    const count = TASKS_PER_STAGE[5];
    let said = 0;
    for (let i = 0; i < count; i++) {
      const def = pick(pool);
      this.ctx.clear();
      const t = def.make(this.ctx);
      this._speechTask = t;
      this._check(run);
      this._state({ mode: 'speech', index: i + 1, count });
      this._glow(t.target);
      await this.goat.setEmotion('happy');
      this.goat._reachOut?.();
      for (;;) {
        const heard = await new Promise((resolve, reject) => { this._pending = { resolve, reject }; });
        this._check(run);
        if (heard === null) break;   // skipped
        const match = t.match(heard);
        if (!match) {
          await this._say(run, 'Anteeksi?', { hold: 600 });
          continue;
        }
        // Act out what was said, even when it is not the glowing thing.
        this._unglow();
        await this.goat.pickUp(match.id);
        await this.goat.holdUp();
        await this._say(run, match.reply, { hold: 900 });
        if (match.id === t.target) {
          this.progress.recordProduced(t.forms);
          said++;
          await this.goat.setEmotion('veryHappy');
          await this.goat.putDown(this.goat.props[match.id] ? this._homeOf(match) : { x: 900, y: 500 });
          break;
        }
        await this.goat.putDown(this._homeOf(match));
        this._glow(t.target);
      }
      this._unglow();
    }
    this.ctx.clear();
    this.progress.recordStage(this.module.id, 5);
    this._state({ mode: 'done', count, said });
    this.ui.progressChanged?.();
  }

  _homeOf(match) {
    return match.home;
  }

  /** The learner's speech (an array of transcripts), or null to skip this one. */
  heard(alternatives) {
    this._resolve(alternatives);
  }

  _glow(id) {
    this._unglow();
    const p = this.goat.props[id];
    if (!p) return;
    const it = this.ctx.items[id];
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ring.setAttribute('cx', p.x);
    ring.setAttribute('cy', p.y);
    ring.setAttribute('rx', it.halfW * p.scale + 22);
    ring.setAttribute('ry', it.half * p.scale + 22);
    ring.setAttribute('fill', '#f5c542');
    ring.setAttribute('opacity', '0.35');
    ring.innerHTML = '<animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.4s" repeatCount="indefinite"/>';
    this.goat.layers.background.appendChild(ring);
    this._ring = ring;
  }

  _unglow() {
    this._ring?.remove();
    this._ring = null;
  }
}
