#!/usr/bin/env node
// scripts/generate-icons.js — DepGest icon generator (zero external deps)
'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── CRC32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG encoder ─────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const crcBuf  = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const rows   = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    rows[y * stride] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * stride + 1 + x * 4;
      rows[d] = rgba[s]; rows[d+1] = rgba[s+1]; rows[d+2] = rgba[s+2]; rows[d+3] = rgba[s+3];
    }
  }
  const idat = zlib.deflateSync(rows, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── ICO wrapper (PNG-in-ICO, supported by all modern browsers + Electron) ───
function buildICO(pngList) {
  const n = pngList.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(n, 4);

  let offset = 6 + n * 16;
  const dirEntries = pngList.map(({ w, h, png }) => {
    const e = Buffer.alloc(16);
    e[0] = w >= 256 ? 0 : w;
    e[1] = h >= 256 ? 0 : h;
    e[2] = 0; e[3] = 0;
    e.writeUInt16LE(1,  4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });

  return Buffer.concat([header, ...dirEntries, ...pngList.map(p => p.png)]);
}

// ─── Icon renderer ────────────────────────────────────────────────────────────
// Monograma "D": barra vertical (espinha) + barra topo + barra base + arco direito
// Fundo: #0D0D0D  |  Acento: #F5A623  |  Cantos arredondados
function renderIcon(S) {
  const rgba = new Uint8Array(S * S * 4);

  const CR = S * 0.17;    // raio dos cantos
  const TK = S * 0.115;   // espessura do traço
  const VM = S * 0.13;    // margem vertical
  const HM = S * 0.15;    // margem horizontal

  const lT   = VM;
  const lB   = S - VM;
  const lL   = HM;
  const midY = S / 2;

  const arcRo = midY - lT;           // raio externo do arco (= metade da altura)
  const arcRi = arcRo - TK;          // raio interno
  const arcCx = lL + arcRo * 0.72;   // centro x do arco
  const arcCy = midY;

  const SS = 4; // supersampling 4×4

  function inRoundedRect(x, y) {
    const inL = x < CR, inR = x > S - 1 - CR;
    const inT = y < CR, inB = y > S - 1 - CR;
    if ((inL || inR) && (inT || inB)) {
      const cx = inL ? CR : S - 1 - CR;
      const cy = inT ? CR : S - 1 - CR;
      return Math.hypot(x - cx, y - cy) <= CR;
    }
    return true;
  }

  function inLetter(x, y) {
    if (x >= lL && x <= lL + TK && y >= lT && y <= lB) return true;    // espinha
    if (x >= lL && x <= arcCx  && y >= lT && y <= lT + TK) return true; // barra topo
    if (x >= lL && x <= arcCx  && y >= lB - TK && y <= lB) return true; // barra base
    const d = Math.hypot(x - arcCx, y - arcCy);
    if (x >= arcCx && d >= arcRi && d <= arcRo) return true;             // arco direito
    return false;
  }

  for (let row = 0; row < S; row++) {
    for (let col = 0; col < S; col++) {
      const idx = (row * S + col) * 4;

      let bgCov = 0, fgCov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = col + (sx + 0.5) / SS - 0.5;
          const fy = row + (sy + 0.5) / SS - 0.5;
          if (!inRoundedRect(fx, fy)) continue;
          bgCov++;
          if (inLetter(fx, fy)) fgCov++;
        }
      }

      const total = SS * SS;
      if (bgCov === 0) { rgba[idx + 3] = 0; continue; }

      const bgAlpha = bgCov / total;
      const blend   = fgCov / bgCov; // fração da área visível que é letra

      rgba[idx]     = Math.round(13  * (1 - blend) + 245 * blend);
      rgba[idx + 1] = Math.round(13  * (1 - blend) + 166 * blend);
      rgba[idx + 2] = Math.round(13  * (1 - blend) + 35  * blend);
      rgba[idx + 3] = Math.round(bgAlpha * 255);
    }
  }

  return rgba;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const ROOT       = path.resolve(__dirname, '..');
const ELEC_PUB   = path.join(ROOT, 'public');
const VERCEL_PUB = path.join(ROOT, 'vercel-app', 'public');

console.log('Gerando ícones DepGest…\n');

const rendered = {};
for (const s of [16, 32, 180, 192, 256]) {
  rendered[s] = encodePNG(s, s, renderIcon(s));
  console.log(`  ✓ ${s}×${s} renderizado`);
}

fs.mkdirSync(ELEC_PUB,   { recursive: true });
fs.mkdirSync(VERCEL_PUB, { recursive: true });

// 1. public/icon.ico — Electron 256×256
fs.writeFileSync(
  path.join(ELEC_PUB, 'icon.ico'),
  buildICO([{ w: 256, h: 256, png: rendered[256] }])
);
console.log('\n  ✓ public/icon.ico');

// 2. vercel-app/public/favicon.ico — 16×16 + 32×32
fs.writeFileSync(
  path.join(VERCEL_PUB, 'favicon.ico'),
  buildICO([
    { w: 16, h: 16, png: rendered[16] },
    { w: 32, h: 32, png: rendered[32] },
  ])
);
console.log('  ✓ vercel-app/public/favicon.ico');

// 3. vercel-app/public/apple-touch-icon.png — 180×180 iOS
fs.writeFileSync(path.join(VERCEL_PUB, 'apple-touch-icon.png'), rendered[180]);
console.log('  ✓ vercel-app/public/apple-touch-icon.png');

// 4. vercel-app/public/icon-192.png — 192×192 Android PWA
fs.writeFileSync(path.join(VERCEL_PUB, 'icon-192.png'), rendered[192]);
console.log('  ✓ vercel-app/public/icon-192.png');

console.log('\nPronto!');
