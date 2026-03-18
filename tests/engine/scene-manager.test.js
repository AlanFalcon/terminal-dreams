// tests/engine/scene-manager.test.js
const { createSceneManager } = require('../../src/engine/scene-manager');
const { generateWorld } = require('../../src/engine/world-generator');

let manager;
let world;

beforeEach(() => {
  world = generateWorld();
  manager = createSceneManager(world);
});

describe('loadScene', () => {
  it('loads act1-scene1', () => {
    const scene = manager.loadScene('act1-scene1');
    expect(scene).toHaveProperty('id', 'act1-scene1');
    expect(scene).toHaveProperty('description');
    expect(typeof scene.description).toBe('string');
    expect(scene.description).not.toMatch(/\{[A-Z]+\}/);
  });

  it('fills slot tokens with genre vocab', () => {
    const scene = manager.loadScene('act1-scene1');
    expect(scene.description.length).toBeGreaterThan(10);
  });
});

describe('resolveExit', () => {
  it('returns next scene id for a normal exit', () => {
    const scene = manager.loadScene('act1-scene1');
    const next = manager.resolveExit(scene, 'north');
    expect(next).toBe('act1-scene2');
  });
});

describe('fork resolution', () => {
  it('returns pivot_taken_scene when pivot was taken', () => {
    manager.setPivotTaken(true);
    const scene = manager.loadScene('act1-scene3');
    const next = manager.resolveExit(scene, 'north');
    expect(next).toBe('act2a-scene4');
  });

  it('returns pivot_skipped_scene when pivot was not taken', () => {
    manager.setPivotTaken(false);
    const scene = manager.loadScene('act1-scene3');
    const next = manager.resolveExit(scene, 'north');
    expect(next).toBe('act2b-scene4');
  });
});
