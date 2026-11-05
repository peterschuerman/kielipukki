# Kielipukki

Kielipukki is a goat character for animated Finnish language lessons. It runs in the browser as SVG (Scalable Vector Graphics) and is animated with plain JavaScript, with no libraries.

![Reference drawing next to the vector redraw](docs/compare.png)

## Run the demo

The rig is loaded with `fetch`, so the page must be served over HTTP (opening the file directly does not work):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/demo/. The buttons run each action, and "Play sample lesson" runs a short scripted lesson. In the browser console, `goat` is the character, so you can try calls such as `goat.pointAt('kuppi')`.

## Files

| Path | Contents |
| --- | --- |
| `assets/goat/rig.svg` | The character: head parts, face variants, hand poses and sample props |
| `assets/goat/reference.png` | The original drawing the rig was redrawn from |
| `src/kielipukki.js` | The controller that loads the rig and runs the actions |
| `src/emotions.js` | Emotion presets (which eyes, mouth and brows each emotion uses) |
| `demo/index.html` | Demo page and sample lesson |
| `tools/render-previews.mjs` | Renders the preview images in `docs/` |

## Writing a lesson

Every action returns a Promise, so a lesson is a sequence of `await`s:

```js
import { createKielipukki } from './src/kielipukki.js';

const goat = await createKielipukki(document.querySelector('#stage'));
goat.addProp('apple', { id: 'omena', x: 820, y: 534 });

await goat.say('Mikä tämä on?');
await goat.pointAt('omena');
await goat.setEmotion('veryHappy');
await goat.say('Tämä on omena!');
await goat.pickUp('omena');
await goat.holdUp();
await goat.putDown({ x: 820, y: 534 });
await goat.thumbsUp();
```

Actions that use different parts can run at the same time. Leave out `await` to start one without waiting, for example `goat.wave(); await goat.say('Hei!');`.

## API

The stage is 1200 x 700 units by default. "left" and "right" hands are from the viewer's side.

### Face

| Call | What it does |
| --- | --- |
| `setEmotion(name)` | Switch to an emotion preset (see below) |
| `emote(name, ms)` | Show an emotion for `ms`, then go back to the previous one |
| `blink()` | Blink once. Blinking also happens on its own every few seconds |
| `lookAt(target)` | Move the eyes toward a point `{x, y}` or a prop id; `null` looks at the viewer |
| `say(text, options)` | Show a speech bubble and move the mouth letter by letter. Options: `hold` (ms the bubble stays after talking, `Infinity` to keep it), `bubble: false`, `audio` (a URL or `<audio>` element; the mouth movement is stretched to the audio length), `letterMs` |
| `hideBubble()` | Remove the speech bubble |

Emotions: `neutral`, `happy`, `veryHappy`, `surprised`, `confused`, `thinking`, `sad`, `wink`, `determined`.

![All emotions](docs/emotions.png)

### Head

| Call | What it does |
| --- | --- |
| `nod(times)` | Nod "yes" |
| `shake(times)` | Shake the head "no" |
| `hop(height)` | Small jump |
| `moveTo(x, y)` | Move the whole character |

### Hands and props

| Call | What it does |
| --- | --- |
| `pointAt(target, options)` | Point at a point `{x, y}`, a prop id, or `'self'` (points at its own face, for "minä"). Options: `hand`, `hold` (ms before the hand goes back to rest) |
| `pickUp(propId, options)` | Move a hand to the prop, grip it and lift it. Option: `hand` |
| `putDown({x, y}, options)` | Put a held prop down with its centre at that point. Options: `hand` or `prop` |
| `holdUp()` | Lift a held prop beside the face to show it |
| `wave()` | Wave with a free hand |
| `thumbsUp()` | Thumbs up with a free hand |
| `rest(side)` | Move one hand or both back to rest. Held props stay held |
| `addProp(type, {id, x, y, scale})` | Put a prop on the stage and return its id |
| `registerProp(type, markup, {grip})` | Add a new prop type from SVG markup centred on 0,0. `grip` is the point the hand holds |
| `moveProp(id, x, y, {ms})`, `removeProp(id)` | Move or remove a prop |
| `wait(ms)` | Pause in a lesson script |

![Hand poses and sample props](docs/hands.png)

### Layers

`goat.layers` has `background`, `goat`, `props`, `hands`, `bubble` and `foreground` groups. Lessons can draw their own scenery into `background` and `foreground`.

## How the rig is built

`assets/goat/rig.svg` is one SVG file that can be opened and edited in any vector editor (Inkscape, Illustrator, Figma). The controller finds parts by their attributes, not by their position in the file, so parts can be redrawn as long as the attributes stay:

- `[data-part]` is a part that moves or changes: `horns`, `ear-l`, `ear-r`, `beard`, `head`, `cheeks`, `brows`, `eyes`, `nose`, `mouth`.
- `[data-variant]` is one drawing of a part. The controller shows one variant of each part at a time. To add a new mouth shape, add a `<g data-variant="...">` inside the mouth part and refer to it from an emotion in `src/emotions.js`.
- `[data-gaze]` marks eye variants that move toward what the goat looks at.
- `#hand-template` holds one hand with every pose (`[data-pose]`), with the fingers pointing right. The controller copies it for each hand and mirrors the left one. In the `grip` pose, a held prop is placed in `[data-slot="held"]`, between the palm and the curled fingers.
- `#props-library` holds the sample props. Each has `data-grip="x y"`, the point the hand holds it by.

The head uses a 512 x 600 box, the same size as the reference image. Hands and props use the same units.

Mouth shapes for talking are named `viseme-a`, `viseme-e`, `viseme-o`, `viseme-u` and `viseme-m`. `say()` chooses one for each letter (a/ä, e/i/y, o/ö, u, m/p/b).

![Talking mouth shapes](docs/visemes.png)

To regenerate the images in `docs/` after editing the rig (needs Node.js and Playwright):

```bash
node tools/render-previews.mjs
```
