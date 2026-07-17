// ---------------------------------------------------------------------------
// player.js — first-person controller (with third-person toggle), the sit
// system, and contextual interactions (E), talk (T), actions (G).
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

HSS.Player = class {
  constructor(scene, canvas, appearance) {
    this.scene = scene;
    this.canvas = canvas;
    this.camera = new BABYLON.UniversalCamera('playerCam', new BABYLON.Vector3(0, 1.7, -10), scene);
    this.camera.attachControl(canvas, true);
    this.camera.speed = 0.32;
    this.camera.angularSensibility = 3200;
    this.camera.inertia = 0.6;
    this.camera.minZ = 0.1;
    this.camera.applyGravity = true;
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new BABYLON.Vector3(0.38, 0.85, 0.38);
    this.camera.ellipsoidOffset = new BABYLON.Vector3(0, 0.85, 0);
    this.camera.keysUp = [87]; this.camera.keysDown = [83];
    this.camera.keysLeft = [65]; this.camera.keysRight = [68];
    scene.activeCamera = this.camera;

    this.sitting = null;          // seat record while seated
    this.thirdPerson = false;
    this.appearance = appearance;
    this.ped = null;              // visible in third person / while seated

    canvas.addEventListener('click', () => {
      if (!HSS.UI.anyPanelOpen()) canvas.requestPointerLock?.();
    });
  }

  buildPed() {
    if (this.ped) return;
    const app = Object.assign({}, this.appearance);
    const built = HSS.buildPed(this.scene, app, 'player');
    this.ped = built;
    this.ped.root.setEnabled(false);
    this.ped.root.getChildMeshes().forEach(m => { m.isPickable = false; });
  }

  position() { return this.camera.position; }

  setThirdPerson(on) {
    this.thirdPerson = on;
    this.buildPed();
    if (!this.sitting) this.ped.root.setEnabled(on);
  }

  syncPed() {
    if (!this.ped) return;
    if (this.sitting) return; // pose frozen at the seat
    if (this.thirdPerson) {
      const p = this.camera.position;
      this.ped.root.position.set(p.x, p.y - 1.7, p.z);
      this.ped.root.rotation.y = this.camera.rotation.y;
    }
  }

  // ---- sit system ---------------------------------------------------------
  sit(seat) {
    if (this.sitting) this.stand();
    this.sitting = seat;
    this.buildPed();
    // park the ped in the chair, put the camera at seated head height
    this.ped.root.setEnabled(true);
    this.ped.root.position.set(seat.pos.x, seat.pos.y + 0.02, seat.pos.z);
    this.ped.root.rotation.y = seat.yaw;
    this.ped.hips.position.y = 0.62;
    this.ped.parts.hipL.rotation.x = -Math.PI / 2.2;
    this.ped.parts.hipR.rotation.x = -Math.PI / 2.2;
    this.camera.applyGravity = false;
    this.camera.checkCollisions = false;
    this.camera.position.set(seat.pos.x - Math.sin(seat.yaw) * 0.1, seat.pos.y + 1.35, seat.pos.z - Math.cos(seat.yaw) * 0.1);
    this.camera.rotation.y = seat.yaw; // face the same way the chair faces
    this.camera.rotation.x = 0;
    HSS.game.onPlayerSat(seat);
  }

  stand() {
    if (!this.sitting) return;
    const seat = this.sitting;
    this.sitting = null;
    if (this.ped) {
      this.ped.root.setEnabled(this.thirdPerson);
      this.ped.hips.position.y = 0.95;
      this.ped.parts.hipL.rotation.x = 0;
      this.ped.parts.hipR.rotation.x = 0;
    }
    this.camera.applyGravity = true;
    this.camera.checkCollisions = true;
    // step out beside the chair
    this.camera.position.set(seat.pos.x + Math.sin(seat.yaw) * 0.9, seat.pos.y + 1.7, seat.pos.z + Math.cos(seat.yaw) * 0.9);
    HSS.game.onPlayerStood(seat);
  }

  // ---- interaction scan (called every frame) ------------------------------
  scanInteractable() {
    const pos = this.camera.position;
    if (this.sitting) {
      // seated at a desk with a computer?
      const room = HSS.game.roomAt(pos);
      const nearPC = this.sitting.type === 'teacherDesk' || this.sitting.type === 'adminDesk' || this.sitting.type === 'officeDesk';
      return { kind: 'seated', seat: this.sitting, room, nearPC };
    }
    // nearest seat within reach & roughly in front
    let bestSeat = null, bestD = 2.2;
    for (const s of HSS.SEATS) {
      const d = BABYLON.Vector3.Distance(pos, new BABYLON.Vector3(s.pos.x, pos.y, s.pos.z));
      if (d < bestD && Math.abs(s.pos.y + 1.7 - pos.y) < 2.2) { bestD = d; bestSeat = s; }
    }
    // nearest NPC
    let bestNpc = null, bestND = 3.2;
    for (const npc of HSS.game.activeNpcs) {
      const d = BABYLON.Vector3.Distance(pos, npc.root.position);
      if (d < bestND) { bestND = d; bestNpc = npc; }
    }
    return { kind: 'free', seat: bestSeat, npc: bestNpc };
  }
};
