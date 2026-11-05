// Registers the vocabulary icons in assets/icons as prop types, so the goat
// can point at them and pick them up:
//
//   const words = await registerIcons(goat);
//   goat.addProp('omena', { x: 800, y: 530 });   // type = word id
//   await goat.say(`Tämä on ${words.omena.fi}.`);
//
// Each prop type is named by the word's id in icons.json (the Finnish word in
// lowercase ASCII, e.g. "pöytä" -> "poyta"). Words with two pictures
// (käsi, jalka, mee pois) use the first one; the second is registered as
// "<id>-2".

export async function registerIcons(goat, options = {}) {
  const needsBase = !options.words || !options.hrefFor;
  const base = needsBase ? (options.base || new URL('../assets/icons/', import.meta.url)) : null;
  const words = options.words || await (await fetch(new URL('icons.json', base))).json();
  const byId = {};
  for (const w of words) {
    byId[w.id] = w;
    w.files.forEach((file, i) => {
      const href = options.hrefFor ? options.hrefFor(file) : new URL(file, base).href;
      goat.registerImageProp(i === 0 ? w.id : `${w.id}-${i + 1}`, href, {
        size: options.size || 120, box: w.boxes?.[i], label: w.fi,
      });
    });
  }
  return byId;
}
