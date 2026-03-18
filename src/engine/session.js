// src/engine/session.js
const { createSceneManager } = require('./scene-manager');
const { processCommand } = require('./command-processor');
const { generateWorld } = require('./world-generator');

const STATES = { LOADING: 'loading', PLAYING: 'playing', COMPLETE: 'complete', LOST: 'lost' };

const HELP_TEXT = 'Commands: look | go [direction] | take [item] | talk to [character] | use [item]';

function createSession({ id, onOutput, onComplete, onLost, graveyardStore, memorialGenerator, tileLibrary, tileCompositor, tileGenerator }) {
  const world = generateWorld();
  const sceneManager = createSceneManager(world);

  let state = STATES.LOADING;
  let currentScene = null;
  let commandHistory = [];

  async function renderScene(scene) {
    const genreNames = world.genres.map(g => g.name);
    const tilePaths = scene.tiles.map(type => tileLibrary.findTile({ genres: genreNames, sceneType: type }));
    const tileContents = tilePaths.map(p => tileLibrary.loadTile(p));
    const art = tileCompositor.compositeTiles(tileContents);

    onOutput('\x1b[2J\x1b[H'); // clear screen
    onOutput(art + '\n\n');
    onOutput('\x1b[1m' + world.name + '\x1b[0m\n\n');
    onOutput(scene.description + '\n\n');
    onOutput('\x1b[2m' + HELP_TEXT + '\x1b[0m\n');
    onOutput('> ');

    // Background: maybe generate new tile (fire and forget)
    tileGenerator.maybeGenerateTile({ genres: genreNames, sceneType: scene.tiles[0] }).catch(() => {});
  }

  async function start() {
    state = STATES.PLAYING;
    onOutput('\x1b[2J\x1b[H');
    onOutput('A world is being assembled for you.\nDo not disconnect until the story ends.\n\n');
    currentScene = sceneManager.loadScene('act1-scene1');
    await renderScene(currentScene);
  }

  async function command(input) {
    if (state !== STATES.PLAYING) return;
    const trimmed = input.trim();
    if (!trimmed) { onOutput('> '); return; }

    commandHistory = [...commandHistory.slice(-19), trimmed];

    const result = processCommand(trimmed.toLowerCase(), currentScene);

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
      await renderScene(currentScene);
      return;
    }

    onOutput('\nUnknown command. ' + HELP_TEXT + '\n\n> ');
  }

  async function complete() {
    state = STATES.COMPLETE;
    onOutput('\n\n\x1b[1mThe story ends.\x1b[0m\n\nCONNECTION CLOSED.\n');
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
    start, command, disconnect,
  };
}

module.exports = { createSession };
