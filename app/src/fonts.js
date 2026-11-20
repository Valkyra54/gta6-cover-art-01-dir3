// fonts.js — loads the four OFL faces from files under app/fonts/ (never
// from the network) and waits until the canvas can actually use them.
const FACES = [
  ['Anton', '400', './fonts/Anton-Regular.ttf'],
  ['Oswald', '600', './fonts/Oswald-SemiBold.ttf'],
  ['Bebas Neue', '400', './fonts/BebasNeue-Regular.ttf'],
  ['Great Vibes', '400', './fonts/GreatVibes-Regular.ttf'],
];

let loaded = null;

export function loadFonts() {
  if (loaded) return loaded;
  loaded = (async () => {
    await Promise.all(FACES.map(async ([family, weight, url]) => {
      const face = new FontFace(family, `url(${url})`, { weight });
      document.fonts.add(await face.load());
    }));
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('600 40px Oswald'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.load('40px "Great Vibes"'),
    ]);
  })();
  return loaded;
}
