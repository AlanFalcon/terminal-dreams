// src/engine/zone-generator.js
const fs = require('fs');
const path = require('path');
const { fillSlot } = require('./world-generator');

const ROOM_TYPES_DIR = path.join(__dirname, '../../data/room-types');
const DIRECTIONS = ['north', 'south', 'east', 'west'];
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
const DELTA = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

const ACT_NUMBER = { act1: 1, act2a: 2, act2b: 2, act3: 3 };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function fillTemplate(text, world) {
  return text.replace(/\{([A-Z]+)\}/g, (_, slot) => fillSlot(slot, world.genres));
}

function fillLatents(latents, world) {
  return latents.map(latent => {
    const filled = {};
    for (const [k, v] of Object.entries(latent)) {
      filled[k] = typeof v === 'string' ? fillTemplate(v, world) : v;
    }
    return filled;
  });
}

function drunkWalk(roomCount) {
  // Returns array of { position: {x,y}, rawExits: {dir: idx} }
  const nodes = [{ position: { x: 0, y: 0 }, rawExits: {} }];
  const grid = new Map([['0,0', 0]]);

  while (nodes.length < roomCount) {
    const candidates = [];
    for (let i = 0; i < nodes.length; i++) {
      const { position: { x, y }, rawExits } = nodes[i];
      for (const dir of DIRECTIONS) {
        if (rawExits[dir] !== undefined) continue;
        const [dx, dy] = DELTA[dir];
        const key = `${x + dx},${y + dy}`;
        if (!grid.has(key)) candidates.push({ fromIdx: i, dir, nx: x + dx, ny: y + dy });
      }
    }
    if (!candidates.length) break;
    const { fromIdx, dir, nx, ny } = pick(candidates);
    const newIdx = nodes.length;
    nodes[fromIdx].rawExits[dir] = newIdx;
    nodes.push({ position: { x: nx, y: ny }, rawExits: { [OPPOSITE[dir]]: fromIdx } });
    grid.set(`${nx},${ny}`, newIdx);
  }
  return nodes;
}

function pickGateDirection(room) {
  // Pick a direction not already used as a real exit
  const usedDirs = new Set(Object.keys(room.exits));
  const open = DIRECTIONS.filter(d => !usedDirs.has(d));
  return open.length > 0 ? pick(open) : pick(DIRECTIONS.filter(d => !room.exits[d] || room.exits[d].startsWith('__')));
}

function resolveAdjacent(rooms, roomIdx, latent) {
  // Find any real exit from this room and resolve __adjacent__ to that room id
  const room = rooms[roomIdx];
  for (const [dir, target] of Object.entries(room.exits)) {
    if (!target || target.startsWith('__')) continue;
    const targetRoom = rooms.find(r => r.id === target);
    if (!targetRoom) continue;
    return { ...latent, exit: dir, target_scene: target };
  }
  // No usable adjacent room — convert to npc_note
  return { fact: latent.fact, hint: 'npc_note' };
}

function createZoneGenerator(roomTypes) {
  // If roomTypes not provided, load from disk
  if (!roomTypes) {
    roomTypes = fs.readdirSync(ROOM_TYPES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(path.join(ROOM_TYPES_DIR, f), 'utf8')));
  }

  function pickTypes(count) {
    const shuffled = [...roomTypes].sort(() => Math.random() - 0.5);
    const types = [];
    for (let i = 0; i < count; i++) types.push(shuffled[i % shuffled.length]);
    return types;
  }

  function generateZone(zoneId, world, roomCount) {
    const act = ACT_NUMBER[zoneId] || 1;
    const isTerminal = zoneId === 'act3';
    const gateToken = isTerminal ? '__complete__' : `__gate_${zoneId === 'act1' ? 'act2' : 'act3'}__`;

    // 1. Build grid
    const nodes = drunkWalk(roomCount);
    const types = pickTypes(roomCount);

    // 2. Create room objects with string IDs
    const rooms = nodes.map((node, i) => ({
      id: `${zoneId}-r${i}`,
      type: types[i].type,
      act,
      position: node.position,
      exits: {},
      description: null,
      latents: [],
      tiles: types[i].tiles,
      isGate: false,
      gateMechanic: null,
      gateTarget: null,
      pivot_action: null,
      pivot_target_slot: null,
      commands: { look: null },
    }));

    // 3. Convert index-based exits to room id exits
    nodes.forEach((node, i) => {
      for (const [dir, targetIdx] of Object.entries(node.rawExits)) {
        rooms[i].exits[dir] = rooms[targetIdx].id;
      }
    });

    // 4. Fill latents from room type templates (slot-fill, resolve __adjacent__)
    rooms.forEach((room, i) => {
      const template = types[i];
      const filled = fillLatents(template.latents, world);
      room.latents = filled.map(latent => {
        if (latent.hint === 'unlock_exit' && latent.target_scene === '__adjacent__') {
          return resolveAdjacent(rooms, i, latent);
        }
        return latent;
      });
    });

    // 5. Pick gate room (not the start room)
    const gateRoomIdx = roomCount > 1 ? (1 + Math.floor(Math.random() * (roomCount - 1))) : 0;
    const gateRoom = rooms[gateRoomIdx];
    const gateDir = pickGateDirection(gateRoom);
    const gateMechanic = pick(['narrative', 'open', 'completion']);

    gateRoom.isGate = true;
    gateRoom.exits[gateDir] = gateToken;
    gateRoom.gateMechanic = isTerminal ? null : gateMechanic;

    // 6. For narrative gates: inject an unlock_exit latent targeting __gate_unlocked__
    if (!isTerminal && gateMechanic === 'narrative') {
      gateRoom.latents.push({
        fact: `something in this ${gateRoom.type} has shifted — a tension in the air that was not here before`,
        hint: 'unlock_exit',
        exit: gateDir,
        exit_desc: 'A passage opens where there was none.',
        target_scene: '__gate_unlocked__',
      });
    }

    // 7. Mark gate room as pivot room (act1 only)
    if (zoneId === 'act1') {
      gateRoom.pivot_action = 'take';
      gateRoom.pivot_target_slot = 'MACGUFFIN';
      const macguffin = fillSlot('MACGUFFIN', world.genres);
      gateRoom.commands[`take ${macguffin}`] = `You take the ${macguffin}. The weight of it settles in your hand.`;
    }

    return { id: zoneId, rooms, startRoomId: rooms[0].id, status: 'pending' };
  }

  return { generateZone };
}

module.exports = { createZoneGenerator };
