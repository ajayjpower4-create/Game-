// ---------------------------------------------------------------------------
// characters.js — procedural ped (character) models + NPC behaviour.
// Peds are built from primitives with PBR skin/cloth materials so the whole
// game ships asset-free; the builder is isolated so rigged glTF characters
// can be dropped in later without touching game logic.
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

HSS.OUTFITS = {
  SLT:       { top: '#2b2f38', bottom: '#22252c', style: 'suit' },
  'Year Team': { top: '#3a4458', bottom: '#2a2f3a', style: 'suit' },
  Teacher:   { top: '#4a5a74', bottom: '#333a46', style: 'smart' },
  SEN:       { top: '#5c5470', bottom: '#333a46', style: 'smart' },
  Admin:     { top: '#6b4a5a', bottom: '#2f333c', style: 'smart' },
  Catering:  { top: '#e8e8e2', bottom: '#3a3d42', style: 'whites' },
  Site:      { top: '#e0a52f', bottom: '#3a3d42', style: 'hivis' },
  IT:        { top: '#37598f', bottom: '#2f333c', style: 'polo' },
  Support:   { top: '#4f6b5a', bottom: '#333a46', style: 'smart' },
  student:   { top: '#2a3550', bottom: '#3a3d42', style: 'uniform' },
};

HSS.buildPed = function (scene, appearance, name) {
  const root = new BABYLON.TransformNode(`ped_${name}`, scene);
  const skin = new BABYLON.PBRMaterial(`skin_${name}`, scene);
  skin.albedoColor = BABYLON.Color3.FromHexString(appearance.skin);
  skin.roughness = 0.65; skin.metallic = 0;
  const topMat = new BABYLON.PBRMaterial(`top_${name}`, scene);
  topMat.albedoColor = BABYLON.Color3.FromHexString(appearance.top || appearance.outfit || '#2a3550');
  topMat.roughness = 0.9; topMat.metallic = 0;
  const botMat = new BABYLON.PBRMaterial(`bot_${name}`, scene);
  botMat.albedoColor = BABYLON.Color3.FromHexString(appearance.bottom || '#33383f');
  botMat.roughness = 0.9; botMat.metallic = 0;
  const hairMat = new BABYLON.PBRMaterial(`hair_${name}`, scene);
  hairMat.albedoColor = BABYLON.Color3.FromHexString(appearance.hairColor || '#181512');
  hairMat.roughness = 0.85; hairMat.metallic = 0;

  const h = appearance.height || 1; // scale factor; 1 ≈ 1.75m adult
  root.scaling.set(h, h, h);

  const parts = {};
  const mk = (n, mesh, parent, mat) => { mesh.material = mat; mesh.parent = parent; mesh.isPickable = true; parts[n] = mesh; return mesh; };

  // hips node (animation pivot)
  const hips = new BABYLON.TransformNode(`hips_${name}`, scene); hips.parent = root; hips.position.y = 0.95;
  // torso
  mk('torso', BABYLON.MeshBuilder.CreateCapsule(`to_${name}`, { height: 0.62, radius: 0.17, tessellation: 10 }, scene), hips, topMat).position.y = 0.32;
  // head
  const neck = new BABYLON.TransformNode(`neck_${name}`, scene); neck.parent = hips; neck.position.y = 0.66;
  mk('neckC', BABYLON.MeshBuilder.CreateCylinder(`nk_${name}`, { height: 0.1, diameter: 0.09 }, scene), neck, skin).position.y = 0.0;
  mk('head', BABYLON.MeshBuilder.CreateSphere(`hd_${name}`, { diameterX: 0.24, diameterY: 0.28, diameterZ: 0.25, segments: 12 }, scene), neck, skin).position.y = 0.14;
  // hair
  const style = appearance.hairStyle || 'short';
  if (style !== 'bald') {
    let hair;
    if (style === 'long') {
      hair = BABYLON.MeshBuilder.CreateSphere(`hr_${name}`, { diameterX: 0.27, diameterY: 0.34, diameterZ: 0.28, segments: 8 }, scene);
      hair.position.y = 0.17; hair.position.z = -0.02;
    } else if (style === 'bun') {
      hair = BABYLON.MeshBuilder.CreateSphere(`hr_${name}`, { diameterX: 0.26, diameterY: 0.16, diameterZ: 0.27, segments: 8 }, scene);
      hair.position.y = 0.25;
      const bun = BABYLON.MeshBuilder.CreateSphere(`bun_${name}`, { diameter: 0.12, segments: 6 }, scene);
      bun.material = hairMat; bun.parent = neck; bun.position.set(0, 0.28, -0.12);
    } else if (style === 'curly' || style === 'braids') {
      hair = BABYLON.MeshBuilder.CreateSphere(`hr_${name}`, { diameterX: 0.3, diameterY: 0.22, diameterZ: 0.3, segments: 8 }, scene);
      hair.position.y = 0.23;
    } else if (style === 'buzz') {
      hair = BABYLON.MeshBuilder.CreateSphere(`hr_${name}`, { diameterX: 0.245, diameterY: 0.14, diameterZ: 0.255, segments: 8 }, scene);
      hair.position.y = 0.24;
    } else { // short
      hair = BABYLON.MeshBuilder.CreateSphere(`hr_${name}`, { diameterX: 0.26, diameterY: 0.18, diameterZ: 0.27, segments: 8 }, scene);
      hair.position.y = 0.235;
    }
    mk('hair', hair, neck, hairMat);
  }

  // arms (shoulder pivots so we can swing / raise)
  for (const side of [-1, 1]) {
    const sh = new BABYLON.TransformNode(`sh${side}_${name}`, scene);
    sh.parent = hips; sh.position.set(side * 0.24, 0.55, 0);
    const arm = BABYLON.MeshBuilder.CreateCapsule(`arm${side}_${name}`, { height: 0.55, radius: 0.055, tessellation: 8 }, scene);
    arm.material = topMat; arm.parent = sh; arm.position.y = -0.24; arm.isPickable = true;
    const hand = BABYLON.MeshBuilder.CreateSphere(`hand${side}_${name}`, { diameter: 0.09, segments: 6 }, scene);
    hand.material = skin; hand.parent = sh; hand.position.y = -0.52;
    parts[side === -1 ? 'shoulderL' : 'shoulderR'] = sh;
  }
  // legs (hip pivots) + shoes
  const shoeMat = new BABYLON.PBRMaterial(`shoe_${name}`, scene);
  shoeMat.albedoColor = BABYLON.Color3.FromHexString('#23201c');
  shoeMat.roughness = 0.5; shoeMat.metallic = 0;
  for (const side of [-1, 1]) {
    const hp = new BABYLON.TransformNode(`hp${side}_${name}`, scene);
    hp.parent = hips; hp.position.set(side * 0.1, 0.02, 0);
    const leg = BABYLON.MeshBuilder.CreateCapsule(`leg${side}_${name}`, { height: 0.9, radius: 0.075, tessellation: 8 }, scene);
    leg.material = botMat; leg.parent = hp; leg.position.y = -0.45; leg.isPickable = true;
    const shoe = BABYLON.MeshBuilder.CreateBox(`shoe${side}_${name}`, { width: 0.11, height: 0.07, depth: 0.22 }, scene);
    shoe.material = shoeMat; shoe.parent = hp; shoe.position.set(0, -0.92, 0.04);
    parts[side === -1 ? 'hipL' : 'hipR'] = hp;
  }

  // simple face: eyes + brows (huge readability win at trivial cost)
  const eyeMat = new BABYLON.StandardMaterial(`eye_${name}`, scene);
  eyeMat.diffuseColor = BABYLON.Color3.FromHexString('#1a1512');
  eyeMat.specularColor = BABYLON.Color3.Black();
  for (const side of [-1, 1]) {
    const eye = BABYLON.MeshBuilder.CreateSphere(`eye${side}_${name}`, { diameter: 0.032, segments: 6 }, scene);
    eye.material = eyeMat; eye.parent = neck; eye.position.set(side * 0.05, 0.16, 0.108);
    const brow = BABYLON.MeshBuilder.CreateBox(`brow${side}_${name}`, { width: 0.05, height: 0.012, depth: 0.01 }, scene);
    brow.material = hairMat; brow.parent = neck; brow.position.set(side * 0.05, 0.195, 0.112);
  }

  // soft blob shadow so characters sit visually on the ground
  if (HSS.materials && HSS.materials.blobShadow) {
    const blob = BABYLON.MeshBuilder.CreateDisc(`blob_${name}`, { radius: 0.34, tessellation: 14 }, scene);
    blob.rotation.x = Math.PI / 2;
    blob.position.y = 0.035;
    blob.material = HSS.materials.blobShadow;
    blob.parent = root;
    blob.isPickable = false;
  }

  // tag every mesh with the root for picking
  root.getChildMeshes().forEach(m => { m.metadata = Object.assign({}, m.metadata, { pedRoot: root }); });
  return { root, hips, parts };
};

// ---------------------------------------------------------------------------
// NPC — wraps a ped with state + procedural animation.
// ---------------------------------------------------------------------------
HSS.NPC = class {
  constructor(scene, profile, appearance) {
    this.scene = scene;
    this.profile = profile;              // staff entry or student record
    this.id = profile.id;
    this.name = profile.name;
    this.kind = profile.kind || 'staff';
    const cat = HSS.OUTFITS[this.kind === 'student' ? 'student' : profile.category] || HSS.OUTFITS.Teacher;
    // deterministic appearance defaults so any profile can spawn without one
    const rng = HSS.makeRng([...String(profile.id)].reduce((a, c) => a + c.charCodeAt(0) * 31, 7));
    const defaults = {
      top: cat.top, bottom: cat.bottom,
      skin: HSS.SKIN_TONES[Math.floor(rng() * HSS.SKIN_TONES.length)],
      hairStyle: HSS.HAIR_STYLES[Math.floor(rng() * (HSS.HAIR_STYLES.length - 1))],
      hairColor: HSS.HAIR_COLORS[Math.floor(rng() * HSS.HAIR_COLORS.length)],
      height: 0.96 + rng() * 0.1,
    };
    const app = Object.assign(defaults, appearance || profile.appearance);
    const ped = HSS.buildPed(scene, app, profile.id);
    this.root = ped.root; this.hips = ped.hips; this.parts = ped.parts;
    this.root.metadata = { npc: this };
    this.root.getChildMeshes().forEach(m => { m.metadata = Object.assign({}, m.metadata, { npc: this }); });
    this.state = 'idle';                 // idle | walk | sit
    this.target = null;
    this.speed = 1.5 + Math.random() * 0.6;
    this.phase = Math.random() * 10;
    this.handRaised = false;
    this.currentSeat = null;
    this.mood = 'neutral';
    this.home = null; // {minX,maxX,minZ,maxZ,y} — indoor NPCs never leave their room
    this._wanderTimer = 0;
  }

  setPosition(x, y, z, yaw = 0) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  sit(seatRec) {
    this.state = 'sit';
    this.currentSeat = seatRec;
    this.root.position.set(seatRec.pos.x, seatRec.pos.y + 0.02, seatRec.pos.z);
    this.root.rotation.y = seatRec.yaw;
    // sitting pose
    this.hips.position.y = 0.62;
    this.parts.hipL.rotation.x = -Math.PI / 2.2;
    this.parts.hipR.rotation.x = -Math.PI / 2.2;
    this.parts.shoulderL.rotation.x = -0.25;
    this.parts.shoulderR.rotation.x = -0.25;
  }

  stand() {
    this.state = 'idle';
    this.currentSeat = null;
    this.hips.position.y = 0.95;
    this.parts.hipL.rotation.x = 0; this.parts.hipR.rotation.x = 0;
    this.parts.shoulderL.rotation.x = 0; this.parts.shoulderR.rotation.x = 0;
    this.raiseHand(false);
  }

  walkTo(v3) { if (this.state !== 'sit') { this.state = 'walk'; this.target = v3.clone(); } }

  raiseHand(up) {
    this.handRaised = up;
    this.parts.shoulderR.rotation.x = up ? Math.PI * 0.95 : (this.state === 'sit' ? -0.25 : 0);
  }

  headPos() {
    const p = this.root.position;
    const h = (this.profile.appearance?.height || 1);
    return new BABYLON.Vector3(p.x, p.y + (this.state === 'sit' ? 1.45 : 1.85) * h, p.z);
  }

  update(dt, t) {
    if (this.state === 'walk' && this.target) {
      const p = this.root.position;
      const dx = this.target.x - p.x, dz = this.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25) { this.state = 'idle'; this.target = null; }
      else {
        const yaw = Math.atan2(dx, dz);
        this.root.rotation.y = yaw;
        p.x += (dx / dist) * this.speed * dt;
        p.z += (dz / dist) * this.speed * dt;
        // walk cycle
        const sw = Math.sin((t + this.phase) * 7) * 0.55;
        this.parts.hipL.rotation.x = sw; this.parts.hipR.rotation.x = -sw;
        if (!this.handRaised) { this.parts.shoulderL.rotation.x = -sw * 0.7; this.parts.shoulderR.rotation.x = sw * 0.7; }
        this.hips.position.y = 0.95 + Math.abs(Math.sin((t + this.phase) * 7)) * 0.03;
      }
    } else if (this.state === 'idle') {
      // subtle idle sway + settle limbs
      this.parts.hipL.rotation.x *= 0.85; this.parts.hipR.rotation.x *= 0.85;
      if (!this.handRaised) { this.parts.shoulderL.rotation.x *= 0.85; this.parts.shoulderR.rotation.x *= 0.85; }
      this.hips.position.y = 0.95 + Math.sin((t + this.phase) * 1.6) * 0.008;
    }
  }

  wander(dt, waypoints) {
    if (this.state === 'sit') return;
    this._wanderTimer -= dt;
    if (this.state !== 'idle' || this._wanderTimer > 0) return;
    this._wanderTimer = 4 + Math.random() * 10;
    if (Math.random() > 0.6) return;
    if (this.home) {
      // pace within the room only — never walk out through a wall or off a floor
      const h = this.home;
      this.walkTo(new BABYLON.Vector3(
        h.minX + Math.random() * (h.maxX - h.minX), h.y,
        h.minZ + Math.random() * (h.maxZ - h.minZ)));
    } else if (waypoints && waypoints.length) {
      // outdoors: only nearby waypoints on the same level, so nobody strides
      // across (or through) a building to reach a distant pitch
      const p = this.root.position;
      const near = waypoints.filter(w => Math.abs(w.y - p.y) < 1 && BABYLON.Vector3.Distance(w, p) < 38);
      if (!near.length) return;
      const wp = near[Math.floor(Math.random() * near.length)];
      const jitter = () => (Math.random() - 0.5) * 6;
      this.walkTo(new BABYLON.Vector3(wp.x + jitter(), wp.y, wp.z + jitter()));
    }
  }

  dispose() { this.root.dispose(false, true); }
};
