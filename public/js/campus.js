// ---------------------------------------------------------------------------
// campus.js — builds the whole site: 4 buildings with interiors, furniture,
// stairwells + roof access, and the outdoor courts/pitches.
// Registers HSS.ROOMS, HSS.CLASSROOMS, HSS.SEATS, HSS.WAYPOINTS.
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

HSS.buildCampus = function (scene, M, shadow) {
  const ROOMS = {};      // id -> room record
  const CLASSROOMS = []; // ordered ids for the timetable
  const WAYPOINTS = { outdoor: [], corridors: [] };
  const FLOOR_H = 3.3, WALL_T = 0.2;

  const masters = {}; // instanced furniture masters
  let uid = 0;

  function box(name, w, h, d, x, y, z, mat, { collide = true, parent = null, rotY = 0, shadows = false } = {}) {
    const b = BABYLON.MeshBuilder.CreateBox(`${name}_${uid++}`, { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z);
    b.rotation.y = rotY;
    b.material = mat;
    b.checkCollisions = collide;
    if (parent) b.parent = parent;
    if (shadows && shadow) shadow.addShadowCaster(b);
    b.freezeWorldMatrix();
    return b;
  }

  // ---- instanced furniture masters ---------------------------------------
  function makeMasters() {
    // student desk (top + 4 legs merged)
    const top = BABYLON.MeshBuilder.CreateBox('deskTop', { width: 1.1, height: 0.06, depth: 0.6 }, scene);
    top.position.y = 0.72;
    const legs = [];
    for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) {
      const l = BABYLON.MeshBuilder.CreateBox('dl', { width: 0.06, height: 0.72, depth: 0.06 }, scene);
      l.position.set(lx, 0.36, lz);
      legs.push(l);
    }
    masters.desk = BABYLON.Mesh.MergeMeshes([top, ...legs], true);
    masters.desk.material = M.wood;
    masters.desk.isVisible = false;

    // chair
    const seat = BABYLON.MeshBuilder.CreateBox('chSeat', { width: 0.46, height: 0.05, depth: 0.46 }, scene);
    seat.position.y = 0.46;
    const back = BABYLON.MeshBuilder.CreateBox('chBack', { width: 0.46, height: 0.5, depth: 0.05 }, scene);
    back.position.set(0, 0.72, 0.22);
    const cl = [];
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const l = BABYLON.MeshBuilder.CreateBox('cl', { width: 0.04, height: 0.46, depth: 0.04 }, scene);
      l.position.set(lx, 0.23, lz);
      cl.push(l);
    }
    masters.chair = BABYLON.Mesh.MergeMeshes([seat, back, ...cl], true);
    masters.chair.material = M.chairSeat;
    masters.chair.isVisible = false;

    // cafeteria long table
    const tt = BABYLON.MeshBuilder.CreateBox('ct', { width: 3.6, height: 0.07, depth: 0.9 }, scene);
    tt.position.y = 0.75;
    const tl1 = BABYLON.MeshBuilder.CreateBox('ctl', { width: 0.1, height: 0.75, depth: 0.8 }, scene);
    tl1.position.set(-1.6, 0.37, 0);
    const tl2 = tl1.clone(); tl2.position.x = 1.6;
    masters.longTable = BABYLON.Mesh.MergeMeshes([tt, tl1, tl2], true);
    masters.longTable.material = M.woodDark;
    masters.longTable.isVisible = false;
  }

  function inst(master, x, y, z, rotY = 0) {
    const i = masters[master].createInstance(`${master}_${uid++}`);
    i.position.set(x, y, z);
    i.rotation.y = rotY;
    i.checkCollisions = true;
    i.freezeWorldMatrix();
    return i;
  }

  function seat(room, x, y, z, yaw, type) {
    const s = { pos: new BABYLON.Vector3(x, y, z), yaw, type, roomId: room.id };
    room.seats.push(s);
    HSS.SEATS.push(s);
    return s;
  }

  // ---- wall runs with gaps ------------------------------------------------
  // Build a wall along X at fixed z (or along Z at fixed x), leaving door gaps.
  function wallRun(axis, fixed, a0, a1, y, h, mat, gaps = []) {
    const segs = [];
    let cur = a0;
    const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
    for (const [g0, g1] of sorted) { if (g0 > cur) segs.push([cur, g0]); cur = Math.max(cur, g1); }
    if (cur < a1) segs.push([cur, a1]);
    for (const [s0, s1] of segs) {
      const len = s1 - s0, mid = (s0 + s1) / 2;
      if (len < 0.05) continue;
      if (axis === 'x') box('wall', len, h, WALL_T, mid, y + h / 2, fixed, mat);
      else box('wall', WALL_T, h, len, fixed, y + h / 2, mid, mat);
    }
    // lintels above door gaps
    for (const [g0, g1] of sorted) {
      const len = g1 - g0, mid = (g0 + g1) / 2;
      if (axis === 'x') box('lintel', len, h - 2.1, WALL_T, mid, y + 2.1 + (h - 2.1) / 2, fixed, mat);
      else box('lintel', WALL_T, h - 2.1, len, fixed, y + 2.1 + (h - 2.1) / 2, mid, mat);
    }
  }

  function windowsOnWall(axis, fixed, a0, a1, y, count) {
    const span = a1 - a0;
    for (let i = 0; i < count; i++) {
      const c = a0 + span * (i + 0.5) / count;
      const w = Math.min(2.2, span / count - 0.8);
      if (w < 0.6) continue;
      if (axis === 'x') {
        box('winFrame', w + 0.12, 1.52, 0.1, c, y + 1.75, fixed, M.blackTrim, { collide: false });
        box('winGlass', w, 1.4, 0.06, c, y + 1.75, fixed, M.glass, { collide: false });
      } else {
        box('winFrame', 0.1, 1.52, w + 0.12, fixed, y + 1.75, c, M.blackTrim, { collide: false });
        box('winGlass', 0.06, 1.4, w, fixed, y + 1.75, c, M.glass, { collide: false });
      }
    }
  }

  // ---- room furnishing ----------------------------------------------------
  function furnishRoom(room) {
    const { minX, maxX, minZ, maxZ } = room.bounds;
    const y = room.floorY;
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const w = maxX - minX, d = maxZ - minZ;
    const facing = room.side === 'N' ? Math.PI : 0; // students face corridor wall (front)
    const frontZ = room.side === 'N' ? minZ : maxZ;

    switch (room.type) {
      case 'classroom': case 'senclass': {
        // whiteboard on the front wall
        const bz = frontZ + (room.side === 'N' ? 0.16 : -0.16);
        box('wb', Math.min(3.4, w - 1.5), 1.2, 0.05, cx, y + 1.7, bz, M.whiteboard, { collide: false });
        box('wbTrim', Math.min(3.5, w - 1.4), 1.3, 0.04, cx, y + 1.7, bz + (room.side === 'N' ? 0.005 : -0.005), M.blackTrim, { collide: false });
        // teacher desk faces the class
        const tz = frontZ + (room.side === 'N' ? 1.3 : -1.3);
        const tdesk = BABYLON.MeshBuilder.CreateBox(`tdesk_${uid++}`, { width: 1.6, height: 0.76, depth: 0.75 }, scene);
        tdesk.position.set(cx, y + 0.38, tz); tdesk.material = M.woodDark; tdesk.checkCollisions = true; tdesk.freezeWorldMatrix();
        // monitor on the desk = the "teacher computer"
        const mon = box('monitor', 0.55, 0.36, 0.05, cx, y + 1.0, tz, M.screen, { collide: false });
        mon.metadata = { computer: 'teacher', roomId: room.id };
        mon.unfreezeWorldMatrix(); mon.isPickable = true; mon.freezeWorldMatrix();
        room.computer = mon;
        inst('chair', cx, y, tz + (room.side === 'N' ? -0.8 : 0.8), facing + Math.PI);
        room.teacherSeat = seat(room, cx, y, tz + (room.side === 'N' ? -0.8 : 0.8), facing + Math.PI, 'teacherDesk');
        // student desks — up to 28 (7 x 4)
        const cols = room.type === 'senclass' ? 3 : 7, rows = room.type === 'senclass' ? 3 : 4;
        const startZ = frontZ + (room.side === 'N' ? 2.6 : -2.6);
        const zStep = (room.side === 'N' ? 1 : -1) * Math.min(1.35, (d - 3.4) / rows);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const dx = minX + (w / (cols + 1)) * (c + 1);
            const dz = startZ + zStep * r;
            inst('desk', dx, y, dz, facing);
            inst('chair', dx, y, dz + (room.side === 'N' ? 0.55 : -0.55), facing);
            seat(room, dx, y, dz + (room.side === 'N' ? 0.55 : -0.55), facing, 'studentDesk');
          }
        }
        break;
      }
      case 'office': case 'headoffice': case 'hr': case 'senco': {
        const odesk = BABYLON.MeshBuilder.CreateBox(`odesk_${uid++}`, { width: 1.7, height: 0.76, depth: 0.8 }, scene);
        odesk.position.set(cx, y + 0.38, cz); odesk.material = M.woodDark; odesk.checkCollisions = true; odesk.freezeWorldMatrix();
        const mon = box('monitor', 0.55, 0.36, 0.05, cx, y + 1.0, cz, M.screen, { collide: false });
        mon.metadata = { computer: room.type === 'hr' ? 'admin' : 'office', roomId: room.id };
        mon.isPickable = true;
        inst('chair', cx, y, cz - 0.8, Math.PI);
        seat(room, cx, y, cz - 0.8, Math.PI, room.type === 'hr' ? 'adminDesk' : 'officeDesk');
        inst('chair', cx - 0.6, y, cz + 0.9, 0); seat(room, cx - 0.6, y, cz + 0.9, 0, 'chair');
        inst('chair', cx + 0.6, y, cz + 0.9, 0); seat(room, cx + 0.6, y, cz + 0.9, 0, 'chair');
        if (room.type === 'hr') box('cabinet', 0.6, 1.5, 0.5, maxX - 0.5, y + 0.75, maxZ - 0.5, M.metal);
        break;
      }
      case 'admin': case 'reception': {
        // bank of admin workstations
        const n = Math.max(2, Math.floor(w / 2.4));
        for (let i = 0; i < n; i++) {
          const dx = minX + (w / (n + 1)) * (i + 1);
          const ddesk = BABYLON.MeshBuilder.CreateBox(`adesk_${uid++}`, { width: 1.5, height: 0.76, depth: 0.7 }, scene);
          ddesk.position.set(dx, y + 0.38, cz); ddesk.material = M.woodDark; ddesk.checkCollisions = true; ddesk.freezeWorldMatrix();
          const mon = box('monitor', 0.5, 0.34, 0.05, dx, y + 0.98, cz, M.screen, { collide: false });
          mon.metadata = { computer: 'admin', roomId: room.id };
          mon.isPickable = true;
          inst('chair', dx, y, cz - 0.75, Math.PI);
          seat(room, dx, y, cz - 0.75, Math.PI, 'adminDesk');
        }
        if (room.type === 'reception') box('counter', w - 1.2, 1.1, 0.5, cx, y + 0.55, maxZ - 0.6, M.woodDark);
        break;
      }
      case 'staffroom': case 'meeting': case 'common': {
        const tables = room.type === 'meeting' ? 1 : Math.max(1, Math.floor((w * d) / 40));
        for (let i = 0; i < tables; i++) {
          const tx = tables === 1 ? cx : minX + (w / (tables + 1)) * (i + 1);
          inst('longTable', tx, y, cz);
          for (let k = 0; k < 4; k++) {
            const sx = tx - 1.35 + k * 0.9;
            inst('chair', sx, y, cz - 0.85, 0); seat(room, sx, y, cz - 0.85, 0, room.type === 'meeting' ? 'meeting' : 'chair');
            inst('chair', sx, y, cz + 0.85, Math.PI); seat(room, sx, y, cz + 0.85, Math.PI, room.type === 'meeting' ? 'meeting' : 'chair');
          }
        }
        break;
      }
      case 'cafeteria': {
        const rows = Math.floor(d / 3.4), cols = Math.floor(w / 5);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const tx = minX + 2.5 + c * 5, tz = minZ + 2 + r * 3.4;
          inst('longTable', tx, y, tz);
          for (let k = 0; k < 4; k++) {
            const sx = tx - 1.35 + k * 0.9;
            inst('chair', sx, y, tz - 0.85, 0); seat(room, sx, y, tz - 0.85, 0, 'chair');
            inst('chair', sx, y, tz + 0.85, Math.PI); seat(room, sx, y, tz + 0.85, Math.PI, 'chair');
          }
        }
        break;
      }
      case 'kitchen': {
        box('counterA', w - 1.4, 0.95, 0.8, cx, y + 0.47, minZ + 0.6, M.metal);
        box('counterB', w - 1.4, 0.95, 0.8, cx, y + 0.47, maxZ - 0.6, M.metal);
        box('hob', 1.6, 1.05, 0.9, cx, y + 0.52, cz, M.blackTrim);
        break;
      }
      case 'mechanical': {
        box('boiler', 1.4, 2.0, 1.2, cx - 1, y + 1.0, cz, M.metal);
        box('tank', 1.0, 1.7, 1.0, cx + 1.2, y + 0.85, cz + 0.6, M.metal);
        box('pipes', 0.15, 0.15, d - 1, cx - 1, y + 2.4, cz, M.metal, { collide: false });
        break;
      }
      case 'gym': {
        // sprung floor + basketball hoops + benches
        box('gymFloor', w - 0.4, 0.06, d - 0.4, cx, y + 0.05, cz, M.wood, { collide: false });
        for (const ex of [minX + 1.2, maxX - 1.2]) {
          box('hoopPost', 0.16, 3.4, 0.16, ex, y + 1.7, cz, M.metal);
          box('backboard', 0.06, 1.1, 1.8, ex + (ex < cx ? 0.35 : -0.35), y + 3.2, cz, M.whiteboard, { collide: false });
        }
        for (let i = 0; i < 4; i++) {
          const bz = minZ + 1 + i * ((d - 2) / 3);
          box('bench', 2.2, 0.42, 0.35, minX + 1.2, y + 0.21, bz, M.woodDark);
          seat(room, minX + 1.2, y, bz, Math.PI / 2, 'chair');
        }
        break;
      }
      case 'suspension': {
        for (let i = 0; i < 4; i++) {
          const dx = minX + 1 + (i % 2) * 2, dz = minZ + 1.2 + Math.floor(i / 2) * 2;
          inst('desk', dx, y, dz, 0);
          inst('chair', dx, y, dz + 0.55, 0);
          seat(room, dx, y, dz + 0.55, 0, 'studentDesk');
        }
        const sdesk = BABYLON.MeshBuilder.CreateBox(`sdesk_${uid++}`, { width: 1.4, height: 0.76, depth: 0.7 }, scene);
        sdesk.position.set(maxX - 1.2, y + 0.38, maxZ - 1.2); sdesk.material = M.woodDark; sdesk.checkCollisions = true; sdesk.freezeWorldMatrix();
        inst('chair', maxX - 1.2, y, maxZ - 1.9, Math.PI);
        seat(room, maxX - 1.2, y, maxZ - 1.9, Math.PI, 'officeDesk');
        break;
      }
      case 'quiet': {
        box('sofa', 1.8, 0.5, 0.8, cx, y + 0.25, cz, M.chairSeat);
        seat(room, cx - 0.4, y, cz, 0, 'chair'); seat(room, cx + 0.4, y, cz, 0, 'chair');
        box('rug', Math.min(2.5, w - 1), 0.02, Math.min(2.5, d - 1), cx, y + 0.02, cz + 1.2, M.chairSeat, { collide: false });
        break;
      }
      case 'library': {
        for (let i = 0; i < Math.floor(w / 2.2); i++) {
          box('shelf', 0.4, 1.9, Math.min(3, d - 2), minX + 1 + i * 2.2, y + 0.95, cz, M.woodDark);
        }
        inst('longTable', cx, y, maxZ - 1.4);
        for (let k = 0; k < 4; k++) {
          const sx = cx - 1.35 + k * 0.9;
          inst('chair', sx, y, maxZ - 2.25, 0); seat(room, sx, y, maxZ - 2.25, 0, 'chair');
        }
        break;
      }
    }
  }

  // ---- building generator -------------------------------------------------
  // spec.floors: array of floor specs; each floor: { rooms: [{id,label,type,side,x0,x1}] }
  // x0/x1 are fractions (0..1) of building width. Corridor runs along X.
  function buildBuilding(spec) {
    const { key, cx, cz, w, d, floors, corridor = 3, wallH = FLOOR_H } = spec;
    const minX = cx - w / 2, maxX = cx + w / 2, minZ = cz - d / 2, maxZ = cz + d / 2;
    const corrHalf = corridor / 2;

    for (let f = 0; f < floors.length; f++) {
      const y = f * FLOOR_H;
      const fl = floors[f];
      // floor slab (top sits 0.03 above the terrain to avoid z-fighting)
      box('slab', w, 0.18, d, cx, y - 0.06, cz, M.lino);

      const northRooms = fl.rooms.filter(r => r.side === 'N');
      const southRooms = fl.rooms.filter(r => r.side === 'S');

      // exterior walls (with entrance gaps on ground floor)
      const extGapsS = f === 0 ? (spec.entrances || [[cx - 1.1, cx + 1.1]]) : [];
      const extGapsN = f === 0 ? (spec.entrancesN || []) : [];
      // corridor-end doors on the gable walls (ground floor)
      const endGaps = f === 0 ? [[cz - 0.9, cz + 0.9]] : [];
      wallRun('x', maxZ, minX, maxX, y, wallH, M.brick, extGapsN);
      wallRun('x', minZ, minX, maxX, y, wallH, M.brick, extGapsS);
      wallRun('z', minX, minZ, maxZ, y, wallH, M.brick, endGaps);
      wallRun('z', maxX, minZ, maxZ, y, wallH, M.brick, endGaps);
      windowsOnWall('x', maxZ + 0.06, minX, maxX, y, Math.floor(w / 4));
      windowsOnWall('x', minZ - 0.06, minX, maxX, y, Math.floor(w / 5));

      // corridor walls with a door gap per room
      const buildSideRooms = (rooms, side) => {
        const wallZ = side === 'N' ? cz + corrHalf : cz - corrHalf;
        const gaps = [];
        for (const r of rooms) {
          const rx0 = minX + r.x0 * w, rx1 = minX + r.x1 * w;
          const doorC = (rx0 + rx1) / 2;
          if (r.type !== 'void') gaps.push([doorC - 0.65, doorC + 0.65]);
        }
        wallRun('x', wallZ, minX, maxX, y, wallH, M.plaster, gaps);
        // partitions between rooms + room records
        for (const r of rooms) {
          const rx0 = minX + r.x0 * w, rx1 = minX + r.x1 * w;
          if (r.x0 > 0.001) {
            if (side === 'N') wallRun('z', rx0, cz + corrHalf, maxZ, y, wallH, M.plaster, []);
            else wallRun('z', rx0, minZ, cz - corrHalf, y, wallH, M.plaster, []);
          }
          if (r.type === 'void') continue;
          const bounds = side === 'N'
            ? { minX: rx0, maxX: rx1, minZ: cz + corrHalf, maxZ: maxZ }
            : { minX: rx0, maxX: rx1, minZ: minZ, maxZ: cz - corrHalf };
          const room = {
            id: `${key}-f${f}-${r.id}`, label: r.label, type: r.type, building: key, floor: f,
            side, bounds, floorY: y,
            center: new BABYLON.Vector3((bounds.minX + bounds.maxX) / 2, y, (bounds.minZ + bounds.maxZ) / 2),
            seats: [], teacherSeat: null,
          };
          ROOMS[room.id] = room;
          if (r.type === 'classroom' || r.type === 'senclass') CLASSROOMS.push(room.id);
          furnishRoom(room);
          // door frame visual
          const doorC = (rx0 + rx1) / 2;
          const wallZ2 = side === 'N' ? cz + corrHalf : cz - corrHalf;
          box('doorFrame', 1.5, 0.12, 0.3, doorC, y + 2.16, wallZ2, M.doorBlue, { collide: false });
          // ceiling for the room (skip stair rooms so you can walk up)
          if (r.type !== 'stair') {
            box('ceil', bounds.maxX - bounds.minX, 0.1, bounds.maxZ - bounds.minZ,
              (bounds.minX + bounds.maxX) / 2, y + wallH - 0.05, (bounds.minZ + bounds.maxZ) / 2, M.ceiling, { collide: false });
          }
          // stairs: ramp up to the next level (or roof on top floor)
          if (r.type === 'stair') {
            const rampLen = Math.min((bounds.maxZ - bounds.minZ) - 1, 6);
            const ramp = BABYLON.MeshBuilder.CreateBox(`ramp_${uid++}`, { width: 1.6, height: 0.2, depth: Math.hypot(rampLen, wallH) }, scene);
            ramp.position.set((bounds.minX + bounds.maxX) / 2, y + wallH / 2, (bounds.minZ + bounds.maxZ) / 2);
            ramp.rotation.x = (side === 'N' ? 1 : -1) * Math.atan2(wallH, rampLen);
            ramp.material = M.lino; ramp.checkCollisions = true; ramp.freezeWorldMatrix();
          }
        }
      };
      buildSideRooms(northRooms, 'N');
      buildSideRooms(southRooms, 'S');

      // corridor ceiling
      box('corrCeil', w, 0.1, corridor, cx, y + wallH - 0.05, cz, M.ceiling, { collide: false });
      WAYPOINTS.corridors.push(new BABYLON.Vector3(cx - w / 4, y, cz), new BABYLON.Vector3(cx + w / 4, y, cz));
    }

    // roof slab + parapet + plant
    const roofY = (floors.length - 1) * FLOOR_H + wallH;
    box('roofSlab', w, 0.2, d, cx, roofY + 0.1, cz, M.roof);
    for (const [px, pz, pw, pd] of [
      [cx, maxZ, w, WALL_T], [cx, minZ, w, WALL_T], [minX, cz, WALL_T, d], [maxX, cz, WALL_T, d],
    ]) box('parapet', pw, 0.9, pd, px, roofY + 0.65, pz, M.brick);
    box('acUnit', 1.6, 1.0, 1.2, cx - w / 5, roofY + 0.7, cz, M.metal);
    box('acUnit', 1.2, 0.9, 1.0, cx + w / 5, roofY + 0.65, cz + d / 6, M.metal);
    box('roofDoorHut', 2.2, 2.3, 2.0, cx + w / 2 - 2.4, roofY + 1.15, cz, M.brick);
  }

  HSS.SEATS = [];

  makeMasters();

  // ======================= ground & landscaping ===========================
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 340, height: 280 }, scene);
  ground.material = M.grass; ground.checkCollisions = true; ground.receiveShadows = true; ground.freezeWorldMatrix();
  // central tarmac playground
  const yard = BABYLON.MeshBuilder.CreateGround('yard', { width: 150, height: 90 }, scene);
  yard.position.set(0, 0.02, 0); yard.material = M.tarmac; yard.receiveShadows = true; yard.freezeWorldMatrix();
  // perimeter fence
  for (const [fx, fz, fw, fd] of [[0, 138, 338, 0.3], [0, -138, 338, 0.3], [-168, 0, 0.3, 276], [168, 0, 0.3, 276]]) {
    box('fence', fw, 2.2, fd, fx, 1.1, fz, M.fence);
  }
  // scatter some hedges/trees
  const rng = HSS.makeRng(42);
  for (let i = 0; i < 26; i++) {
    const tx = -160 + rng() * 320, tz = 95 + rng() * 38 * (rng() < 0.5 ? 1 : -1) + (rng() < 0.5 ? 20 : -115);
    const trunk = box('trunk', 0.35, 2.6, 0.35, tx, 1.3, tz, M.woodDark);
    const crown = BABYLON.MeshBuilder.CreateSphere(`crown_${uid++}`, { diameter: 3.2 + rng() * 2, segments: 6 }, scene);
    crown.position.set(tx, 3.6, tz); crown.material = M.hedge; crown.freezeWorldMatrix();
  }

  // ======================= MAIN BUILDING ==================================
  // Front office, classrooms, hallways, stairwells, common areas, mech, kitchen.
  const mainClass = (n, x0, x1, side) => ({ id: `c${n}`, label: `Classroom M${n}`, type: 'classroom', side, x0, x1 });
  buildBuilding({
    key: 'main', cx: 0, cz: 55, w: 84, d: 22,
    entrances: [[-2.2, 2.2], [-30, -27.8]],
    floors: [
      { rooms: [
        { id: 'stairW', label: 'West Stairwell', type: 'stair', side: 'N', x0: 0.0, x1: 0.06 },
        mainClass(1, 0.06, 0.20, 'N'), mainClass(2, 0.20, 0.34, 'N'), mainClass(3, 0.34, 0.48, 'N'),
        mainClass(4, 0.48, 0.62, 'N'), mainClass(5, 0.62, 0.76, 'N'), mainClass(6, 0.76, 0.94, 'N'),
        { id: 'stairE', label: 'East Stairwell', type: 'stair', side: 'N', x0: 0.94, x1: 1.0 },
        { id: 'recep', label: 'Front Office', type: 'reception', side: 'S', x0: 0.42, x1: 0.58 },
        { id: 'common1', label: 'Common Area', type: 'common', side: 'S', x0: 0.58, x1: 0.76 },
        { id: 'library', label: 'Library', type: 'library', side: 'S', x0: 0.76, x1: 1.0 },
        { id: 'mech', label: 'Mechanical Room', type: 'mechanical', side: 'S', x0: 0.0, x1: 0.08 },
        { id: 'kitchenette', label: 'Staff Kitchenette', type: 'kitchen', side: 'S', x0: 0.08, x1: 0.16 },
        { id: 'nurse', label: 'Medical Room', type: 'office', side: 'S', x0: 0.16, x1: 0.26 },
        { id: 'common2', label: 'Year Hub', type: 'common', side: 'S', x0: 0.26, x1: 0.42 },
      ] },
      { rooms: [
        { id: 'stairW', label: 'West Stairwell', type: 'stair', side: 'N', x0: 0.0, x1: 0.06 },
        mainClass(7, 0.06, 0.20, 'N'), mainClass(8, 0.20, 0.34, 'N'), mainClass(9, 0.34, 0.48, 'N'),
        mainClass(10, 0.48, 0.62, 'N'), mainClass(11, 0.62, 0.76, 'N'), mainClass(12, 0.76, 0.94, 'N'),
        { id: 'stairE', label: 'East Stairwell (Roof Access)', type: 'stair', side: 'N', x0: 0.94, x1: 1.0 },
        mainClass(13, 0.0, 0.14, 'S'), mainClass(14, 0.14, 0.28, 'S'), mainClass(15, 0.28, 0.42, 'S'),
        mainClass(16, 0.42, 0.56, 'S'), mainClass(17, 0.56, 0.70, 'S'), mainClass(18, 0.70, 0.84, 'S'),
        { id: 'common3', label: 'Upper Common Area', type: 'common', side: 'S', x0: 0.84, x1: 1.0 },
      ] },
    ],
  });

  // ======================= STAFF & ADMIN BUILDING =========================
  buildBuilding({
    key: 'staff', cx: -78, cz: -8, w: 46, d: 16, corridor: 2.6,
    entrances: [[-80.2, -75.8]],
    floors: [
      { rooms: [
        { id: 'stair', label: 'Stairwell', type: 'stair', side: 'N', x0: 0.0, x1: 0.1 },
        { id: 'staffroom', label: 'Staff Room', type: 'staffroom', side: 'N', x0: 0.1, x1: 0.45 },
        { id: 'admin', label: 'Admin Workstations', type: 'admin', side: 'N', x0: 0.45, x1: 0.75 },
        { id: 'mech', label: 'Mechanical Room', type: 'mechanical', side: 'N', x0: 0.75, x1: 0.9 },
        { id: 'kitchen', label: 'Staff Kitchen', type: 'kitchen', side: 'N', x0: 0.9, x1: 1.0 },
        { id: 'meeting1', label: 'Meeting Room 1', type: 'meeting', side: 'S', x0: 0.0, x1: 0.25 },
        { id: 'hr', label: 'HR Records', type: 'hr', side: 'S', x0: 0.25, x1: 0.45 },
        { id: 'finance', label: 'Finance Office', type: 'office', side: 'S', x0: 0.45, x1: 0.65 },
        { id: 'data', label: 'Data & Exams Office', type: 'admin', side: 'S', x0: 0.65, x1: 1.0 },
      ] },
      { rooms: [
        { id: 'stair', label: 'Stairwell (Roof Access)', type: 'stair', side: 'N', x0: 0.0, x1: 0.1 },
        { id: 'head', label: "Headteacher's Office", type: 'headoffice', side: 'N', x0: 0.1, x1: 0.35 },
        { id: 'deputy1', label: 'Deputy Head (Curriculum)', type: 'office', side: 'N', x0: 0.35, x1: 0.55 },
        { id: 'deputy2', label: 'Deputy Head (Behaviour)', type: 'office', side: 'N', x0: 0.55, x1: 0.75 },
        { id: 'aht', label: 'Assistant Heads Office', type: 'office', side: 'N', x0: 0.75, x1: 1.0 },
        { id: 'meeting2', label: 'SLT Meeting Room', type: 'meeting', side: 'S', x0: 0.0, x1: 0.35 },
        { id: 'business', label: 'Business Manager', type: 'office', side: 'S', x0: 0.35, x1: 0.55 },
        { id: 'itoffice', label: 'IT Office', type: 'admin', side: 'S', x0: 0.55, x1: 0.8 },
        { id: 'pastoral', label: 'Pastoral Office', type: 'office', side: 'S', x0: 0.8, x1: 1.0 },
      ] },
    ],
  });

  // ======================= SEN BUILDING ===================================
  buildBuilding({
    key: 'sen', cx: 76, cz: -8, w: 42, d: 15, corridor: 2.6,
    entrances: [[73.8, 78.2]],
    floors: [
      { rooms: [
        { id: 'senclass1', label: 'SEN Classroom 1', type: 'senclass', side: 'N', x0: 0.0, x1: 0.22 },
        { id: 'senclass2', label: 'SEN Classroom 2', type: 'senclass', side: 'N', x0: 0.22, x1: 0.44 },
        { id: 'senclass3', label: 'Sensory Room', type: 'quiet', side: 'N', x0: 0.44, x1: 0.62 },
        { id: 'mech', label: 'Mechanical Room', type: 'mechanical', side: 'N', x0: 0.62, x1: 0.78 },
        { id: 'kitchen', label: 'Life Skills Kitchen', type: 'kitchen', side: 'N', x0: 0.78, x1: 1.0 },
        { id: 'senco', label: 'SENCO Office', type: 'senco', side: 'S', x0: 0.0, x1: 0.2 },
        { id: 'quiet1', label: 'Quiet Room 1', type: 'quiet', side: 'S', x0: 0.2, x1: 0.38 },
        { id: 'quiet2', label: 'Quiet Room 2', type: 'quiet', side: 'S', x0: 0.38, x1: 0.56 },
        { id: 'counsel', label: 'Counselling Room', type: 'office', side: 'S', x0: 0.56, x1: 0.78 },
        { id: 'therapy', label: 'Speech & Language', type: 'office', side: 'S', x0: 0.78, x1: 1.0 },
      ] },
    ],
  });

  // ======================= CAFÉ & GYM BUILDING ============================
  // Gym on the right (east), cafeteria on the left (west), internal
  // suspension room, kitchen, mechanical, changing rooms.
  buildBuilding({
    key: 'gymcafe', cx: 0, cz: -70, w: 78, d: 26, corridor: 2.8, wallH: 4.6,
    entrances: [[-32, -29.8]],
    entrancesN: [[-24, -20], [16, 20]],
    floors: [
      { rooms: [
        { id: 'cafeteria', label: 'Cafeteria', type: 'cafeteria', side: 'N', x0: 0.0, x1: 0.42 },
        { id: 'gym', label: 'Sports Hall', type: 'gym', side: 'N', x0: 0.46, x1: 1.0 },
        { id: 'kitchen', label: 'Main Kitchen', type: 'kitchen', side: 'S', x0: 0.0, x1: 0.2 },
        { id: 'suspension', label: 'Internal Suspension Room', type: 'suspension', side: 'S', x0: 0.2, x1: 0.36 },
        { id: 'mech', label: 'Mechanical Room', type: 'mechanical', side: 'S', x0: 0.36, x1: 0.5 },
        { id: 'changingA', label: 'Changing Room A', type: 'common', side: 'S', x0: 0.5, x1: 0.68 },
        { id: 'changingB', label: 'Changing Room B', type: 'common', side: 'S', x0: 0.68, x1: 0.86 },
        { id: 'peoffice', label: 'PE Office', type: 'office', side: 'S', x0: 0.86, x1: 1.0 },
      ] },
    ],
  });

  // ======================= OUTDOOR SPORTS =================================
  function courtTexture(name, painter) {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 256 }, scene, true);
    const ctx = tex.getContext();
    painter(ctx, 512, 256);
    tex.update();
    return tex;
  }
  function court(name, x, z, w, d, baseColor, painter) {
    const g = BABYLON.MeshBuilder.CreateGround(name + uid++, { width: w, height: d }, scene);
    g.position.set(x, 0.04, z);
    const mat = new BABYLON.PBRMaterial(name + 'mat' + uid, scene);
    mat.albedoTexture = courtTexture(name + 'tex' + uid, (ctx, cw, ch) => {
      ctx.fillStyle = baseColor; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#f0f0ea'; ctx.lineWidth = 5;
      painter(ctx, cw, ch);
    });
    mat.roughness = 0.9; mat.metallic = 0;
    g.material = mat; g.receiveShadows = true; g.freezeWorldMatrix();
    WAYPOINTS.outdoor.push(new BABYLON.Vector3(x, 0, z));
    return g;
  }
  const rect = (ctx, w, h, m) => ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  // 3 tennis courts (east side)
  for (let i = 0; i < 3; i++) {
    court('tennis', 118, 44 - i * 26, 22, 11, '#2e6b4f', (ctx, w, h) => {
      rect(ctx, w, h, 20);
      ctx.beginPath(); ctx.moveTo(w / 2, 20); ctx.lineTo(w / 2, h - 20); ctx.stroke();
      ctx.strokeRect(20, h * 0.28, w - 40, h * 0.44);
    });
    box('tennisNet', 0.06, 1.0, 11, 118, 0.5, 44 - i * 26, M.fence);
  }
  // 2 basketball courts (west side)
  for (let i = 0; i < 2; i++) {
    court('bball', -122, 40 - i * 20, 26, 15, '#2c5c8a', (ctx, w, h) => {
      rect(ctx, w, h, 16);
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(30, h / 2, 46, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(w - 30, h / 2, 46, Math.PI / 2, 3 * Math.PI / 2); ctx.stroke();
    });
    const bz = 40 - i * 20;
    for (const bx of [-134, -110]) {
      box('bbPost', 0.15, 3.4, 0.15, bx, 1.7, bz, M.metal);
      box('bbBoard', 0.06, 1.0, 1.6, bx + (bx < -122 ? 0.3 : -0.3), 3.1, bz, M.whiteboard, { collide: false });
    }
  }
  // 2 soccer pitches (south field)
  for (let i = 0; i < 2; i++) {
    const px = -55 + i * 110;
    court('pitch', px, -115, 48, 30, '#3e7a2e', (ctx, w, h) => {
      rect(ctx, w, h, 12);
      ctx.beginPath(); ctx.moveTo(w / 2, 12); ctx.lineTo(w / 2, h - 12); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(12, h * 0.3, 40, h * 0.4); ctx.strokeRect(w - 52, h * 0.3, 40, h * 0.4);
    });
    for (const gx of [px - 23.5, px + 23.5]) {
      box('goalPost', 0.12, 2.2, 0.12, gx, 1.1, -115 - 3.5, M.lineWhite);
      box('goalPost', 0.12, 2.2, 0.12, gx, 1.1, -115 + 3.5, M.lineWhite);
      box('goalBar', 0.12, 0.12, 7.2, gx, 2.2, -115, M.lineWhite);
    }
  }

  WAYPOINTS.outdoor.push(
    new BABYLON.Vector3(0, 0, 20), new BABYLON.Vector3(-40, 0, 0), new BABYLON.Vector3(40, 0, 5),
    new BABYLON.Vector3(0, 0, -30), new BABYLON.Vector3(-20, 0, 30), new BABYLON.Vector3(25, 0, -20),
  );

  HSS.ROOMS = ROOMS;
  HSS.CLASSROOMS = CLASSROOMS;
  HSS.WAYPOINTS = WAYPOINTS;
  return { ROOMS, CLASSROOMS };
};
