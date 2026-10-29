"""Tiny software renderer for part dumps (box / cylinder / ball / wedge)."""
import json, math, sys
import numpy as np
from PIL import Image


def rot(cf):
    x, y, z = cf[0:3]
    r = np.array(cf[3:12], dtype=float).reshape(3, 3)
    return np.array([x, y, z], dtype=float), r


def box_tris(sx, sy, sz):
    h = np.array([sx, sy, sz]) / 2
    c = np.array([[i, j, k] for i in (-1, 1) for j in (-1, 1) for k in (-1, 1)], dtype=float) * h
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    tris = []
    for a, b, cc, d in faces:
        tris.append((c[a], c[b], c[cc]))
        tris.append((c[a], c[cc], c[d]))
    return tris


def wedge_tris(sx, sy, sz):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    # bottom rectangle, back vertical face (z=+hz), slope from bottom-front to top-back
    p = {
        "bfl": (-hx, -hy, -hz), "bfr": (hx, -hy, -hz), "bbl": (-hx, -hy, hz), "bbr": (hx, -hy, hz),
        "tbl": (-hx, hy, hz), "tbr": (hx, hy, hz),
    }
    P = {k: np.array(v) for k, v in p.items()}
    q = [("bfl", "bfr", "bbr"), ("bfl", "bbr", "bbl"), ("bbl", "bbr", "tbr"), ("bbl", "tbr", "tbl"),
         ("bfl", "tbl", "tbr"), ("bfl", "tbr", "bfr"), ("bfl", "bbl", "tbl"), ("bfr", "tbr", "bbr")]
    return [(P[a], P[b], P[c]) for a, b, c in q]


def cyl_tris(sx, sy, sz, n=14):
    r = min(sy, sz) / 2
    hx = sx / 2
    tris = []
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p0 = np.array([0, math.cos(a0) * r, math.sin(a0) * r])
        p1 = np.array([0, math.cos(a1) * r, math.sin(a1) * r])
        L, R = np.array([-hx, 0, 0]), np.array([hx, 0, 0])
        tris += [(L + p0, R + p0, R + p1), (L + p0, R + p1, L + p1), (L, L + p0, L + p1), (R, R + p1, R + p0)]
    return tris


def ball_tris(sx, n=10):
    r = sx / 2
    tris = []
    for i in range(n):
        t0, t1 = math.pi * i / n, math.pi * (i + 1) / n
        for j in range(n * 2):
            f0, f1 = 2 * math.pi * j / (n * 2), 2 * math.pi * (j + 1) / (n * 2)
            def pt(t, f):
                return np.array([math.sin(t) * math.cos(f), math.cos(t), math.sin(t) * math.sin(f)]) * r
            tris += [(pt(t0, f0), pt(t1, f0), pt(t1, f1)), (pt(t0, f0), pt(t1, f1), pt(t0, f1))]
    return tris


def render(parts, eye, target, fov=40, W=1000, H=650, out="out.png"):
    eye, target = np.array(eye, float), np.array(target, float)
    fwd = target - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    f = 1 / math.tan(math.radians(fov) / 2)
    img = np.zeros((H, W, 3), float)
    img[:] = np.array([0.72, 0.80, 0.88])
    img[int(H * 0.0):, :] = np.linspace([0.62, 0.72, 0.84], [0.85, 0.87, 0.88], H)[:, None, :]
    zb = np.full((H, W), np.inf)
    sun = np.array([-0.4, 0.8, -0.45])
    sun /= np.linalg.norm(sun)
    for p in parts:
        if p.get("tr", 0) > 0.9:
            continue
        pos, R = rot(p["cf"])
        sx, sy, sz = p["size"]
        shape = p.get("shape", "Block")
        if p["cls"] == "WedgePart":
            tris = wedge_tris(sx, sy, sz)
        elif shape == "Cylinder":
            tris = cyl_tris(sx, sy, sz)
        elif shape == "Ball":
            tris = ball_tris(sx)
        else:
            tris = box_tris(sx, sy, sz)
        col = np.array(p["color"])
        if p.get("tr", 0) > 0.3:
            col = col * 0.5 + np.array([0.75, 0.8, 0.85]) * 0.5
        neon = p.get("mat") == "Neon"
        for t in tris:
            w = [pos + R @ v for v in t]
            n = np.cross(w[1] - w[0], w[2] - w[0])
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            n /= nn
            shade = 1.0 if neon else 0.35 + 0.65 * max(0.0, float(np.dot(n, sun))) * 0.9 + 0.15 * abs(n[1])
            c = np.clip(col * shade, 0, 1)
            pts = []
            ok = True
            for v in w:
                d = v - eye
                z = np.dot(d, fwd)
                if z < 0.5:
                    ok = False
                    break
                x = np.dot(d, right) / z * f
                y = np.dot(d, up) / z * f
                pts.append((W / 2 + x * H / 2, H / 2 - y * H / 2, z))
            if not ok:
                continue
            xs = [q[0] for q in pts]
            ys = [q[1] for q in pts]
            x0, x1 = max(int(min(xs)), 0), min(int(max(xs)) + 1, W - 1)
            y0, y1 = max(int(min(ys)), 0), min(int(max(ys)) + 1, H - 1)
            if x0 > x1 or y0 > y1:
                continue
            (ax, ay, az), (bx, by, bz), (cx, cy, cz) = pts
            den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(den) < 1e-9:
                continue
            X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            l1 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den
            l2 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den
            l3 = 1 - l1 - l2
            inside = (l1 >= 0) & (l2 >= 0) & (l3 >= 0)
            if not inside.any():
                continue
            Z = 1.0 / (l1 / az + l2 / bz + l3 / cz)
            sub = zb[y0:y1 + 1, x0:x1 + 1]
            mask = inside & (Z < sub)
            sub[mask] = Z[mask]
            img[y0:y1 + 1, x0:x1 + 1][mask] = c
    Image.fromarray((img * 255).astype(np.uint8)).save(out)


if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    for view in data["views"]:
        render(data["parts"], view["eye"], view["target"], view.get("fov", 40), out=view["out"])
        print("wrote", view["out"])
