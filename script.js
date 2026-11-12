/* Collage
   Each result uses 10 photos from Assets, cut into overlapping pieces.
   Generate pulls the next 10 and lets them bleed down the page.
   Width and height set the size of the collage.
   Add a photo by dropping it in Assets and adding its filename to PHOTOS.
*/

"use strict";

const PHOTOS = [
  "Amazon_com _ 40_ Hair Tinsel 100 Strands (Shiny Charm Pink) _ Beauty & Personal Care.jpeg",
  "Amber Waves.jpeg",
  "Christmas tree 🎄.jpeg",
  "G.jpeg",
  "Holographic _ wallpaper.jpeg",
  "Makes me happy.jpeg",
  "Metallic background.jpeg",
  "OrcaJump - 1 pieza de decoración de telón de fondo con borlas de lentejuelas - Oro rosa, one-size.jpeg",
  "Shiny Tinsel Backdrop _ Custom Party Fringe for NYE or Birthday Bash.jpeg",
  "Women's Red Tinsel Fringe Shorts - XL.jpeg",
  "_ (1) copy.jpeg",
  "_ (1).jpeg",
  "_ (10).jpeg",
  "_ (11).jpeg",
  "_ (12).jpeg",
  "_ (13).jpeg",
  "_ (2) copy.jpeg",
  "_ (2).jpeg",
  "_ (3).jpeg",
  "_ (4).jpeg",
  "_ (5).jpeg",
  "_ (6).jpeg",
  "_ (7).jpeg",
  "_ (8).jpeg",
  "_ (9).jpeg",
  "_ copy 2.jpeg",
  "_ copy 3.jpeg",
  "_ copy.jpeg",
  "_.jpeg",
  "all that glitters.jpeg",
  "brightness and light.jpeg",
  "lametta 💕.jpeg",
  "samia.jpeg",
  "the life of a showgirl aesthetic _ “Sweat and Vanilla Perfume”.jpeg",
  "Мишура❄️✨.jpeg",
];

const BATCH = 10;

const ui = {
  canvas: document.querySelector("#collage"),
  frame: document.querySelector("#frame"),
  generate: document.querySelector("#generate"),
  width: document.querySelector("#width"),
  height: document.querySelector("#height"),
  widthOut: document.querySelector("#width-out"),
  heightOut: document.querySelector("#height-out"),
  status: document.querySelector("#status"),
};

const library = [];
let deck = [];
let batch = [];
let seed = 1;
let sliderTimer = 0;

function mulberry32(start) {
  let a = start >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function loadUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function downscale(img, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function loadLibrary() {
  for (const name of PHOTOS) {
    try {
      const img = await loadUrl(`Assets/${encodeURIComponent(name)}`);
      library.push(downscale(img, 1100));
    } catch (error) {
      console.warn(`Skipped ${name}`);
    }
  }
}

function updateOutputs() {
  ui.widthOut.value = ui.width.value;
  ui.heightOut.value = ui.height.value;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

/* Next 10 photos that have not been used in this pass through Assets. */
function nextBatch() {
  const need = Math.min(BATCH, library.length);
  const chosen = [];
  while (chosen.length < need) {
    if (!deck.length) {
      deck = shuffle(library.filter((img) => !chosen.includes(img)));
      if (!deck.length) break;
    }
    chosen.push(deck.pop());
  }
  batch = chosen;
}

/* Place a photo so it covers a rectangle, cropped from a random area. */
function paintPhoto(ctx, img, x, y, w, h, rand) {
  const zoom = 1 + rand() * 0.65;
  const sw = img.width / zoom;
  const sh = img.height / zoom;
  const sx = rand() * (img.width - sw);
  const sy = rand() * (img.height - sh);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/* How this generation melts. Each mode drips a different distance and width. */
function bleedProfile(rand) {
  const mode = Math.floor(rand() * 4);
  if (mode === 0) {
    return { column: 2, coverage: 0.48, block: 0.22, reach: 0.6, side: 0.08, start: 0.62, trails: 6 };
  }
  if (mode === 1) {
    return { column: 2, coverage: 0.72, block: 0.3, reach: 1, side: 0.12, start: 0.5, trails: 12 };
  }
  if (mode === 2) {
    return { column: 3, coverage: 0.58, block: 0.46, reach: 0.8, side: 0.05, start: 0.54, trails: 8 };
  }
  return { column: 2, coverage: 0.64, block: 0.24, reach: 0.9, side: 0.3, start: 0.46, trails: 10 };
}

/* Overlapping cutouts instead of an even grid. The recipe changes with each generation. */
function collagePieces(w, h, rand) {
  const recipe = Math.floor(rand() * 3);
  const pieces = [];
  const count = batch.length;
  pieces.push({ img: batch[0], x: 0, y: 0, w, h, drip: false });

  if (recipe === 0) {
    let y = h * rand() * 0.05;
    batch.forEach((img) => {
      const ph = h * (0.16 + rand() * 0.14);
      const inset = w * rand() * 0.2;
      pieces.push({
        img,
        x: -inset * 0.15,
        y: y - ph * 0.28,
        w: w - inset * 0.25,
        h: ph * (1.3 + rand() * 0.35),
        drip: true,
      });
      y += ph * (0.52 + rand() * 0.2);
      if (y > h * 0.9) y = h * (0.12 + rand() * 0.45);
    });
    for (let k = 0; k < 3; k += 1) {
      const pw = w * (0.24 + rand() * 0.22);
      const ph = h * (0.26 + rand() * 0.28);
      pieces.push({
        img: batch[Math.floor(rand() * count)],
        x: rand() * (w - pw),
        y: rand() * (h - ph * 0.7),
        w: pw,
        h: ph,
        drip: true,
      });
    }
    return pieces;
  }

  if (recipe === 1) {
    const split = w * (0.38 + rand() * 0.24);
    const columns = [
      { x: 0, w: split + w * 0.1 },
      { x: split - w * 0.1, w: w - split + w * 0.1 },
    ];
    columns.forEach((col, colIndex) => {
      let y = 0;
      let guard = 0;
      let index = colIndex;
      while (y < h && guard < 7) {
        const ph = h * (0.18 + rand() * 0.14);
        pieces.push({
          img: batch[index % count],
          x: col.x,
          y: y - ph * 0.16,
          w: col.w,
          h: ph * (1.2 + rand() * 0.3),
          drip: true,
        });
        y += ph * (0.68 + rand() * 0.16);
        index += 2;
        guard += 1;
      }
    });
    pieces.push({
      img: batch[Math.floor(rand() * count)],
      x: 0,
      y: h * (0.22 + rand() * 0.42),
      w: w * (0.78 + rand() * 0.22),
      h: h * (0.14 + rand() * 0.12),
      drip: true,
    });
    return pieces;
  }

  batch.forEach((img, index) => {
    const pw = w * (0.46 + rand() * 0.36);
    const ph = h * (0.18 + rand() * 0.18);
    const x = (index % 2 === 0 ? -w * 0.02 : w * 0.22) + (rand() - 0.5) * w * 0.1;
    const y = (index / count) * h * 0.82 + (rand() - 0.5) * h * 0.08;
    pieces.push({ img, x, y, w: pw, h: ph, drip: true });
  });
  return pieces;
}

function drawStrip(ctx, source, sx, sy, sw, sh, dx, dy, dw, dh, frameW) {
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
  if (dx + dw > frameW) ctx.drawImage(source, sx, sy, sw, sh, dx - frameW, dy, dw, dh);
  if (dx < 0) ctx.drawImage(source, sx, sy, sw, sh, dx + frameW, dy, dw, dh);
}

/* Pull a row of the photo downward so it runs over the photos below. */
function dripCell(ctx, source, cell, w, h, rand, profile) {
  let x = Math.max(0, Math.floor(cell.x));
  const x1 = Math.min(w, Math.ceil(cell.x + cell.w));
  if (x1 - x < 2) return;
  let groupReach = cell.h * profile.reach * (0.45 + rand() * 0.9);
  let groupLeft = 10 + rand() * 46;

  while (x < x1) {
    const wide = rand() < profile.block;
    const width = Math.min(x1 - x, wide ? 8 + Math.floor(rand() * 18) : profile.column + (rand() < 0.3 ? 1 : 0));
    if (groupLeft <= 0) {
      groupReach = cell.h * profile.reach * (0.35 + rand() * 1.15);
      groupLeft = 8 + rand() * 42;
    }
    groupLeft -= width;
    if (rand() > profile.coverage) {
      x += Math.max(1, width);
      continue;
    }

    const startFrac = clamp(profile.start + (rand() - 0.5) * 0.3, 0.18, 0.82);
    const cut = cell.y + cell.h * startFrac;
    const y2 = Math.min(h, cut + Math.max(8, groupReach * (0.7 + rand() * 0.55)));
    const shift = (rand() - 0.5) * cell.w * profile.side;
    let sx = Math.round(x + shift);
    if (sx < 0) sx = 0;
    if (sx > w - width) sx = Math.max(0, w - width);
    const sampleY = clamp(Math.round(cut - rand() * cell.h * 0.22), 0, h - 1);
    ctx.filter = rand() < 0.18 ? `brightness(${(0.88 + rand() * 0.28).toFixed(2)})` : "none";
    drawStrip(ctx, source, sx, sampleY, width, 1, x, cut, width, y2 - cut, w);
    x += Math.max(1, width);
  }
}

function dripTrails(ctx, source, w, h, rand, count) {
  for (let i = 0; i < count; i += 1) {
    const width = rand() < 0.82 ? 1 : 2;
    const x = Math.floor(rand() * Math.max(1, w - width));
    const cut = rand() * h * 0.72;
    const sampleY = clamp(Math.round(cut), 0, h - 1);
    ctx.filter = "none";
    ctx.drawImage(source, x, sampleY, width, 1, x, cut, width, h - cut);
  }
}

function render() {
  if (!batch.length) return;
  const w = Number(ui.width.value);
  const h = Number(ui.height.value);
  const rand = mulberry32(hashString(`bleed:${seed}`));
  const profile = bleedProfile(rand);
  const cells = collagePieces(w, h, rand);

  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;
  const sourceCtx = source.getContext("2d");
  sourceCtx.fillStyle = "#120c0c";
  sourceCtx.fillRect(0, 0, w, h);
  cells.forEach((cell, index) => {
    const crop = mulberry32(hashString(`crop:${seed}:${index}`));
    paintPhoto(sourceCtx, cell.img, cell.x, cell.y, cell.w, cell.h, crop);
  });

  const canvas = ui.canvas;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);

  const quiet = new Set();
  const quietCount = Math.min(cells.length, 1 + Math.floor(rand() * 2));
  while (quiet.size < quietCount) quiet.add(Math.floor(rand() * cells.length));

  cells.forEach((cell, index) => {
    if (!cell.drip || quiet.has(index)) return;
    dripCell(ctx, source, cell, w, h, rand, profile);
  });
  dripTrails(ctx, source, w, h, rand, profile.trails);
  ctx.filter = "none";
  fitCanvas();
}

function fitCanvas() {
  const frameW = ui.frame.clientWidth;
  const frameH = ui.frame.clientHeight;
  if (!frameW || !frameH) return;
  const scale = Math.min(frameW / ui.canvas.width, frameH / ui.canvas.height);
  ui.canvas.style.width = `${Math.max(1, ui.canvas.width * scale)}px`;
  ui.canvas.style.height = `${Math.max(1, ui.canvas.height * scale)}px`;
}

function generate() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  seed = buf[0] || 1;
  nextBatch();
  render();
  ui.status.textContent = `${batch.length} photos · ${library.length} in Assets`;
}

function wire() {
  ui.generate.addEventListener("click", generate);
  for (const input of [ui.width, ui.height]) {
    input.addEventListener("input", () => {
      updateOutputs();
      window.clearTimeout(sliderTimer);
      sliderTimer = window.setTimeout(render, 60);
    });
  }
  let resizeTick = 0;
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(resizeTick);
    resizeTick = window.requestAnimationFrame(fitCanvas);
  });
  updateOutputs();
}

async function start() {
  wire();
  await loadLibrary();
  if (!library.length) {
    ui.status.textContent = "No photos could be opened from Assets.";
    return;
  }
  ui.generate.disabled = false;
  generate();
}

start();
