// Draws the 256 px STEELRISE icon (yellow tower crane on charcoal with a
// hazard stripe) and writes resources/icon.png. No image libraries needed.
import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

const N = 256;
const px = new Uint8Array(N * N * 4);
const set = (x, y, [r, g, b], a = 255) => {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = (y * N + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
};
const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, c); };
const line = (x0, y0, x1, y1, w, c) => {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; rect(Math.round(x - w / 2), Math.round(y - w / 2), Math.round(x + w / 2), Math.round(y + w / 2), c); }
};
const CH = [24, 26, 29], Y = [255, 194, 14], DK = [12, 13, 15], W = [236, 233, 226];
// rounded charcoal tile
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = Math.max(0, Math.abs(x - 127.5) - 100), dy = Math.max(0, Math.abs(y - 127.5) - 100);
  if (Math.hypot(dx, dy) <= 26) set(x, y, CH);
}
// hazard stripe along the bottom
for (let y = 200; y < 226; y++) for (let x = 28; x < 228; x++) set(x, y, ((x + y) >> 4) % 2 ? Y : DK);
// mast
rect(92, 62, 108, 200, Y);
for (let y = 66; y < 196; y += 16) { line(92, y, 108, y + 16, 3, DK); }
// jib and counter-jib
rect(52, 52, 214, 62, Y);
line(100, 30, 52, 52, 4, Y);
line(100, 30, 200, 52, 4, Y);
rect(96, 26, 104, 52, Y);
rect(52, 62, 76, 78, W); // counterweight
// hook rope and load
line(176, 62, 176, 132, 3, W);
rect(150, 132, 202, 146, Y);
rect(160, 146, 192, 150, DK);

// PNG encode
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const raw = Buffer.alloc(N * (N * 4 + 1));
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; Buffer.from(px.buffer, y * N * 4, N * 4).copy(raw, y * (N * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync("resources/icon.png", Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("wrote resources/icon.png");
