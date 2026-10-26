// Assembles Skyville.
import * as THREE from 'three';
import { roadMaterials, buildRoads } from './roads.js';
import { buildHighway } from './highway.js';
import { buildBlocks } from './blocks.js';
import { buildProps, updateSignals } from './props.js';
import { buildRoadGraph, SHOPS } from './layout.js';

export async function buildCity(scene, physics, progress = () => {}) {
  const root = new THREE.Group();
  root.name = 'skyville';
  scene.add(root);
  const tick = () => new Promise((r) => setTimeout(r, 0));

  progress(0.05, 'Pouring the streets…');
  await tick();
  const mats = roadMaterials();
  const roads = buildRoads(root, physics, mats);
  // Ground collider (the grass and streets sit at y≈0).
  physics.box(0, -0.5, 0, 2500, 0.5, 2500, { friction: 1.0 });

  progress(0.25, 'Raising I-671…');
  await tick();
  const highway = buildHighway(root, physics, mats);

  progress(0.45, 'Building the blocks…');
  await tick();
  const blocks = buildBlocks(root, physics, roads.blocks, mats);

  progress(0.65, 'Planting trees and street lights…');
  await tick();
  const props = buildProps(root, physics, { blocks: roads.blocks, treeSpots: blocks.treeSpots, benchSpots: blocks.benchSpots, solids: blocks.solids });

  progress(0.8, 'Mapping the roads…');
  await tick();
  const graph = buildRoadGraph();

  return {
    root, mats, graph, shops: SHOPS, blocks: roads.blocks, solids: blocks.solids,
    parkingSpots: blocks.parkingSpots, signals: props.signals, signalized: props.signalized,
    lampMats: [props.lampMat, highway.lampMat], water: blocks.water,
    update(t) { updateSignals(props.signals, t); },
  };
}
