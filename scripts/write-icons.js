/* Genera public/icon-192.png e icon-512.png en el build (GitHub no acepta binarios por el conector). */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}
function u32(n) {
  return Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}
function chunk(type, data) {
  const t = Buffer.from(type);
  const crc = u32(crc32(Buffer.concat([t, data])));
  return Buffer.concat([u32(data.length), t, data, crc]);
}
function png(size) {
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2;
      const cy = y - size / 2;
      const r = Math.sqrt(cx * cx + cy * cy);
      const pin = r < size * 0.28;
      raw.push(pin ? 243 : 31, pin ? 238 : 111, pin ? 228 : 74, 255);
    }
  }
  const ihdr = Buffer.concat([u32(size), u32(size), Buffer.from([8, 6, 0, 0, 0])]);
  const idat = zlib.deflateSync(Buffer.from(raw));
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
const dir = path.join(process.cwd(), "public");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "icon-192.png"), png(192));
fs.writeFileSync(path.join(dir, "icon-512.png"), png(512));
console.log("iconos PNG escritos");
