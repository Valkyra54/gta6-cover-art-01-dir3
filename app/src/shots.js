// shots.js — fixed scenes for screenshots: ?shot=cover shows the cover
// alone at the requested size; ?shot=editor shows the editor with a fixed
// state. Query params: layout, photo, photo2, location, field, threshold,
// tones, neon (0/1), sunset, caption, tagline, size, w, h, crop, crop2.
// window.__shotReady is set after two animation frames once painted.
import { buildAssets, drawCover } from './cover.js';
import { loadFonts } from './fonts.js';

export function defaultState() {
  return {
    layout: 'A',
    photoId: 'protective-woman',
    photo2Id: 'protective-woman',
    locationId: 'sunset-boulevard',
    field: 'mustard',
    threshold: 55,
    tones: 3,
    neon: true,
    sunset: 70,
    caption: 'NIGHT WATCH',
    tagline: 'SHE SEES YOU FIRST',
    size: '1080x1080',
    crop: { scale: 1, ox: 0, oy: 0 },
    crop2: { scale: 1, ox: 0, oy: 0 },
  };
}

export const LAYOUT_DEFAULTS = {
  A: { field: 'mustard', caption: 'NIGHT WATCH', tagline: 'SHE SEES YOU FIRST' },
  B: { field: 'mustard', caption: 'NIGHT SHIFT', tagline: 'ONE CUT IS ALL IT TAKES' },
  C: { field: 'teal', caption: 'LONG SHADOW', tagline: 'THE CITY REMEMBERS EVERYTHING', photoId: 'protective-woman' },
};

function parseCrop(raw) {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return { scale: parts[0], ox: parts[1], oy: parts[2] };
}

export function stateFromQuery(query) {
  const state = defaultState();
  const get = (k) => query.get(k);
  if (get('layout') && 'ABC'.includes(get('layout'))) {
    state.layout = get('layout');
    // A shot that names a layout gets that layout's field and words unless
    // the query spells them out.
    const d = LAYOUT_DEFAULTS[state.layout];
    state.field = d.field;
    state.caption = d.caption;
    state.tagline = d.tagline;
    if (d.photoId) state.photoId = d.photoId;
  }
  if (get('photo')) state.photoId = get('photo');
  if (get('photo2')) state.photo2Id = get('photo2');
  if (get('location')) state.locationId = get('location');
  if (get('field')) state.field = get('field');
  if (get('threshold') !== null) state.threshold = clampNum(get('threshold'), 0, 100, 55);
  if (get('tones') !== null) state.tones = get('tones') === '2' ? 2 : 3;
  if (get('neon') !== null) state.neon = get('neon') !== '0';
  if (get('sunset') !== null) state.sunset = clampNum(get('sunset'), 0, 100, 70);
  if (get('caption')) state.caption = get('caption');
  if (get('tagline')) state.tagline = get('tagline');
  if (get('size')) state.size = get('size');
  const crop = parseCrop(get('crop'));
  if (crop) state.crop = crop;
  const crop2 = parseCrop(get('crop2'));
  if (crop2) state.crop2 = crop2;
  return state;
}

function clampNum(raw, lo, hi, fallback) {
  const n = Number(raw);
  if (Number.isNaN(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

export function sizeFromQuery(query, fallback) {
  const w = Number(query.get('w'));
  const h = Number(query.get('h'));
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return [w, h];
  const [sw, sh] = (fallback || '1080x1080').split('x').map(Number);
  return [sw, sh];
}

// Runs a shot scene. `env` supplies the canvas and, for the editor, a
// callback that receives the resolved state so main.js can paint the
// controls to match.
export async function runShot(shot, query, env) {
  const state = stateFromQuery(query);
  await loadFonts();
  const assets = await buildAssets(state);
  if (shot === 'cover') {
    const [w, h] = sizeFromQuery(query, state.size);
    env.canvas.width = w;
    env.canvas.height = h;
    drawCover(env.canvas, state, assets);
    document.body.classList.add('shot-cover');
  } else if (shot === 'editor' && env.onEditor) {
    await env.onEditor(state, assets);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
  return { state, assets };
}
