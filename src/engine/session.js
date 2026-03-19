const { createSceneManager } = require('./scene-manager');
const { processCommand } = require('./command-processor');
const { generateWorld } = require('./world-generator');
const { bold, dim, clear, renderInventory } = require('../interfaces/render');

const STATES = { LOADING: 'loading', PLAYING: 'playing', COMPLETE: 'complete', LOST: 'lost' };
const HELP_TEXT = 'Commands: look | go [direction] | take [item] | talk to [character] | use [item]';

function createSession({ id, onOutput, onComplete, onLost, graveyardStore, memorialGenerator,
  tileLibrary, tileCompositor, tileGenerator, latentsProcessor, zoneGenerator, descriptionGenerator, world: injectedWorld }) {

  const world = injectedWorld || generateWorld(zoneGenerator);
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
  }

  async function renderScene(scene) {
    const genreNames = world.genres.map(g => g.name);
    const tilePaths = scene.tiles.map(type => tileLibrary.findTile({ genres: genreNames, sceneType: type }));
    const tileContents = tilePaths.map(p => tileLibrary.loadTile(p));
    const art = tileCompositor.compositeTiles(tileContents);

    onOutput(clear());
    onOutput(art + '\n\n');
    onOutput(bold(world.name) + '\n\n');
    onOutput(scene.description + '\n\n');
    const inv = renderInventory(inventory);
    if (inv) onOutput(inv + '\n');
    onOutput(dim(HELP_TEXT) + '\n');
    onOutput('> ');

    tileGenerator.maybeGenerateTile({ genres: genreNames, sceneType: scene.tiles[0] }).catch(() => {});
  }

  async function fillDescriptions(zone) {
    await Promise.all(zone.rooms.map(async room => {
      if (!room.description) {
        const desc = await descriptionGenerator.generateDescription(room, world);
        room.description = desc;
        room.commands.look = desc;
      }
    }));
    zone.status = 'ready';
  }

  async function generateNextZone(zoneId) {
    const roomCount = 5 + Math.floor(Math.random() * 3);
    const zone = zoneGenerator.generateZone(zoneId, world, roomCount);
    world.zones[zoneId] = zone;
    await fillDescriptions(zone);
    return zone;
  }

  function startBackgroundZoneGeneration(zoneId) {
    world.pendingZone = generateNextZone(zoneId).catch(() => {});
  }

  async function start() {
    onOutput(clear());
    onOutput('A world is being assembled for you.\nDo not disconnect until the story ends.\n\n');
    await fillDescriptions(world.zones.act1);
    currentScene = sceneManager.loadScene(world.zones.act1.startRoomId);
    world.visitedRoomIds.add(currentScene.id);
    state = STATES.PLAYING;
    await renderScene(currentScene);
  }

  async function command(input) {
    if (state !== STATES.PLAYING) return;
    const trimmed = input.trim();
    if (!trimmed) { onOutput('> '); return; }

    const normalized = trimmed.toLowerCase();
    commandHistory = [...commandHistory.slice(-19), trimmed];

    const result = processCommand(normalized, currentScene);

    if (result.pivotTaken && !world.pivotTaken) {
      sceneManager.setPivotTaken(true);
      const act2ZoneId = sceneManager.resolveFork();
      startBackgroundZoneGeneration(act2ZoneId);
    }

    if (result.type === 'response') {
      onOutput('\n' + result.text + '\n\n> ');
      return;
    }

    if (result.type === 'exit') {
      const raw = sceneManager.resolveExit(currentScene, result.direction);

      if (raw && raw.startsWith('__gate_')) {
        let nextRoomId = sceneManager.resolveGate(currentScene, result.direction, world);
        if (nextRoomId === null) { onOutput('\nYou cannot go that way.\n\n> '); return; }
        if (nextRoomId === '__stall__') {
          onOutput('\nThe passage holds for a moment...\n');
          for (let i = 0; i < 3 && nextRoomId === '__stall__'; i++) {
            await new Promise(r => setTimeout(r, 1000));
            if (world.pendingZone) await world.pendingZone;
            nextRoomId = sceneManager.resolveGate(currentScene, result.direction, world);
          }
          if (nextRoomId === '__stall__') {
            // Fallback: force open
            const gateTarget = currentScene.gateTarget;
            nextRoomId = world.zones[gateTarget]?.startRoomId || null;
          }
        }
        if (!nextRoomId) { onOutput('\nYou cannot go that way.\n\n> '); return; }
        // Zone transition
        world.discoveredLatents = 0;
        currentScene = sceneManager.loadScene(nextRoomId);
        world.visitedRoomIds.add(currentScene.id);
        latentConversation = [];
        // Wire up gateTarget on the new zone's gate room, then start background generation
        const newZoneId = currentScene.id.split('-r')[0];
        const newZone = world.zones[newZoneId];
        const nextZoneForward = { act2a: 'act3', act2b: 'act3' }[newZoneId];
        if (nextZoneForward && newZone) {
          const newGateRoom = newZone.rooms.find(r => r.isGate);
          if (newGateRoom && !newGateRoom.gateTarget) {
            newGateRoom.gateTarget = nextZoneForward;
            world.pendingZone = null; // reset before starting next
            startBackgroundZoneGeneration(nextZoneForward);
          }
        }
        await renderScene(currentScene);
        return;
      }

      if (raw === '__complete__') { await complete(); return; }
      if (!raw) { onOutput('\nYou cannot go that way.\n\n> '); return; }

      currentScene = sceneManager.loadScene(raw);
      world.visitedRoomIds.add(currentScene.id);
      latentConversation = [];
      await renderScene(currentScene);
      return;
    }

    if (result.type === 'unknown') {
      if (latentsProcessor && currentScene.latents && currentScene.latents.length > 0) {
        const { text, effect } = await latentsProcessor.process(normalized, currentScene, latentConversation);
        if (effect) {
          applyEffect(effect);
          world.discoveredLatents++;
        }
        latentConversation = [...latentConversation.slice(-9), { command: normalized, response: text }];
        onOutput('\n' + text + '\n\n');
        if (effect && effect.type === 'exit') {
          const raw2 = sceneManager.resolveExit(currentScene, effect.direction);
          if (raw2 === '__complete__') { await complete(); return; }
          if (raw2 && !raw2.startsWith('__gate_')) {
            currentScene = sceneManager.loadScene(raw2);
            world.visitedRoomIds.add(currentScene.id);
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
      rooms: world.visitedRoomIds.size,
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
