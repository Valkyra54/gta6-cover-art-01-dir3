// cover.js — the cover painter. Everything the poster is made of lives
// here: the posterize that turns a real photo into a flat 2-3 tone print,
// the warm tonal-band grade for the small real photos, the seeded grain,
// and the one big title. No drawing of scenes from scratch: the photo
// supplies the depth, the light and the texture; the canvas only cuts it
// into flat tones and sets type on top of it.
import { coverRect, containRect } from './photos.js';

export const FIELDS = {
  mustard: { field: '#e9a319', ink: '#14101f', paper: '#f6efdd', title: '#14101f', tag: '#14101f' },
  red: { field: '#d42b1e', ink: '#14101f', paper: '#f6efdd', title: '#f6efdd', tag: '#f6efdd' },
  teal: { field: '#7a4a3c', ink: '#14101f', paper: '#f6efdd', title: '#f6efdd', tag: '#f6efdd' },
  bone: { field: '#f2ead8', ink: '#14101f', paper: '#ffffff', title: '#14101f', tag: '#14101f' },
};

export const GRADE = {
  shadow: [43, 21, 72],
  mid: [177, 58, 122],
  highlight: [255, 179, 71],
  contrast: 1.1,
};

// A fixed-seed generator, so the grain tile is byte-identical on every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
export function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const rand = mulberry32(20261120);
  const tile = document.createElement('canvas');
  tile.width = 128; tile.height = 128;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(tile, 'repeat');
  return grainTile;
}

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Warmth of the accent, driven by the Sunset slider: amber at 0, hot pink
// at 100. Neon off pins the accent to flat amber with no glow.
export function accentFor(state) {
  const s = state.sunset / 100;
  const amber = [255, 179, 71];
  const pink = [255, 46, 136];
  const c = amber.map((v, i) => Math.round(v + (pink[i] - v) * s));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function accentRgb(state) {
  return accentFor(state).match(/[0-9]+/g).map(Number);
}

// Turns a photo into a flat screen print: shadows become ink, midtones
// paper, warm highlights the accent, bright sky drops out to transparent
// so the flat field shows through. `mode: 'ink'` keeps ink only — a pure
// silhouette for the giant shadow. Posterized at 480 px wide, so the print
// has a deliberate chunky edge when it is blown up. `fade` dissolves the
// print's own rectangular edges into the field (fractions of its size);
// the blade fill and the shadow never fade.
export function posterizePrint(img, state, mode, fade) {
  const PW = 480;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const ph = Math.max(2, Math.round((PW * ih) / iw));
  const c = document.createElement('canvas');
  c.width = PW; c.height = ph;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, PW, ph);
  const data = x.getImageData(0, 0, PW, ph);
  const px = data.data;
  const t = 0.3 + (state.threshold / 100) * 0.4;
  const sp = state.tones === 3 ? 0.1 : 0;
  const ink = hexRgb(FIELDS[state.field].ink);
  const paper = hexRgb(FIELDS[state.field].paper);
  const accent = state.neon ? accentRgb(state) : [255, 179, 71];
  const f = fade || { l: 0, r: 0, t: 0, b: 0 };
  for (let row = 0; row < ph; row++) {
    for (let col = 0; col < PW; col++) {
      const i = (row * PW + col) * 4;
      const r = px[i]; const g = px[i + 1]; const b = px[i + 2];
      const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const warm = (r - b) / 255;
      let out = null;
      // Figure cut: the hero photo's figure (skin, tan coat, bag) is
      // desaturated warm, its backdrop saturated red, and the two barely
      // differ in luminance — so luminance alone cannot cut the figure
      // out. Chroma does: ink where the red-green gap is small and the
      // pixel is not near-black; the saturated red wall drops out.
      if (mode === 'inkFigure') { if (L > 0.10 && (r - g) / 255 < 0.22) out = ink; }
      else if (mode === 'blade' && L < t - sp && warm > 0.26) out = null;
      else if (L < t - sp) out = ink;
      else if (mode !== 'ink' && L < t + sp) out = paper;
      else if (mode !== 'ink' && warm > 0.26 && L < 0.68) out = accent;
      if (!out) { px[i + 3] = 0; continue; }
      px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2];
      let a = 255;
      if (f.l) a = Math.min(a, 255 * smooth(0, f.l, col / PW));
      if (f.r) a = Math.min(a, 255 * smooth(0, f.r, (PW - 1 - col) / PW));
      if (f.t) a = Math.min(a, 255 * smooth(0, f.t, row / ph));
      if (f.b) a = Math.min(a, 255 * smooth(0, f.b, (ph - 1 - row) / ph));
      px[i + 3] = Math.round(a);
    }
  }
  x.putImageData(data, 0, 0);
  return c;
}

// The warm tonal-band grade for the small real photos: contrast first,
// then luminance bands — shadows to deep purple, midtones to magenta,
// highlights to hot amber — with a whisper of the photo's own colour kept
// so a face stays a face. The Sunset slider sets how warm the wash is.
export function gradePhoto(img, maxW, state) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const w = Math.min(maxW, iw);
  const h = Math.round((w * ih) / iw);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const data = x.getImageData(0, 0, w, h);
  const px = data.data;
  const warm = state.sunset / 100;
  const [sr, sg, sb] = GRADE.shadow;
  const [mr, mg, mb] = GRADE.mid;
  const [hr, hg, hb] = GRADE.highlight;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i]; let g = px[i + 1]; let b = px[i + 2];
    r = Math.min(255, Math.max(0, (r - 128) * GRADE.contrast + 128));
    g = Math.min(255, Math.max(0, (g - 128) * GRADE.contrast + 128));
    b = Math.min(255, Math.max(0, (b - 128) * GRADE.contrast + 128));
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const s1 = smooth(0.02, 0.45, L);
    const s2 = smooth(0.45, 0.85, L);
    let br = sr + (mr - sr) * s1; let bg = sg + (mg - sg) * s1; let bb = sb + (mb - sb) * s1;
    br += (hr - br) * s2; bg += (hg - bg) * s2; bb += (hb - bb) * s2;
    const keep = 0.18;
    px[i] = br * (1 - keep) + r * keep + warm * 14 * (1 - L);
    px[i + 1] = bg * (1 - keep) + g * keep;
    px[i + 2] = bb * (1 - keep) + b * keep - warm * 10 * (1 - L);
  }
  x.putImageData(data, 0, 0);
  return c;
}

function smooth(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// One title, auto-fit to the box width, Anton all caps. Neon on draws the
// accent as an offset echo behind the title first, then the title itself.
export function drawTitle(ctx, text, box, color, accent, neon, maxSize) {
  const clean = (text || 'UNTITLED').toUpperCase();
  let size = maxSize;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fit = (s) => {
    ctx.font = `${s}px Anton, 'Arial Narrow', sans-serif`;
    return ctx.measureText(clean).width;
  };
  while (size > 24 && fit(size) > box.w) size -= 2;
  const cx = box.x + box.w / 2;
  const baseline = box.y + box.h * 0.82;
  if (neon) {
    ctx.save();
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = size * 0.12;
    ctx.fillText(clean, cx + size * 0.045, baseline + size * 0.045);
    ctx.restore();
  }
  ctx.save();
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  ctx.shadowColor = 'rgba(10,6,20,0.55)';
  ctx.shadowBlur = size * 0.06;
  ctx.shadowOffsetY = size * 0.02;
  ctx.fillStyle = color;
  ctx.fillText(clean, cx, baseline);
  ctx.restore();
  return size;
}

export function drawTagline(ctx, text, x, y, w, color, size) {
  const clean = (text || '').toUpperCase();
  if (!clean) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  let s = size;
  const set = (v) => {
    ctx.font = `${v}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(v * 0.28)}px`; } catch (e) { /* older canvas */ }
  };
  set(s);
  while (s > 10 && ctx.measureText(clean).width > w) { s -= 1; set(s); }
  ctx.fillText(clean, x + w / 2, y);
  ctx.restore();
}

export function drawCredits(ctx, text, x, y, w, color, size) {
  const clean = (text || '').toUpperCase();
  if (!clean) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  let s = size;
  const set = (v) => {
    ctx.font = `600 ${v}px Oswald, 'Arial Narrow', sans-serif`;
    try { ctx.letterSpacing = `${Math.round(v * 0.22)}px`; } catch (e) { /* older canvas */ }
  };
  set(s);
  while (s > 8 && ctx.measureText(clean).width > w) { s -= 1; set(s); }
  ctx.globalAlpha = 0.85;
  ctx.fillText(clean, x + w / 2, y);
  ctx.restore();
}

// The round "01" badge, top right on every cover, so the three layouts
// read as one series.
export function drawBadge(ctx, W, color) {
  const r = Math.round(W * 0.026);
  const cx = W - r - Math.round(W * 0.035);
  const cy = r + Math.round(W * 0.035);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(r * 0.95)}px Oswald, 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('01', cx, cy + r * 0.04);
  ctx.restore();
}

export function applyGrain(ctx, W, H) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export { coverRect, containRect };

// Builds (and caches) everything a draw needs: the loaded photos, their
// posterized prints, and the graded small photos. The cache key covers
// every state value the prints depend on.
import { loadPhoto } from './photos.js';
import { layoutA, layoutB, layoutC } from './layouts.js';

let assetsKey = '';
let assetsCache = null;

export async function buildAssets(state) {
  const key = [
    state.photoId, state.photo2Id, state.locationId, state.field,
    state.threshold, state.tones, state.sunset, state.neon,
  ].join('|');
  if (assetsCache && assetsKey === key) return assetsCache;
  const [main, second, location] = await Promise.all([
    loadPhoto(state.photoId),
    loadPhoto(state.photo2Id),
    loadPhoto(state.locationId),
  ]);
  // The blade print is cut much lighter than the main print: a face in
  // shadow comes out all ink at the default cut, while a light cut turns
  // it into a readable two-tone face — dark hair and features on light
  // skin, the way a face reads in the Psycho blade. The 'blade' cut also
  // drops the warm red backdrop, so the blade itself stays light.
  const bladeState = { ...state, threshold: Math.max(10, state.threshold - 35) };
  // The shadow is the figure, not its backdrop: the hero photo's
  // background is dark red, so a dark-ink cut would print the backdrop
  // as the mass and the figure as holes. 'inkFigure' cuts by chroma
  // instead — desaturated skin and coat become the ink mass, the
  // saturated red wall drops out.
  assetsCache = {
    main, second, location,
    mainPrint: posterizePrint(main, state, 'print', { l: 0.08, r: 0.08, t: 0.18, b: 0.18 }),
    mainInk: posterizePrint(main, state, 'inkFigure', { t: 0.05, b: 0.05 }),
    secondPrint: posterizePrint(second, state, 'print'),
    bladePrint: posterizePrint(second, bladeState, 'blade'),
    secondGraded: gradePhoto(second, 560, state),
    locationGraded: gradePhoto(location, 640, state),
  };
  assetsKey = key;
  return assetsCache;
}

// Paints the whole cover onto the canvas at its own size.
export function drawCover(canvas, state, assets) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (state.layout === 'B') layoutB(ctx, W, H, state, assets);
  else if (state.layout === 'C') layoutC(ctx, W, H, state, assets);
  else layoutA(ctx, W, H, state, assets);
}
