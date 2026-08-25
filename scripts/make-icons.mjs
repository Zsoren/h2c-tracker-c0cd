// Generate PWA icons (PNG) with no dependencies: amber square, black "H2C" in a chunky pixel font.
import fs from 'node:fs'
import zlib from 'node:zlib'

const FONT = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  '2': ['11110', '00001', '00001', '01110', '10000', '10000', '11111'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
}

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y)
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function render(size, { padding = 0 } = {}) {
  const AMBER = [255, 179, 0], BLACK = [0, 0, 0]
  const text = 'H2C'
  const cols = text.length * 5 + (text.length - 1) * 1   // 17 cells wide
  const rows = 7
  const inner = size - padding * 2
  const cell = Math.floor((inner * 0.78) / cols)
  const w = cell * cols, h = cell * rows
  const ox = Math.floor((size - w) / 2), oy = Math.floor((size - h) / 2)
  return png(size, (x, y) => {
    if (x < padding || y < padding || x >= size - padding || y >= size - padding) return BLACK
    const cx = Math.floor((x - ox) / cell), cy = Math.floor((y - oy) / cell)
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return AMBER
    const ci = Math.floor(cx / 6), gx = cx % 6
    if (gx === 5) return AMBER
    return FONT[text[ci]][cy][gx] === '1' ? BLACK : AMBER
  })
}

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/icon-192.png', render(192))
fs.writeFileSync('public/icon-512.png', render(512))
fs.writeFileSync('public/icon-maskable-512.png', render(512, { padding: 0 }))
fs.writeFileSync('public/apple-touch-icon.png', render(180))
console.log('icons written')
