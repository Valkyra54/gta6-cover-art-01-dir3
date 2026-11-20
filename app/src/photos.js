// photos.js — the photo tray: sample photos, loading, and the cover/contain
// crop math every layout shares. No network: every sample is a file under
// app/samples/, uploads stay on the user's machine as object URLs.
export const SAMPLES = [
  { id: 'protective-woman', file: 'protective-woman.jpg', label: 'Night Watch', focus: { x: 0.35, y: 0.32 }, face: { x: 0.32, y: 0.27, w: 0.32 } },
  { id: 'sunset-boulevard', file: 'sunset-boulevard.jpg', label: 'Boulevard', focus: { x: 0.5, y: 0.5 }, face: { x: 0.5, y: 0.5, w: 0.4 } },
  { id: 'boulevard', file: 'boulevard.jpg', label: 'Beach', focus: { x: 0.5, y: 0.4 }, face: { x: 0.5, y: 0.4, w: 0.4 } },
  { id: 'pier', file: 'pier.jpg', label: 'Pier', focus: { x: 0.5, y: 0.45 }, face: { x: 0.5, y: 0.4, w: 0.4 } },
];

const cache = new Map();

export function sampleById(id) {
  return SAMPLES.find((s) => s.id === id) || SAMPLES[0];
}

// Loads a sample (or an uploaded object URL) once and caches the element.
export function loadPhoto(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  const sample = SAMPLES.find((s) => s.id === id);
  const src = sample ? `./samples/${sample.file}` : id;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { cache.set(id, img); resolve(img); };
    img.onerror = () => reject(new Error(`could not load photo ${id}`));
    img.src = src;
  });
}

export function registerUpload(id, objectUrl) {
  const img = new Image();
  img.src = objectUrl;
  cache.set(id, img);
  return img;
}

// Rect of the image drawn "cover" into a box, honouring a focus point and a
// user crop { scale, ox, oy }: scale zooms in, ox/oy pan in box fractions.
export function coverRect(img, box, focus, crop) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(box.w / iw, box.h / ih) * (crop?.scale || 1);
  const dw = iw * base;
  const dh = ih * base;
  const fx = focus?.x ?? 0.5;
  const fy = focus?.y ?? 0.5;
  let dx = box.x + (box.w - dw) * fx;
  let dy = box.y + (box.h - dh) * fy;
  dx += (crop?.ox || 0) * box.w;
  dy += (crop?.oy || 0) * box.h;
  return { dx, dy, dw, dh };
}

// Same, but "contain": the whole image visible inside the box, centred.
export function containRect(img, box) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.min(box.w / iw, box.h / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { dx: box.x + (box.w - dw) / 2, dy: box.y + (box.h - dh) / 2, dw, dh };
}

export function drawCoverFit(ctx, img, box, focus, crop) {
  const r = coverRect(img, box, focus, crop);
  ctx.drawImage(img, r.dx, r.dy, r.dw, r.dh);
  return r;
}

export function drawContainFit(ctx, img, box) {
  const r = containRect(img, box);
  ctx.drawImage(img, r.dx, r.dy, r.dw, r.dh);
  return r;
}
