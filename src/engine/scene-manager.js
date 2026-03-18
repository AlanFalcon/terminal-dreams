// src/engine/scene-manager.js
const fs = require('fs');
const path = require('path');
const { fillSlot } = require('./world-generator');

const SCENES_DIR = path.join(__dirname, '../../data/scenes');

function loadSceneTemplate(sceneId) {
  const filePath = path.join(SCENES_DIR, `${sceneId}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fillTemplate(text, world) {
  return text.replace(/\{([A-Z]+)\}/g, (_, slot) => fillSlot(slot, world.genres));
}

function fillScene(template, world) {
  const description = template.descriptions
    .slice(0, Math.min(3, template.descriptions.length))
    .map(d => fillTemplate(d, world))
    .join('\n\n');

  const commands = {};
  for (const [cmd, val] of Object.entries(template.commands)) {
    const filledCmd = fillTemplate(cmd, world);
    if (typeof val === 'string') {
      commands[filledCmd] = fillTemplate(val, world);
    } else {
      commands[filledCmd] = val;
    }
  }

  return {
    id: template.id,
    act: template.act,
    description,
    commands,
    exits: template.exits,
    tiles: template.tiles,
    is_final: template.is_final || false,
    pivot_action: template.pivot_action,
    pivot_target_slot: template.pivot_target_slot,
    pivot_taken_scene: template.pivot_taken_scene,
    pivot_skipped_scene: template.pivot_skipped_scene,
  };
}

function createSceneManager(world) {
  let pivotTaken = false;

  function loadScene(sceneId) {
    const template = loadSceneTemplate(sceneId);
    return fillScene(template, world);
  }

  function setPivotTaken(value) {
    pivotTaken = value;
  }

  function isPivotTaken() {
    return pivotTaken;
  }

  function resolveExit(scene, direction) {
    const rawExit = scene.exits[direction];
    if (!rawExit) return null;
    if (rawExit !== '__fork__') return rawExit;
    return pivotTaken ? scene.pivot_taken_scene : scene.pivot_skipped_scene;
  }

  return { loadScene, setPivotTaken, isPivotTaken, resolveExit };
}

module.exports = { createSceneManager };
