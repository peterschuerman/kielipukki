// Kielipukki character controller.
//
// Loads assets/goat/rig.svg into a stage <svg> and exposes actions that
// return Promises, so a lesson can be written as a sequence of awaits:
//
//   const goat = await createKielipukki(document.querySelector('#stage'));
//   goat.addProp('apple', { id: 'omena', x: 820, y: 560 });
//   await goat.say('Hei! Minä olen Kielipukki.');
//   await goat.pointAt('omena');
//   await goat.say('Tämä on omena.');
//   await goat.pickUp('omena');
//
// "left" and "right" hands are from the viewer's point of view.
// All stage coordinates are in the stage viewBox (default 1200 x 700).

import { EMOTIONS } from './emotions.js';

const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
let instanceCount = 0;

export const EASE = {
  linear: t => t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  backOut: t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

// Hand positions in goat units (the 512 x 600 head box). rot is the
// direction the fingers point for the right hand, in degrees (0 = right,
// -90 = up). The left hand uses the mirror image.
const HAND_PLACES = {
  rest:   { x: 500, y: 500, rot: 75 },
  carry:  { x: 520, y: 450, rot: -90 },
  holdUp: { x: 560, y: 330, rot: -90 },
  wave:   { x: 540, y: 160, rot: -80 },
  thumb:  { x: 520, y: 430, rot: 0 },
  self:   { x: 525, y: 360, rot: 180 },
};
const GRIP_ANCHOR = { x: 31, y: 0 };  // where a held prop's grip point sits, in hand units
const FINGERTIP = 100;                // distance from palm centre to fingertip, in hand units

// Mouth shape for each letter when talking.
const VISEME = {
  a: 'viseme-a', 'ä': 'viseme-a', e: 'viseme-e', i: 'viseme-e', y: 'viseme-e',
  o: 'viseme-o', 'ö': 'viseme-o', 'å': 'viseme-o', u: 'viseme-u',
  m: 'viseme-m', p: 'viseme-m', b: 'viseme-m',
};

export async function createKielipukki(container, options = {}) {
  let rigSvg = options.rigSvg;
  if (!rigSvg) {
    const url = options.rigUrl || new URL('../assets/goat/rig.svg', import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load rig from ${url}: ${res.status}`);
    rigSvg = await res.text();
  }
  return new Kielipukki(container, rigSvg, options);
}

export class Kielipukki {
  constructor(container, rigSvg, options = {}) {
    this.options = {
      width: 1200, height: 700,
      x: 130, y: 150, scale: 0.68, handScale: 1.35,
      idle: true, autoBlink: true,
      font: "Nunito, 'Trebuchet MS', system-ui, sans-serif",
      letterMs: 70,
      ...options,
    };
    const o = this.options;

    // Give every id in the rig a unique prefix so several goats can share a page.
    const prefix = `kp${++instanceCount}-`;
    this._prefix = prefix;
    const text = rigSvg
      .replace(/\sid="([^"]+)"/g, ` id="${prefix}$1"`)
      .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);
    const rig = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    const byId = id => rig.querySelector(`#${prefix}${id}`);

    // Stage and layers.
    const svg = el('svg', { viewBox: `0 0 ${o.width} ${o.height}`, class: 'kielipukki-stage' });
    svg.style.display = 'block';
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.style.overflow = 'visible';
    svg.appendChild(document.importNode(rig.querySelector('defs'), true));
    this.svg = svg;
    this.layers = {};
    for (const name of ['background', 'goat', 'props', 'hands', 'bubble', 'foreground']) {
      this.layers[name] = svg.appendChild(el('g', { 'data-layer': name }));
    }

    // Goat.
    this._goatOuter = this.layers.goat.appendChild(el('g'));
    this._goatInner = this._goatOuter.appendChild(el('g'));
    const goatNode = document.importNode(byId('goat'), true);
    this._goatInner.appendChild(goatNode);
    this.parts = {};
    goatNode.querySelectorAll('[data-part]').forEach(p => { this.parts[p.dataset.part] = p; });
    this.goat = { x: o.x, y: o.y, s: o.scale, tilt: 0, bob: 0, squash: 1, earL: 0, earR: 0, gx: 0, gy: 0 };

    // Hands.
    const handTpl = byId('hand-template');
    this.hands = {};
    for (const side of ['left', 'right']) {
      const node = document.importNode(handTpl, true);
      node.removeAttribute('id');
      node.removeAttribute('transform');
      node.dataset.hand = side;
      this.layers.hands.appendChild(node);
      const poses = {};
      node.querySelectorAll('[data-pose]').forEach(p => { poses[p.dataset.pose] = p; });
      const hand = {
        side, node, poses, slot: node.querySelector('[data-slot="held"]'),
        x: 0, y: 0, rot: 0, scale: this.options.handScale, pose: null, holding: null,
        phase: side === 'left' ? 0 : 1.7,
      };
      this.hands[side] = hand;
      this._setPose(hand, 'open');
      Object.assign(hand, this._handPlace(hand, 'rest'));
    }

    // Prop templates.
    this.propTypes = {};
    byId('props-library').querySelectorAll('[data-prop]').forEach(p => {
      this.propTypes[p.dataset.prop] = {
        node: p,
        grip: (p.dataset.grip || '0 0').split(/\s+/).map(Number),
        label: p.dataset.label || p.dataset.prop,
      };
    });
    this.props = {};
    this._propCount = 0;

    this._tweens = [];
    this._lookTarget = null;
    this.emotion = 'happy';
    this._t0 = performance.now();
    this.setEmotion('happy', { ms: 0 });

    container.appendChild(svg);
    this._frame = this._frame.bind(this);
    this._raf = requestAnimationFrame(this._frame);
    if (o.autoBlink) this._scheduleBlink();
  }

  // ---------------------------------------------------------------- face

  /** Show an emotion preset from src/emotions.js (or an object of the same shape). */
  setEmotion(name, { ms = 250 } = {}) {
    const e = typeof name === 'string' ? EMOTIONS[name] : name;
    if (!e) throw new Error(`Unknown emotion "${name}". Known: ${Object.keys(EMOTIONS).join(', ')}`);
    if (typeof name === 'string') this.emotion = name;
    this._emotionDef = e;
    this._showVariant('eyes', e.eyes);
    this._showVariant('mouth', e.mouth);
    this._showVariant('brows', e.brows || 'none');
    this._showVariant('cheeks', e.cheeks ? 'on' : 'off');
    const look = this._gazeFor(this._lookTarget) || { gx: e.gaze?.[0] || 0, gy: e.gaze?.[1] || 0 };
    return this._tween(this.goat, { earL: e.ears?.[0] || 0, earR: e.ears?.[1] || 0, tilt: e.tilt || 0, ...look }, ms);
  }

  /** Show an emotion for a while, then go back to the previous one. */
  async emote(name, ms = 1500) {
    const before = this.emotion;
    await this.setEmotion(name);
    await this.wait(ms);
    await this.setEmotion(before);
  }

  /** Close the eyes briefly. Only has a visible effect on open eyes. */
  async blink() {
    const eyes = this._emotionDef.eyes;
    if (eyes !== 'open' && eyes !== 'wide') return;
    this._showVariant('eyes', 'closed');
    await this.wait(110);
    if (this._emotionDef.eyes === eyes) this._showVariant('eyes', eyes);
  }

  /** Turn the eyes toward a point, a prop id, or null to look at the viewer. */
  lookAt(target, { ms = 250 } = {}) {
    this._lookTarget = target == null ? null : target;
    const e = this._emotionDef;
    const look = this._gazeFor(target) || { gx: e.gaze?.[0] || 0, gy: e.gaze?.[1] || 0 };
    return this._tween(this.goat, look, ms);
  }

  /**
   * Show a speech bubble and move the mouth in time with the text.
   * options: bubble (default true), hold (ms to keep the bubble after
   * talking, default 1400; Infinity keeps it), audio (an URL or
   * HTMLAudioElement to play; the mouth then follows its length),
   * letterMs (time per letter when there is no audio).
   */
  async say(text, options = {}) {
    const { bubble = true, hold = 1400, audio = null } = options;
    let letterMs = options.letterMs || this.options.letterMs;
    const token = (this._sayToken = {});
    if (bubble) this._showBubble(text);

    let player = null;
    if (audio) {
      player = typeof audio === 'string' ? new Audio(audio) : audio;
      try {
        await player.play();
        if (isFinite(player.duration) && player.duration > 0) letterMs = (player.duration * 1000) / text.length;
      } catch (err) {
        console.warn('Kielipukki: audio could not play', err);
      }
    }

    const letters = [...text.toLowerCase()];
    let last = null;
    for (const ch of letters) {
      if (this._sayToken !== token) return;
      let shape;
      if (VISEME[ch]) shape = VISEME[ch];
      else if (/[\s.,!?;:]/.test(ch)) shape = 'viseme-m';
      else shape = last && last !== 'viseme-m' ? 'viseme-e' : 'viseme-u';
      if (shape !== last) this._showVariant('mouth', shape);
      last = shape;
      await this.wait(/[.!?]/.test(ch) ? letterMs * 3 : letterMs);
    }
    if (this._sayToken !== token) return;
    this._showVariant('mouth', this._emotionDef.mouth);
    if (bubble && hold !== Infinity) {
      await this.wait(hold);
      if (this._sayToken === token) this.hideBubble();
    }
  }

  hideBubble() {
    this.layers.bubble.replaceChildren();
  }

  // ---------------------------------------------------------------- body

  /** Nod "yes". */
  async nod(times = 2) {
    for (let i = 0; i < times; i++) {
      await this._tween(this.goat, { bob: 14 * this.goat.s, squash: 0.96 }, 150, EASE.out);
      await this._tween(this.goat, { bob: 0, squash: 1 }, 170, EASE.inOut);
    }
  }

  /** Shake the head "no". */
  async shake(times = 2) {
    const base = this._emotionDef.tilt || 0;
    for (let i = 0; i < times; i++) {
      await this._tween(this.goat, { tilt: base - 8 }, 110);
      await this._tween(this.goat, { tilt: base + 8 }, 160);
    }
    await this._tween(this.goat, { tilt: base }, 120);
  }

  /** A small happy jump. */
  async hop(height = 60) {
    await this._tween(this.goat, { squash: 0.9 }, 110, EASE.out);
    await this._tween(this.goat, { bob: -height * this.goat.s, squash: 1.04 }, 230, EASE.out);
    await this._tween(this.goat, { bob: 0, squash: 0.92 }, 200, EASE.in);
    await this._tween(this.goat, { squash: 1 }, 140, EASE.backOut);
  }

  /** Move the whole character (hands follow) to a stage position. */
  async moveTo(x, y, { ms = 600 } = {}) {
    const dx = x - this.goat.x, dy = y - this.goat.y;
    const jobs = [this._tween(this.goat, { x, y }, ms)];
    for (const h of Object.values(this.hands)) jobs.push(this._tween(h, { x: h.x + dx, y: h.y + dy }, ms));
    await Promise.all(jobs);
  }

  // ---------------------------------------------------------------- hands

  /**
   * Point at a stage point {x, y}, a prop id, or the goat's own face ('self').
   * options: hand ('left' | 'right', default: the side nearer the target),
   * hold (ms, then the hand goes back to rest; default: stays),
   * reach (largest distance from the goat, in stage units).
   */
  async pointAt(target, options = {}) {
    const p = this._resolvePoint(target);
    const hand = this._pickHand(options.hand, target === 'self' ? null : p);
    if (target === 'self') {
      // Point at its own face from the side ("minä").
      this.lookAt(null);
      this._setPose(hand, 'point');
      await this._moveHand(hand, this._handPlace(hand, 'self'), options.ms ?? 450);
      if (options.hold != null) { await this.wait(options.hold); await this.rest(hand.side); }
      return;
    }
    const centre = this._g(256, 300);
    let dx = p.x - centre.x, dy = p.y - centre.y;
    let dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const sc = this.goat.s * hand.scale;
    const reach = options.reach ?? 900 * this.goat.s;
    // Stop with the fingertip just short of the target, but not further than reach.
    let along = Math.min(dist - (FINGERTIP + 18) * sc, reach);
    along = Math.max(along, 280 * this.goat.s);
    const pos = { x: centre.x + ux * along, y: centre.y + uy * along };
    const worldDeg = Math.atan2(p.y - pos.y, p.x - pos.x) / DEG;
    const rot = hand.side === 'right' ? worldDeg : 180 - worldDeg;

    this.lookAt(target);
    this._setPose(hand, 'point');
    await this._moveHand(hand, { ...pos, rot }, options.ms ?? 450);
    // A short jab toward the target.
    const jab = 14 * sc;
    await this._tween(hand, { x: pos.x + ux * jab, y: pos.y + uy * jab }, 120, EASE.out);
    await this._tween(hand, { x: pos.x, y: pos.y }, 160, EASE.inOut);
    if (options.hold != null) {
      await this.wait(options.hold);
      await this.rest(hand.side);
    }
  }

  /** Pick up a prop by id. The hand moves to it, grips it and lifts it. */
  async pickUp(propId, options = {}) {
    const prop = this._prop(propId);
    if (prop.holder) return;
    const hand = this._pickHand(options.hand, prop, true);
    if (hand.holding) await this.putDown(this._handPlace(hand, 'rest'), { hand: hand.side });
    const gripWorld = { x: prop.x + prop.grip[0] * prop.scale, y: prop.y + prop.grip[1] * prop.scale };
    this.lookAt(propId);
    this._setPose(hand, 'open');
    await this._moveHand(hand, this._handAt(hand, gripWorld, -90), options.ms ?? 500);
    this._setPose(hand, 'grip');
    this._attach(prop, hand);
    await this.wait(120);
    await this._moveHand(hand, this._handPlace(hand, 'carry'), 450);
    this.lookAt(null);
  }

  /**
   * Put a held prop down so its centre is at {x, y}.
   * options: hand, or prop (id) to choose which held prop.
   */
  async putDown(target, options = {}) {
    let hand = options.hand ? this.hands[options.hand] : null;
    if (options.prop) hand = this._prop(options.prop).holder;
    if (!hand) hand = Object.values(this.hands).find(h => h.holding);
    if (!hand || !hand.holding) return;
    const prop = hand.holding;
    const p = this._resolvePoint(target);
    const gripWorld = { x: p.x + prop.grip[0] * prop.scale, y: p.y + prop.grip[1] * prop.scale };
    this.lookAt(p);
    await this._moveHand(hand, this._handAt(hand, gripWorld, -90), options.ms ?? 550);
    this._detach(prop, p);
    this._setPose(hand, 'open');
    await this.wait(100);
    this.lookAt(null);
    await this.rest(hand.side);
  }

  /** Lift a held prop up beside the face to show it. */
  async holdUp(options = {}) {
    const hand = options.hand ? this.hands[options.hand] : Object.values(this.hands).find(h => h.holding);
    if (!hand) return;
    await this._moveHand(hand, this._handPlace(hand, 'holdUp'), options.ms ?? 450, EASE.backOut);
  }

  /** Wave hello or goodbye. Uses a free hand; does nothing if both hands are full. */
  async wave(options = {}) {
    const hand = this._freeHand(options.hand || 'right');
    if (!hand) return;
    const place = this._handPlace(hand, 'wave');
    this._setPose(hand, 'open');
    await this._moveHand(hand, place, 380);
    for (let i = 0; i < (options.times || 3); i++) {
      await this._tween(hand, { rot: place.rot - 25 }, 170);
      await this._tween(hand, { rot: place.rot + 20 }, 170);
    }
    await this.rest(hand.side);
  }

  /** Thumbs up, for praise. options.hold: ms before going back to rest (default 1200). */
  async thumbsUp(options = {}) {
    const hand = this._freeHand(options.hand || 'right');
    if (!hand) return;
    this._setPose(hand, 'thumbs-up');
    await this._moveHand(hand, this._handPlace(hand, 'thumb'), 380, EASE.backOut);
    await this.wait(options.hold ?? 1200);
    await this.rest(hand.side);
  }

  /** Move one hand ('left' | 'right') or both hands back to rest. Held props stay held. */
  async rest(side) {
    const hands = side ? [this.hands[side]] : Object.values(this.hands);
    this.lookAt(null);
    await Promise.all(hands.map(h => {
      if (h.holding) return this._moveHand(h, this._handPlace(h, 'carry'), 400);
      this._setPose(h, 'open');
      return this._moveHand(h, this._handPlace(h, 'rest'), 400);
    }));
  }

  // ---------------------------------------------------------------- props

  /**
   * Put a prop on the stage. type is a prop name from the rig (apple, book,
   * cup, key) or one added with registerProp. Returns the prop id.
   */
  addProp(type, { id, x = 900, y = 560, scale } = {}) {
    const def = this.propTypes[type];
    if (!def) throw new Error(`Unknown prop "${type}". Known: ${Object.keys(this.propTypes).join(', ')}`);
    id = id || `${type}-${++this._propCount}`;
    if (this.props[id]) throw new Error(`Prop id "${id}" already exists`);
    const wrap = el('g', { 'data-prop-id': id });
    const node = def.node.cloneNode(true);
    wrap.appendChild(node);
    this.layers.props.appendChild(wrap);
    const prop = { id, type, el: wrap, x, y, scale: scale ?? this.goat.s * this.options.handScale, grip: def.grip, label: def.label, holder: null };
    this.props[id] = prop;
    this._placeProp(prop);
    return id;
  }

  /** Add a prop type from SVG markup centred on 0,0. grip is [x, y] in the same units. */
  registerProp(type, markup, { grip = [0, 0], label = type } = {}) {
    const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${markup}</svg>`, 'image/svg+xml');
    const g = el('g', { 'data-prop': type });
    for (const child of [...doc.documentElement.childNodes]) g.appendChild(document.importNode(child, true));
    this.propTypes[type] = { node: g, grip, label };
  }

  removeProp(id) {
    const prop = this._prop(id);
    if (prop.holder) prop.holder.holding = null;
    prop.el.remove();
    delete this.props[id];
  }

  /** Move a prop that is not being held. */
  moveProp(id, x, y, { ms = 0 } = {}) {
    const prop = this._prop(id);
    if (prop.holder) return Promise.resolve();
    return this._tween(prop, { x, y }, ms);
  }

  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    clearTimeout(this._blinkTimer);
    this.svg.remove();
  }

  // ---------------------------------------------------------------- internals

  _showVariant(part, variant) {
    const node = this.parts[part];
    if (!node) return;
    let found = false;
    for (const child of node.children) {
      if (!child.dataset.variant) continue;
      const on = child.dataset.variant === variant;
      child.style.display = on ? '' : 'none';
      found ||= on;
    }
    if (!found) console.warn(`Kielipukki: no variant "${variant}" for part "${part}"`);
  }

  _setPose(hand, pose) {
    if (hand.pose === pose) return;
    if (hand.holding && pose !== 'grip') throw new Error('Put the prop down before changing this hand\'s pose');
    for (const [name, node] of Object.entries(hand.poses)) node.style.display = name === pose ? '' : 'none';
    hand.pose = pose;
  }

  // Goat units to stage units (ignores tilt and bob).
  _g(lx, ly) {
    return { x: this.goat.x + lx * this.goat.s, y: this.goat.y + ly * this.goat.s };
  }

  _handPlace(hand, name) {
    const p = HAND_PLACES[name];
    const lx = hand.side === 'right' ? p.x : 512 - p.x;
    return { ...this._g(lx, p.y), rot: p.rot };
  }

  // Stage position of a point given in hand units.
  _handPoint(hand, lx, ly, state = hand) {
    const sc = this.goat.s * hand.scale;
    const flip = hand.side === 'right' ? 1 : -1;
    const a = (hand.side === 'right' ? state.rot : 180 - state.rot) * DEG;
    const px = lx * sc, py = ly * flip * sc;
    return { x: state.x + px * Math.cos(a) - py * Math.sin(a), y: state.y + px * Math.sin(a) + py * Math.cos(a) };
  }

  // Hand position that puts the grip anchor on a stage point.
  _handAt(hand, point, rot) {
    const off = this._handPoint(hand, GRIP_ANCHOR.x, GRIP_ANCHOR.y, { x: 0, y: 0, rot });
    return { x: point.x - off.x, y: point.y - off.y, rot };
  }

  _moveHand(hand, to, ms, ease = EASE.inOut) {
    let rot = to.rot;
    while (rot - hand.rot > 180) rot -= 360;
    while (rot - hand.rot < -180) rot += 360;
    return this._tween(hand, { x: to.x, y: to.y, rot }, ms, ease);
  }

  _pickHand(side, point, forHolding = false) {
    if (side) return this.hands[side];
    const { left, right } = this.hands;
    let preferred = right;
    if (point) preferred = point.x < this._g(256, 0).x ? left : right;
    const other = preferred === left ? right : left;
    if (preferred.holding && !other.holding) return other;
    if (forHolding && preferred.holding && other.holding) return preferred;
    return preferred;
  }

  // The requested hand if it is empty, otherwise the other hand if that one is empty.
  _freeHand(side) {
    const h = this.hands[side];
    if (!h.holding) return h;
    const other = this.hands[side === 'left' ? 'right' : 'left'];
    return other.holding ? null : other;
  }

  _prop(id) {
    const prop = this.props[id];
    if (!prop) throw new Error(`No prop with id "${id}"`);
    return prop;
  }

  _resolvePoint(target) {
    if (target === 'self') return this._g(256, 300);
    if (typeof target === 'string') {
      const prop = this._prop(target);
      if (prop.holder) return this._handPoint(prop.holder, GRIP_ANCHOR.x, GRIP_ANCHOR.y);
      return { x: prop.x, y: prop.y };
    }
    return target;
  }

  _gazeFor(target) {
    if (target == null) return null;
    const p = this._resolvePoint(target);
    const eye = this._g(256, 238);
    const dx = p.x - eye.x, dy = p.y - eye.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / (250 * this.goat.s));
    return { gx: (dx / d) * k, gy: (dy / d) * k };
  }

  _attach(prop, hand) {
    prop.holder = hand;
    hand.holding = prop;
    hand.slot.appendChild(prop.el);
  }

  _detach(prop, at) {
    prop.holder.holding = null;
    prop.holder = null;
    prop.x = at.x;
    prop.y = at.y;
    this.layers.props.appendChild(prop.el);
    this._placeProp(prop);
  }

  _placeProp(prop) {
    if (prop.holder) {
      // Inside the hand: undo the hand's rotation and mirroring so the prop stays upright.
      const h = prop.holder;
      const flip = h.side === 'right' ? 1 : -1;
      const actual = h.side === 'right' ? h.rot : 180 - h.rot;
      const k = prop.scale / (this.goat.s * h.scale);
      prop.el.setAttribute('transform',
        `translate(${GRIP_ANCHOR.x} ${GRIP_ANCHOR.y}) scale(1 ${flip}) rotate(${-actual}) scale(${k}) translate(${-prop.grip[0]} ${-prop.grip[1]})`);
    } else {
      prop.el.setAttribute('transform', `translate(${prop.x} ${prop.y}) scale(${prop.scale})`);
    }
  }

  _showBubble(text) {
    const layer = this.layers.bubble;
    layer.replaceChildren();
    const fontSize = 30, lineH = 38, pad = 24, maxW = 380;
    const g = layer.appendChild(el('g'));
    const t = g.appendChild(el('text', { 'font-family': this.options.font, 'font-size': fontSize, 'font-weight': 700, fill: '#111' }));
    // Wrap words to maxW.
    const lines = [];
    let line = '';
    const probe = t.appendChild(el('tspan'));
    for (const word of text.split(/\s+/)) {
      const tryLine = line ? `${line} ${word}` : word;
      probe.textContent = tryLine;
      if (probe.getComputedTextLength() > maxW && line) { lines.push(line); line = word; } else line = tryLine;
    }
    lines.push(line);
    probe.remove();
    let w = 0;
    lines.forEach((ln, i) => {
      const span = t.appendChild(el('tspan', { x: 0, dy: i === 0 ? 0 : lineH }));
      span.textContent = ln;
      w = Math.max(w, span.getComputedTextLength());
    });
    const h = lines.length * lineH;
    const boxW = w + pad * 2, boxH = h + pad * 2 - (lineH - fontSize);
    // Tail points at the mouth corner; the box sits above and to the right of the head.
    const tip = this._g(392, 330);
    let bx = this._g(430, 0).x;
    let by = this._g(0, 120).y - boxH;
    bx = Math.min(bx, this.options.width - boxW - 10);
    by = Math.max(by, 10);
    const r = 26;
    const tx = bx + 40, ty = by + boxH;
    g.insertBefore(el('path', {
      d: `M${bx + r} ${by} H${bx + boxW - r} Q${bx + boxW} ${by} ${bx + boxW} ${by + r} V${by + boxH - r} Q${bx + boxW} ${by + boxH} ${bx + boxW - r} ${by + boxH}` +
         ` H${tx + 46} L${tip.x} ${tip.y} L${tx} ${ty} H${bx + r} Q${bx} ${by + boxH} ${bx} ${by + boxH - r} V${by + r} Q${bx} ${by} ${bx + r} ${by} Z`,
      fill: '#fff', stroke: '#111', 'stroke-width': 7, 'stroke-linejoin': 'round',
    }), t);
    t.setAttribute('transform', `translate(${bx + pad} ${by + pad + fontSize * 0.8})`);
    t.querySelectorAll('tspan').forEach(s => s.setAttribute('x', 0));
    // Pop in.
    const pop = { k: 0.6 };
    const cx = tx + 23, cy = ty;
    const apply = () => g.setAttribute('transform', `translate(${cx} ${cy}) scale(${pop.k}) translate(${-cx} ${-cy})`);
    apply();
    pop._apply = apply;
    this._tween(pop, { k: 1 }, 220, EASE.backOut);
    this._bubblePop = pop;
  }

  _scheduleBlink() {
    this._blinkTimer = setTimeout(() => {
      this.blink();
      this._scheduleBlink();
    }, 2200 + Math.random() * 3000);
  }

  _tween(obj, to, ms = 400, ease = EASE.inOut) {
    return new Promise(resolve => {
      // A new tween takes over any keys an older tween on the same object is moving.
      for (const tw of this._tweens) if (tw.obj === obj) for (const k in to) delete tw.to[k];
      if (!ms || ms <= 0) {
        Object.assign(obj, to);
        resolve();
        return;
      }
      const from = {};
      for (const k in to) from[k] = obj[k];
      this._tweens.push({ obj, from, to: { ...to }, t0: performance.now(), ms, ease, resolve });
    });
  }

  _frame(now) {
    this._tweens = this._tweens.filter(tw => {
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      const e = tw.ease(k);
      for (const key in tw.to) tw.obj[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
      if (k >= 1 || Object.keys(tw.to).length === 0) {
        tw.resolve();
        return false;
      }
      return true;
    });
    this._render(now);
    this._raf = requestAnimationFrame(this._frame);
  }

  _render(now) {
    const g = this.goat;
    const t = (now - this._t0) / 1000;
    const idle = this.options.idle;
    const breathe = idle ? Math.sin(t * 2.1) * 4 * g.s : 0;
    this._goatOuter.setAttribute('transform', `translate(${g.x} ${g.y + g.bob + breathe}) scale(${g.s})`);
    const sx = 1 + (1 - g.squash) * 0.6;
    this._goatInner.setAttribute('transform',
      `rotate(${g.tilt} 256 470) translate(256 590) scale(${sx} ${g.squash}) translate(-256 -590)`);
    this.parts['ear-l']?.setAttribute('transform', `rotate(${g.earL} 124 215)`);
    this.parts['ear-r']?.setAttribute('transform', `rotate(${g.earR} 388 215)`);
    const gaze = `translate(${g.gx * 10} ${g.gy * 9})`;
    this.parts.eyes?.querySelectorAll('[data-gaze]').forEach(n => n.setAttribute('transform', gaze));

    for (const h of Object.values(this.hands)) {
      const sc = g.s * h.scale;
      const flip = h.side === 'right' ? 1 : -1;
      const actual = h.side === 'right' ? h.rot : 180 - h.rot;
      const float = idle ? Math.sin(t * 2.4 + h.phase) * 5 * g.s : 0;
      h.node.setAttribute('transform', `translate(${h.x} ${h.y + float}) rotate(${actual}) scale(${sc} ${sc * flip})`);
      if (h.holding) this._placeProp(h.holding);
    }
    for (const p of Object.values(this.props)) if (!p.holder) this._placeProp(p);
    if (this._bubblePop?._apply) this._bubblePop._apply();
  }
}

function el(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
