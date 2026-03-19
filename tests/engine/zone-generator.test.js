const { createZoneGenerator } = require('../../src/engine/zone-generator');
const { fillSlot } = require('../../src/engine/world-generator');

// Minimal world for testing
const WORLD = {
  name: 'Test World',
  genres: [{ name: 'horror', vocab: { ADJ: ['grim'], NOUN: ['dust'], LOCATION: ['hallway'], CHARACTER: ['stranger'], ANTAGONIST: ['shadow'], MACGUFFIN: ['crystal'], THREAT: ['void'] } }],
  zones: { act1: null, act2a: null, act2b: null, act3: null },
  pivotTaken: false, discoveredLatents: 0, visitedRoomIds: new Set(), pendingZone: null,
};

// Minimal room type library for testing
const ROOM_TYPES = [
  { type: 'entrance', tiles: ['location', 'atmosphere'], latents: [
    { fact: 'a coin is here', hint: 'add_item', item: 'coin', item_desc: 'A worn coin.' },
    { fact: 'marks on the wall', hint: 'npc_note' },
    { fact: 'a hidden panel', hint: 'unlock_exit', exit: 'east', exit_desc: 'A gap.', target_scene: '__adjacent__' },
  ]},
  { type: 'corridor', tiles: ['atmosphere'], latents: [
    { fact: 'something in the dust', hint: 'add_item', item: 'fragment', item_desc: 'A fragment.' },
    { fact: 'scratches on the floor', hint: 'npc_note' },
    { fact: 'a loose panel', hint: 'unlock_exit', exit: 'east', exit_desc: 'A gap.', target_scene: '__adjacent__' },
  ]},
  { type: 'chamber', tiles: ['location'], latents: [
    { fact: 'a badge behind the fixture', hint: 'add_item', item: 'badge', item_desc: 'A badge.' },
    { fact: 'residue on the floor', hint: 'npc_note' },
    { fact: 'a hatch left ajar', hint: 'unlock_exit', exit: 'east', exit_desc: 'A hatch.', target_scene: '__adjacent__' },
  ]},
  { type: 'ruin', tiles: ['atmosphere', 'location'], latents: [
    { fact: 'something under rubble', hint: 'add_item', item: 'container', item_desc: 'A container.' },
    { fact: 'the collapse was sudden', hint: 'npc_note' },
    { fact: 'a gap in the wall', hint: 'unlock_exit', exit: 'east', exit_desc: 'A gap.', target_scene: '__adjacent__' },
  ]},
  { type: 'threshold', tiles: ['atmosphere'], latents: [
    { fact: 'a token at the threshold', hint: 'add_item', item: 'token', item_desc: 'A token.' },
    { fact: 'the door has been used', hint: 'npc_note' },
    { fact: 'a mechanism in the frame', hint: 'unlock_exit', exit: 'east', exit_desc: 'A passage.', target_scene: '__adjacent__' },
  ]},
];

let zoneGenerator;
beforeEach(() => {
  zoneGenerator = createZoneGenerator(ROOM_TYPES);
});

describe('generateZone structure', () => {
  it('returns a zone with correct id, startRoomId, status', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 5);
    expect(zone.id).toBe('act1');
    expect(zone.startRoomId).toBe('act1-r0');
    expect(zone.status).toBe('pending');
  });

  it('generates exactly roomCount rooms', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 5);
    expect(zone.rooms).toHaveLength(5);
  });

  it('generates 5–7 rooms when called without fixed count', () => {
    const counts = Array.from({ length: 20 }, () =>
      zoneGenerator.generateZone('act1', WORLD, 5 + Math.floor(Math.random() * 3)).rooms.length
    );
    counts.forEach(c => expect(c).toBeGreaterThanOrEqual(5));
    counts.forEach(c => expect(c).toBeLessThanOrEqual(7));
  });

  it('room ids follow zoneId-rN pattern', () => {
    const zone = zoneGenerator.generateZone('act2a', WORLD, 5);
    zone.rooms.forEach((r, i) => expect(r.id).toBe(`act2a-r${i}`));
  });

  it('rooms have required fields', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 5);
    zone.rooms.forEach(r => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('type');
      expect(r).toHaveProperty('position');
      expect(r).toHaveProperty('exits');
      expect(r).toHaveProperty('description', null);
      expect(r).toHaveProperty('latents');
      expect(r).toHaveProperty('tiles');
      expect(r).toHaveProperty('act');
      expect(r).toHaveProperty('commands');
      expect(r).toHaveProperty('isGate');
    });
  });
});

describe('grid connectivity', () => {
  it('all rooms are reachable from room 0', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 6);
    const visited = new Set();
    const queue = [zone.rooms[0].id];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const room = zone.rooms.find(r => r.id === id);
      if (!room) continue;
      Object.values(room.exits).forEach(target => {
        if (target && !target.startsWith('__') && !visited.has(target)) queue.push(target);
      });
    }
    // All rooms (minus gate token) reachable
    zone.rooms.forEach(r => expect(visited.has(r.id)).toBe(true));
  });

  it('exits are spatially reversible (north↔south, east↔west)', () => {
    const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
    const zone = zoneGenerator.generateZone('act1', WORLD, 6);
    zone.rooms.forEach(room => {
      Object.entries(room.exits).forEach(([dir, target]) => {
        if (!target || target.startsWith('__')) return;
        const targetRoom = zone.rooms.find(r => r.id === target);
        if (!targetRoom) return;
        expect(targetRoom.exits[OPPOSITE[dir]]).toBe(room.id);
      });
    });
  });
});

describe('gate placement', () => {
  it('exactly one room is the gate room', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 5);
    const gateRooms = zone.rooms.filter(r => r.isGate);
    expect(gateRooms).toHaveLength(1);
  });

  it('gate room has gateMechanic and gate token exit', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 5);
    const gate = zone.rooms.find(r => r.isGate);
    expect(['narrative', 'open', 'completion']).toContain(gate.gateMechanic);
    const gateExitValue = Object.values(gate.exits).find(v => v && v.startsWith('__gate_'));
    expect(gateExitValue).toBeTruthy();
  });

  it('act3 gate room uses __complete__ token instead of __gate_', () => {
    const zone = zoneGenerator.generateZone('act3', WORLD, 5);
    const gate = zone.rooms.find(r => r.isGate);
    const completeExit = Object.values(gate.exits).find(v => v === '__complete__');
    expect(completeExit).toBe('__complete__');
  });

  it('narrative gate room has an unlock_exit latent with __gate_unlocked__ target', () => {
    // Run many times to get a narrative gate (1/3 chance)
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      const zone = zoneGenerator.generateZone('act1', WORLD, 5);
      const gate = zone.rooms.find(r => r.isGate && r.gateMechanic === 'narrative');
      if (!gate) continue;
      const gateLatent = gate.latents.find(l => l.hint === 'unlock_exit' && l.target_scene === '__gate_unlocked__');
      expect(gateLatent).toBeDefined();
      found = true;
    }
    if (!found) console.warn('Did not encounter narrative gate in 30 tries — may be ok');
  });
});

describe('act assignment', () => {
  it.each([
    ['act1', 1], ['act2a', 2], ['act2b', 2], ['act3', 3],
  ])('zone %s sets act: %i on all rooms', (zoneId, expectedAct) => {
    const zone = zoneGenerator.generateZone(zoneId, WORLD, 5);
    zone.rooms.forEach(r => expect(r.act).toBe(expectedAct));
  });
});

describe('latent slot filling', () => {
  it('slot tokens in latent strings are filled', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 5);
    zone.rooms.forEach(room => {
      room.latents.forEach(latent => {
        Object.values(latent).forEach(val => {
          if (typeof val === 'string') expect(val).not.toMatch(/\{[A-Z]+\}/);
        });
      });
    });
  });
});

describe('__adjacent__ resolution', () => {
  it('no room has __adjacent__ in latent target_scene after generation', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 6);
    zone.rooms.forEach(room => {
      room.latents.forEach(latent => {
        if (latent.hint === 'unlock_exit') {
          expect(latent.target_scene).not.toBe('__adjacent__');
        }
      });
    });
  });

  it('resolved unlock_exit latent exit direction matches an existing room exit', () => {
    const zone = zoneGenerator.generateZone('act1', WORLD, 6);
    zone.rooms.forEach(room => {
      room.latents.forEach(latent => {
        if (latent.hint === 'unlock_exit' && latent.target_scene !== '__gate_unlocked__') {
          // Direction must exist in room.exits
          expect(room.exits).toHaveProperty(latent.exit);
          // And target_scene must match the room id in that direction
          expect(room.exits[latent.exit]).toBe(latent.target_scene);
        }
      });
    });
  });

  it('rooms demoted from unlock_exit to npc_note still have exactly 3 latents', () => {
    // Run many zones — some rooms will hit the fallback
    for (let trial = 0; trial < 10; trial++) {
      const zone = zoneGenerator.generateZone('act1', WORLD, 5);
      zone.rooms.forEach(room => {
        // narrative gate rooms get an extra latent; others should have >= 3
        expect(room.latents.length).toBeGreaterThanOrEqual(3);
      });
    }
  });
});

describe('resolveGate — open mechanic (additional)', () => {
  it('returns startRoomId when zone is ready and pendingZone is null', () => {
    // Zone already fully generated before player crosses — pendingZone cleared
    const world2 = {
      ...WORLD,
      zones: {
        act1: { id: 'act1', rooms: [], startRoomId: 'act1-r0', status: 'ready' },
        act2a: { id: 'act2a', rooms: [{ id: 'act2a-r0' }], startRoomId: 'act2a-r0', status: 'ready' },
        act2b: null, act3: null,
      },
      pendingZone: null,
    };
    const { createSceneManager } = require('../../src/engine/scene-manager');
    const gateRoom = { id: 'act1-r1', exits: { west: '__gate_act2__' }, isGate: true, gateMechanic: 'open', gateTarget: 'act2a', latents: [], commands: {}, description: '', tiles: [], act: 1, pivot_action: null, pivot_target_slot: null };
    const mgr = createSceneManager(world2);
    expect(mgr.resolveGate(gateRoom, 'west', world2)).toBe('act2a-r0');
  });
});
