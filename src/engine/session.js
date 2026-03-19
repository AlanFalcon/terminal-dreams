// src/engine/session.js
const { createSceneManager } = require('./scene-manager');
const { processCommand } = require('./command-processor');
const { generateWorld } = require('./world-generator');
const { bold, dim, clear, renderInventory } = require('../interfaces/render');

const STATES = { LOADING: 'loading', PLAYING: 'playing', COMPLETE: 'complete', LOST: 'lost' };

const HELP_TEXT = 'Commands: look | go [direction] | take [item] | talk to [character] | use [item]';

function createSession({ id, onOutput, onComplete, onLost, graveyardStore, memorialGenerator, tileLibrary, tileCompositor, tileGenerator, latentsProcessor }) {
  const world = generateWorld();
  const sceneManager = createSceneManager(world);

  let state = STATES.LOADING;
  let currentScene = null;
  let commandHistory = [];
  let inventory = [];
  let latentConversation = [];

  function applyEffect(effect) {
    if (!effect) return;
    if (effect.type === 'add_item') {
      if (!inventory.some(i => i.item === effect.item)) {
        inventory = [...inventory, { item: effect.item, item_desc: effect.item_desc }];
      }
    } else if (effect.type === 'unlock_exit') {
      currentScene.exits[effect.exit] = effect.target_scene;
    }
    // npc_note and nothing: no state change
  }

  async function renderScene(scene) {
    const genreNames = world.genres.map(g => g.name);
    const tilePaths = scene.tiles.map(type => tileLibrary.findTile({ genres: genreNames, sceneType: type }));
    const tileContents = tilePaths.map(p => tileLibrary.loadTile(p));
    const art = tileCompositor.compositeTiles(tileContents);

    onOutput(clear()); // clear screen
    onOutput(art + '\n\n');
    onOutput(bold(world.name) + '\n\n');
    onOutput(scene.description + '\n\n');
    const inv = renderInventory(inventory);
    if (inv) onOutput(inv + '\n');
    onOutput(dim(HELP_TEXT) + '\n');
    onOutput('> ');

    // Background: maybe generate new tile (fire and forget)
    tileGenerator.maybeGenerateTile({ genres: genreNames, sceneType: scene.tiles[0] }).catch(() => {});
  }

  async function start() {
    onOutput(clear());
    onOutput('A world is being assembled for you.\nDo not disconnect until the story ends.\n\n');
    currentScene = sceneManager.loadScene('act1-scene1');
    state = STATES.PLAYING;
    await renderScene(currentScene);
  }

  async function command(input) {
    if (state !== STATES.PLAYING) return;
    const trimmed = input.trim();
    if (!trimmed) { onOutput('> '); return; }

    const normalized = trimmed.toLowerCase();
    commandHistory = [...commandHistory.slice(-19), trimmed]; // keep original casing in history display

    const result = processCommand(normalized, currentScene);

    if (result.pivotTaken) {
      sceneManager.setPivotTaken(true);
    }

    if (result.type === 'response') {
      onOutput('\n' + result.text + '\n\n> ');
      return;
    }

    if (result.type === 'exit') {
      const nextId = sceneManager.resolveExit(currentScene, result.direction);
      if (!nextId) { onOutput('\nYou cannot go that way.\n\n> '); return; }
      if (nextId === '__complete__') { await complete(); return; }
      currentScene = sceneManager.loadScene(nextId);
      latentConversation = [];
      await renderScene(currentScene);
      return;
    }

    if (result.type === 'unknown') {
      if (latentsProcessor && currentScene.latents && currentScene.latents.length > 0) {
        const { text, effect } = await latentsProcessor.process(normalized, currentScene, latentConversation);
        applyEffect(effect);
        latentConversation = [...latentConversation.slice(-9), { command: normalized, response: text }];
        onOutput('\n' + text + '\n\n');
        if (effect && effect.type === 'exit') {
          const nextId = sceneManager.resolveExit(currentScene, effect.direction);
          if (nextId === '__complete__') { await complete(); return; }
          if (nextId) {
            currentScene = sceneManager.loadScene(nextId);
            latentConversation = [];
            await renderScene(currentScene);
            return;
          }
        }
        onOutput('> ');
      } else {
        onOutput('\nUnknown command. ' + HELP_TEXT + '\n\n> ');
      }
      return;
    }
  }

  async function complete() {
    state = STATES.COMPLETE;
    onOutput('\n\n' + bold('The story ends.') + '\n\nCONNECTION CLOSED.\n');
    await graveyardStore.writeCompleted({
      worldName: world.name,
      genres: world.genres.map(g => g.name),
      scenes: 10,
      timestamp: new Date().toISOString(),
    });
    onComplete(id);
  }

  async function disconnect() {
    if (state !== STATES.PLAYING) return;
    state = STATES.LOST;
    const act = currentScene ? currentScene.act : 1;
    const sceneId = currentScene ? currentScene.id : 'unknown';
    const memorial = await memorialGenerator.generate({
      worldName: world.name,
      genres: world.genres.map(g => g.name),
      act, scene: sceneId,
      commands: commandHistory,
    });
    await graveyardStore.writeMemorial({
      worldName: world.name,
      genres: world.genres.map(g => g.name),
      act, scene: sceneId,
      memorial,
      timestamp: new Date().toISOString(),
    });
    onLost(id);
  }

  return {
    get state() { return state; },
    get commandHistory() { return commandHistory; },
    get inventory() { return inventory; },
    get latentConversation() { return latentConversation; },
    start, command, disconnect,
  };
}

module.exports = { createSession };
