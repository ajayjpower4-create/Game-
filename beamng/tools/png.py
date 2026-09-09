"""Minimal PNG writer + procedural texture painting. No third-party deps."""
import zlib, struct, math, random


def write_png(path, w, h, rgb):
    raw = bytearray()
    stride = w * 3
    for y in range(h):
        raw.append(0)
        raw += rgb[y * stride:(y + 1) * stride]
    comp = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)))
        f.write(chunk(b'IDAT', comp))
        f.write(chunk(b'IEND', b''))


class Img:
    """Tiny RGB canvas with the handful of drawing ops the textures need."""

    def __init__(self, w, h, color=(0, 0, 0)):
        self.w, self.h = w, h
        self.px = bytearray(w * h * 3)
        self.fill(color)

    def fill(self, c):
        row = bytes((int(c[0]), int(c[1]), int(c[2]))) * self.w
        for y in range(self.h):
            self.px[y * self.w * 3:(y + 1) * self.w * 3] = row

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            i = (y * self.w + x) * 3
            self.px[i] = max(0, min(255, int(c[0])))
            self.px[i + 1] = max(0, min(255, int(c[1])))
            self.px[i + 2] = max(0, min(255, int(c[2])))

    def get(self, x, y):
        i = ((y % self.h) * self.w + (x % self.w)) * 3
        return (self.px[i], self.px[i + 1], self.px[i + 2])

    def rect(self, x0, y0, x1, y1, c):
        cc = (max(0, min(255, int(c[0]))), max(0, min(255, int(c[1]))),
              max(0, min(255, int(c[2]))))
        for y in range(max(0, int(y0)), min(self.h, int(y1))):
            base = y * self.w * 3
            for x in range(max(0, int(x0)), min(self.w, int(x1))):
                i = base + x * 3
                self.px[i], self.px[i + 1], self.px[i + 2] = cc

    def rect_wrap(self, x0, y0, x1, y1, c):
        cc = (max(0, min(255, int(c[0]))), max(0, min(255, int(c[1]))),
              max(0, min(255, int(c[2]))))
        for y in range(int(y0), int(y1)):
            for x in range(int(x0), int(x1)):
                i = ((y % self.h) * self.w + (x % self.w)) * 3
                self.px[i], self.px[i + 1], self.px[i + 2] = cc

    def noise(self, amount, rng, mono=True):
        for y in range(self.h):
            for x in range(self.w):
                n = rng.uniform(-amount, amount)
                r, g, b = self.get(x, y)
                if mono:
                    self.set(x, y, (r + n, g + n, b + n))
                else:
                    self.set(x, y, (r + n, g + rng.uniform(-amount, amount),
                                    b + rng.uniform(-amount, amount)))

    def blotches(self, count, radius, color, rng, alpha=0.35):
        for _ in range(count):
            cx = rng.randrange(self.w)
            cy = rng.randrange(self.h)
            r = rng.uniform(radius * 0.4, radius)
            for y in range(int(cy - r), int(cy + r) + 1):
                for x in range(int(cx - r), int(cx + r) + 1):
                    d = math.hypot(x - cx, y - cy)
                    if d > r:
                        continue
                    a = alpha * (1.0 - d / r)
                    o = self.get(x, y)
                    self.set(x % self.w, y % self.h,
                             (o[0] + (color[0] - o[0]) * a,
                              o[1] + (color[1] - o[1]) * a,
                              o[2] + (color[2] - o[2]) * a))

    def save(self, path):
        write_png(path, self.w, self.h, self.px)
