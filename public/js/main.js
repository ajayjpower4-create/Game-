// ---------------------------------------------------------------------------
// main.js — boots the engine, wires every system together, runs the game loop.
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

(async function boot() {
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true, { stencil: true });
  const scene = new BABYLON.Scene(engine);
  scene.collisionsEnabled = true;
  scene.gravity = new BABYLON.Vector3(0, -0.45, 0);
  scene.clearColor = BABYLON.Color4.FromHexString('#9db8d8ff');
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0022;
  scene.fogColor = BABYLON.Color3.FromHexString('#b8c8dc');

  // ---- lighting: low London sun + sky ambience + post pipeline ----------
  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.45, -0.85, 0.35), scene);
  sun.position = new BABYLON.Vector3(60, 90, -50);
  sun.intensity = 3.0;
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;
  hemi.groundColor = BABYLON.Color3.FromHexString('#5a6a55');
  scene.environmentIntensity = 1.0;
  // procedural gradient sky (no external assets)
  {
    const sky = BABYLON.MeshBuilder.CreateSphere('sky', { diameter: 850, segments: 12, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
    const skyMat = new BABYLON.StandardMaterial('skyMat', scene);
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    const skyTex = new BABYLON.DynamicTexture('skyTex', { width: 32, height: 512 }, scene, true);
    const sc = skyTex.getContext();
    const grad = sc.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#41639b');
    grad.addColorStop(0.45, '#7f9dc4');
    grad.addColorStop(0.62, '#c9d6e6');
    grad.addColorStop(1, '#8fa3b8');
    sc.fillStyle = grad; sc.fillRect(0, 0, 32, 512);
    skyTex.update();
    skyMat.emissiveTexture = skyTex;
    skyMat.diffuseColor = skyMat.specularColor = BABYLON.Color3.Black();
    sky.material = skyMat;
    sky.isPickable = false;
    sky.applyFog = false;
  }

  const shadow = new BABYLON.ShadowGenerator(2048, sun);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = 16;
  shadow.bias = 0.001;

  const pipeline = new BABYLON.DefaultRenderingPipeline('pipe', true, scene, [/* cameras added later */]);
  pipeline.fxaaEnabled = true;
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.9; pipeline.bloomWeight = 0.18;
  pipeline.imageProcessing.toneMappingEnabled = true;
  pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  pipeline.imageProcessing.contrast = 1.15;
  pipeline.imageProcessing.exposure = 1.05;

  // screen-space ambient occlusion — opt-in via ?ssao=1 (renders badly on some
  // software/older GPUs, so it defaults off)
  let ssao = null;
  try {
    const wantSSAO = new URLSearchParams(location.search).get('ssao') === '1';
    if (wantSSAO && BABYLON.SSAO2RenderingPipeline && BABYLON.SSAO2RenderingPipeline.IsSupported) {
      ssao = new BABYLON.SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.75, blurRatio: 1 }, []);
      ssao.radius = 1.4;
      ssao.totalStrength = 1.0;
      ssao.samples = 12;
      ssao.expensiveBlur = false;
    }
  } catch { ssao = null; }
  // the post pipeline follows the single active camera — attaching several
  // cameras at once smears the frame
  let fxCam = null;
  const attachFX = (cam) => {
    if (fxCam === cam) return;
    if (fxCam) {
      try {
        pipeline.removeCamera(fxCam);
        if (ssao) scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline('ssao', fxCam);
      } catch { /* previous camera may already be disposed */ }
    }
    fxCam = cam;
    pipeline.addCamera(cam);
    if (ssao) scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('ssao', cam);
  };

  // ---- world --------------------------------------------------------------
  const M = HSS.buildMaterials(scene);
  HSS.materials = M;
  HSS.buildCampus(scene, M, shadow);
  const students = HSS.generateStudents();

  // camera used behind the menus until the player takes over
  const menuCam = new BABYLON.ArcRotateCamera('menuCam', -Math.PI / 2.4, 1.15, 90, new BABYLON.Vector3(0, 6, 20), scene);
  scene.activeCamera = menuCam;

  // ---- game state ---------------------------------------------------------
  const G = {
    scene, engine, students,
    staffList: [], playerStaff: null, playerName: 'You',
    clockMin: HSS.toMin('08:25'), timeScale: 20, // game-seconds per real second
    recentEvents: [],
    activeNpcs: [],
    currentRoom: null,
    classesByRoom: new Map(),   // roomId -> {form, subject, students}
    attendance: new Map(),      // form -> {marks:{}, submitted, dueBy}
    confrontedForms: new Set(),
    pendingWalkAway: null,
    started: false,
    player: null,

    npcById(id) { return this.activeNpcs.find(n => n.id === id) || null; },

    roomAt(pos) {
      for (const id in HSS.ROOMS) {
        const r = HSS.ROOMS[id], b = r.bounds;
        if (pos.x >= b.minX && pos.x <= b.maxX && pos.z >= b.minZ && pos.z <= b.maxZ
          && pos.y >= r.floorY - 0.5 && pos.y <= r.floorY + 3.2) return r;
      }
      return null;
    },

    // one register per form per period — skipping any lesson's register has consequences
    attendanceFor(form) {
      const key = `${form}|${HSS.periodAt(this.clockMin).name}`;
      if (!this.attendance.has(key)) this.attendance.set(key, { marks: {}, submitted: false });
      return this.attendance.get(key);
    },

    logEvent(s) { this.recentEvents.push(s); if (this.recentEvents.length > 12) this.recentEvents.shift(); },

    onPlayerSat(seat) {
      const room = this.roomAt(this.player.camera.position);
      if (seat.type === 'teacherDesk') HSS.UI.toast('Seated at the teacher desk. Press E to use the computer.');
      else if (seat.type === 'adminDesk') HSS.UI.toast('Seated at an admin workstation. Press E to open the admin panel.');
      const near = this.activeNpcs.filter(n => BABYLON.Vector3.Distance(n.root.position, seat.pos) < 8);
      if (near.length && Math.random() < 0.4) {
        const n = near[Math.floor(Math.random() * near.length)];
        HSS.AI.reactToEvent(n, `${this.playerName} sits down nearby`).then(t => HSS.UI.bubble(n, t));
      }
    },
    onPlayerStood() {},

    onAttendanceDone(form) {
      this.logEvent(`attendance taken for ${form}`);
    },

    // homework / quiz hand-out with cutscene
    async assignWork(type, title, cls) {
      const room = this.currentRoom;
      const label = type === 'homework' ? 'homework' : 'quiz';
      const cam = this.player.camera;
      document.exitPointerLock?.();
      const oldPos = cam.position.clone(), oldRot = cam.rotation.clone();
      // sweep the camera across the classroom
      if (room) {
        const b = room.bounds;
        cam.position.set((b.minX + b.maxX) / 2, room.floorY + 2.2, room.side === 'N' ? b.minZ + 1 : b.maxZ - 1);
        cam.rotation.set(0.35, room.side === 'N' ? 0 : Math.PI, 0);
      }
      // papers appear on the desks
      const papers = [];
      if (room) {
        for (const s of room.seats.filter(x => x.type === 'studentDesk')) {
          const p = BABYLON.MeshBuilder.CreateBox('paper', { width: 0.3, height: 0.01, depth: 0.4 }, scene);
          p.position.set(s.pos.x, s.pos.y + 0.76, s.pos.z - Math.cos(s.yaw) * 0.55);
          p.material = M.paper;
          papers.push(p);
        }
      }
      await HSS.UI.cutscene(`${this.playerName} moves along the rows, handing out "${title}" to ${cls.form}…`, 4.5);
      cam.position.copyFrom(oldPos); cam.rotation.copyFrom(oldRot);
      HSS.UI.toast(`📄 ${title} (${label}) assigned to ${cls.form}.`);
      this.logEvent(`${label} "${title}" handed out to ${cls.form}`);
      const seated = this.activeNpcs.filter(n => n.kind === 'student' && n.state === 'sit');
      if (seated.length) {
        const replies = await HSS.AI.talkToGroup(seated.slice(0, 8), `[EVENT] ${this.playerName} hands out a ${label} titled "${title}" to the class`);
        for (const r of replies) {
          const npc = seated.find(n => String(n.id) === String(r.id));
          if (npc) HSS.UI.bubble(npc, r.text);
        }
      }
    },
  };
  HSS.game = G;

  // ---- load staff + start screen -----------------------------------------
  const staffData = await fetch('/api/staff').then(r => r.json());
  G.staffList = staffData.staff;
  const aiStatus = document.getElementById('aiStatus');
  fetch('/api/health').then(r => r.json()).then(j => {
    aiStatus.textContent = j.aiEnabled
      ? '🟢 AI NPCs online (claude-sonnet-4-6)'
      : '🟠 ANTHROPIC_API_KEY not set — NPCs will use canned fallback lines.';
  }).catch(() => { aiStatus.textContent = '🔴 Server unreachable.'; });

  const roleList = document.getElementById('roleList');
  const roleSearch = document.getElementById('roleSearch');
  function renderRoles() {
    const q = roleSearch.value.trim().toLowerCase();
    roleList.innerHTML = '';
    const groups = {};
    for (const s of G.staffList) {
      const hay = `${s.name} ${s.role} ${s.department || ''} ${s.category}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      (groups[s.category] = groups[s.category] || []).push(s);
    }
    for (const cat of Object.keys(groups)) {
      const gh = document.createElement('div'); gh.className = 'roleGroup'; gh.textContent = cat;
      roleList.appendChild(gh);
      for (const s of groups[cat]) {
        const item = document.createElement('div'); item.className = 'roleItem';
        const a = document.createElement('span'); a.className = 'rName'; a.textContent = s.name;
        const b = document.createElement('span'); b.className = 'rRole'; b.textContent = s.role;
        item.append(a, b);
        item.addEventListener('click', () => chooseRole(s));
        roleList.appendChild(item);
      }
    }
  }
  roleSearch.addEventListener('input', renderRoles);
  renderRoles();

  // ---- character creation -------------------------------------------------
  const creator = {
    skin: HSS.SKIN_TONES[2], hairStyle: 'short', hairColor: HSS.HAIR_COLORS[0],
    outfit: HSS.OUTFIT_COLORS[0], height: 1.0,
  };
  let previewPed = null, previewCam = null;

  function chooseRole(s) {
    G.playerStaff = s;
    G.playerName = s.name;
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('creatorScreen').classList.remove('hidden');
    document.getElementById('creatorRoleLine').textContent = `${s.name} — ${s.role}`;
    // preview stage: ped on the yard, orbit camera
    menuCam.detachControl();
    previewCam = new BABYLON.ArcRotateCamera('prevCam', -Math.PI / 2, 1.35, 5.2, new BABYLON.Vector3(0, 1.1, 10), scene);
    scene.activeCamera = previewCam;
    previewCam.attachControl(canvas, true);
    rebuildPreview();
    buildSwatches();
  }

  function rebuildPreview() {
    if (previewPed) previewPed.root.dispose(false, true);
    const cat = HSS.OUTFITS[G.playerStaff.category] || HSS.OUTFITS.Teacher;
    previewPed = HSS.buildPed(scene, {
      skin: creator.skin, hairStyle: creator.hairStyle, hairColor: creator.hairColor,
      top: creator.outfit, bottom: cat.bottom, height: creator.height,
    }, 'preview');
    previewPed.root.position.set(0, 0, 10);
    previewPed.root.rotation.y = Math.PI;
  }

  function swatchRow(elId, colors, key) {
    const el = document.getElementById(elId); el.innerHTML = '';
    colors.forEach(c => {
      const s = document.createElement('div');
      s.className = `swatch${creator[key] === c ? ' sel' : ''}`;
      s.style.background = c;
      s.addEventListener('click', () => { creator[key] = c; buildSwatches(); rebuildPreview(); });
      el.appendChild(s);
    });
  }
  function buildSwatches() {
    swatchRow('skinSwatches', HSS.SKIN_TONES, 'skin');
    swatchRow('hairSwatches', HSS.HAIR_COLORS, 'hairColor');
    swatchRow('outfitSwatches', HSS.OUTFIT_COLORS, 'outfit');
    const hs = document.getElementById('hairStyles'); hs.innerHTML = '';
    HSS.HAIR_STYLES.forEach(st => {
      const c = document.createElement('div');
      c.className = `chip${creator.hairStyle === st ? ' sel' : ''}`; c.textContent = st;
      c.addEventListener('click', () => { creator.hairStyle = st; buildSwatches(); rebuildPreview(); });
      hs.appendChild(c);
    });
  }
  document.getElementById('heightSlider').addEventListener('input', (e) => {
    creator.height = parseFloat(e.target.value); rebuildPreview();
  });

  document.getElementById('startDayBtn').addEventListener('click', () => {
    document.getElementById('creatorScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    if (previewPed) { previewPed.root.dispose(false, true); previewPed = null; }
    if (previewCam) { previewCam.detachControl(); previewCam.dispose(); }
    startGame();
  });

  // ---- the game proper ----------------------------------------------------
  const cat = () => HSS.OUTFITS[G.playerStaff.category] || HSS.OUTFITS.Teacher;

  function startGame() {
    G.player = new HSS.Player(scene, canvas, {
      skin: creator.skin, hairStyle: creator.hairStyle, hairColor: creator.hairColor,
      top: creator.outfit, bottom: cat().bottom, height: creator.height,
    });
    attachFX(G.player.camera);
    G.player.camera.position.set(0, 1.75, 5);
    G.started = true;
    document.getElementById('playerBox').textContent = `${G.playerName} — ${G.playerStaff.role}`;
    HSS.UI.toast(`Welcome to Harford, ${G.playerStaff.role}. The day runs until 15:30.`);
    canvas.requestPointerLock?.();
  }

  // ---- NPC population management -----------------------------------------
  const npcPool = new Map(); // id -> NPC
  function spawnNpc(profile, appearance) {
    if (npcPool.has(profile.id)) return npcPool.get(profile.id);
    const npc = new HSS.NPC(scene, profile, appearance);
    npcPool.set(profile.id, npc);
    G.activeNpcs.push(npc);
    return npc;
  }
  function despawnNpc(npc) {
    npcPool.delete(npc.id);
    const i = G.activeNpcs.indexOf(npc);
    if (i >= 0) G.activeNpcs.splice(i, 1);
    HSS.UI.setHandRaised(npc, false);
    npc.dispose();
  }
  function despawnWhere(pred) { [...G.activeNpcs].filter(pred).forEach(despawnNpc); }

  // which class is in a given classroom this period?
  function classForRoom(room, period) {
    if (period.kind !== 'lesson' && period.kind !== 'form') return null;
    const idx = HSS.CLASSROOMS.indexOf(room.id);
    if (idx < 0) return null;
    for (let year = 7; year <= 11; year++) {
      for (const f of HSS.FORMS) {
        const form = `${year}${f}`;
        const les = HSS.lessonFor(form, period.name);
        if (les.roomIndex % HSS.CLASSROOMS.length === idx) {
          return { form, subject: les.subject, students: students.filter(s => s.form === form) };
        }
      }
    }
    return null;
  }

  let lastPopKey = '';
  function managePopulation() {
    const period = HSS.periodAt(G.clockMin);
    const room = G.currentRoom;
    const key = `${period.name}|${room ? room.id : 'out'}`;
    if (key === lastPopKey) return;
    lastPopKey = key;

    // classroom population
    if (room && (room.type === 'classroom' || room.type === 'senclass')) {
      const cls = classForRoom(room, period);
      despawnWhere(n => n.kind === 'student' && (!cls || n.profile.form !== cls.form));
      if (cls) {
        G.classesByRoom.set(room.id, cls);
        const seats = room.seats.filter(s => s.type === 'studentDesk');
        cls.students.slice(0, seats.length).forEach((st, i) => {
          const npc = spawnNpc(st);
          npc.sit(seats[i]);
        });
        // attendance timer starts when a lesson finds you in the room
        if (period.kind === 'lesson') armAttendanceWatch(cls, period);
        HSS.UI.toast(`${cls.form} — ${cls.subject}, ${room.label}.`);
      }
      return;
    }

    // outside classrooms: wanderers during social times
    despawnWhere(n => n.kind === 'student');
    const social = period.kind === 'break' || period.kind === 'lunch' || period.kind === 'free';
    const n = social ? 26 : 6; // stragglers during lessons
    const rng = HSS.makeRng(Math.floor(G.clockMin));
    const pos = G.player ? G.player.camera.position : new BABYLON.Vector3(0, 0, 0);
    const wps = HSS.WAYPOINTS.outdoor;
    for (let i = 0; i < n; i++) {
      const st = students[Math.floor(rng() * students.length)];
      const npc = spawnNpc(st);
      const wp = wps[Math.floor(rng() * wps.length)];
      npc.setPosition(wp.x + (rng() - 0.5) * 10, 0, wp.z + (rng() - 0.5) * 10, rng() * Math.PI * 2);
    }
    // lunch: fill the cafeteria if the player heads there
    if (period.kind === 'lunch') {
      const caf = HSS.ROOMS['gymcafe-f0-cafeteria'];
      if (caf && pos && BABYLON.Vector3.Distance(pos, caf.center) < 45) {
        const seats = caf.seats;
        for (let i = 0; i < Math.min(seats.length, 30); i++) {
          const st = students[Math.floor(rng() * students.length)];
          const npc = spawnNpc(st);
          npc.sit(seats[i]);
        }
      }
    }
  }

  // ---- staff NPC placement (a handful near the player) -------------------
  function staffHomeRoom(s) {
    const R = HSS.ROOMS;
    switch (s.category) {
      case 'SLT': return R['staff-f1-head'] && (s.id === 'slt-01' ? R['staff-f1-head'] : R['staff-f1-meeting2']);
      case 'Admin': return s.building === 'main' ? R['main-f0-recep'] : R['staff-f0-admin'];
      case 'Catering': return R['gymcafe-f0-kitchen'];
      case 'Site': return null; // wanders outdoors
      case 'IT': return R['staff-f1-itoffice'];
      case 'SEN': return R['sen-f0-senco'] || R['sen-f0-senclass1'];
      case 'Year Team': return R['main-f0-common2'];
      case 'Support': return R['main-f0-library'];
      default: return R['staff-f0-staffroom'];
    }
  }
  let staffSpawned = false;
  function placeStaff() {
    if (staffSpawned) return;
    staffSpawned = true;
    const rng = HSS.makeRng(7);
    for (const s of G.staffList) {
      if (s.id === G.playerStaff.id) continue;
      if (rng() > 0.45) continue; // ~40 staff around the site
      const room = staffHomeRoom(s);
      const npc = spawnNpc(Object.assign({ kind: 'staff' }, s, {
        appearance: {
          skin: HSS.SKIN_TONES[Math.floor(rng() * HSS.SKIN_TONES.length)],
          hairStyle: HSS.HAIR_STYLES[Math.floor(rng() * HSS.HAIR_STYLES.length)],
          hairColor: HSS.HAIR_COLORS[Math.floor(rng() * HSS.HAIR_COLORS.length)],
          height: 0.96 + rng() * 0.1,
        },
      }));
      if (room) {
        // indoor staff are confined to their own room — no wandering out
        // through walls or off upper floors
        npc.home = {
          minX: room.bounds.minX + 0.7, maxX: room.bounds.maxX - 0.7,
          minZ: room.bounds.minZ + 0.7, maxZ: room.bounds.maxZ - 0.7,
          y: room.floorY,
        };
        const sSeat = room.seats.find(x => !x.taken);
        if (sSeat && rng() < 0.6) { sSeat.taken = true; npc.sit(sSeat); }
        else npc.setPosition(room.center.x + (rng() - 0.5) * 2, room.floorY, room.center.z + (rng() - 0.5) * 2, rng() * Math.PI * 2);
      } else {
        const wp = HSS.WAYPOINTS.outdoor[Math.floor(rng() * HSS.WAYPOINTS.outdoor.length)];
        npc.setPosition(wp.x, 0, wp.z, rng() * Math.PI * 2);
      }
    }
  }

  // ---- attendance consequence --------------------------------------------
  let attendanceWatch = null;
  function armAttendanceWatch(cls, period) {
    if (G.confrontedForms.has(`${cls.form}|${period.name}`)) return;
    const reg = G.attendanceFor(cls.form);
    if (reg.submitted) return;
    attendanceWatch = { cls, period, deadline: G.clockMin + 4 }; // 4 game-minutes grace
  }
  async function fireAttendanceConfrontation() {
    const { cls, period } = attendanceWatch;
    attendanceWatch = null;
    G.confrontedForms.add(`${cls.form}|${period.name}`);
    const year = parseInt(cls.form, 10);
    const enforcerProfile = G.staffList.find(s => s.id === `hoy-${String(year).padStart(2, '0')}`)
      || G.staffList.find(s => s.category === 'SLT');
    if (!enforcerProfile || !G.currentRoom) return;
    const room = G.currentRoom;
    // walk in from the door
    const doorPos = new BABYLON.Vector3(
      (room.bounds.minX + room.bounds.maxX) / 2,
      room.floorY,
      room.side === 'N' ? room.bounds.minZ + 0.6 : room.bounds.maxZ - 0.6);
    const npc = spawnNpc(Object.assign({ kind: 'staff' }, enforcerProfile));
    npc.setPosition(doorPos.x, doorPos.y, doorPos.z);
    npc.home = {
      minX: room.bounds.minX + 0.7, maxX: room.bounds.maxX - 0.7,
      minZ: room.bounds.minZ + 0.7, maxZ: room.bounds.maxZ - 0.7,
      y: room.floorY,
    };
    const pp = G.player.camera.position;
    npc.walkTo(new BABYLON.Vector3(pp.x + 0.8, room.floorY, pp.z + 0.8));
    HSS.UI.toast(`⚠ ${enforcerProfile.name} has walked in about the missing register.`, 'warn');
    G.logEvent(`${enforcerProfile.name} walked in because attendance wasn't taken for ${cls.form}`);
    const line = await HSS.AI.talkTo(npc, `[EVENT] You have just walked into ${room.label} because ${G.playerName} (${G.playerStaff.role}) has not taken attendance for ${cls.form} — the register is a legal safeguarding requirement. Confront them about it, in character.`);
    HSS.UI.bubble(npc, line, { seconds: 12 });
  }

  // ---- hand raising -------------------------------------------------------
  let handTimer = 0;
  function handRaising(dt) {
    if (!G.currentRoom || !(G.currentRoom.type === 'classroom' || G.currentRoom.type === 'senclass')) return;
    handTimer -= dt;
    if (handTimer > 0) return;
    handTimer = 14 + Math.random() * 18;
    const seated = G.activeNpcs.filter(n => n.kind === 'student' && n.state === 'sit' && !n.handRaised);
    if (!seated.length) return;
    const candidates = seated.filter(n => n.profile.stats.engagement > 5 || Math.random() < 0.3);
    if (!candidates.length) return;
    const npc = candidates[Math.floor(Math.random() * candidates.length)];
    npc.raiseHand(true);
    HSS.UI.setHandRaised(npc, true, (clicked) => {
      HSS.UI.openDialogue([{ label: `✋ ${clicked.name}`, npcs: [clicked] }]);
    });
    setTimeout(() => { if (npc.handRaised) { npc.raiseHand(false); HSS.UI.setHandRaised(npc, false); } }, 45000);
  }

  // ---- input --------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (!G.started) return;
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (e.key === 'Escape') { closeDialogueWithMemory(); HSS.UI.closePanels(); return; }
    if (typing) return;

    const scan = G.player.scanInteractable();
    switch (e.key.toLowerCase()) {
      case 'e': {
        if (scan.kind === 'seated') {
          if (scan.nearPC) {
            const room = scan.room;
            if (scan.seat.type === 'teacherDesk') HSS.UI.openTeacherPC(room, room ? classForRoom(room, HSS.periodAt(G.clockMin)) : null);
            else HSS.UI.openAdminPanel();
          } else G.player.stand();
        } else if (scan.seat) {
          G.player.sit(scan.seat);
        }
        break;
      }
      case 'q': if (scan.kind === 'seated') G.player.stand(); break;
      case 't': {
        const targets = buildDialogueTargets();
        if (targets.length) HSS.UI.openDialogue(targets);
        else HSS.UI.toast('Nobody close enough to talk to.');
        break;
      }
      case 'g': {
        HSS.UI.openActionMenu(async (key, desc) => {
          HSS.UI.toast(`You ${desc}.`);
          G.logEvent(`${G.playerName} ${desc}`);
          const near = G.activeNpcs.filter(n => BABYLON.Vector3.Distance(n.root.position, G.player.camera.position) < 10);
          if (!near.length) return;
          if (near.length === 1) {
            const t = await HSS.AI.reactToAction(near[0], desc);
            HSS.UI.bubble(near[0], t);
          } else {
            const replies = await HSS.AI.talkToGroup(near.slice(0, 8), `[ACTION] ${G.playerName} ${desc}`);
            for (const r of replies) {
              const npc = near.find(n => String(n.id) === String(r.id));
              if (npc) HSS.UI.bubble(npc, r.text);
            }
          }
        });
        break;
      }
      case 'v': G.player.setThirdPerson(!G.player.thirdPerson); break;
      case '[': G.timeScale = Math.max(5, G.timeScale / 2); HSS.UI.toast(`Time speed ×${G.timeScale}`); break;
      case ']': G.timeScale = Math.min(120, G.timeScale * 2); HSS.UI.toast(`Time speed ×${G.timeScale}`); break;
    }
  });

  function buildDialogueTargets() {
    const pos = G.player.camera.position;
    const near = G.activeNpcs
      .map(n => ({ n, d: BABYLON.Vector3.Distance(n.root.position, pos) }))
      .filter(x => x.d < 9)
      .sort((a, b) => a.d - b.d);
    if (!near.length) return [];
    const targets = [];
    targets.push({ label: `→ ${near[0].n.name}`, npcs: [near[0].n] });
    const room = G.currentRoom;
    if (room && (room.type === 'classroom' || room.type === 'senclass')) {
      const cls = G.activeNpcs.filter(n => n.kind === 'student' && n.state === 'sit');
      if (cls.length) targets.push({ label: `📢 Whole class (${cls.length})`, npcs: cls });
    }
    if (room && room.type === 'meeting') {
      const grp = G.activeNpcs.filter(n => G.roomAt(n.root.position)?.id === room.id);
      if (grp.length) targets.push({ label: `👥 Meeting (${grp.length})`, npcs: grp });
    }
    if (near.length > 1) {
      targets.push({ label: `Group: ${Math.min(near.length, 5)} nearest`, npcs: near.slice(0, 5).map(x => x.n) });
    }
    // walk-away tracking for the single target
    G.pendingWalkAway = { npc: near[0].n, pos: pos.clone(), armed: false };
    return targets;
  }

  function closeDialogueWithMemory() {
    if (!document.getElementById('dialogueBox').classList.contains('hidden') && G.pendingWalkAway) {
      G.pendingWalkAway.armed = true;
      G.pendingWalkAway.until = performance.now() + 12000;
    }
  }
  document.querySelector('[data-close="dialogueBox"]').addEventListener('click', closeDialogueWithMemory);

  // ---- clock + loop -------------------------------------------------------
  const clockTime = document.getElementById('clockTime');
  const clockPeriod = document.getElementById('clockPeriod');
  let lastPeriodName = '';
  let elapsed = 0;

  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;
    elapsed += dt;
    if (!G.started) return;

    // advance the school day
    G.clockMin += (dt * G.timeScale) / 60;
    if (G.clockMin >= HSS.toMin('17:00')) G.clockMin = HSS.toMin('17:00');
    const period = HSS.periodAt(G.clockMin);
    clockTime.textContent = HSS.fmtTime(G.clockMin);
    clockPeriod.textContent = period.name;
    if (period.name !== lastPeriodName) {
      lastPeriodName = period.name;
      HSS.UI.toast(`🔔 ${period.name} (${period.start}–${period.end})`);
      lastPopKey = ''; // force respawn pass
      if (period.name === 'After school') HSS.UI.toast('🏁 3:30pm — the school day is over. Free roam.', 'warn');
    }

    G.currentRoom = G.roomAt(G.player.camera.position);
    placeStaff();
    managePopulation();
    handRaising(dt);

    // attendance watchdog
    if (attendanceWatch && G.clockMin > attendanceWatch.deadline) {
      const reg = G.attendanceFor(attendanceWatch.cls.form);
      if (!reg.submitted) fireAttendanceConfrontation();
      else attendanceWatch = null;
    }

    // walk-away reactions
    if (G.pendingWalkAway?.armed) {
      const w = G.pendingWalkAway;
      if (performance.now() > w.until) G.pendingWalkAway = null;
      else if (BABYLON.Vector3.Distance(G.player.camera.position, w.pos) > 5) {
        G.pendingWalkAway = null;
        HSS.AI.reactToEvent(w.npc, `${G.playerName} walks away from the conversation`).then(t => HSS.UI.bubble(w.npc, t));
      }
    }

    // NPC updates
    for (const npc of G.activeNpcs) {
      npc.update(dt, elapsed);
      if (npc.kind === 'staff' && npc.state !== 'sit') npc.wander(dt, HSS.WAYPOINTS.outdoor);
      else if (npc.kind === 'student' && npc.state !== 'sit') npc.wander(dt, HSS.WAYPOINTS.outdoor);
    }
    G.player.syncPed();

    // interaction prompt
    if (!HSS.UI.anyPanelOpen()) {
      const scan = G.player.scanInteractable();
      if (scan.kind === 'seated') {
        HSS.UI.showPrompt(scan.nearPC ? '<b>E</b> use computer · <b>Q</b> stand up' : '<b>E</b>/<b>Q</b> stand up');
      } else if (scan.seat) {
        const label = { teacherDesk: 'sit at the teacher desk', adminDesk: 'sit at the workstation', officeDesk: 'sit at the desk', meeting: 'take a meeting seat', studentDesk: 'sit at the desk', chair: 'sit down' }[scan.seat.type] || 'sit';
        HSS.UI.showPrompt(`<b>E</b> ${label}${scan.npc ? ` · <b>T</b> talk to ${scan.npc.name}` : ''}`);
      } else if (scan.npc) {
        HSS.UI.showPrompt(`<b>T</b> talk to ${scan.npc.name}`);
      } else HSS.UI.hidePrompt();
    } else HSS.UI.hidePrompt();

    HSS.UI.updateOverlays(scene, engine);
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
})();
