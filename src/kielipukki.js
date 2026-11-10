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
  present: { x: 575, y: 470, rot: -6 },
  self:   { x: 525, y: 360, rot: 180 },
  ask:    { x: 560, y: 450, rot: -25 },
  windUp: { x: 520, y: 40, rot: -70 },
  throw:  { x: 300, y: -10, rot: -150 },
};
const GRIP_ANCHOR = { x: 31, y: 0 };  // where a held prop's grip point sits, in hand units
const PALM_ANCHOR = { x: 26, y: -28 }; // top of the palm in the palm-up pose; a prop's lowest point rests here
const HOLDING_POSES = ['grip', 'palm-up'];
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
      sound: null,
      bubbles: true,
      ...options,
    };
    const o = this.options;
    this.sound = o.sound;  // a KielipukkiSound, or null for no sound

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
    for (const name of ['background', 'behind', 'goat', 'props', 'hands', 'bubble', 'foreground']) {
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
        side, node, poses, slots: Object.fromEntries(HOLDING_POSES.map(n => [n, poses[n].querySelector('[data-slot="held"]')])),
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
        bottom: Number(p.dataset.bottom || 50),
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
    this._dragOn = false;
    this._asking = null;
    this._receiving = false;
    svg.addEventListener('pointerdown', e => this._dragStart(e));
    svg.addEventListener('pointermove', e => this._dragMove(e));
    svg.addEventListener('pointerup', e => this._dragEnd(e));
    svg.addEventListener('pointercancel', e => this._dragEnd(e));
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
    this._showVariant('jowls', 'off');
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
    if (this._eating || (eyes !== 'open' && eyes !== 'wide')) return;
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
   * Show a speech bubble, speak the text and move the mouth with it.
   * options: bubble (default: options.bubbles, see setBubbles), hold (ms to keep the bubble after
   * talking, default 1400; Infinity keeps it), audio (a URL or
   * HTMLAudioElement to play instead of text-to-speech), speak (false to
   * stay silent for this line), letterMs (time per letter when silent).
   * Speech uses options.sound (a KielipukkiSound) when the goat has one.
   */
  async say(text, options = {}) {
    const { bubble = this.options.bubbles, hold = 1400, audio = null } = options;
    let letterMs = options.letterMs || this.options.letterMs;
    const token = (this._sayToken = {});
    const sound = this.sound;
    sound?.stopSpeaking();
    this._player?.pause();
    if (bubble) this._showBubble(text);

    // Start the sound, if any. `playing` resolves when it ends.
    let playing = null, finished = false, jumpTo = null;
    if (audio) {
      const player = typeof audio === 'string' ? new Audio(audio) : audio;
      this._player = player;
      if (sound) player.volume = Math.min(1, sound.volume * 1.6);
      try {
        await player.play();
        if (isFinite(player.duration) && player.duration > 0) letterMs = (player.duration * 1000) / text.length;
        playing = new Promise(r => { player.onended = r; player.onpause = r; player.onerror = r; });
      } catch (err) {
        console.warn('Kielipukki: audio could not play', err);
      }
    } else if (sound && options.speak !== false) {
      const speech = sound.speak(text);
      if (speech) {
        playing = speech.done;
        speech.onboundary = i => { jumpTo = i; };
      }
    }
    playing?.then(() => { finished = true; });

    // Mouth: one shape per letter. While sound plays, follow its word
    // positions where the browser reports them, and repeat until it ends.
    const letters = [...text.toLowerCase()];
    let last = null;
    for (let i = 0; i < letters.length; i++) {
      if (this._sayToken !== token) return;
      if (playing && finished) break;
      if (jumpTo != null) { i = Math.min(jumpTo, letters.length - 1); jumpTo = null; }
      const ch = letters[i];
      let shape;
      if (VISEME[ch]) shape = VISEME[ch];
      else if (/[\s.,!?;:]/.test(ch)) shape = 'viseme-m';
      else shape = last && last !== 'viseme-m' ? 'viseme-e' : 'viseme-u';
      if (shape !== last) this._showVariant('mouth', shape);
      last = shape;
      await this.wait(/[.!?]/.test(ch) ? letterMs * 3 : letterMs);
      if (playing && !finished && i === letters.length - 1) i = -1;
    }
    if (this._sayToken !== token) return;
    this._showVariant('mouth', this._emotionDef.mouth);
    if (bubble && hold !== Infinity) {
      await this.wait(hold);
      if (this._sayToken === token) this.hideBubble();
    }
  }

  /** Turn speech bubbles on or off for every line from now on. Off also hides the current bubble. */
  setBubbles(on) {
    this.options.bubbles = !!on;
    if (!on) this.hideBubble();
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
    this._sfx('boing');
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
   * Put a held prop down so its centre is at {x, y}, or so its lowest point
   * is at {x, bottom}. options: hand, or prop (id) to choose which held prop.
   */
  async putDown(target, options = {}) {
    let hand = options.hand ? this.hands[options.hand] : null;
    if (options.prop) hand = this._prop(options.prop).holder;
    if (!hand) hand = Object.values(this.hands).find(h => h.holding);
    if (!hand || !hand.holding) return;
    const prop = hand.holding;
    const p = target.bottom != null
      ? { x: target.x, y: target.bottom - prop.bottomOffset * prop.scale }
      : this._resolvePoint(target);
    const gripWorld = { x: p.x + prop.grip[0] * prop.scale, y: p.y + prop.grip[1] * prop.scale };
    this.lookAt(p);
    this._setPose(hand, 'grip');
    await this._moveHand(hand, this._handAt(hand, gripWorld, -90), options.ms ?? 550);
    this._detach(prop, p);
    this._setPose(hand, 'open');
    await this.wait(100);
    this.lookAt(null);
    await this.rest(hand.side);
  }

  /**
   * Show a held prop resting on an open palm, to talk about it.
   * options.grip: true keeps it in the fist and lifts it beside the face instead.
   */
  async holdUp(options = {}) {
    const hand = options.hand ? this.hands[options.hand] : Object.values(this.hands).find(h => h.holding);
    if (!hand || !hand.holding) return;
    if (options.grip) {
      this._setPose(hand, 'grip');
      await this._moveHand(hand, this._handPlace(hand, 'holdUp'), options.ms ?? 450, EASE.backOut);
      return;
    }
    // Lift a little, open the hand under the prop, then present it.
    await this._tween(hand, { y: hand.y - 30 * this.goat.s }, 140, EASE.out);
    this._setPose(hand, 'palm-up');
    await this._moveHand(hand, this._handPlace(hand, 'present'), options.ms ?? 420, EASE.backOut);
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
    this._sfx('ding');
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
   * cup, key) or one added with registerProp / registerImageProp.
   * Give y for the prop's centre, or bottom to set its lowest point on a
   * surface at that height. Returns the prop id.
   */
  addProp(type, { id, x = 900, y = 560, bottom, scale } = {}) {
    const def = this.propTypes[type];
    if (!def) throw new Error(`Unknown prop "${type}". Known: ${Object.keys(this.propTypes).join(', ')}`);
    id = id || `${type}-${++this._propCount}`;
    if (this.props[id]) throw new Error(`Prop id "${id}" already exists`);
    const wrap = el('g', { 'data-prop-id': id });
    const node = def.node.cloneNode(true);
    wrap.appendChild(node);
    this.layers.props.appendChild(wrap);
    scale = scale ?? this.goat.s * this.options.handScale;
    if (bottom != null) y = bottom - def.bottom * scale;
    const prop = { id, type, el: wrap, x, y, scale, grip: def.grip, bottomOffset: def.bottom, label: def.label, holder: null };
    this.props[id] = prop;
    this._placeProp(prop);
    this._dragStyle(prop);
    return id;
  }

  /** Add a prop type from SVG markup centred on 0,0. grip is [x, y] in the same units; bottom is its lowest point below 0. */
  registerProp(type, markup, { grip = [0, 0], label = type, bottom = 50 } = {}) {
    const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${markup}</svg>`, 'image/svg+xml');
    const g = el('g', { 'data-prop': type });
    for (const child of [...doc.documentElement.childNodes]) g.appendChild(document.importNode(child, true));
    this.propTypes[type] = { node: g, grip, label, bottom };
  }

  /**
   * Add a prop type from an image (an SVG, PNG or WebP URL or data: URI).
   * box is where the drawing sits inside the image's square, as fractions
   * [left, top, right, bottom] (see tools/measure-icons.mjs). The drawing is
   * centred on 0,0 and scaled so its larger side is `size` units.
   * grip defaults to a point halfway between the centre and the bottom.
   */
  registerImageProp(type, href, { size = 130, box = [0, 0, 1, 1], grip, label = type } = {}) {
    const [x0, y0, x1, y1] = box;
    const k = size / Math.max(x1 - x0, y1 - y0, 0.05);  // units per image square
    const g = el('g', { 'data-prop': type });
    g.appendChild(el('image', { href, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k, width: k, height: k }));
    const bottom = ((y1 - y0) / 2) * k;
    this.propTypes[type] = { node: g, grip: grip || [0, bottom * 0.5], label, bottom };
  }

  /** The vocabulary word of a prop on stage (its label), for use in say(). */
  labelOf(id) {
    return this._prop(id).label;
  }

  removeProp(id) {
    const prop = this._prop(id);
    if (prop.holder) prop.holder.holding = null;
    prop.el.remove();
    prop.mask?.remove();
    delete this.props[id];
  }

  /** Move a prop that is not being held. */
  moveProp(id, x, y, { ms = 0 } = {}) {
    const prop = this._prop(id);
    if (prop.holder) return Promise.resolve();
    return this._tween(prop, { x, y }, ms);
  }

  /** Animate numeric fields of an object (a prop, a hand, goat.goat) to new values. */
  tween(obj, to, ms = 400, ease = EASE.inOut) {
    return this._tween(obj, to, ms, ease);
  }

  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  destroy() {
    this.sound?.stopSpeaking();
    cancelAnimationFrame(this._raf);
    clearTimeout(this._blinkTimer);
    this.svg.remove();
  }

  // ---------------------------------------------------------------- giving

  /**
   * Let the viewer drag props with the mouse or a finger. When a prop is
   * dragged near the goat, he takes it, says thanks, names it and puts it
   * back where it was picked up. During askFor() he also checks that it is
   * the prop he asked for.
   * options.reach: how close (stage units from the face) counts as near.
   */
  enableDragging(on = true, { reach } = {}) {
    this._dragOn = on;
    if (reach) this._reach = reach;
    for (const p of Object.values(this.props)) this._dragStyle(p);
  }

  /**
   * Ask the viewer to give him a prop, and wait until they do.
   * options: ask (the request, default "Anna mulle <word>!"), thanks
   * (default "Kiitos!"), name (what he says while holding it up, default
   * "Tämä on <word>."), wrong (a function (givenWord, wantedWord) returning
   * what he says for the wrong prop).
   * Resolves to { given: true } when the right prop arrives, or
   * { given: false } if cancelAsk() is called first.
   */
  async askFor(id, options = {}) {
    const want = this._prop(id);
    this.cancelAsk();
    this.enableDragging(true);
    const ask = options.ask ?? `Anna mulle ${want.label}!`;
    const asking = (this._asking = { id, options, ask });
    const done = new Promise(r => { asking.resolve = r; });
    await this.setEmotion('happy');
    this._reachOut();
    this.say(ask, { hold: Infinity });
    return done;
  }

  /**
   * Eat a prop: bring it to the mouth on the palm, take three bites, chew,
   * swallow and say "Nam nam!". The prop is removed. options.say: what he
   * says afterwards (false for nothing).
   */
  async eat(id, { hand: side, say = 'Nam nam!' } = {}) {
    const prop = this._prop(id);
    if (!prop.holder) await this.pickUp(id, { hand: side });
    const hand = prop.holder;
    if (!hand) return;
    this._eating = true;
    const s = this.goat.s, dir = hand.side === 'right' ? 1 : -1;
    const half = prop.bottomOffset * prop.scale;
    // Hold it beside the mouth, its near edge just over the mouth.
    const mouth = this._g(256, 378);
    this._setPose(hand, 'palm-up');
    await this._moveHand(hand, this._handForPalm(hand, prop, { x: mouth.x + dir * (half + 46 * s), y: mouth.y + 22 * s }, -6), 450);
    this.lookAt(prop.id, { ms: 150 });
    this._showVariant('eyes', 'wide');
    this._showVariant('brows', 'raised');
    // Bite marks are cut out of the prop with a mask, from the side facing the mouth.
    const mask = this._biteMask(prop);
    const h = prop.bottomOffset;  // prop units
    const bites = [[-0.55, -0.15, 0.42], [-0.4, 0.35, 0.5], [0.05, 0, 0.95]];
    for (let i = 0; i < bites.length; i++) {
      this._showVariant('mouth', 'chomp');
      await this._tween(this.goat, { tilt: dir * 5 }, 160, EASE.out);
      await this.wait(90);
      const [bx, by, r] = bites[i];
      this._addBite(mask, bx * h * dir, by * h, r * h);   // bx < 0 is the side nearest the mouth
      this._showVariant('mouth', 'chew-a');
      this._sfx('chomp');
      this._crumbs(this._heldCentre(prop), dir, prop.scale);
      this._tween(this.goat, { tilt: 0, squash: 0.97 }, 120, EASE.out).then(() => this._tween(this.goat, { squash: 1 }, 120));
      await this.wait(260);
    }
    this.removeProp(id);
    this._setPose(hand, 'open');
    this.rest(hand.side);
    this.lookAt(null);
    // Chew with full cheeks.
    this._showVariant('eyes', 'happy');
    this._showVariant('brows', 'none');
    this._showVariant('jowls', 'on');
    for (let i = 0; i < 6; i++) {
      this._showVariant('mouth', i % 2 ? 'chew-b' : 'chew-a');
      this._sfx('munch', 0.8);
      await this._tween(this.goat, { squash: i % 2 ? 1 : 0.975, tilt: i % 2 ? 2 : -2 }, 150);
    }
    // Swallow.
    this._showVariant('jowls', 'off');
    this._showVariant('mouth', 'viseme-m');
    this._sfx('gulp');
    await this._tween(this.goat, { bob: 10 * s, tilt: 0, squash: 1 }, 140, EASE.out);
    await this._tween(this.goat, { bob: 0 }, 180);
    this._showVariant('mouth', 'lick');
    await this.wait(550);
    this._eating = false;
    await this.setEmotion('veryHappy', { ms: 150 });
    if (say) await this.say(say, { hold: 300 });
  }

  _biteMask(prop) {
    const id = `${this._prefix}bite-${prop.id}-${Math.random().toString(36).slice(2, 7)}`;
    const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -400, y: -400, width: 800, height: 800 });
    mask.appendChild(el('rect', { x: -400, y: -400, width: 800, height: 800, fill: '#fff' }));
    this.svg.querySelector('defs').appendChild(mask);
    prop.el.firstChild.setAttribute('mask', `url(#${id})`);
    prop.mask = mask;
    return mask;
  }

  // Cut one bite (a circle with two tooth notches on its rim) out of the prop.
  _addBite(mask, x, y, r) {
    const g = el('g', { fill: '#000' });
    g.appendChild(el('circle', { cx: x, cy: y, r }));
    for (const a of [-0.5, 0.5]) {
      const ang = Math.atan2(-y, -x) + a;   // notches on the inner side of the bite
      g.appendChild(el('circle', { cx: x + Math.cos(ang) * r, cy: y + Math.sin(ang) * r, r: r * 0.28 }));
    }
    mask.appendChild(g);
  }

  // A few crumbs that fall from a bite.
  _crumbs(at, dir, scale) {
    for (let i = 0; i < 5; i++) {
      const c = el('circle', { r: 3 + Math.random() * 4, fill: '#fff', stroke: '#111', 'stroke-width': 3 });
      this.layers.foreground.appendChild(c);
      const p = { x: at.x - dir * 30 * scale, y: at.y, rot: 0 };
      const vx = -dir * (20 + Math.random() * 60), up = 20 + Math.random() * 40, fall = 120 + Math.random() * 80;
      const place = () => c.setAttribute('transform', `translate(${p.x} ${p.y})`);
      place();
      const t0 = performance.now(), dur = 600;
      const step = now => {
        const t = Math.min(1, (now - t0) / dur);
        p.x = at.x - dir * 30 * scale + vx * t;
        p.y = at.y - up * 4 * t * (1 - t) + fall * t * t;
        place();
        c.setAttribute('opacity', 1 - t * t);
        if (t < 1) requestAnimationFrame(step); else c.remove();
      };
      requestAnimationFrame(step);
    }
  }

  /**
   * Throw a prop over his shoulder and off the stage, then remove it.
   * If the prop is not held, he picks it up first.
   */
  async throwAway(id, { hand: side } = {}) {
    const prop = this._prop(id);
    if (!prop.holder) await this.pickUp(id, { hand: side });
    const hand = prop.holder;
    if (!hand) return;
    this.lookAt(null);
    await this.setEmotion('determined', { ms: 120 });
    // Wind up beside the head, then swing over it.
    await this._moveHand(hand, this._handPlace(hand, 'windUp'), 320, EASE.out);
    this._sfx('whoosh', 1);
    const swing = this._moveHand(hand, this._handPlace(hand, 'throw'), 220, EASE.in);
    await this.wait(120);
    // Let go: the prop keeps its stage position and flies on by itself.
    const start = this._heldCentre(prop);
    this._detach(prop, start, { sound: false });
    this._setPose(hand, 'open');
    const away = hand.side === 'right' ? -1 : 1;  // over the opposite shoulder
    const endX = away < 0 ? -260 : this.options.width + 260;
    const apexY = Math.min(start.y - 40, this._g(0, -60).y);  // just above the horns
    const endY = this._g(0, 380).y;
    const flight = Promise.all([
      this._tween(prop, { x: endX, rot: (prop.rot || 0) + away * 620, scale: prop.scale * 0.55 }, 1200, EASE.linear),
      (async () => {
        await this._tween(prop, { y: apexY }, 520, EASE.out);
        this.layers.behind.appendChild(prop.el);  // from here on it passes behind him
        await this._tween(prop, { y: endY }, 680, EASE.in);
      })(),
    ]);
    await swing;
    this.setEmotion('wink');
    this.rest(hand.side);
    await flight;
    this.removeProp(id);
  }

  /**
   * Add a prop that falls from above the stage and lands with its centre at
   * x, y (or its lowest point at bottom). Returns the prop id.
   */
  async dropIn(type, { id, x = 900, y, bottom, scale } = {}) {
    id = this.addProp(type, { id, x, y: y ?? 0, bottom, scale });
    const prop = this.props[id];
    const landY = prop.y;
    const lean = (Math.random() - 0.5) * 30;
    Object.assign(prop, { y: -160, rot: lean });
    await this._tween(prop, { y: landY, rot: 0 }, 520, EASE.in);
    this._sfx('drop');
    await this._tween(prop, { y: landY - 26 * prop.scale }, 150, EASE.out);
    await this._tween(prop, { y: landY }, 150, EASE.in);
    this._sfx('drop', 0.4);
    return id;
  }

  /** Stop waiting for a prop asked for with askFor(). */
  cancelAsk() {
    const a = this._asking;
    if (!a) return;
    this._asking = null;
    this.hideBubble();
    a.resolve({ given: false });
    if (!this._receiving) this.rest();
  }

  _dragStyle(prop) {
    prop.el.style.cursor = this._dragOn ? 'grab' : '';
    prop.el.style.touchAction = this._dragOn ? 'none' : '';
  }

  _stagePoint(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  }

  // Pointer handling. A press on a prop becomes a click if the pointer
  // hardly moves, or a drag once it moves more than a few units.
  // Lesson hooks (all optional):
  //   onPropClick(prop)            a prop was clicked or tapped
  //   canDrag(prop) -> bool        whether this prop may be dragged now
  //   canReceive(prop) -> bool     whether he takes it when it comes near him
  //   onDrop(prop, point, from)    let go away from him; return true to keep it
  //                                where it is (the hook then moves it), false
  //                                to let it slide back
  //   onGiven(prop, hand, from)    replaces his response after taking a prop
  _dragStart(e) {
    if (this._press || this._drag || this._receiving) return;
    const node = e.target.closest?.('[data-prop-id]');
    const prop = node && this.props[node.dataset.propId];
    if (!prop || prop.holder) return;
    const draggable = this._dragOn && prop.draggable !== false && (this.canDrag ? this.canDrag(prop) : true);
    if (!draggable && !this.onPropClick) return;
    e.preventDefault();
    const p = this._stagePoint(e);
    this._press = { prop, pointer: e.pointerId, start: p, draggable, dx: prop.x - p.x, dy: prop.y - p.y, from: { x: prop.x, y: prop.y } };
    try { this.svg.setPointerCapture(e.pointerId); } catch {}
  }

  _receivable(prop) {
    return this.canReceive ? !!this.canReceive(prop) : true;
  }

  _dragMove(e) {
    const pr = this._press;
    if (!pr || e.pointerId !== pr.pointer) return;
    const p = this._stagePoint(e);
    if (!this._drag) {
      if (!pr.draggable || Math.hypot(p.x - pr.start.x, p.y - pr.start.y) < 6) return;
      this._drag = pr;
      const prop = pr.prop;
      this.svg.style.cursor = 'grabbing';
      this.layers.props.appendChild(prop.el);  // draw it above the other props
      prop.dragScale = prop.scale;
      this._tween(prop, { scale: prop.scale * 1.08 }, 120, EASE.out);
      this._sfx('grab', 0.5);
      this.lookAt(prop.id, { ms: 120 });
      if (this._receivable(prop)) this._reachOut();
    }
    const d = this._drag;
    d.prop.x = p.x + d.dx;
    d.prop.y = p.y + d.dy;
    this.lookAt(d.prop.id, { ms: 60 });
    if (this._receivable(d.prop) && this._isNear(d.prop)) this._take(d);
  }

  _dragEnd(e) {
    const pr = this._press;
    if (!pr || e.pointerId !== pr.pointer) return;
    this._press = null;
    try { this.svg.releasePointerCapture(e.pointerId); } catch {}
    if (!this._drag) {
      this.onPropClick?.(pr.prop);
      return;
    }
    const d = this._drag;
    this._drag = null;
    this.svg.style.cursor = '';
    const prop = d.prop;
    if (this._receivable(prop) && this._isNear(prop)) { this._take(d); return; }
    if (this.onDrop && this.onDrop(prop, { x: prop.x, y: prop.y }, d.from)) {
      this._tween(prop, { scale: d.prop.dragScale }, 120);
      return;
    }
    // Let go too far away: the prop slides back.
    this._tween(prop, { x: d.from.x, y: d.from.y, scale: d.prop.dragScale }, 350, EASE.inOut)
      .then(() => this._sfx('drop', 0.5));
    this.lookAt(null);
    if (!this._asking) this.rest();
  }

  _isNear(prop) {
    const face = this._g(256, 320);
    const reach = this._reach ?? 300 * this.goat.s;
    if (Math.hypot(prop.x - face.x, prop.y - face.y) < reach) return true;
    const hand = Object.values(this.hands).find(h => !h.holding && h.pose === 'open');
    return !!hand && Math.hypot(prop.x - hand.x, prop.y - hand.y) < 90 * this.goat.s * hand.scale;
  }

  _reachOut() {
    const hand = this._freeHand('right');
    if (!hand) return;
    this._setPose(hand, 'open');
    this._moveHand(hand, this._handPlace(hand, 'ask'), 350);
  }

  // The prop was brought near: take it from the viewer and respond.
  async _take(d) {
    if (this._receiving) return;
    this._drag = null;
    this._press = null;
    try { this.svg.releasePointerCapture(d.pointer); } catch {}
    this.svg.style.cursor = '';
    const prop = d.prop;
    this._tween(prop, { scale: prop.dragScale }, 0);
    const hand = this._freeHand('right');
    if (!hand) {
      this._tween(prop, { x: d.from.x, y: d.from.y }, 350);
      return;
    }
    this._receiving = true;
    try {
      const gripWorld = { x: prop.x + prop.grip[0] * prop.scale, y: prop.y + prop.grip[1] * prop.scale };
      this._setPose(hand, 'open');
      await this._moveHand(hand, this._handAt(hand, gripWorld, -90), 220, EASE.out);
      this._setPose(hand, 'grip');
      this._attach(prop, hand);
      if (this.onGiven) await this.onGiven(prop, hand, d.from);
      else await this._respond(prop, hand, d.from);
    } finally {
      this._receiving = false;
    }
  }

  async _respond(prop, hand, home) {
    const asking = this._asking;
    const right = !asking || asking.id === prop.id;
    const o = asking?.options || {};
    const wanted = asking && this.props[asking.id];
    await this.holdUp({ hand: hand.side, ms: 380 });
    this.lookAt(prop.id);
    if (right) {
      await this.setEmotion('veryHappy');
      await this.say(o.thanks ?? 'Kiitos!', { hold: 150 });
      this.lookAt(null);
      await this.say(o.name ?? `Tämä on ${prop.label}.`, { hold: 300 });
    } else {
      await this.setEmotion('confused');
      const wrong = o.wrong ? o.wrong(prop.label, wanted.label) : `Kiitos, mutta tämä on ${prop.label}.`;
      await this.say(wrong, { hold: 300 });
      await this.shake();
    }
    // onReceive decides whether he puts the prop back, eats it or throws it away.
    const action = this.onReceive?.(prop, { asked: asking?.id ?? null, right }) || 'return';
    if (action === 'eat' || action === 'throw') {
      const id = prop.id;
      if (action === 'eat') await this.eat(id, { hand: hand.side });
      else await this.throwAway(id, { hand: hand.side });
      await this.onGone?.(id, home, action);
    } else {
      await this.putDown(home, { hand: hand.side });
    }
    if (right && asking) {
      if (this._asking === asking) this._asking = null;
      await this.setEmotion('happy');
      asking.resolve({ given: true });
    } else if (asking && this._asking === asking) {
      await this.setEmotion('happy');
      this._reachOut();
      this.say(asking.ask, { hold: Infinity });
    } else {
      await this.setEmotion('happy');
    }
  }

  // ---------------------------------------------------------------- internals

  _sfx(name, strength) {
    this.sound?.play(name, strength);
  }

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
    if (hand.holding && !HOLDING_POSES.includes(pose)) throw new Error('Put the prop down before changing this hand\'s pose');
    for (const [name, node] of Object.entries(hand.poses)) node.style.display = name === pose ? '' : 'none';
    hand.pose = pose;
    if (hand.holding) {
      hand.slots[pose].appendChild(hand.holding.el);
      this._placeProp(hand.holding);
    }
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
    const dist = Math.hypot(to.x - hand.x, to.y - hand.y);
    if (dist > 60) this._sfx('whoosh', Math.min(1, dist / 500));
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
      if (prop.holder) return this._heldCentre(prop);
      return { x: prop.x, y: prop.y };
    }
    return target;
  }

  // Stage position of a held prop's centre.
  _heldCentre(prop) {
    const h = prop.holder;
    if (h.pose === 'palm-up') {
      const a = this._handPoint(h, PALM_ANCHOR.x, PALM_ANCHOR.y);
      return { x: a.x, y: a.y - prop.bottomOffset * prop.scale };
    }
    const a = this._handPoint(h, GRIP_ANCHOR.x, GRIP_ANCHOR.y);
    return { x: a.x - prop.grip[0] * prop.scale, y: a.y - prop.grip[1] * prop.scale };
  }

  // Hand position (palm-up pose) that puts a held prop's centre on a stage point.
  _handForPalm(hand, prop, centre, rot) {
    const off = this._handPoint(hand, PALM_ANCHOR.x, PALM_ANCHOR.y, { x: 0, y: 0, rot });
    return { x: centre.x - off.x, y: centre.y + prop.bottomOffset * prop.scale - off.y, rot };
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
    this._sfx('grab');
    prop.holder = hand;
    hand.holding = prop;
    hand.slots[HOLDING_POSES.includes(hand.pose) ? hand.pose : 'grip'].appendChild(prop.el);
  }

  _detach(prop, at, { sound = true } = {}) {
    if (sound) this._sfx('drop');
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
      const upright = `scale(1 ${flip}) rotate(${-actual}) scale(${k})`;
      prop.el.setAttribute('transform', h.pose === 'palm-up'
        ? `${upright} translate(0 ${-prop.bottomOffset})`   // the palm slot is already at PALM_ANCHOR
        : `translate(${GRIP_ANCHOR.x} ${GRIP_ANCHOR.y}) ${upright} translate(${-prop.grip[0]} ${-prop.grip[1]})`);
    } else {
      prop.el.setAttribute('transform', `translate(${prop.x} ${prop.y}) rotate(${prop.rot || 0}) scale(${prop.scale})`);
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
    this._sfx('pop');
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
