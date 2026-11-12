/* Tinsel collage generator
   Assumptions (also listed in the chat when this was built):
   - Glitch_background.jpeg was not in the project. Drawing follows the written description.
   - Portrait base is 736×1305, painted at 2× so the download is 1472×2610.
     Square is 1024×1024 and landscape is 1305×736, also at 2×.
     Drop SCALE to 1 if a browser needs a lighter preview.
   - Block shift is 0–25px at 1×, multiplied by SCALE.
   - The seed string is the whole recipe: random base, four sliders, frame,
     streak direction, and palette. Use seed restores that recipe.
   - Randomise settings rerolls the four sliders only. The frame stays put.
     Palette and horizontal-streak mode always come from the new seed.
     Horizontal streaks are uncommon, and more common when the frame is landscape.
   - The source picture is the photos listed in PHOTO_FILES, loaded from
     ../Assets. TinselStrand.jpg is the same strand as the PNG, so only the PNG
     is listed. Add a new jpg, png, or webp by putting it in Assets and adding
     its filename to PHOTO_FILES. PDF and PSD files are skipped.
   - "Use my photo" still replaces the Assets photos for that collage. An extra
     strand upload is scattered on top. Those files are not stored in the seed.
   - History keeps the last 12 results for this visit.
   - Bricolage Grotesque comes from Google Fonts. The fallback is a system sans.
   - Pixels are packed little-endian, which matches canvas ImageData on current
     phones and laptops. draw() checks that and warns if it ever isn't.
*/

"use strict";

/* Photos in Final Project/Assets. Drop a new image in that folder, then add
   its filename here. The generator builds the collage from these instead of
   the drawn beads and blobs. */
const ASSET_FOLDER = "../Assets/";
const PHOTO_FILES = [
  "TinselStrand.png",
];

const SCALE = 2;
const BASE = {
  portrait: [736, 1305],
  square: [1024, 1024],
  landscape: [1305, 736],
};

/* Palette roles stay in-family. Brightness varies later; hue does not wander. */
const PALETTES = [
  {
    name: "Hearth",
    field: [[132, 20, 28], [176, 36, 40], [168, 88, 42], [98, 50, 28], [92, 102, 44], [48, 62, 34], [228, 206, 170], [28, 16, 14]],
    blob: [[104, 112, 46], [54, 70, 36], [110, 58, 32], [78, 64, 34], [140, 96, 44]],
    bar: [[240, 226, 198], [214, 168, 72], [176, 98, 48], [250, 246, 236]],
    bead: [[198, 28, 36], [150, 18, 28], [184, 90, 42], [214, 166, 68], [244, 226, 196], [118, 20, 28]],
    cream: [[248, 240, 226], [236, 214, 176], [255, 250, 242]],
    spark: [[255, 244, 220], [255, 250, 244], [255, 210, 120]],
    shadow: [26, 14, 12],
    paper: [78, 28, 24],
  },
  {
    name: "Ice",
    field: [[208, 216, 222], [146, 184, 204], [72, 96, 112], [230, 236, 240], [16, 24, 32], [168, 178, 186], [112, 148, 168]],
    blob: [[186, 198, 208], [86, 112, 126], [214, 224, 230], [36, 54, 66]],
    bar: [[244, 248, 252], [176, 206, 220], [206, 210, 204]],
    bead: [[236, 242, 246], [160, 198, 216], [190, 202, 210], [255, 255, 255], [118, 154, 174]],
    cream: [[244, 248, 252], [220, 232, 238]],
    spark: [[255, 255, 255], [214, 236, 248], [236, 242, 246]],
    shadow: [12, 18, 26],
    paper: [42, 60, 72],
  },
  {
    name: "Magenta",
    field: [[198, 22, 92], [124, 14, 48], [214, 166, 64], [250, 220, 214], [62, 10, 32], [228, 64, 118], [150, 86, 40]],
    blob: [[112, 16, 52], [68, 18, 36], [176, 36, 82], [122, 70, 36]],
    bar: [[255, 236, 214], [228, 186, 78], [255, 220, 228]],
    bead: [[220, 28, 98], [255, 78, 138], [214, 158, 58], [250, 220, 210], [140, 14, 58]],
    cream: [[255, 236, 228], [255, 246, 236]],
    spark: [[255, 236, 210], [255, 250, 244], [255, 200, 110]],
    shadow: [28, 8, 16],
    paper: [112, 16, 46],
  },
  {
    name: "Emerald",
    field: [[14, 112, 78], [16, 56, 42], [212, 176, 96], [236, 214, 170], [8, 34, 28], [36, 138, 98], [122, 92, 42]],
    blob: [[14, 88, 62], [22, 48, 38], [64, 118, 78], [96, 74, 36]],
    bar: [[244, 228, 196], [220, 184, 100], [236, 236, 220]],
    bead: [[18, 140, 96], [10, 78, 56], [220, 180, 96], [244, 224, 180], [255, 248, 236]],
    cream: [[248, 236, 210], [255, 250, 240]],
    spark: [[255, 246, 220], [255, 252, 244], [240, 210, 130]],
    shadow: [8, 20, 16],
    paper: [12, 58, 44],
  },
];

const ui = {
  canvas: document.querySelector("#collage"),
  frame: document.querySelector("#frame"),
  generate: document.querySelector("#generate"),
  seed: document.querySelector("#seed"),
  useSeed: document.querySelector("#use-seed"),
  streak: document.querySelector("#streak"),
  blocks: document.querySelector("#blocks"),
  sparkles: document.querySelector("#sparkles"),
  beads: document.querySelector("#beads"),
  streakOut: document.querySelector("#streak-out"),
  blocksOut: document.querySelector("#blocks-out"),
  sparklesOut: document.querySelector("#sparkles-out"),
  beadsOut: document.querySelector("#beads-out"),
  randomise: document.querySelector("#randomise"),
  photo: document.querySelector("#photo"),
  strand: document.querySelector("#strand"),
  clearPhoto: document.querySelector("#clear-photo"),
  clearStrand: document.querySelector("#clear-strand"),
  download: document.querySelector("#download"),
  status: document.querySelector("#status"),
  history: document.querySelector("#history"),
};

const state = {
  photo: null,
  strand: null,
  library: [],
  sourceNames: [],
  history: [],
  spec: null,
};

const sourceCanvas = document.createElement("canvas");
let renderToken = 0;
let fadeTimer = 0;
let sliderTimer = 0;

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp8(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value | 0;
}

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function css([r, g, b]) {
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

function tint(rgb, rand) {
  const gain = 0.62 + rand() * 0.58;
  return [clamp8(rgb[0] * gain), clamp8(rgb[1] * gain), clamp8(rgb[2] * gain)];
}

function pick(list, rand) {
  return list[(rand() * list.length) | 0];
}

/* Little-endian pack: byte order r, g, b, a. Matches ImageData on ARM and x86. */
function pack(r, g, b) {
  return (255 << 24) | (b << 16) | (g << 8) | (r | 0);
}

function scalePacked(color, gain) {
  return pack(
    clamp8((color & 255) * gain),
    clamp8(((color >>> 8) & 255) * gain),
    clamp8(((color >>> 16) & 255) * gain)
  );
}

function pixelsAreLittleEndian() {
  const bytes = new Uint8ClampedArray(4);
  new Uint32Array(bytes.buffer)[0] = pack(255, 0, 0);
  return bytes[0] === 255 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 255;
}

function randomBase() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0].toString(16).padStart(8, "0");
}

function toBase(token) {
  const raw = token.trim().toLowerCase();
  if (/^[a-f0-9]+$/.test(raw)) return raw.slice(0, 8).padStart(8, "0");
  return (hashString(raw) >>> 0).toString(16).padStart(8, "0");
}

function pickPaletteIndex(rand) {
  const roll = rand();
  if (roll < 0.64) return 0;
  if (roll < 0.78) return 1;
  if (roll < 0.9) return 2;
  return 3;
}

function deriveSettings(base) {
  const rand = mulberry32(hashString(`${base}:settings`));
  return {
    streak: Math.round(52 + rand() * 48),
    blocks: 6 + Math.floor(rand() * 9),
    sparkles: 40 + Math.floor(rand() * 81),
    beads: Math.round(rand() * 100),
  };
}

/* Horizontal mode is a property of the seed, nudged by the frame you generate in. */
function deriveExtras(base, aspect) {
  const rand = mulberry32(hashString(`${base}:extras`));
  const palette = pickPaletteIndex(rand);
  const odds = aspect === "landscape" ? 0.42 : 0.07;
  return { palette, horizontal: rand() < odds };
}

function formatSeed(spec) {
  const aspectCode = spec.aspect === "square" ? 1 : spec.aspect === "landscape" ? 2 : 0;
  return [
    spec.base,
    `s${spec.streak}`,
    `b${spec.blocks}`,
    `k${spec.sparkles}`,
    `d${spec.beads}`,
    `a${aspectCode}`,
    `h${spec.horizontal ? 1 : 0}`,
    `p${spec.palette}`,
  ].join("-");
}

function parseSeed(input) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("empty");
  const parts = trimmed.split("-");
  const base = toBase(parts[0]);
  const derived = deriveSettings(base);
  const tags = {};
  for (const part of parts.slice(1)) {
    const num = Number(part.slice(1));
    if (part.length > 1 && Number.isFinite(num)) tags[part[0]] = num;
  }
  const aspect = tags.a === 1 ? "square" : tags.a === 2 ? "landscape" : tags.a === 0 ? "portrait" : "portrait";
  const extras = deriveExtras(base, aspect);
  return {
    base,
    streak: tags.s == null ? derived.streak : clampInt(tags.s, 0, 100, derived.streak),
    blocks: tags.b == null ? derived.blocks : clampInt(tags.b, 6, 14, derived.blocks),
    sparkles: tags.k == null ? derived.sparkles : clampInt(tags.k, 40, 120, derived.sparkles),
    beads: tags.d == null ? derived.beads : clampInt(tags.d, 0, 100, derived.beads),
    aspect,
    horizontal: tags.h == null ? extras.horizontal : tags.h === 1,
    palette: tags.p == null ? extras.palette : clampInt(tags.p, 0, PALETTES.length - 1, extras.palette),
  };
}

function readTunables() {
  return {
    streak: Number(ui.streak.value),
    blocks: Number(ui.blocks.value),
    sparkles: Number(ui.sparkles.value),
    beads: Number(ui.beads.value),
  };
}

function readAspect() {
  const checked = document.querySelector('input[name="aspect"]:checked');
  return checked ? checked.value : "portrait";
}

function updateOutputs() {
  ui.streakOut.value = ui.streak.value;
  ui.blocksOut.value = ui.blocks.value;
  ui.sparklesOut.value = ui.sparkles.value;
  ui.beadsOut.value = ui.beads.value;
}

function applySpecToControls(spec) {
  ui.streak.value = String(spec.streak);
  ui.blocks.value = String(spec.blocks);
  ui.sparkles.value = String(spec.sparkles);
  ui.beads.value = String(spec.beads);
  const radio = document.querySelector(`input[name="aspect"][value="${spec.aspect}"]`);
  if (radio) radio.checked = true;
  ui.seed.value = formatSeed(spec);
  updateOutputs();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function loadImageUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

/* Shrink a huge scan, then crop away empty margins. A mostly clear picture
   (the tinsel strand) is scattered as fibre. A full photo is placed in slices. */
function prepareAsset(img, name) {
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const sample = document.createElement("canvas");
  sample.width = sw;
  sample.height = sh;
  const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
  sampleCtx.drawImage(img, 0, 0, sw, sh);
  const data = sampleCtx.getImageData(0, 0, sw, sh).data;
  let minX = sw;
  let minY = sh;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  const step = 2;
  for (let y = 0; y < sh; y += step) {
    for (let x = 0; x < sw; x += step) {
      if (data[(y * sw + x) * 4 + 3] > 28) {
        opaque += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const samples = Math.ceil(sw / step) * Math.ceil(sh / step);
  const coverage = samples ? opaque / samples : 1;
  const strand = coverage < 0.62;
  if (maxX < minX) return { canvas: sample, strand: false, name };
  const crop = document.createElement("canvas");
  crop.width = Math.max(1, maxX - minX + 1);
  crop.height = Math.max(1, maxY - minY + 1);
  crop.getContext("2d").drawImage(sample, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return { canvas: crop, strand, name };
}

async function loadLibrary() {
  const loaded = [];
  for (const name of PHOTO_FILES) {
    try {
      const img = await loadImageUrl(`${ASSET_FOLDER}${encodeURIComponent(name)}`);
      loaded.push(prepareAsset(img, name));
    } catch (error) {
      console.warn(`Could not open ${name}`);
    }
  }
  return loaded;
}

function pickDistinct(items, count, rand) {
  const pool = items.slice();
  const chosen = [];
  while (chosen.length < count && pool.length) {
    const index = Math.floor(rand() * pool.length);
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen;
}

function splitSpan(total, parts, rand) {
  const raw = [];
  let sum = 0;
  for (let i = 0; i < parts; i += 1) {
    const value = 0.4 + rand();
    raw.push(value);
    sum += value;
  }
  const spans = [];
  let cursor = 0;
  for (let i = 0; i < parts; i += 1) {
    const next = i === parts - 1 ? total : cursor + Math.round((total * raw[i]) / sum);
    spans.push(next - cursor);
    cursor = next;
  }
  return spans;
}

function drawCoverInRect(ctx, img, x, y, w, h) {
  const imageRatio = img.width / img.height;
  const frameRatio = w / h;
  let dw;
  let dh;
  if (imageRatio > frameRatio) {
    dh = h;
    dw = h * imageRatio;
  } else {
    dw = w;
    dh = w / imageRatio;
  }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/**
 * composeLibrary — fill the hidden scene with the Assets photos.
 * Full photos are placed edge to edge. Strands (mostly transparent scans)
 * are repeated into a curtain. Photo density controls how many copies.
 *
 * Tweak:
 *   copies formula     how full the curtain is
 *   height range       how far strands run past the frame
 */
function composeLibrary(ctx, w, h, rand, library, density) {
  ctx.fillStyle = "#090b10";
  ctx.fillRect(0, 0, w, h);
  const plates = library.filter((item) => !item.strand);
  const strands = library.filter((item) => item.strand);
  const used = [];

  if (plates.length) {
    const count = 1 + Math.floor(rand() * Math.min(plates.length, 1 + Math.round(density * 3)));
    const chosen = pickDistinct(plates, count, rand);
    chosen.forEach((item) => used.push(item.name));
    if (chosen.length === 1) {
      drawCover(ctx, chosen[0].canvas, w, h);
    } else {
      const vertical = rand() < 0.65;
      const spans = splitSpan(vertical ? w : h, chosen.length, rand);
      let cursor = 0;
      chosen.forEach((item, index) => {
        const span = spans[index];
        ctx.save();
        ctx.beginPath();
        if (vertical) ctx.rect(cursor, 0, span, h);
        else ctx.rect(0, cursor, w, span);
        ctx.clip();
        if (vertical) drawCoverInRect(ctx, item.canvas, cursor, 0, span, h);
        else drawCoverInRect(ctx, item.canvas, 0, cursor, w, span);
        ctx.restore();
        cursor += span;
      });
    }
  }

  if (strands.length) {
    /* Step across the frame so the scans cover it. Density tightens the overlap. */
    const overlap = 0.22 + density * 0.62;
    let x = -w * 0.04;
    let guard = 0;
    while (x < w && guard < 90) {
      guard += 1;
      const item = strands[Math.floor(rand() * strands.length)];
      if (!used.includes(item.name)) used.push(item.name);
      const height = h * (0.98 + rand() * 0.18);
      const scale = height / item.canvas.height;
      const width = Math.max(2, item.canvas.width * scale);
      const y = (rand() - 0.5) * h * 0.05;
      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate((rand() - 0.5) * 0.045);
      if (rand() < 0.5) ctx.scale(-1, 1);
      ctx.drawImage(item.canvas, -width / 2, -height / 2, width, height);
      ctx.restore();
      x += Math.max(4, width * (1.05 - overlap));
    }
  }
  return used;
}

function drawCover(ctx, img, w, h) {
  const imageRatio = img.width / img.height;
  const frameRatio = w / h;
  let dw;
  let dh;
  if (imageRatio > frameRatio) {
    dh = h;
    dw = h * imageRatio;
  } else {
    dw = w;
    dh = w / imageRatio;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function archBlob(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.bezierCurveTo(x, y + h * 0.2, x + w * 0.12, y, x + w * 0.5, y);
  ctx.bezierCurveTo(x + w * 0.88, y, x + w, y + h * 0.2, x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

function teardrop(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.45);
  ctx.quadraticCurveTo(x + r * 0.95, y - r * 0.1, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.95, y - r * 0.1, x, y - r * 1.45);
  ctx.fill();
}

function paintFibreGround(ctx, w, h, rand, palette) {
  const bytes = new Uint8ClampedArray(w * h * 4);
  const view = new Uint32Array(bytes.buffer);
  /* Hue stays put down a column, so every source row is the same tinsel barcode.
     Brightness steps create the soft horizontal bands. */
  const cycle = palette.bead.concat(palette.blob, palette.cream, palette.bar, [palette.shadow, palette.paper]);
  let x = 0;
  let cursor = Math.floor(rand() * cycle.length);
  while (x < w) {
    const streakW = Math.min(
      w - x,
      rand() < 0.05 ? 4 + Math.floor(rand() * 4) : rand() < 0.55 ? 1 : rand() < 0.85 ? 2 : 3
    );
    const family = cycle[cursor % cycle.length];
    if (rand() < 0.72) cursor += 1;
    const roll = rand();
    const columnGain = roll < 0.4 ? 0.38 + roll * 0.7 : 0.9 + (roll - 0.4) * 0.85;
    const base = tint(family, rand).map((channel) => clamp8(channel * columnGain));
    let y = 0;
    while (y < h) {
      const band = 48 + Math.floor(rand() * 180);
      const y2 = Math.min(h, y + band);
      const wobble = 0.9 + rand() * 0.16;
      const packed = pack(clamp8(base[0] * wobble), clamp8(base[1] * wobble), clamp8(base[2] * wobble));
      for (let yy = y; yy < y2; yy += 1) {
        const row = yy * w + x;
        for (let k = 0; k < streakW; k += 1) view[row + k] = packed;
      }
      y = y2;
    }
    x += streakW;
  }
  ctx.putImageData(new ImageData(bytes, w, h), 0, 0);
}

/**
 * buildSource — the picture that later gets stretched.
 * Assets photos fill the frame. If none of them open, the drawn fibre is the fallback.
 * An uploaded photo replaces the Assets set. An uploaded strand is scattered on top.
 */
function buildSource(ctx, w, h, rand, palette, beadDensity, images) {
  if (images.photo) {
    ctx.fillStyle = "#090b10";
    ctx.fillRect(0, 0, w, h);
    drawCover(ctx, images.photo, w, h);
    state.sourceNames = ["your photo"];
  } else if (images.library && images.library.length) {
    state.sourceNames = composeLibrary(ctx, w, h, rand, images.library, clamp(beadDensity / 100, 0, 1));
  } else {
    state.sourceNames = [];
    const density = clamp(beadDensity / 100, 0, 1);
    /*
      Ground is a hair of 1–3px columns, written with ImageData so a full
      1472×2610 field stays cheap. Colour drifts sideways instead of jumping
      every pixel, so a stretch reads as garlands rather than static.
      Segment height is what unstretched blocks show as short ticks.
      Ornaments above this are ordinary canvas shapes.
    */
    paintFibreGround(ctx, w, h, rand, palette);

    const shadows = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < shadows; i += 1) {
      ctx.fillStyle = css(palette.shadow);
      ctx.fillRect(rand() * w, rand() * h, w * (0.08 + rand() * 0.22), h * (0.04 + rand() * 0.12));
    }

    const blobs = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < blobs; i += 1) {
      const bw = w * (0.1 + rand() * 0.16);
      const bh = h * (0.035 + rand() * 0.07);
      const x = rand() * (w - bw * 0.4) - bw * 0.1;
      const y = rand() * h;
      ctx.fillStyle = css(tint(pick(palette.blob, rand), rand));
      if (rand() < 0.55) {
        archBlob(ctx, x, y, bw, bh);
      } else {
        ctx.beginPath();
        ctx.ellipse(x + bw / 2, y + bh * 0.45, bw / 2, bh * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const bars = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < bars; i += 1) {
      ctx.save();
      ctx.translate(rand() * w, rand() * h);
      ctx.rotate(-0.42 + rand() * 0.7);
      ctx.fillStyle = css(pick(palette.bar, rand));
      ctx.fillRect(0, 0, w * (0.28 + rand() * 0.48), 2 + rand() * 7);
      ctx.restore();
    }

    const creams = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < creams; i += 1) {
      const cw = w * (0.18 + rand() * 0.34);
      const ch = h * (0.05 + rand() * 0.1);
      const x = rand() * w;
      const y = rand() * h;
      ctx.fillStyle = css(pick(palette.cream, rand));
      ctx.fillRect(x, y, cw, ch);
      const glints = 8 + Math.floor(rand() * 14);
      ctx.fillStyle = css(pick(palette.bar, rand));
      for (let g = 0; g < glints; g += 1) {
        ctx.fillRect(x + rand() * cw, y + rand() * ch, 2 + rand() * 3, 2 + rand() * 2);
      }
    }

    const ornaments = Math.round(6 + density * 14);
    for (let i = 0; i < ornaments; i += 1) {
      const r = 8 + rand() * 26;
      const x = rand() * w;
      const y = rand() * h;
      ctx.fillStyle = css(tint(pick(palette.bead, rand), rand));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = css(pick(palette.cream, rand));
      ctx.beginPath();
      ctx.arc(x - r * 0.28, y - r * 0.32, Math.max(1.5, r * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }

    /* Scalloped clusters: the readable bead clumps in unstretched blocks. */
    const clusters = Math.round(2 + density * 9);
    for (let c = 0; c < clusters; c += 1) {
      const cx = rand() * w;
      const cy = rand() * h;
      const radius = (28 + rand() * 90) * (0.75 + density * 0.55);
      const lobes = 5 + Math.floor(rand() * 4);
      const count = Math.round(18 + density * 80);
      for (let i = 0; i < count; i += 1) {
        const angle = rand() * Math.PI * 2;
        const lobe = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(angle * lobes));
        const dist = radius * lobe * Math.sqrt(rand());
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist * 0.7;
        const color = tint(pick(palette.bead, rand), rand);
        ctx.fillStyle = css(color);
        const br = 1.1 + rand() * 3.4;
        if (rand() < 0.22) teardrop(ctx, px, py, br);
        else {
          ctx.beginPath();
          ctx.arc(px, py, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /* Wavy bands of beads, so a stretched row turns into repeating colour. */
    const bands = Math.round(3 + density * 5);
    for (let b = 0; b < bands; b += 1) {
      const y0 = ((b + 0.35 + rand() * 0.4) / bands) * h;
      const amp = h * (0.008 + rand() * 0.03);
      const phase = rand() * Math.PI * 2;
      const freq = 2 + rand() * 5;
      const count = Math.round(50 + density * 240);
      const span = w * (0.7 + rand() * 0.45);
      const x0 = rand() * w * 0.25;
      for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 0 : i / (count - 1);
        const x = x0 + t * span;
        const y = y0 + Math.sin(t * Math.PI * freq + phase) * amp;
        ctx.fillStyle = css(tint(pick(palette.bead, rand), rand));
        const br = 1 + rand() * 2.8;
        ctx.beginPath();
        ctx.arc(x, y, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (images.strand) scatterStrand(ctx, images.strand, w, h, rand);
}

function scatterStrand(ctx, img, w, h, rand) {
  const copies = 16 + Math.floor(rand() * 30);
  for (let i = 0; i < copies; i += 1) {
    const targetH = h * (0.08 + rand() * 0.2);
    const scale = targetH / img.height;
    ctx.save();
    ctx.translate(rand() * w, rand() * h);
    ctx.rotate((rand() - 0.5) * 0.55);
    ctx.globalAlpha = 0.4 + rand() * 0.6;
    ctx.drawImage(img, (-img.width * scale) / 2, -targetH / 2, img.width * scale, targetH);
    ctx.restore();
  }
}

function splitUntil(rects, target, rand, mode) {
  let guard = 0;
  while (rects.length < target && guard < 48) {
    guard += 1;
    let pickIndex = 0;
    let best = -1;
    for (let i = 0; i < rects.length; i += 1) {
      const score = rects[i].w * rects[i].h * (0.35 + rand());
      if (score > best) {
        best = score;
        pickIndex = i;
      }
    }
    const rect = rects[pickIndex];
    const canV = rect.w >= 24;
    const canH = rect.h >= 24;
    let vertical = mode === "vertical";
    if (mode === "either") {
      if (canV && canH) vertical = rect.w > rect.h ? rand() < 0.6 : rand() < 0.4;
      else vertical = canV;
    }
    if (vertical && !canV) {
      if (!canH) break;
      vertical = false;
    }
    if (!vertical && !canH) {
      if (!canV) break;
      vertical = true;
    }
    const cutFrac = 0.28 + rand() * 0.44;
    rects.splice(pickIndex, 1);
    if (vertical) {
      const cut = Math.max(10, Math.min(rect.w - 10, Math.round(rect.w * cutFrac)));
      rects.push({ x: rect.x, y: rect.y, w: cut, h: rect.h });
      rects.push({ x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h });
    } else {
      const cut = Math.max(10, Math.min(rect.h - 10, Math.round(rect.h * cutFrac)));
      rects.push({ x: rect.x, y: rect.y, w: rect.w, h: cut });
      rects.push({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut });
    }
  }
  return rects;
}

/**
 * blockify — cut the frame into 6–14 rectangles.
 * Early cuts are vertical, and a few of those strips stay full height so some
 * drips can run the whole picture. Each block stores the source row it stretches
 * from, a sideways shift, a streak-length range, and whether it stays sharp.
 *
 * Tweak:
 *   fullStrips / freezeCount   how many columns run top to bottom
 *   SHIFT is 25 × SCALE       sideways displacement
 *   passTarget                pixel share left unstretched (about 8–18%)
 *   minF / maxF               streak length as a fraction of the block
 */
function blockify(w, h, count, rand, streak) {
  const fullStrips = Math.max(2, Math.min(count, 2 + Math.floor(rand() * Math.max(2, count * 0.55))));
  let rects = splitUntil([{ x: 0, y: 0, w, h }], fullStrips, rand, "vertical");
  for (let i = rects.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const swap = rects[i];
    rects[i] = rects[j];
    rects[j] = swap;
  }
  const freezeCount = Math.max(1, Math.min(rects.length, Math.round(rects.length * 0.45)));
  const frozen = rects.slice(0, freezeCount).map((rect) => ({ ...rect }));
  let loose = rects.slice(freezeCount).map((rect) => ({ ...rect }));
  loose = splitUntil(loose, Math.max(loose.length, count - frozen.length), rand, "either");
  rects = frozen.concat(loose);

  /* Keep unstretched islands small, or the largest block swallows the picture. */
  const passTarget = w * h * (0.08 + rand() * 0.1);
  const candidates = rects
    .map((rect, index) => ({ index, area: rect.w * rect.h, rank: rand() }))
    .sort((a, b) => a.rank - b.rank);
  const pass = new Set();
  let passArea = 0;
  for (const candidate of candidates) {
    if (pass.size >= 1 && passArea >= passTarget) break;
    if (candidate.area > w * h * 0.22) continue;
    pass.add(candidate.index);
    passArea += candidate.area;
    if (pass.size >= 3) break;
  }
  if (!pass.size) pass.add(candidates[0].index);

  const t = clamp(streak / 100, 0, 1);
  const minF = 0.02 + t * 0.4;
  const maxF = Math.min(1, 0.1 + t * 0.9);
  const shiftMax = 25 * SCALE;

  return rects.map((rect, index) => ({
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    sampleY: Math.round(rand() * (h - 1)),
    sampleX: Math.round(rand() * (w - 1)),
    shift: Math.round(rand() * shiftMax),
    passthrough: pass.has(index),
    lenMinF: minF,
    lenMaxF: Math.max(minF + 0.04, maxF),
  }));
}

function copyShifted(src32, dst32, w, h, block) {
  const x1 = block.x + block.w;
  const y1 = Math.min(h, block.y + block.h);
  const shift = block.shift;
  for (let y = block.y; y < y1; y += 1) {
    const row = y * w;
    for (let x = block.x; x < x1; x += 1) {
      let sx = x + shift;
      if (sx < 0) sx = 0;
      else if (sx >= w) sx = w - 1;
      dst32[row + x] = src32[row + sx];
    }
  }
}

function pickStreakWidth(rand) {
  const roll = rand();
  if (roll < 0.55) return 1;
  if (roll < 0.88) return 2;
  return 3;
}

function paintVertical(dst32, w, x, y0, y1, streakW, color) {
  const len = y1 - y0;
  const edge = len > 18 ? Math.min(6, len >> 3) : 0;
  for (let y = y0; y < y1; y += 1) {
    let paint = color;
    if (edge) {
      const fromStart = y - y0;
      const fromEnd = y1 - 1 - y;
      if (fromStart < edge) paint = scalePacked(color, 0.7 + (0.3 * fromStart) / edge);
      else if (fromEnd < edge) paint = scalePacked(color, 0.6 + (0.4 * fromEnd) / edge);
    }
    let i = y * w + x;
    for (let k = 0; k < streakW; k += 1) dst32[i + k] = paint;
  }
}

function paintHorizontal(dst32, w, x0, x1, y, streakH, color, h) {
  const len = x1 - x0;
  const edge = len > 18 ? Math.min(6, len >> 3) : 0;
  const y1 = Math.min(h, y + streakH);
  for (let x = x0; x < x1; x += 1) {
    let paint = color;
    if (edge) {
      const fromStart = x - x0;
      const fromEnd = x1 - 1 - x;
      if (fromStart < edge) paint = scalePacked(color, 0.7 + (0.3 * fromStart) / edge);
      else if (fromEnd < edge) paint = scalePacked(color, 0.6 + (0.4 * fromEnd) / edge);
    }
    for (let yy = y; yy < y1; yy += 1) dst32[yy * w + x] = paint;
  }
}

/**
 * smearColumns — turn the source into tinsel.
 * Inside each block, every 1–3px column picks a nearby source row and paints
 * that colour downward for a random length. Neighbour columns wander, so the
 * fringe is uneven. Brightness jitters about ±15% per column.
 * Horizontal mode does the same thing sideways. Passthrough blocks are copied
 * with their sideways shift and no stretch, so beads and blobs stay readable.
 *
 * Tweak:
 *   COLUMN_JITTER   per-column brightness, 0.15 is ±15%
 *   window size     how far neighbouring columns drift through the source
 */
function smearColumns(src32, dst32, w, h, blocks, rand, horizontal) {
  const COLUMN_JITTER = 0.15;
  if (horizontal) {
    smearRows(src32, dst32, w, h, blocks, rand, COLUMN_JITTER);
    return;
  }

  for (const block of blocks) {
    if (block.passthrough) {
      copyShifted(src32, dst32, w, h, block);
      continue;
    }
    const windowH = Math.round(16 + rand() * 78);
    const preferred = pickStreakWidth(rand);
    const lenMin = Math.max(2, Math.round(block.h * block.lenMinF));
    const lenMax = Math.max(lenMin + 1, Math.round(block.h * block.lenMaxF));
    let sy = block.sampleY;
    let x = block.x;
    const x1 = block.x + block.w;
    const y1 = block.y + block.h;
    while (x < x1) {
      const streakW = Math.min(x1 - x, rand() < 0.72 ? preferred : pickStreakWidth(rand));
      sy += (rand() - 0.5) * windowH * 0.42;
      if (rand() < 0.08) sy = block.sampleY + (rand() - 0.5) * windowH;
      if (sy < 0) sy = 0;
      else if (sy > h - 1) sy = h - 1;
      const columnGain = 1 + (rand() - 0.5) * COLUMN_JITTER * 2;
      let y = block.y;
      let len = lenMin + rand() * (lenMax - lenMin);
      while (y < y1) {
        len += (rand() - 0.5) * (lenMax - lenMin) * 0.45;
        if (len < lenMin) len = lenMin;
        else if (len > lenMax) len = lenMax;
        const sampleY = clamp(Math.round(sy + (rand() - 0.5) * windowH * 0.2), 0, h - 1);
        let sampleX = Math.round(x + block.shift + (rand() - 0.5) * 4);
        if (sampleX < 0) sampleX = 0;
        else if (sampleX >= w) sampleX = w - 1;
        const color = scalePacked(src32[sampleY * w + sampleX], columnGain);
        const y2 = Math.min(y1, y + Math.max(2, Math.round(len)));
        paintVertical(dst32, w, x, y, y2, streakW, color);
        y = y2;
      }
      x += streakW;
    }
  }
}

function smearRows(src32, dst32, w, h, blocks, rand, columnJitter) {
  for (const block of blocks) {
    if (block.passthrough) {
      copyShifted(src32, dst32, w, h, block);
      continue;
    }
    const windowW = Math.round(16 + rand() * 78);
    const preferred = pickStreakWidth(rand);
    const lenMin = Math.max(2, Math.round(block.w * block.lenMinF));
    const lenMax = Math.max(lenMin + 1, Math.round(block.w * block.lenMaxF));
    let y = block.y;
    const y1 = block.y + block.h;
    const x1 = block.x + block.w;
    while (y < y1) {
      const streakH = Math.min(y1 - y, rand() < 0.72 ? preferred : pickStreakWidth(rand));
      let sx = block.sampleX;
      let x = block.x;
      const rowGain = 1 + (rand() - 0.5) * columnJitter * 2;
      while (x < x1) {
        sx += (rand() - 0.5) * windowW * 0.42;
        if (rand() < 0.08) sx = block.sampleX + (rand() - 0.5) * windowW;
        let sampleX = Math.round(sx);
        if (sampleX < 0) sampleX = 0;
        else if (sampleX >= w) sampleX = w - 1;
        let sampleY = Math.round(y + block.shift);
        if (sampleY < 0) sampleY = 0;
        else if (sampleY >= h) sampleY = h - 1;
        const lenRoll = lenMin + rand() * (lenMax - lenMin);
        const x2 = Math.min(x1, x + Math.max(2, Math.round(lenRoll)));
        const color = scalePacked(src32[sampleY * w + sampleX], rowGain);
        paintHorizontal(dst32, w, x, x2, y, streakH, color, h);
        x = x2;
      }
      y += streakH;
    }
  }
}

/**
 * addSparkles — four-point stars on the bright fibres.
 * Additive blend, warm (or palette) tint, soft centre. They gather where the
 * collage is already light, which is where tinsel would catch a lamp.
 *
 * Tweak:
 *   radius range    star size, in output pixels
 *   threshold       how bright a pixel must be to host a star
 */
function addSparkles(data, w, h, rand, count, palette) {
  const step = 5;
  let threshold = 176;
  let points = collectBright(data, w, h, threshold, step);
  if (points.length < count) {
    threshold = 140;
    points = collectBright(data, w, h, threshold, step);
  }
  if (points.length < count) points = collectBright(data, w, h, 90, step);
  if (!points.length) return;

  const pairs = points.length / 2;
  for (let s = 0; s < count; s += 1) {
    const at = (rand() * pairs) | 0;
    const cx = clamp(points[at * 2] + Math.round((rand() - 0.5) * 22), 0, w - 1);
    const cy = clamp(points[at * 2 + 1] + Math.round((rand() - 0.5) * 22), 0, h - 1);
    const radius = 5 + rand() * 13;
    const tintColor = pick(palette.spark, rand);
    stampStar(data, w, h, cx, cy, radius, tintColor);
  }
}

function collectBright(data, w, h, minLum, step) {
  const pts = [];
  for (let y = 0; y < h; y += step) {
    const row = y * w * 4;
    for (let x = 0; x < w; x += step) {
      const i = row + x * 4;
      const lum = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      if (lum >= minLum) {
        pts.push(x, y);
      }
    }
  }
  return pts;
}

function stampStar(data, w, h, cx, cy, radius, tintColor) {
  const r = radius | 0;
  const arm = Math.max(1.2, r * 0.16);
  for (let dy = -r; dy <= r; dy += 1) {
    const y = cy + dy;
    if (y < 0 || y >= h) continue;
    for (let dx = -r; dx <= r; dx += 1) {
      const x = cx + dx;
      if (x < 0 || x >= w) continue;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const flareH = Math.max(0, 1 - ax / r) * Math.max(0, 1 - ay / arm);
      const flareV = Math.max(0, 1 - ay / r) * Math.max(0, 1 - ax / arm);
      const dist = Math.hypot(dx, dy);
      const glow = Math.max(0, 1 - dist / (r * 0.5));
      const intensity = Math.min(1, flareH + flareV + glow * glow * 0.5);
      if (intensity < 0.04) continue;
      const i = (y * w + x) * 4;
      data[i] = Math.min(255, data[i] + tintColor[0] * intensity);
      data[i + 1] = Math.min(255, data[i + 1] + tintColor[1] * intensity);
      data[i + 2] = Math.min(255, data[i + 2] + tintColor[2] * intensity);
    }
  }
}

/** Faint grain. Strength is the ± range, in 8-bit steps. */
function addGrain(data, seed) {
  let n = seed || 1;
  const strength = 4;
  for (let i = 0; i < data.length; i += 4) {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    const g = (n & 7) - 3;
    if (!g) continue;
    const amount = g > 0 ? Math.min(strength, g) : Math.max(-strength, g);
    data[i] = clamp8(data[i] + amount);
    data[i + 1] = clamp8(data[i + 1] + amount);
    data[i + 2] = clamp8(data[i + 2] + amount);
  }
}

function draw(spec) {
  if (!pixelsAreLittleEndian()) {
    throw new Error("endian");
  }
  const started = performance.now();
  const [bw, bh] = BASE[spec.aspect] || BASE.portrait;
  const w = bw * SCALE;
  const h = bh * SCALE;
  const ctx = ui.canvas.getContext("2d", { willReadFrequently: true });
  if (ui.canvas.width !== w || ui.canvas.height !== h) {
    ui.canvas.width = w;
    ui.canvas.height = h;
  }
  sourceCanvas.width = w;
  sourceCanvas.height = h;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const palette = PALETTES[spec.palette] || PALETTES[0];
  buildSource(
    sourceCtx,
    w,
    h,
    mulberry32(hashString(`${spec.base}:source`)),
    palette,
    spec.beads,
    { photo: state.photo, strand: state.strand, library: state.library }
  );

  const snap = sourceCtx.getImageData(0, 0, w, h);
  const srcCopy = new Uint8ClampedArray(snap.data);
  const src32 = new Uint32Array(srcCopy.buffer);
  const outBytes = new Uint8ClampedArray(w * h * 4);
  const dst32 = new Uint32Array(outBytes.buffer);
  const blocks = blockify(w, h, spec.blocks, mulberry32(hashString(`${spec.base}:layout`)), spec.streak);
  smearColumns(src32, dst32, w, h, blocks, mulberry32(hashString(`${spec.base}:smear`)), spec.horizontal);
  addGrain(outBytes, hashString(`${spec.base}:grain`));
  addSparkles(outBytes, w, h, mulberry32(hashString(`${spec.base}:spark`)), spec.sparkles, palette);
  ctx.putImageData(new ImageData(outBytes, w, h), 0, 0);
  ui.canvas.setAttribute("aria-label", `${palette.name} tinsel collage, seed ${spec.base}`);
  return Math.round(performance.now() - started);
}

function fitCanvas() {
  const frameW = ui.frame.clientWidth;
  const frameH = ui.frame.clientHeight;
  if (!frameW || !frameH) return;
  const scale = Math.min(frameW / ui.canvas.width, frameH / ui.canvas.height);
  ui.canvas.style.width = `${Math.max(1, ui.canvas.width * scale)}px`;
  ui.canvas.style.height = `${Math.max(1, ui.canvas.height * scale)}px`;
}

function makeThumb() {
  const thumb = document.createElement("canvas");
  thumb.width = 96;
  thumb.height = Math.max(1, Math.round(96 * (ui.canvas.height / ui.canvas.width)));
  thumb.getContext("2d").drawImage(ui.canvas, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL("image/jpeg", 0.72);
}

function paintHistory() {
  const current = state.spec ? formatSeed(state.spec) : "";
  ui.history.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "The last 12 collages show up here.";
    ui.history.append(empty);
    return;
  }
  for (const item of state.history) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb";
    button.setAttribute("role", "listitem");
    button.dataset.seed = item.seed;
    button.setAttribute("aria-label", `Restore collage ${item.seed}`);
    if (item.seed === current) button.setAttribute("aria-current", "true");
    const img = document.createElement("img");
    img.alt = "";
    img.src = item.url;
    button.append(img);
    button.addEventListener("click", () => restore(item.seed));
    ui.history.append(button);
  }
}

function pushHistory(seed) {
  const url = makeThumb();
  state.history = state.history.filter((item) => item.seed !== seed);
  state.history.unshift({ seed, url });
  state.history = state.history.slice(0, 12);
  paintHistory();
}

function render(nextSpec, options) {
  window.clearTimeout(fadeTimer);
  renderToken += 1;
  const token = renderToken;
  state.spec = nextSpec;
  if (options.syncControls) applySpecToControls(nextSpec);
  else ui.seed.value = formatSeed(nextSpec);
  updateOutputs();

  const finish = () => {
    if (token !== renderToken) return;
    try {
      const ms = draw(nextSpec);
      fitCanvas();
      const palette = PALETTES[nextSpec.palette].name;
      const mode = nextSpec.horizontal ? "Horizontal streaks" : "Vertical streaks";
      const names = state.sourceNames && state.sourceNames.length ? ` · ${state.sourceNames.join(", ")}` : "";
      ui.status.textContent = `${palette} · ${mode} · ${ui.canvas.width}×${ui.canvas.height} · ${ms} ms${names}`;
      ui.download.disabled = false;
      if (options.history) pushHistory(formatSeed(nextSpec));
      else paintHistory();
      requestAnimationFrame(() => {
        if (token === renderToken) ui.canvas.style.opacity = "1";
      });
    } catch (error) {
      ui.canvas.style.opacity = "1";
      ui.status.textContent = error && error.message === "endian"
        ? "This browser packs pixels in an unexpected order, so the collage was not drawn."
        : "That collage could not be drawn. Try Generate again.";
    }
  };

  if (options.fade && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    ui.canvas.style.opacity = "0";
    fadeTimer = window.setTimeout(finish, 190);
  } else {
    ui.canvas.style.opacity = "1";
    finish();
  }
}

function generate() {
  const base = randomBase();
  const aspect = readAspect();
  const tunables = ui.randomise.checked ? deriveSettings(base) : readTunables();
  const extras = deriveExtras(base, aspect);
  render(
    {
      base,
      aspect,
      streak: tunables.streak,
      blocks: tunables.blocks,
      sparkles: tunables.sparkles,
      beads: tunables.beads,
      palette: extras.palette,
      horizontal: extras.horizontal,
    },
    { fade: true, history: true, syncControls: true }
  );
}

function useSeed() {
  try {
    render(parseSeed(ui.seed.value), { fade: true, history: true, syncControls: true });
  } catch (error) {
    ui.status.textContent = "Enter a seed, then press Use seed.";
  }
}

function restore(seed) {
  render(parseSeed(seed), { fade: true, history: false, syncControls: true });
}

function rerenderFromControls(saveHistory, fade) {
  if (!state.spec) return;
  render(
    { ...state.spec, ...readTunables(), aspect: readAspect() },
    { fade: Boolean(fade), history: saveHistory, syncControls: false }
  );
}

function wire() {
  ui.generate.addEventListener("click", generate);
  ui.useSeed.addEventListener("click", useSeed);
  ui.seed.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      useSeed();
    }
  });

  for (const input of [ui.streak, ui.blocks, ui.sparkles, ui.beads]) {
    input.addEventListener("input", () => {
      updateOutputs();
      window.clearTimeout(sliderTimer);
      sliderTimer = window.setTimeout(() => rerenderFromControls(false, false), 50);
    });
    input.addEventListener("change", () => {
      window.clearTimeout(sliderTimer);
      rerenderFromControls(true, false);
    });
  }

  for (const input of document.querySelectorAll('input[name="aspect"]')) {
    input.addEventListener("change", () => {
      if (input.checked) rerenderFromControls(true, true);
    });
  }

  ui.photo.addEventListener("change", async () => {
    const file = ui.photo.files && ui.photo.files[0];
    if (!file) return;
    try {
      state.photo = await loadImage(file);
      ui.clearPhoto.disabled = false;
      if (state.spec) rerenderFromControls(true, true);
    } catch (error) {
      ui.status.textContent = "That photo could not be opened.";
    }
  });

  ui.strand.addEventListener("change", async () => {
    const file = ui.strand.files && ui.strand.files[0];
    if (!file) return;
    try {
      state.strand = await loadImage(file);
      ui.clearStrand.disabled = false;
      if (state.spec) rerenderFromControls(true, true);
    } catch (error) {
      ui.status.textContent = "That strand image could not be opened.";
    }
  });

  ui.clearPhoto.addEventListener("click", () => {
    state.photo = null;
    ui.photo.value = "";
    ui.clearPhoto.disabled = true;
    if (state.spec) rerenderFromControls(true, true);
  });

  ui.clearStrand.addEventListener("click", () => {
    state.strand = null;
    ui.strand.value = "";
    ui.clearStrand.disabled = true;
    if (state.spec) rerenderFromControls(true, true);
  });

  ui.download.addEventListener("click", () => {
    if (!state.spec) return;
    ui.canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `tinsel-collage-${formatSeed(state.spec)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat) return;
    const target = event.target;
    const tag = target && target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (target && target.isContentEditable)) return;
    if (target && target.closest && target.closest("button, a, label")) return;
    event.preventDefault();
    generate();
  });

  let resizeTick = 0;
  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(resizeTick);
    resizeTick = window.requestAnimationFrame(fitCanvas);
  });

  updateOutputs();
  paintHistory();
}

async function start() {
  wire();
  ui.status.textContent = "Loading photos from Assets…";
  state.library = await loadLibrary();
  if (!state.library.length) {
    ui.status.textContent = "Could not open the Assets photos. Generate will use the drawn tinsel until one loads.";
  }
  generate();
}

start();
