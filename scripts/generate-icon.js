/**
 * Gera public/icon.ico com 256x256 BMP 24-bit.
 * Design: fundo escuro arredondado, letra "D" âmbar centralizada.
 */
const fs = require('fs')
const path = require('path')

const W = 256, H = 256

// Cores BGR (BMP armazena em BGR)
const BG   = [0x0D, 0x0D, 0x0D]  // #0D0D0D
const CARD = [0x1A, 0x1A, 0x1A]  // #1A1A1A
const ACC  = [0x23, 0xA6, 0xF5]  // #F5A623 âmbar

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
}

function makePixels() {
  const cx = W / 2, cy = H / 2
  const radius = W / 2 - 4  // raio do círculo do ícone
  const innerR = radius - 10  // borda de 10px

  const px = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => [...BG])
  )

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = dist(x, y, cx, cy)
      if (d <= innerR) {
        px[y][x] = [...CARD]
      } else if (d <= radius) {
        // anti-aliasing simples na borda
        const t = (radius - d) / 10
        px[y][x] = [
          Math.round(CARD[0] * t + BG[0] * (1 - t)),
          Math.round(CARD[1] * t + BG[1] * (1 - t)),
          Math.round(CARD[2] * t + BG[2] * (1 - t)),
        ]
      }
    }
  }

  // Letra "D" em âmbar — escala para 256x256
  // Grid 16x16 original → escala 8x para 128x128, centrado
  const scale = 8
  const dGrid = [
    [1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [1,1,0,0,0,0,0,0,1,1,1,1,0,0,0,0],
    [1,1,0,0,0,0,0,0,0,1,1,1,1,0,0,0],
    [1,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0],
    [1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,0],
    [1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
    [1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
    [1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
    [1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],
    [1,1,0,0,0,0,0,0,0,0,0,1,1,1,1,0],
    [1,1,0,0,0,0,0,0,0,1,1,1,1,0,0,0],
    [1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]

  const gridW = dGrid[0].length * scale  // 128
  const gridH = dGrid.length * scale     // 128
  const ox = Math.floor((W - gridW) / 2)
  const oy = Math.floor((H - gridH) / 2)

  for (let r = 0; r < dGrid.length; r++) {
    for (let c = 0; c < dGrid[r].length; c++) {
      if (!dGrid[r][c]) continue
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const y = oy + r * scale + sy
          const x = ox + c * scale + sx
          if (y >= 0 && y < H && x >= 0 && x < W) {
            // Só pinta se estiver dentro do círculo
            if (dist(x, y, cx, cy) <= innerR) {
              px[y][x] = [...ACC]
            }
          }
        }
      }
    }
  }

  return px
}

function buildBmpData(pixels) {
  const rowSize = W * 3  // 768 bytes, múltiplo de 4
  const xorSize = H * rowSize
  const andRowSize = Math.ceil(W / 8)  // 32 bytes, múltiplo de 4
  const andSize = H * andRowSize
  const bmpSize = 40 + xorSize + andSize

  const buf = Buffer.alloc(bmpSize, 0)
  let off = 0

  buf.writeUInt32LE(40, off); off += 4
  buf.writeInt32LE(W, off);   off += 4
  buf.writeInt32LE(H * 2, off); off += 4  // double para ICO
  buf.writeUInt16LE(1, off);  off += 2
  buf.writeUInt16LE(24, off); off += 2
  buf.writeUInt32LE(0, off);  off += 4
  buf.writeUInt32LE(xorSize + andSize, off); off += 4
  buf.writeInt32LE(0, off);   off += 4
  buf.writeInt32LE(0, off);   off += 4
  buf.writeUInt32LE(0, off);  off += 4
  buf.writeUInt32LE(0, off);  off += 4

  // XOR data: bottom-up
  for (let y = H - 1; y >= 0; y--) {
    for (let x = 0; x < W; x++) {
      const [b, g, r] = pixels[y][x]
      buf[off++] = b
      buf[off++] = g
      buf[off++] = r
    }
  }
  // AND mask: todos 0 (opaco) — já inicializado

  return buf
}

function buildIco(bmpData) {
  const imageOffset = 6 + 16
  const ico = Buffer.alloc(imageOffset + bmpData.length, 0)

  ico.writeUInt16LE(0, 0)
  ico.writeUInt16LE(1, 2)
  ico.writeUInt16LE(1, 4)

  // ICONDIRENTRY: width=0 e height=0 significa 256
  ico[6]  = 0   // width = 256
  ico[7]  = 0   // height = 256
  ico[8]  = 0
  ico[9]  = 0
  ico.writeUInt16LE(1, 10)
  ico.writeUInt16LE(24, 12)
  ico.writeUInt32LE(bmpData.length, 14)
  ico.writeUInt32LE(imageOffset, 18)

  bmpData.copy(ico, imageOffset)
  return ico
}

const pixels = makePixels()
const bmpData = buildBmpData(pixels)
const icoData = buildIco(bmpData)

const outPath = path.join(__dirname, '..', 'public', 'icon.ico')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, icoData)
console.log(`Ícone 256x256 gerado: ${outPath} (${(icoData.length / 1024).toFixed(1)} KB)`)
