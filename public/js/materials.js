// ---------------------------------------------------------------------------
// materials.js — PBR materials with procedurally painted textures.
// Everything is generated at runtime (no external assets) so the game is
// fully self-hosted; swap these for photo-scanned PBR texture sets to push
// fidelity further.
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

HSS.buildMaterials = function (scene) {
  const M = {};

  function canvasTex(name, size, painter, opts = {}) {
    const tex = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, true);
    const ctx = tex.getContext();
    painter(ctx, size);
    tex.update();
    tex.wrapU = tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    if (opts.uv) { tex.uScale = opts.uv[0]; tex.vScale = opts.uv[1]; }
    return tex;
  }

  function pbr(name, { albedo, tex, rough = 0.85, metal = 0.0, bump = null, emissive = null }) {
    const m = new BABYLON.PBRMaterial(name, scene);
    if (tex) m.albedoTexture = tex;
    m.albedoColor = albedo ? BABYLON.Color3.FromHexString(albedo) : BABYLON.Color3.White();
    m.roughness = rough;
    m.metallic = metal;
    if (bump) { m.bumpTexture = bump; m.bumpTexture.level = 0.6; }
    if (emissive) m.emissiveColor = BABYLON.Color3.FromHexString(emissive);
    m.environmentIntensity = 0.9;
    return m;
  }

  const noise = (ctx, size, base, variance, count) => {
    for (let i = 0; i < count; i++) {
      const v = Math.floor(Math.random() * variance);
      ctx.fillStyle = `rgba(${base + v},${base + v},${base + v},0.08)`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 6, 2 + Math.random() * 6);
    }
  };

  // London stock brick
  const brickTex = canvasTex('brickTex', 512, (ctx, s) => {
    ctx.fillStyle = '#8a6a52'; ctx.fillRect(0, 0, s, s);
    const bh = 24, bw = 62;
    for (let y = 0, row = 0; y < s; y += bh, row++) {
      for (let x = -(row % 2) * bw / 2; x < s; x += bw) {
        const shade = 118 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.72)},${Math.floor(shade * 0.55)})`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
    ctx.strokeStyle = 'rgba(60,50,42,0.55)'; ctx.lineWidth = 2;
    for (let y = 0; y < s; y += bh) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
    noise(ctx, s, 90, 60, 500);
  }, { uv: [4, 2] });
  M.brick = pbr('brick', { tex: brickTex, rough: 0.95 });

  const plasterTex = canvasTex('plasterTex', 256, (ctx, s) => {
    ctx.fillStyle = '#e9e6dd'; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 210, 30, 700);
  }, { uv: [3, 2] });
  M.plaster = pbr('plaster', { tex: plasterTex, rough: 0.9 });
  M.plasterAccent = pbr('plasterAccent', { albedo: '#37598f', tex: plasterTex, rough: 0.9 });

  const linoTex = canvasTex('linoTex', 512, (ctx, s) => {
    ctx.fillStyle = '#b9b4a6'; ctx.fillRect(0, 0, s, s);
    const t = 64;
    for (let y = 0; y < s; y += t) for (let x = 0; x < s; x += t) {
      const v = 168 + Math.floor(Math.random() * 22);
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 14})`;
      ctx.fillRect(x + 1, y + 1, t - 2, t - 2);
    }
    noise(ctx, s, 140, 50, 900);
  }, { uv: [8, 8] });
  M.lino = pbr('lino', { tex: linoTex, rough: 0.55 });

  const woodTex = canvasTex('woodTex', 256, (ctx, s) => {
    ctx.fillStyle = '#9a713f'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(${90 + Math.random() * 60},${55 + Math.random() * 40},20,0.35)`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      const y = Math.random() * s;
      ctx.moveTo(0, y); ctx.bezierCurveTo(s / 3, y + 8, 2 * s / 3, y - 8, s, y);
      ctx.stroke();
    }
  });
  M.wood = pbr('wood', { tex: woodTex, rough: 0.5 });
  M.woodDark = pbr('woodDark', { albedo: '#6b4a28', tex: woodTex, rough: 0.55 });

  const grassTex = canvasTex('grassTex', 512, (ctx, s) => {
    ctx.fillStyle = '#4a7a33'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${40 + Math.random() * 60},${105 + Math.random() * 60},${30 + Math.random() * 30},0.5)`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 4);
    }
  }, { uv: [30, 30] });
  M.grass = pbr('grass', { tex: grassTex, rough: 1.0 });

  const tarmacTex = canvasTex('tarmacTex', 512, (ctx, s) => {
    ctx.fillStyle = '#4d4f52'; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 60, 60, 3000);
  }, { uv: [18, 18] });
  M.tarmac = pbr('tarmac', { tex: tarmacTex, rough: 0.95 });

  M.courtGreen = pbr('courtGreen', { albedo: '#2e6b4f', rough: 0.9 });
  M.courtBlue = pbr('courtBlue', { albedo: '#2c5c8a', rough: 0.9 });
  M.lineWhite = pbr('lineWhite', { albedo: '#e8e8e2', rough: 0.8 });

  M.roof = pbr('roof', { albedo: '#3c4046', rough: 0.9 });
  M.ceiling = pbr('ceiling', { albedo: '#dfe1de', rough: 0.95 });

  M.glass = (() => {
    const g = new BABYLON.PBRMaterial('glass', scene);
    g.albedoColor = BABYLON.Color3.FromHexString('#9fc4d8');
    g.alpha = 0.35; g.roughness = 0.08; g.metallic = 0.1;
    g.environmentIntensity = 1.2;
    return g;
  })();

  M.metal = pbr('metal', { albedo: '#8d949c', rough: 0.35, metal: 0.85 });

  M.whiteboard = pbr('whiteboard', { albedo: '#f4f6f5', rough: 0.15 });
  M.blackTrim = pbr('blackTrim', { albedo: '#22252a', rough: 0.6 });
  M.doorBlue = pbr('doorBlue', { albedo: '#33517e', tex: woodTex, rough: 0.6 });
  M.chairSeat = pbr('chairSeat', { albedo: '#37598f', rough: 0.8 });
  M.deskTop = M.wood;
  M.screen = pbr('screenMat', { albedo: '#0c1016', rough: 0.2, emissive: '#1a2f4a' });
  M.paper = pbr('paper', { albedo: '#f2efe6', rough: 0.9 });
  M.fence = pbr('fence', { albedo: '#3d5a3a', rough: 0.8 });
  M.hedge = pbr('hedge', { albedo: '#2f5a2b', rough: 1.0 });

  return M;
};
