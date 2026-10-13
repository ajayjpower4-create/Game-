/* Example mod: adds your own 3D object to the world — a spinning billboard
 * over the middle of the lot, with text drawn on a canvas. Shows how to use
 * three.js from a mod. Copy this file up one folder (into "mods") to use it. */

const S = window.BuildingSim;
const THREE = S.THREE;

const canvas = document.createElement('canvas');
canvas.width = 1024;
canvas.height = 256;
const g = canvas.getContext('2d');
g.fillStyle = '#12213a';
g.fillRect(0, 0, 1024, 256);
g.fillStyle = '#ffcf3f';
g.font = 'bold 120px system-ui, sans-serif';
g.textAlign = 'center';
g.textBaseline = 'middle';
g.fillText('MODDED!', 512, 132);
const texture = new THREE.CanvasTexture(canvas);
texture.colorSpace = THREE.SRGBColorSpace;

const face = new THREE.MeshStandardMaterial({ map: texture, emissive: new THREE.Color('#ffffff'), emissiveMap: texture, emissiveIntensity: 0.6, roughness: 0.5 });
const frame = new THREE.MeshStandardMaterial({ color: '#2b3036', metalness: 0.6, roughness: 0.4 });
const sign = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 1), [frame, frame, frame, frame, face, face]);
sign.castShadow = false;   // it turns, and the shadow map is only redrawn when something changes

const group = new THREE.Group();
group.add(sign);
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 60, 12), frame);
pole.position.y = -30;
pole.castShadow = true;
group.add(pole);
S.engine.scene.add(group);
S.engine.shadowDirty = true;   // draw the pole's shadow

S.onTick((dt) => {
  const lot = S.state.lot;
  group.position.set(lot.width / 2, 66, lot.depth / 2);
  sign.rotation.y += dt * 0.6;
});
