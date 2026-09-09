"""Mesh building + COLLADA (.dae) export for Torque3D / BeamNG."""
import math


class Mesh:
    def __init__(self, name):
        self.name = name
        self.pos = []      # [(x,y,z), ...]
        self.nrm = []
        self.uv = []
        self.tris = {}     # material -> [(i0,i1,i2), ...]

    # ---------------------------------------------------------- primitives ---
    def _v(self, p, n, uv):
        self.pos.append(p)
        self.nrm.append(n)
        self.uv.append(uv)
        return len(self.pos) - 1

    def quad(self, mat, p0, p1, p2, p3, uv0, uv1, uv2, uv3, flip=False):
        ax = (p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
        bx = (p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2])
        n = (ax[1] * bx[2] - ax[2] * bx[1],
             ax[2] * bx[0] - ax[0] * bx[2],
             ax[0] * bx[1] - ax[1] * bx[0])
        L = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
        n = (n[0] / L, n[1] / L, n[2] / L)
        if flip:
            n = (-n[0], -n[1], -n[2])
        i0 = self._v(p0, n, uv0)
        i1 = self._v(p1, n, uv1)
        i2 = self._v(p2, n, uv2)
        i3 = self._v(p3, n, uv3)
        t = self.tris.setdefault(mat, [])
        if flip:
            t.append((i0, i2, i1))
            t.append((i0, i3, i2))
        else:
            t.append((i0, i1, i2))
            t.append((i0, i2, i3))

    def tri(self, mat, p0, p1, p2, uv0, uv1, uv2):
        ax = (p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
        bx = (p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2])
        n = (ax[1] * bx[2] - ax[2] * bx[1],
             ax[2] * bx[0] - ax[0] * bx[2],
             ax[0] * bx[1] - ax[1] * bx[0])
        L = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
        n = (n[0] / L, n[1] / L, n[2] / L)
        i0 = self._v(p0, n, uv0)
        i1 = self._v(p1, n, uv1)
        i2 = self._v(p2, n, uv2)
        self.tris.setdefault(mat, []).append((i0, i1, i2))

    def plane(self, mat, x0, y0, x1, y1, z, tile=8.0, flip=False):
        u0, v0 = x0 / tile, y0 / tile
        u1, v1 = x1 / tile, y1 / tile
        self.quad(mat, (x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z),
                  (u0, v0), (u1, v0), (u1, v1), (u0, v1), flip)

    def box(self, mat_side, x0, y0, z0, x1, y1, z1, mat_top=None, tile=3.0,
            tile_v=None, top_tile=4.0, sides=True, top=True, bottom=False):
        """Axis-aligned box. UVs scale with world size so textures never stretch."""
        mat_top = mat_top or mat_side
        tv = tile_v or tile
        sx, sy, sz = x1 - x0, y1 - y0, z1 - z0
        if sides:
            # -Y
            self.quad(mat_side, (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
                      (0, 0), (sx / tile, 0), (sx / tile, sz / tv), (0, sz / tv))
            # +Y
            self.quad(mat_side, (x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1),
                      (0, 0), (sx / tile, 0), (sx / tile, sz / tv), (0, sz / tv))
            # -X
            self.quad(mat_side, (x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1),
                      (0, 0), (sy / tile, 0), (sy / tile, sz / tv), (0, sz / tv))
            # +X
            self.quad(mat_side, (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1),
                      (0, 0), (sy / tile, 0), (sy / tile, sz / tv), (0, sz / tv))
        if top:
            self.quad(mat_top, (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
                      (0, 0), (sx / top_tile, 0), (sx / top_tile, sy / top_tile),
                      (0, sy / top_tile))
        if bottom:
            self.quad(mat_top, (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                      (0, 0), (sx / top_tile, 0), (sx / top_tile, sy / top_tile),
                      (0, sy / top_tile), flip=True)

    def gable_roof(self, mat, x0, y0, x1, y1, z_eave, z_ridge, along='x',
                   overhang=0.5, tile=2.0, soffit_mat=None):
        """Simple two-slope roof with eave overhang. Ridge runs along x or y."""
        soffit_mat = soffit_mat or mat
        x0 -= overhang; x1 += overhang
        y0 -= overhang; y1 += overhang
        if along == 'x':
            ymid = (y0 + y1) / 2.0
            slope = math.hypot((y1 - y0) / 2.0, z_ridge - z_eave)
            self.quad(mat, (x0, y0, z_eave), (x1, y0, z_eave),
                      (x1, ymid, z_ridge), (x0, ymid, z_ridge),
                      (0, 0), ((x1 - x0) / tile, 0), ((x1 - x0) / tile, slope / tile),
                      (0, slope / tile))
            self.quad(mat, (x1, y1, z_eave), (x0, y1, z_eave),
                      (x0, ymid, z_ridge), (x1, ymid, z_ridge),
                      (0, 0), ((x1 - x0) / tile, 0), ((x1 - x0) / tile, slope / tile),
                      (0, slope / tile))
            self.tri(soffit_mat, (x0, y0, z_eave), (x0, ymid, z_ridge), (x0, y1, z_eave),
                     (0, 0), ((y1 - y0) / 2 / tile, (z_ridge - z_eave) / tile),
                     ((y1 - y0) / tile, 0))
            self.tri(soffit_mat, (x1, y1, z_eave), (x1, ymid, z_ridge), (x1, y0, z_eave),
                     (0, 0), ((y1 - y0) / 2 / tile, (z_ridge - z_eave) / tile),
                     ((y1 - y0) / tile, 0))
        else:
            xmid = (x0 + x1) / 2.0
            slope = math.hypot((x1 - x0) / 2.0, z_ridge - z_eave)
            self.quad(mat, (x1, y0, z_eave), (x1, y1, z_eave),
                      (xmid, y1, z_ridge), (xmid, y0, z_ridge),
                      (0, 0), ((y1 - y0) / tile, 0), ((y1 - y0) / tile, slope / tile),
                      (0, slope / tile))
            self.quad(mat, (x0, y1, z_eave), (x0, y0, z_eave),
                      (xmid, y0, z_ridge), (xmid, y1, z_ridge),
                      (0, 0), ((y1 - y0) / tile, 0), ((y1 - y0) / tile, slope / tile),
                      (0, slope / tile))
            self.tri(soffit_mat, (x0, y0, z_eave), (xmid, y0, z_ridge), (x1, y0, z_eave),
                     (0, 0), ((x1 - x0) / 2 / tile, (z_ridge - z_eave) / tile),
                     ((x1 - x0) / tile, 0))
            self.tri(soffit_mat, (x1, y1, z_eave), (xmid, y1, z_ridge), (x0, y1, z_eave),
                     (0, 0), ((x1 - x0) / 2 / tile, (z_ridge - z_eave) / tile),
                     ((x1 - x0) / tile, 0))

    def cylinder(self, mat, cx, cy, z0, z1, r0, r1=None, seg=10, tile=2.0,
                 cap_top=True, cap_bottom=False, rot=0.0):
        r1 = r0 if r1 is None else r1
        pts0, pts1 = [], []
        for i in range(seg):
            a = rot + 2 * math.pi * i / seg
            pts0.append((cx + r0 * math.cos(a), cy + r0 * math.sin(a), z0))
            pts1.append((cx + r1 * math.cos(a), cy + r1 * math.sin(a), z1))
        circ = 2 * math.pi * max(r0, r1)
        h = z1 - z0
        for i in range(seg):
            j = (i + 1) % seg
            u0, u1 = i * circ / seg / tile, (i + 1) * circ / seg / tile
            self.quad(mat, pts0[i], pts0[j], pts1[j], pts1[i],
                      (u0, 0), (u1, 0), (u1, h / tile), (u0, h / tile))
        if cap_top:
            for i in range(1, seg - 1):
                self.tri(mat, pts1[0], pts1[i], pts1[i + 1],
                         (0, 0), (i / seg, 0.5), ((i + 1) / seg, 0.5))
        if cap_bottom:
            for i in range(1, seg - 1):
                self.tri(mat, pts0[0], pts0[i + 1], pts0[i],
                         (0, 0), ((i + 1) / seg, 0.5), (i / seg, 0.5))

    def cone(self, mat, cx, cy, z0, z1, r, seg=10, tile=2.0):
        apex = (cx, cy, z1)
        pts = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z0))
        for i in range(seg):
            j = (i + 1) % seg
            self.tri(mat, pts[i], pts[j], apex,
                     (i * 2 * math.pi * r / seg / tile, 0),
                     ((i + 1) * 2 * math.pi * r / seg / tile, 0),
                     (i * 2 * math.pi * r / seg / tile, (z1 - z0) / tile))

    def strut(self, mat, p0, p1, r, tile=1.0, caps=False):
        """Square-section beam between two arbitrary points. Used for towers,
        guardrails, fences, poles and light arms."""
        d = (p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
        L = math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2)
        if L < 1e-6:
            return
        d = (d[0] / L, d[1] / L, d[2] / L)
        up = (0, 0, 1) if abs(d[2]) < 0.9 else (1, 0, 0)
        u = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2],
             d[0] * up[1] - d[1] * up[0])
        lu = math.sqrt(u[0] ** 2 + u[1] ** 2 + u[2] ** 2) or 1.0
        u = (u[0] / lu, u[1] / lu, u[2] / lu)
        v = (d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2],
             d[0] * u[1] - d[1] * u[0])
        c = []
        for (su, sv) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            off = (u[0] * su * r + v[0] * sv * r,
                   u[1] * su * r + v[1] * sv * r,
                   u[2] * su * r + v[2] * sv * r)
            c.append(((p0[0] + off[0], p0[1] + off[1], p0[2] + off[2]),
                      (p1[0] + off[0], p1[1] + off[1], p1[2] + off[2])))
        for i in range(4):
            j = (i + 1) % 4
            self.quad(mat, c[i][0], c[j][0], c[j][1], c[i][1],
                      (0, 0), (2 * r / tile, 0), (2 * r / tile, L / tile), (0, L / tile))
        if caps:
            self.quad(mat, c[0][1], c[1][1], c[2][1], c[3][1],
                      (0, 0), (1, 0), (1, 1), (0, 1))
            self.quad(mat, c[3][0], c[2][0], c[1][0], c[0][0],
                      (0, 0), (1, 0), (1, 1), (0, 1))

    def disc(self, mat, cx, cy, cz, r, seg=12, normal_up=True):
        pts = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a), cz))
        for i in range(1, seg - 1):
            if normal_up:
                self.tri(mat, pts[0], pts[i], pts[i + 1], (0, 0), (0.5, 0), (1, 0.5))
            else:
                self.tri(mat, pts[0], pts[i + 1], pts[i], (0, 0), (1, 0.5), (0.5, 0))

    # ------------------------------------------------------ road ribbons -----
    def ribbon(self, mat, points, width, z, tex_len=12.0, z_lift=0.0):
        """points: [(x,y), ...] centerline. U across width, V along length."""
        n = len(points)
        left, right = [], []
        for i, (x, y) in enumerate(points):
            if i == 0:
                dx, dy = points[1][0] - x, points[1][1] - y
            elif i == n - 1:
                dx, dy = x - points[-2][0], y - points[-2][1]
            else:
                dx = points[i + 1][0] - points[i - 1][0]
                dy = points[i + 1][1] - points[i - 1][1]
            L = math.hypot(dx, dy) or 1.0
            nx, ny = -dy / L, dx / L
            hw = width / 2.0
            left.append((x + nx * hw, y + ny * hw))
            right.append((x - nx * hw, y - ny * hw))
        dist = 0.0
        for i in range(n - 1):
            seg = math.hypot(points[i + 1][0] - points[i][0],
                             points[i + 1][1] - points[i][1])
            v0, v1 = dist / tex_len, (dist + seg) / tex_len
            zz = z + z_lift
            self.quad(mat,
                      (left[i][0], left[i][1], zz), (right[i][0], right[i][1], zz),
                      (right[i + 1][0], right[i + 1][1], zz),
                      (left[i + 1][0], left[i + 1][1], zz),
                      (0, v0), (1, v0), (1, v1), (0, v1))
            dist += seg

    def stats(self):
        return len(self.pos), sum(len(t) for t in self.tris.values())


# ------------------------------------------------------------ dae export -----
_HEAD = '''<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset>
    <contributor><authoring_tool>Crestwood City Generator</authoring_tool></contributor>
    <created>2024-01-01T00:00:00</created>
    <modified>2024-01-01T00:00:00</modified>
    <unit meter="1" name="meter"/>
    <up_axis>Z_UP</up_axis>
  </asset>
'''


def _fmt(vals, per=6):
    out = []
    for v in vals:
        out.append(('%.4f' % v).rstrip('0').rstrip('.') or '0')
    return ' '.join(out)


def write_dae(mesh, path, detail_size=2):
    mats = [m for m in mesh.tris if mesh.tris[m]]
    g = 'geo'
    parts = [_HEAD]

    parts.append('  <library_effects>\n')
    for m in mats:
        parts.append(
            '    <effect id="%s-fx"><profile_COMMON><technique sid="common"><lambert>'
            '<diffuse><color sid="diffuse">0.8 0.8 0.8 1</color></diffuse>'
            '</lambert></technique></profile_COMMON></effect>\n' % m)
    parts.append('  </library_effects>\n')

    parts.append('  <library_materials>\n')
    for m in mats:
        parts.append('    <material id="%s" name="%s"><instance_effect url="#%s-fx"/></material>\n'
                     % (m, m, m))
    parts.append('  </library_materials>\n')

    flat_p = [c for p in mesh.pos for c in p]
    flat_n = [c for p in mesh.nrm for c in p]
    flat_t = [c for p in mesh.uv for c in (p[0], p[1])]
    nv = len(mesh.pos)

    parts.append('  <library_geometries>\n    <geometry id="%s" name="%s">\n      <mesh>\n' % (g, g))
    parts.append('        <source id="%s-pos"><float_array id="%s-pos-a" count="%d">%s</float_array>'
                 '<technique_common><accessor source="#%s-pos-a" count="%d" stride="3">'
                 '<param name="X" type="float"/><param name="Y" type="float"/>'
                 '<param name="Z" type="float"/></accessor></technique_common></source>\n'
                 % (g, g, len(flat_p), _fmt(flat_p), g, nv))
    parts.append('        <source id="%s-nrm"><float_array id="%s-nrm-a" count="%d">%s</float_array>'
                 '<technique_common><accessor source="#%s-nrm-a" count="%d" stride="3">'
                 '<param name="X" type="float"/><param name="Y" type="float"/>'
                 '<param name="Z" type="float"/></accessor></technique_common></source>\n'
                 % (g, g, len(flat_n), _fmt(flat_n), g, nv))
    parts.append('        <source id="%s-uv"><float_array id="%s-uv-a" count="%d">%s</float_array>'
                 '<technique_common><accessor source="#%s-uv-a" count="%d" stride="2">'
                 '<param name="S" type="float"/><param name="T" type="float"/>'
                 '</accessor></technique_common></source>\n'
                 % (g, g, len(flat_t), _fmt(flat_t), g, nv))
    parts.append('        <vertices id="%s-vtx"><input semantic="POSITION" source="#%s-pos"/></vertices>\n'
                 % (g, g))
    for m in mats:
        tris = mesh.tris[m]
        idx = []
        for a, b, c in tris:
            idx += [a, a, a, b, b, b, c, c, c]
        parts.append('        <triangles count="%d" material="%s-sym">'
                     '<input semantic="VERTEX" source="#%s-vtx" offset="0"/>'
                     '<input semantic="NORMAL" source="#%s-nrm" offset="1"/>'
                     '<input semantic="TEXCOORD" source="#%s-uv" offset="2" set="0"/>'
                     '<p>%s</p></triangles>\n'
                     % (len(tris), m, g, g, g, ' '.join(str(i) for i in idx)))
    parts.append('      </mesh>\n    </geometry>\n  </library_geometries>\n')

    binds = ''.join(
        '<instance_material symbol="%s-sym" target="#%s">'
        '<bind_vertex_input semantic="UVMap" input_semantic="TEXCOORD" input_set="0"/>'
        '</instance_material>' % (m, m) for m in mats)
    node = '%s%d' % (mesh.name, detail_size)
    parts.append('  <library_visual_scenes>\n    <visual_scene id="Scene" name="Scene">\n')
    for nid in (node, 'Col-1'):
        parts.append('      <node id="%s" name="%s" type="NODE">\n'
                     '        <matrix sid="transform">1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1</matrix>\n'
                     '        <instance_geometry url="#%s"><bind_material><technique_common>%s'
                     '</technique_common></bind_material></instance_geometry>\n      </node>\n'
                     % (nid, nid, g, binds))
    parts.append('    </visual_scene>\n  </library_visual_scenes>\n')
    parts.append('  <scene><instance_visual_scene url="#Scene"/></scene>\n</COLLADA>\n')

    with open(path, 'w') as f:
        f.write(''.join(parts))
    return mesh.stats()
