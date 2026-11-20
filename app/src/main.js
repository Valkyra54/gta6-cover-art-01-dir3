// main.js — wires the editor: tray, layout and field pickers, the
// posterize / neon / sunset controls, caption fields, crop by drag and
// wheel, and the real PNG export at the three post sizes.
import { drawCover, buildAssets } from './cover.js';
import { loadFonts } from './fonts.js';
import { SAMPLES, loadPhoto, registerUpload } from './photos.js';
import { defaultState, stateFromQuery, LAYOUT_DEFAULTS, runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const status = $('status');

let state = defaultState();
let assets = null;
let uploadCount = 0;
let drawBusy = false;
let drawDirty = false;

const SIZES = ['1080x1080', '1080x1350', '1920x1080'];

function sizeParts() {
  return state.size.split('x').map(Number);
}

async function redraw() {
  if (drawBusy) { drawDirty = true; return; }
  drawBusy = true;
  await loadFonts();
  const [w, h] = sizeParts();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  assets = await buildAssets(state);
  drawCover(canvas, state, assets);
  drawBusy = false;
  if (drawDirty) { drawDirty = false; redraw(); }
}

function syncControls() {
  document.querySelectorAll('#layoutSeg button').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#tray img').forEach((img) => {
    img.classList.toggle('on', img.dataset.photo === state.photoId);
  });
  document.querySelectorAll('#fieldSwatches button').forEach((b) => {
    b.classList.toggle('on', b.dataset.field === state.field);
  });
  document.querySelectorAll('#tonesSeg button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.tones) === state.tones);
  });
  $('threshold').value = state.threshold;
  $('thresholdVal').textContent = state.threshold;
  $('sunset').value = state.sunset;
  $('sunsetVal').textContent = state.sunset;
  $('neon').checked = state.neon;
  $('caption').value = state.caption;
  $('tagline').value = state.tagline;
  $('photo2').value = state.photo2Id;
  $('location').value = state.locationId;
  $('zoom').value = Math.round(state.crop.scale * 100);
}

function buildTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  for (const s of SAMPLES) {
    const img = document.createElement('img');
    img.src = `./samples/${s.file}`;
    img.alt = s.label;
    img.title = s.label;
    img.dataset.photo = s.id;
    img.addEventListener('click', () => {
      state.photoId = s.id;
      syncControls();
      redraw();
    });
    tray.appendChild(img);
  }
}

function buildSelects() {
  for (const [id, key] of [['photo2', 'photo2Id'], ['location', 'locationId']]) {
    const sel = $(id);
    sel.innerHTML = '';
    for (const s of SAMPLES) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.label;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      state[key] = sel.value;
      redraw();
    });
  }
}

function buildFields() {
  const wrap = $('fieldSwatches');
  const names = { mustard: 'Mustard', red: 'Red', teal: 'Teal', bone: 'Bone' };
  const colors = { mustard: '#e9a319', red: '#d42b1e', teal: '#0f6e6a', bone: '#f2ead8' };
  for (const f of Object.keys(names)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.field = f;
    b.style.background = colors[f];
    b.title = names[f];
    b.setAttribute('aria-label', names[f]);
    b.addEventListener('click', () => {
      state.field = f;
      syncControls();
      redraw();
    });
    wrap.appendChild(b);
  }
}

function applyLayoutDefaults(layout) {
  const d = LAYOUT_DEFAULTS[layout];
  state.field = d.field;
  state.caption = d.caption;
  state.tagline = d.tagline;
  if (d.photoId) state.photoId = d.photoId;
  if (layout === 'B') state.photo2Id = 'protective-woman';
  if (layout === 'C') state.photo2Id = 'protective-woman';
}

document.querySelectorAll('#layoutSeg button').forEach((b) => {
  b.addEventListener('click', () => {
    state.layout = b.dataset.layout;
    applyLayoutDefaults(state.layout);
    syncControls();
    redraw();
  });
});

document.querySelectorAll('#tonesSeg button').forEach((b) => {
  b.addEventListener('click', () => {
    state.tones = Number(b.dataset.tones);
    syncControls();
    redraw();
  });
});

$('threshold').addEventListener('input', (e) => {
  state.threshold = Number(e.target.value);
  $('thresholdVal').textContent = state.threshold;
  redraw();
});

$('sunset').addEventListener('input', (e) => {
  state.sunset = Number(e.target.value);
  $('sunsetVal').textContent = state.sunset;
  redraw();
});

$('neon').addEventListener('change', (e) => {
  state.neon = e.target.checked;
  redraw();
});

$('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  redraw();
});

$('tagline').addEventListener('input', (e) => {
  state.tagline = e.target.value;
  redraw();
});

$('zoom').addEventListener('input', (e) => {
  state.crop.scale = Number(e.target.value) / 100;
  redraw();
});

// Drag to pan the photo inside its print, wheel to zoom it.
let dragging = null;
canvas.addEventListener('pointerdown', (e) => {
  dragging = { x: e.clientX, y: e.clientY, ox: state.crop.ox, oy: state.crop.oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  state.crop.ox = dragging.ox + (e.clientX - dragging.x) / rect.width;
  state.crop.oy = dragging.oy + (e.clientY - dragging.y) / rect.height;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const next = state.crop.scale * (e.deltaY < 0 ? 1.08 : 0.93);
  state.crop.scale = Math.min(2.5, Math.max(0.8, next));
  $('zoom').value = Math.round(state.crop.scale * 100);
  redraw();
}, { passive: false });

$('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  uploadCount += 1;
  const id = `upload-${uploadCount}`;
  const url = URL.createObjectURL(file);
  registerUpload(id, url);
  try {
    await loadPhoto(id);
    state.photoId = id;
    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;
    img.title = file.name;
    img.dataset.photo = id;
    img.addEventListener('click', () => {
      state.photoId = id;
      syncControls();
      redraw();
    });
    $('tray').appendChild(img);
    syncControls();
    redraw();
  } catch (err) {
    status.textContent = 'That file could not be read as a photo.';
  }
});

// Real export: a fresh offscreen canvas at the exact post size, PNG blob.
export async function exportPng(size) {
  const [w, h] = size.split('x').map(Number);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const a = assets || (await buildAssets(state));
  drawCover(off, state, a);
  return new Promise((resolve) => {
    off.toBlob((blob) => resolve({ blob, w, h }), 'image/png');
  });
}

document.querySelectorAll('[data-export]').forEach((b) => {
  b.addEventListener('click', async () => {
    const size = b.dataset.export;
    state.size = size;
    status.textContent = `Exporting ${size}…`;
    const { blob, w, h } = await exportPng(size);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved cover-${w}x${h}.png`;
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
});

document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => {
    state.size = b.dataset.size;
    document.querySelectorAll('[data-size]').forEach((x) => {
      x.classList.toggle('on', x === b);
    });
    redraw();
  });
});

buildTray();
buildSelects();
buildFields();

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, {
    canvas,
    onEditor: async (shotState, shotAssets) => {
      state = shotState;
      assets = shotAssets;
      syncControls();
      await redraw();
    },
  });
} else {
  syncControls();
  redraw();
}
