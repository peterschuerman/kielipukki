// Drawings for lesson scenes, in the same style as Kielipukki: thick black
// outlines and flat fills. Each function returns SVG markup centred on 0,0
// plus the measurements a lesson needs (half height, anchor points).
// All sizes are in stage units at scale 1.

const INK = '#111';

/** A cardboard box, open at the top. size: { w, h }. */
export function box({ w, h }) {
  const sw = 8, top = -h / 2, rim = Math.max(10, h * 0.16), inset = w * 0.08;
  const markup = `
    <path d="M${-w / 2 - 4} ${top + rim} L${-w / 2 - w * 0.16} ${top - rim * 0.6} L${-w / 2 + inset} ${top} Z"
      fill="#c99556" stroke="${INK}" stroke-width="${sw * 0.8}" stroke-linejoin="round"/>
    <path d="M${w / 2 + 4} ${top + rim} L${w / 2 + w * 0.16} ${top - rim * 0.6} L${w / 2 - inset} ${top} Z"
      fill="#c99556" stroke="${INK}" stroke-width="${sw * 0.8}" stroke-linejoin="round"/>
    <path d="M${-w / 2} ${top + rim} L${-w / 2 + inset} ${top} L${w / 2 - inset} ${top} L${w / 2} ${top + rim} Z"
      fill="#6b4422" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
    <rect x="${-w / 2}" y="${top + rim}" width="${w}" height="${h - rim}" rx="5"
      fill="#dcaa6a" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M${-w * 0.12} ${top + rim + 4} V${top + rim + (h - rim) * 0.35} M${w * 0.12} ${top + rim + 4} V${top + rim + (h - rim) * 0.35}"
      stroke="#b98543" stroke-width="${Math.max(4, w * 0.04)}" stroke-linecap="round"/>`;
  return { markup, half: h / 2, halfW: w / 2, top: top };
}

/** A price tag hanging at (x, y), e.g. "12 €". */
export function priceTag(text, x, y) {
  const w = 18 + text.length * 15, h = 34;
  return `
    <g transform="translate(${x} ${y}) rotate(-8)">
      <path d="M0 0 L12 ${-h / 2} H${w} V${h / 2} H12 Z" fill="#fff6d6" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="12" cy="0" r="4" fill="${INK}"/>
      <text x="${18 + (w - 18) / 2}" y="9" text-anchor="middle" font-family="Nunito, 'Trebuchet MS', sans-serif"
        font-size="24" font-weight="900" fill="${INK}">${text}</text>
    </g>`;
}

/** A row of three stars below an item; `n` of them are filled. */
export function stars(n, y) {
  const star = (cx, on) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 16, a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${on ? '#f5c542' : '#fff'}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  };
  return star(-36, n >= 1) + star(0, n >= 2) + star(36, n >= 3);
}

/**
 * A small reader's face above an item, showing how interesting it is:
 * 0 asleep (bored), 1 neutral, 2 fascinated.
 */
export function readerFace(level, x, y) {
  const face = `<circle cx="0" cy="0" r="24" fill="#f3d9c2" stroke="${INK}" stroke-width="5"/>`;
  const parts = [
    // asleep: closed eyes, flat mouth, "z z"
    `<path d="M-13 -3 Q-8 1 -3 -3 M3 -3 Q8 1 13 -3" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
     <path d="M-7 11 H7" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
     <text x="22" y="-18" font-family="Nunito, sans-serif" font-size="20" font-weight="900" fill="${INK}">z</text>
     <text x="34" y="-32" font-family="Nunito, sans-serif" font-size="15" font-weight="900" fill="${INK}">z</text>`,
    // neutral
    `<circle cx="-8" cy="-4" r="3.5" fill="${INK}"/><circle cx="8" cy="-4" r="3.5" fill="${INK}"/>
     <path d="M-7 10 Q0 13 7 10" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    // fascinated: wide eyes, open mouth, sparkles
    `<circle cx="-8" cy="-5" r="6" fill="${INK}"/><circle cx="8" cy="-5" r="6" fill="${INK}"/>
     <circle cx="-6" cy="-7" r="2" fill="#fff"/><circle cx="10" cy="-7" r="2" fill="#fff"/>
     <ellipse cx="0" cy="11" rx="5" ry="6" fill="${INK}"/>
     <path d="M30 -26 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z M-34 -20 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#f5c542" stroke="${INK}" stroke-width="2"/>`,
  ];
  return `<g transform="translate(${x} ${y})">${face}${parts[level]}</g>`;
}

const SKIN = '#f3d9c2';

/**
 * A person standing, in goat style. kind: 'isa' | 'aiti' | 'poika' | 'tytto'
 * | 'vauva'. height: stage units. Returns markup centred on 0,0, its half
 * height, and anchor points for a hat (`head`, the top of the head) and a
 * held thing (`hand`, the viewer's right hand).
 */
export function person({ kind, height: H, shirt = '#3e63dd', pants = '#3a3f4b', hair = '#5a3a1e', asleep = false }) {
  const kid = kind === 'poika' || kind === 'tytto' || kind === 'vauva';
  const sw = 6;
  const headR = H * (kind === 'vauva' ? 0.2 : kid ? 0.15 : 0.12);
  const top = -H / 2;
  const hy = top + headR;                       // head centre
  const bodyTop = top + headR * 2 + 2;
  const bodyH = H * (kind === 'vauva' ? 0.36 : 0.37);
  const bodyBottom = bodyTop + bodyH;
  const bw = H * (kind === 'vauva' ? 0.42 : kid ? 0.32 : 0.28);
  const feetY = H / 2 - 7;
  const legW = bw * 0.3, legX = bw * 0.2;
  const shoulderY = bodyTop + 12, handY = bodyBottom - 6, handX = bw / 2 + 10;
  const arm = sx => `M${sx * (bw / 2 - 6)} ${shoulderY} L${sx * handX} ${handY}`;

  let hairBack = '', hairFront = '', extra = '';
  if (kind === 'aiti') {
    hairBack = `<path d="M${-headR * 1.1} ${hy} C ${-headR * 1.3} ${hy + headR * 2}, ${-headR * 0.4} ${hy + headR * 2.2}, 0 ${hy + headR * 1.6}
                 C ${headR * 0.4} ${hy + headR * 2.2}, ${headR * 1.3} ${hy + headR * 2}, ${headR * 1.1} ${hy} Z"
                 fill="${hair}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    hairFront = `<path d="M${-headR * 1.02} ${hy + 2} C ${-headR} ${hy - headR * 1.3}, ${headR} ${hy - headR * 1.3}, ${headR * 1.02} ${hy + 2}
                  C ${headR * 0.5} ${hy - headR * 0.5}, ${-headR * 0.3} ${hy - headR * 0.7}, ${-headR * 1.02} ${hy + 2} Z"
                  fill="${hair}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  } else if (kind === 'tytto') {
    hairBack = [-1, 1].map(sx => `<ellipse cx="${sx * headR * 1.15}" cy="${hy + headR * 0.3}" rx="${headR * 0.35}" ry="${headR * 0.6}"
                 fill="${hair}" stroke="${INK}" stroke-width="${sw}"/>`).join('');
    hairFront = `<path d="M${-headR * 1.02} ${hy} C ${-headR} ${hy - headR * 1.3}, ${headR} ${hy - headR * 1.3}, ${headR * 1.02} ${hy}
                  C ${headR * 0.6} ${hy - headR * 0.6}, ${-headR * 0.6} ${hy - headR * 0.6}, ${-headR * 1.02} ${hy} Z"
                  fill="${hair}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  } else if (kind === 'vauva') {
    hairFront = `<path d="M-4 ${hy - headR + 2} C -2 ${hy - headR - 12}, 8 ${hy - headR - 12}, 6 ${hy - headR - 4}" fill="none" stroke="${INK}" stroke-width="${sw * 0.8}" stroke-linecap="round"/>`;
  } else {
    // isä and poika: short hair
    const spikes = kind === 'poika';
    hairFront = `<path d="M${-headR * 1.02} ${hy - 2} C ${-headR * 1.05} ${hy - headR * 1.25}, ${headR * 1.05} ${hy - headR * 1.25}, ${headR * 1.02} ${hy - 2}
                  ${spikes ? `L${headR * 0.6} ${hy - headR * 0.55} L${headR * 0.25} ${hy - headR * 0.8} L${-headR * 0.1} ${hy - headR * 0.55} L${-headR * 0.5} ${hy - headR * 0.8} L${-headR * 0.75} ${hy - headR * 0.5}` : `C ${headR * 0.4} ${hy - headR * 0.6}, ${-headR * 0.4} ${hy - headR * 0.6}, ${-headR * 1.02} ${hy - 2}`} Z"
                  fill="${hair}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    if (kind === 'isa') extra = `<path d="M${-headR * 0.42} ${hy + headR * 0.42} Q 0 ${hy + headR * 0.22} ${headR * 0.42} ${hy + headR * 0.42} Q 0 ${hy + headR * 0.6} ${-headR * 0.42} ${hy + headR * 0.42} Z" fill="${hair}" stroke="${INK}" stroke-width="${sw * 0.6}" stroke-linejoin="round"/>`;
  }

  const eyeR = Math.max(3, headR * 0.1);
  const markup = `
    ${hairBack}
    <g stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round">
      <rect x="${-legX - legW / 2}" y="${bodyBottom - 6}" width="${legW}" height="${feetY - bodyBottom + 6}" rx="${legW / 2}" fill="${pants}"/>
      <rect x="${legX - legW / 2}" y="${bodyBottom - 6}" width="${legW}" height="${feetY - bodyBottom + 6}" rx="${legW / 2}" fill="${pants}"/>
      <ellipse cx="${-legX - 3}" cy="${feetY}" rx="${legW * 0.75}" ry="7" fill="${INK}"/>
      <ellipse cx="${legX + 3}" cy="${feetY}" rx="${legW * 0.75}" ry="7" fill="${INK}"/>
    </g>
    <g fill="none" stroke-linecap="round">
      <path d="${arm(-1)} ${arm(1)}" stroke="${INK}" stroke-width="${H * 0.075 + sw * 2}"/>
      <path d="${arm(-1)} ${arm(1)}" stroke="${shirt}" stroke-width="${H * 0.075}"/>
    </g>
    <rect x="${-bw / 2}" y="${bodyTop}" width="${bw}" height="${bodyH}" rx="${bw * 0.32}" fill="${shirt}" stroke="${INK}" stroke-width="${sw}"/>
    <circle cx="${-handX}" cy="${handY}" r="${H * 0.045 + 3}" fill="${SKIN}" stroke="${INK}" stroke-width="${sw * 0.8}"/>
    <circle cx="${handX}" cy="${handY}" r="${H * 0.045 + 3}" fill="${SKIN}" stroke="${INK}" stroke-width="${sw * 0.8}"/>
    <circle cx="0" cy="${hy}" r="${headR}" fill="${SKIN}" stroke="${INK}" stroke-width="${sw}"/>
    ${hairFront}
    ${asleep
      ? `<path d="M${-headR * 0.5} ${hy + headR * 0.05} q${headR * 0.14} ${headR * 0.12} ${headR * 0.28} 0 M${headR * 0.22} ${hy + headR * 0.05} q${headR * 0.14} ${headR * 0.12} ${headR * 0.28} 0"
           fill="none" stroke="${INK}" stroke-width="${sw * 0.6}" stroke-linecap="round"/>
         <text x="${headR * 0.9}" y="${hy - headR * 0.9}" font-family="Nunito, sans-serif" font-size="${Math.max(16, headR * 0.7)}" font-weight="900" fill="${INK}">z</text>
         <text x="${headR * 1.35}" y="${hy - headR * 1.45}" font-family="Nunito, sans-serif" font-size="${Math.max(12, headR * 0.5)}" font-weight="900" fill="${INK}">z</text>`
      : `<circle cx="${-headR * 0.36}" cy="${hy + headR * 0.05}" r="${eyeR}" fill="${INK}"/>
         <circle cx="${headR * 0.36}" cy="${hy + headR * 0.05}" r="${eyeR}" fill="${INK}"/>`}
    ${extra}
    <path d="M${-headR * 0.3} ${hy + headR * 0.5} Q 0 ${hy + headR * 0.72} ${headR * 0.3} ${hy + headR * 0.5}" fill="none" stroke="${INK}" stroke-width="${sw * 0.7}" stroke-linecap="round"/>`;
  return {
    markup, half: H / 2, halfW: bw / 2 + 18,
    head: { x: 0, y: top - 2 },                      // top of the head (for a hat)
    face: { x: 0, y: hy, r: headR },                 // centre of the face
    hand: { x: handX, y: handY },                    // viewer's right hand
    leftHand: { x: -handX, y: handY },
  };
}

/**
 * A small house with a door and a window. door: 'open' | 'closed'.
 * Returns markup centred on 0,0 with the door's bottom centre (`door`) and
 * the window's centre (`window`).
 */
export function house({ w = 150, h = 150, door = 'closed', roof = '#d9534f', wall = '#f1e3c6' } = {}) {
  const sw = 7, top = -h / 2, roofH = h * 0.38, bodyTop = top + roofH;
  const dw = w * 0.26, dh = (h - roofH) * 0.6, dx = w * 0.14, dy = h / 2 - dh;
  const win = { x: -w * 0.22, y: bodyTop + (h - roofH) * 0.36 }, ws = w * 0.24;
  const doorMarkup = door === 'open'
    ? `<rect x="${dx - dw / 2}" y="${dy}" width="${dw}" height="${dh}" fill="#3b2a1a" stroke="${INK}" stroke-width="${sw}"/>
       <path d="M${dx - dw / 2} ${dy} L${dx - dw / 2 - dw * 0.55} ${dy + 8} L${dx - dw / 2 - dw * 0.55} ${h / 2 - 4} L${dx - dw / 2} ${h / 2} Z" fill="#a0632e" stroke="${INK}" stroke-width="${sw * 0.8}" stroke-linejoin="round"/>`
    : `<rect x="${dx - dw / 2}" y="${dy}" width="${dw}" height="${dh}" rx="4" fill="#a0632e" stroke="${INK}" stroke-width="${sw}"/>
       <circle cx="${dx + dw * 0.25}" cy="${dy + dh * 0.55}" r="3.5" fill="${INK}"/>`;
  const markup = `
    <path d="M${-w / 2 - 12} ${bodyTop + 4} L0 ${top} L${w / 2 + 12} ${bodyTop + 4} Z" fill="${roof}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
    <rect x="${-w / 2}" y="${bodyTop}" width="${w}" height="${h - roofH}" fill="${wall}" stroke="${INK}" stroke-width="${sw}"/>
    <rect x="${win.x - ws / 2}" y="${win.y - ws / 2}" width="${ws}" height="${ws}" fill="#cfe8f7" stroke="${INK}" stroke-width="${sw * 0.8}"/>
    ${doorMarkup}`;
  return { markup, half: h / 2, halfW: w / 2 + 12, door: { x: dx, y: h / 2 }, window: { x: win.x, y: win.y, size: ws } };
}

/**
 * Markup for one of the vocabulary icons (assets/icons), fitted so its
 * larger side is `size` and centred on 0,0. extra: optional style for the
 * <image>, e.g. a filter. Returns markup and its half height.
 */
export function iconImage(href, box = [0, 0, 1, 1], size = 110, { style = '', transform = '' } = {}) {
  const [x0, y0, x1, y1] = box;
  const k = size / Math.max(x1 - x0, y1 - y0, 0.05);
  const half = ((y1 - y0) / 2) * k, halfW = ((x1 - x0) / 2) * k;
  const markup = `<image href="${href}" x="${-((x0 + x1) / 2) * k}" y="${-((y0 + y1) / 2) * k}" width="${k}" height="${k}"
    ${style ? `style="${style}"` : ''} ${transform ? `transform="${transform}"` : ''}/>`;
  return { markup, half, halfW };
}
