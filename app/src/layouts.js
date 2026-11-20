// layouts.js — the three compositions of direction 3. One giant thing on a
// flat field, one giant title, nothing else. The photo is never drawn as a
// scene: it arrives already posterized into flat tones (layout A/C) or
// clipped inside one giant object (layout B).
import {
  FIELDS, accentFor, drawTitle, drawTagline, drawCredits, drawBadge,
  applyGrain,
} from './cover.js';
import { coverRect, containRect, sampleById } from './photos.js';

function creditsLine() {
  return 'ONE OBJECT PICTURES  •  A COVER IN THREE TONES  •  ED. 01';
}

function paintField(ctx, W, H, state) {
  ctx.fillStyle = FIELDS[state.field].field;
  ctx.fillRect(0, 0, W, H);
}

function finish(ctx, W, H, state) {
  const pal = FIELDS[state.field];
  drawBadge(ctx, W, pal.title);
  applyGrain(ctx, W, H);
}

// A — Giant silhouette. The posterized photo stands alone on the field,
// edge-to-edge tall, the way the Tenet gun stands on pale paper. Square
// and portrait stack it over the title; wide splits it left / title right.
export function layoutA(ctx, W, H, state, A) {
  const pal = FIELDS[state.field];
  const accent = state.neon ? accentFor(state) : '#ffb347';
  paintField(ctx, W, H, state);
  const wide = W > H * 1.2;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (wide) {
    // The print bleeds off the top, left and bottom edges; its straight
    // right edge becomes the gutter between the print and the title field.
    const box = { x: 0, y: 0, w: W * 0.48, h: H };
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    const r = coverRect(A.mainPrint, box, sampleById(state.photoId).focus, state.crop);
    ctx.drawImage(A.mainPrint, r.dx, r.dy, r.dw, r.dh);
  } else {
    const box = { x: 0, y: H * 0.03, w: W, h: H * 0.62 };
    const r = containRect(A.mainPrint, box);
    ctx.drawImage(A.mainPrint, r.dx, r.dy, r.dw, r.dh);
  }
  ctx.restore();
  if (wide) {
    const bx = W * 0.5; const bw = W * 0.47;
    drawTagline(ctx, state.tagline, bx, H * 0.42, bw, pal.tag, Math.round(H * 0.045));
    drawTitle(ctx, state.caption, { x: bx, y: H * 0.44, w: bw, h: H * 0.2 },
      pal.title, accent, state.neon, Math.round(H * 0.17));
    drawCredits(ctx, creditsLine(), bx, H * 0.72, bw, pal.tag, Math.round(H * 0.02));
  } else {
    drawTagline(ctx, state.tagline, W * 0.04, H * 0.7, W * 0.92, pal.tag, Math.round(H * 0.032));
    drawTitle(ctx, state.caption, { x: W * 0.04, y: H * 0.72, w: W * 0.92, h: H * 0.2 },
      pal.title, accent, state.neon, Math.round(H * 0.155));
    drawCredits(ctx, creditsLine(), W * 0.04, H * 0.955, W * 0.92, pal.tag, Math.round(H * 0.016));
  }
  finish(ctx, W, H, state);
}

// B — Object. One giant knife on the field, the portrait clipped inside
// the blade like the face in the Psycho blade, a miniature boulevard at
// its foot, the title in deep red at the lower right. The blade is fat on
// purpose: only a wide blade fits a whole face inside it.
export function layoutB(ctx, W, H, state, A) {
  const pal = FIELDS[state.field];
  const accent = state.neon ? accentFor(state) : '#ffb347';
  paintField(ctx, W, H, state);
  const min = Math.min(W, H);
  const wide = W > H * 1.2;
  const hx = W * 0.76; const hy = H * 0.18;
  const tx = W * 0.1; const ty = H * 0.64;
  const L = Math.hypot(tx - hx, ty - hy);
  const ang = Math.atan2(ty - hy, tx - hx);
  const bw = min * 0.38;

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  // Blade: a straight spine on top, one long sweep of a cutting edge
  // below, meeting at the tip. Flat silver first, so it reads as a solid
  // object even where the photo inside drops out to the field.
  ctx.beginPath();
  ctx.moveTo(0, -bw * 0.42);
  ctx.lineTo(L * 0.72, -bw * 0.46);
  ctx.quadraticCurveTo(L * 0.94, -bw * 0.34, L, 0);
  ctx.quadraticCurveTo(L * 0.88, bw * 0.34, L * 0.5, bw * 0.5);
  ctx.lineTo(0, bw * 0.44);
  ctx.closePath();
  ctx.fillStyle = pal.paper;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  // The face sits upright along the blade: the print is turned 90° so
  // the face's up direction points at the handle, and scaled until the
  // face fills the blade's width — the way the face fills the blade in
  // the Psycho poster. The blade path clips the rest away.
  ctx.translate(L * 0.47, 0);
  ctx.rotate(-Math.PI / 2);
  const face = sampleById(state.photo2Id).face || { x: 0.5, y: 0.34, w: 0.4 };
  // The face fills about 64% of the blade's width: big enough to read,
  // small enough to sit inside the blade with silver showing around it.
  const faceScale = (bw * 0.64) / (face.w * A.bladePrint.width);
  const dw = A.bladePrint.width * faceScale;
  const dh = A.bladePrint.height * faceScale;
  ctx.drawImage(A.bladePrint, -dw * face.x, -dh * face.y, dw, dh);
  ctx.restore();
  ctx.lineWidth = Math.max(2, min * 0.006);
  ctx.strokeStyle = pal.ink;
  ctx.stroke();
  // Handle: flat ink, one paper rivet, fully on the canvas.
  const hl = L * 0.17;
  ctx.fillStyle = pal.ink;
  roundRect(ctx, -hl, -bw * 0.3, hl, bw * 0.6, bw * 0.14);
  ctx.fill();
  ctx.fillStyle = pal.paper;
  ctx.beginPath(); ctx.arc(-hl * 0.45, 0, bw * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // Miniature location at the foot of the blade, clipped to its keyline.
  const mx = W * 0.05; const mw = wide ? W * 0.22 : W * 0.3;
  const mh = wide ? H * 0.17 : H * 0.12;
  const my = H * 0.79;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  const mbox = { x: mx, y: my, w: mw, h: mh };
  ctx.beginPath();
  ctx.rect(mbox.x, mbox.y, mbox.w, mbox.h);
  ctx.clip();
  const mr = coverRect(A.locationGraded, mbox, sampleById(state.locationId).focus, null);
  ctx.drawImage(A.locationGraded, mr.dx, mr.dy, mr.dw, mr.dh);
  ctx.restore();
  ctx.save();
  ctx.lineWidth = Math.max(2, min * 0.005);
  ctx.strokeStyle = pal.ink;
  ctx.strokeRect(mx, my, mw, mh);
  ctx.restore();

  // Title block, lower right, clear of the blade tip and the miniature.
  const titleColor = state.field === 'mustard' ? '#c81e12' : pal.title;
  const bx = W * 0.38; const bw2 = W * 0.57;
  drawTagline(ctx, state.tagline, bx, H * 0.815, bw2, pal.tag, Math.round(H * 0.03));
  drawTitle(ctx, state.caption, { x: bx, y: H * 0.83, w: bw2, h: H * 0.13 },
    titleColor, accent, state.neon, Math.round(H * 0.12));
  drawCredits(ctx, creditsLine(), bx, H * 0.965, bw2, pal.tag, Math.round(H * 0.015));
  finish(ctx, W, H, state);
}

// C — Giant shadow. The poster's joke is scale: one giant ink
// silhouette of the woman stands upright and fills the field, with her
// long shadow lying flat from its feet, the way the Wolf poster's giant
// silhouette throws its shadow. The silhouette IS the figure, so it
// reads as her; the streak only has to read as a long shadow. No small
// photo at its foot — the figure alone carries the poster.
export function layoutC(ctx, W, H, state, A) {
  const pal = FIELDS[state.field];
  paintField(ctx, W, H, state);
  const wide = W > H * 1.2;
  const portrait = H > W * 1.15;

  // The shadow streak: the ink print, rotated almost flat, anchored at
  // the silhouette's feet and running right along the ground, long
  // enough to leave the frame. Drawn BEFORE the standing silhouette, so
  // the silhouette's base covers its left end and the streak reads as
  // cast by the giant figure. Source-cropped like the silhouette, so the
  // stray neon flecks at the print's edges never enter the poster.
  const feetX = W * 0.08; const feetY = H * 0.88;
  const shH = wide ? W * 0.62 : H * 0.85;
  const shW = shH * 0.45;
  const shAngle = 1.45;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(feetX, feetY);
  ctx.rotate(shAngle);
  ctx.scale(0.3, 1.0);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(A.mainInk, 24, 0, 432, 960, -shW / 2, -shH, shW, shH);
  ctx.restore();

  // The giant standing silhouette: the same ink figure, upright, its long
  // coat hem on the ground line at 0.88H, the silhouette filling the
  // empty upper half. The print is source-cropped (x 24..456): the chroma cut catches a few flecks
  // of the photo's neon background at the print's left edge and right
  // edge, and uncropped they float on the field as dirt.
  const figH = wide ? H * 0.8 : H * 0.78;
  const figW = figH * 0.45;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.96;
  ctx.drawImage(A.mainInk, 24, 0, 432, 960, W * 0.02, feetY - figH, figW, figH);
  ctx.restore();

  // Title, right side — top on wide, mid-height otherwise, clear of the
  // shadow's head. C never takes the neon accent echo: the Sunset pink is
  // a third hue that fights the warm field, so the
  // title stays cream with only drawTitle's own neutral dark drop shadow.
  const bx = W * 0.44; const bw = W * 0.52;
  const ty = wide ? 0.1 : portrait ? 0.2 : 0.36;
  drawTagline(ctx, state.tagline, bx, H * ty, bw, pal.tag, Math.round(H * 0.032));
  drawTitle(ctx, state.caption, { x: bx, y: H * (ty + 0.02), w: bw, h: H * 0.2 },
    pal.title, '', false, Math.round(H * 0.15));
  // Credits sit at the very bottom (y 0.95), like layouts A and B: the
  // shadow streak runs along y ~0.78-0.88 in the credits' x-range, so a
  // mid-height credits line would collide with it. Down here the streak
  // has left the frame (it rises rightward from the feet and exits right).
  drawCredits(ctx, creditsLine(), bx, H * 0.95, bw, pal.tag, Math.round(H * 0.016));
  finish(ctx, W, H, state);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
