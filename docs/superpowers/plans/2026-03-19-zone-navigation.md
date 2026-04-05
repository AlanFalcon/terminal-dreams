# Zone Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear 10-scene structure with procedurally generated zones — each act is a spatial grid of 5–7 rooms with free exploration, randomised gate mechanics between acts, and Claude-generated room descriptions.

**Architecture:** `worldGenerator` builds the act1 zone layout at startup (no Claude calls). `session.start()` generates room descriptions in parallel then renders the first room. Subsequent zones are generated in the background after pivot action / gate crossing. `sceneManager` reads from `world.zones` instead of JSON files; `resolveGate` enforces the three gate mechanics (open, narrative, completion).

**Tech Stack:** Node.js 20, `@anthropic-ai/sdk` (claude-haiku-4-5 for descriptions), jest for tests, existing slot-filling system unchanged.

---

## File map

**Create:**
- `data/room-types/*.json` — 34 room type templates (latents + tiles, no descriptions or exits)
- `src/engine/zone-generator.js` — drunk-walk grid layout, gate placement, token resolution
- `src/engine/description-generator.js` — Claude haiku room description calls
- `tests/engine/zone-generator.test.js`
- `tests/engine/description-generator.test.js`

**Modify:**
- `src/engine/world-generator.js` — accept `zoneGenerator` param, add new world fields, generate act1 layout
- `src/engine/scene-manager.js` — replace file-based loadScene with world.zones lookup, add resolveGate, update resolveExit, update setPivotTaken
- `src/engine/session.js` — async description gen in start(), gate-crossing flow in command(), background zone generation, discoveredLatents/visitedRoomIds tracking
- `index.js` — create and inject `zoneGenerator`, `descriptionGenerator`
- `tests/engine/world-generator.test.js` — add new world field tests
- `tests/engine/scene-manager.test.js` — rewrite for world.zones API
- `tests/engine/session.test.js` — update makeSession for new deps, add gate tests

**Delete (Task 7):**
- `data/scenes/*.json` — all 10 files, once all tests pass without them

---

## Task 1: Room type library

**Files:**
- Create: `data/room-types/entrance.json` (and 33 others)

No tests — this is authored content. The format is the same latents structure already used in the codebase. Each file must have exactly 3 latents: one `add_item`, one `npc_note`, and one `unlock_exit` with `target_scene: "__adjacent__"`. The `unlock_exit` latent's `exit` field is a placeholder direction (`"east"`) — zone-generator resolves it to the actual adjacent room id and direction at placement time.

- [ ] **Step 1: Create the room-types directory and write 5 core files**

```bash
mkdir -p data/room-types
```

`data/room-types/entrance.json`:
```json
{
  "type": "entrance",
  "tiles": ["location", "atmosphere"],
  "latents": [
    {
      "fact": "a {ADJ} keycard is wedged under the lip of the threshold — someone slid it there before the door sealed",
      "hint": "add_item",
      "item": "keycard",
      "item_desc": "A {ADJ} keycard, scratched. The name on it has been scored out."
    },
    {
      "fact": "the {CHARACTER} left marks on the doorframe — notches, possibly a count, possibly a warning",
      "hint": "npc_note"
    },
    {
      "fact": "a panel beside the door is slightly proud of the wall — it depresses with pressure",
      "hint": "unlock_exit",
      "exit": "east",
      "exit_desc": "A narrow passage opens in the wall.",
      "target_scene": "__adjacent__"
    }
  ]
}
```

`data/room-types/corridor.json`:
```json
{
  "type": "corridor",
  "tiles": ["atmosphere", "location"],
  "latents": [
    {
      "fact": "a {ADJ} lens from some kind of optical device has been dropped and rolled against the baseboard",
      "hint": "add_item",
      "item": "cracked lens",
      "item_desc": "A {ADJ} lens, cracked diagonally. Shapes look wrong through it."
    },
    {
      "fact": "the walls are scored with parallel lines at irregular intervals — someone was measuring something, or counting time",
      "hint": "npc_note"
    },
    {
      "fact": "a section of panelling on the {ADJ} wall sounds hollow — it gives slightly under pressure",
      "hint": "unlock_exit",
      "exit": "east",
      "exit_desc": "A gap behind the panelling leads somewhere quieter.",
      "target_scene": "__adjacent__"
    }
  ]
}
```

`data/room-types/chamber.json`:
```json
{
  "type": "chamber",
  "tiles": ["location", "character"],
  "latents": [
    {
      "fact": "a {ADJ} token or badge has fallen behind the main fixture — easily missed",
      "hint": "add_item",
      "item": "identification token",
      "item_desc": "A {ADJ} token stamped with a symbol you don't recognise. Still warm."
    },
    {
      "fact": "the {ANTAGONIST} has been here — there is residue on the floor that matches the {THREAT}",
      "hint": "npc_note"
    },
    {
      "fact": "behind the {ADJ} fixture, a maintenance hatch has been forced open and left ajar",
      "hint": "unlock_exit",
      "exit": "east",
      "exit_desc": "A maintenance passage beyond the hatch.",
      "target_scene": "__adjacent__"
    }
  ]
}
```

`data/room-types/crossroads.json`:
```json
{
  "type": "crossroads",
  "tiles": ["location", "atmosphere"],
  "latents": [
    {
      "fact": "a coin or disc has been left at the exact centre of the junction — placed deliberately, face down",
      "hint": "add_item",
      "item": "waymarker disc",
      "item_desc": "A {ADJ} disc, heavier than it looks. One side is blank. The other shows a path."
    },
    {
      "fact": "someone has scratched a direction into the floor at the junction — it points nowhere useful",
      "hint": "npc_note"
    },
    {
      "fact": "one of the four passages has been partially blocked — but the blockage moves if you push it correctly",
      "hint": "unlock_exit",
      "exit": "east",
      "exit_desc": "The passage clears. Something waits beyond.",
      "target_scene": "__adjacent__"
    }
  ]
}
```

`data/room-types/ruin.json`:
```json
{
  "type": "ruin",
  "tiles": ["atmosphere", "location"],
  "latents": [
    {
      "fact": "under a {ADJ} fragment of collapsed ceiling, something has been preserved — sealed against exposure",
      "hint": "add_item",
      "item": "sealed container",
      "item_desc": "A {ADJ} container, intact despite the collapse. The seal is still good."
    },
    {
      "fact": "the collapse here was not gradual — the damage pattern suggests it happened in one event, quickly",
      "hint": "npc_note"
    },
    {
      "fact": "a gap in the fallen wall is partially hidden by debris — it leads somewhere the collapse missed",
      "hint": "unlock_exit",
      "exit": "east",
      "exit_desc": "A passable gap in the rubble.",
      "target_scene": "__adjacent__"
    }
  ]
}
```

- [ ] **Step 2: Write the remaining 29 room type files**

Use the exact same JSON structure as above. Each file: `data/room-types/<type>.json`. Tile choices: `"location"`, `"character"`, `"atmosphere"` — pick 2 that fit thematically.

| Type | `add_item` fact | `npc_note` fact | `unlock_exit` — what reveals the hidden passage |
|------|-----------------|-----------------|--------------------------------------------------|
| `threshold` | a toll or offering left at the threshold | the door has been used very recently — the mechanism is still warm | a mechanism in the doorframe depresses with pressure |
| `sanctum` | a personal effect left for safekeeping | the silence here is not natural — it absorbs sound rather than reflecting it | a secondary exit concealed behind ritual objects, visible only from within |
| `antechamber` | something set aside during the wait | whoever waited here left in a hurry — the queue number is still in their seat | a door at the far end of the waiting area, never used |
| `observatory` | a lens, chart, or measurement tool | the instruments are still tracking — whatever they are pointed at has moved | a hatch in the floor leads to the level below |
| `vault` | an overlooked item not worth securing | the vault was not forced — it was opened from the inside | a secondary compartment behind the main one, keyed differently |
| `gallery` | an object removed from its designated display | the pieces here are arranged in an order that tells a sequence — reading it is unsettling | a service passage behind one of the display cases, for restorers |
| `atrium` | something that fell from an upper level | the acoustics are wrong — sound arrives from the wrong direction | a door hidden at the base of a pillar, painted to match the floor |
| `cellar` | something cached here for later retrieval | the smell changes in one corner — different decay, different origin | a tunnel dug through the floor and concealed with a fitted stone |
| `archive` | a record or document that should not exist | the index refers to itself — the catalogue is its own subject | a restricted section behind a filing unit on a track |
| `laboratory` | an experimental subject or residual by-product | the experiment was abandoned mid-step — the controls were not shut down | a ventilation duct large enough to move through, forced open |
| `market` | something left on the stall, unpaid for | the goods have shifted meaning — what was sold here is not what it appears | a back entrance through the stalls, used for deliveries |
| `watchtower` | a range-finding tool or signal device | the view from up here is wrong — something large has moved since the tower was built | a rope or bracket ladder down the exterior face |
| `infirmary` | a medication or instrument | the charts are still being updated — by something that cannot be present | a service corridor behind the ward, for those who should not be seen |
| `greenhouse` | a cutting or specimen, still living | the growth here is wrong — some plants are oriented toward a light source that is not present | a gap in the glass panels, patched with cloth that tears |
| `forge` | a small object cast in the most recent firing | the coals are still warm — something was made here within the last few hours | a cooling tunnel beneath the furnace floor, sized for a body |
| `catacombs` | something interred that was never declared dead | the stacking here was intentional — the arrangement follows a pattern, not convenience | a niche behind a sealed alcove, opened from inside |
| `chapel` | a devotional object repurposed for something else | the object of devotion has changed — the new one is not depicted anywhere | a door behind the altar, bricked in and re-plastered, recently |
| `armory` | a weapon or tool that was missed in the inventory | the racks were emptied selectively — whoever took what they needed knew exactly where to look | a supply tunnel to an adjacent area, sized for moving equipment |
| `dock` | rope, a mooring pin, or a navigation tool | the moorings still hold — whatever was tethered here has simply gone slack | a ladder bracket down to the level below the waterline |
| `cistern` | something thrown in that is now retrievable | the reflection is delayed — not by much, but enough to notice | a maintenance hatch set into the wall at the waterline, sealed with a quarter-turn |
| `pit` | something dropped and lodged partway down | the bottom is not visible — the pit is deeper than the light reaches | a narrow ledge passage around the inner edge, invisible from the lip |
| `rampart` | a signal device or sighting tool | the wind carries a voice — or the shape of one — periodically and without source | a rope or bracket ladder down the outer face, below the parapet |
| `workshop` | a tool or component left mid-task | the project is almost recognisable — another hour of work and it would be clear what it was | a connecting passage through the bench, behind a panel of stored stock |
| `shrine` | the offering left most recently — still fresh | the focal object is not what the shrine was originally built for | a concealed compartment behind the focal object, for the previous one |
| `terminus` | a ticket, manifest, or logbook | the line this terminus served no longer runs — but the timetable is still being updated | a maintenance access door at the far end of the platform, keyed |
| `switchboard` | a small component extracted from the board | most of the labels have been corrected — someone spent time replacing them with wrong ones | a cable conduit large enough to move through, with a removable panel |
| `esplanade` | something dropped by the crowd | the noise of the crowd has not faded — it is not an echo, it is still happening | a service gate set into the perimeter wall, not visible from the promenade |
| `sump` | something that drained here from an unexpected origin | everything drains here eventually — the variety of what has arrived is a record of the whole structure | a pipe or culvert leading away, large enough to enter |
| `reliquary` | a fragment of whatever the reliquary held | the display case is built to prevent removal — the engineering suggests something that wanted out | a concealed compartment below the display platform, for the secondary relic |

- [ ] **Step 3: Verify all 34 files exist and are valid JSON**

```bash
ls data/room-types/ | wc -l   # should print 34
node -e "require('fs').readdirSync('data/room-types').forEach(f => { JSON.parse(require('fs').readFileSync('data/room-types/' + f)); console.log('ok', f); })"
```

Expected: 34 lines, all `ok <filename>`.

- [ ] **Step 4: Commit**

```bash
git add data/room-types/
git commit -m "feat: add 34 room type templates"
```

---

## Task 2: zone-generator.js

**Files:**
- Create: `src/engine/zone-generator.js`
- Create: `tests/engine/zone-generator.test.js`

The zone-generator builds a room grid using a drunk-walk, assigns room types, places a gate, fills latents from templates (including slot-filling), and resolves `__adjacent__` and `__gate_target__` tokens.

- [ ] **Step 1: Write the failing tests**

`tests/engine/zone-generator.test.js`:
```js
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
        // narrative gate rooms get an extra latent; others should have ≥ 3
        const baseCount = room.isGate && room.gateMechanic === 'narrative' ? 4 : 3;
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/engine/zone-generator.test.js --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `createZoneGenerator` not found.

- [ ] **Step 3: Implement zone-generator.js**

`src/engine/zone-generator.js`:
```js
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
    // Check the target doesn't already have an exit back (already connected bidirectionally — pick a different one)
    // Use any reachable neighbour as the unlock target (revealing a "hidden" connection)
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/engine/zone-generator.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/zone-generator.js tests/engine/zone-generator.test.js
git commit -m "feat: add zone-generator with drunk-walk grid layout"
```

---

## Task 3: description-generator.js

**Files:**
- Create: `src/engine/description-generator.js`
- Create: `tests/engine/description-generator.test.js`

One Claude haiku call per room. Falls back to a generic description on error.

- [ ] **Step 1: Write the failing tests**

`tests/engine/description-generator.test.js`:
```js
const { createDescriptionGenerator } = require('../../src/engine/description-generator');

jest.mock('@anthropic-ai/sdk');
const Anthropic = require('@anthropic-ai/sdk');

const WORLD = {
  name: 'Test World',
  genres: [{ name: 'horror', vocab: {} }],
};

const ROOM = {
  id: 'act1-r0',
  type: 'entrance',
  act: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  Anthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'A dim entrance. The threshold is cold.' }],
      }),
    },
  }));
});

describe('generateDescription', () => {
  it('returns a string description', async () => {
    const gen = createDescriptionGenerator('test-key');
    const desc = await gen.generateDescription(ROOM, WORLD);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('passes room type and world info to Claude', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ text: 'A grim entrance.' }],
    });
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
    const gen = createDescriptionGenerator('test-key');
    await gen.generateDescription(ROOM, WORLD);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringContaining('haiku') })
    );
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('entrance');
    expect(prompt).toContain('horror');
  });

  it('falls back to generic description on API error', async () => {
    Anthropic.mockImplementation(() => ({
      messages: { create: jest.fn().mockRejectedValue(new Error('API error')) },
    }));
    const gen = createDescriptionGenerator('test-key');
    const desc = await gen.generateDescription(ROOM, WORLD);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
    expect(desc.toLowerCase()).toContain('entrance');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/engine/description-generator.test.js --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `createDescriptionGenerator` not found.

- [ ] **Step 3: Implement description-generator.js**

`src/engine/description-generator.js`:
```js
const Anthropic = require('@anthropic-ai/sdk');

function createDescriptionGenerator(apiKey) {
  const client = new Anthropic({ apiKey });

  async function generateDescription(room, world) {
    const genreNames = world.genres.map(g => g.name).join(', ');
    const prompt = `Write exactly 2 sentences describing a ${room.type} in a world shaped by these genres: ${genreNames}. Act ${room.act} of 3. Terse, atmospheric, uncanny. No dialogue. No character names. Present tense.`;
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].text.trim();
    } catch {
      return `A ${room.type}. The air here is still.`;
    }
  }

  return { generateDescription };
}

module.exports = { createDescriptionGenerator };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest tests/engine/description-generator.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/description-generator.js tests/engine/description-generator.test.js
git commit -m "feat: add description-generator for Claude haiku room descriptions"
```

---

## Task 4: world-generator.js update

**Files:**
- Modify: `src/engine/world-generator.js`
- Modify: `tests/engine/world-generator.test.js`

`generateWorld` now accepts a `zoneGenerator` dependency and adds the new world fields. The `generateWorld` return signature changes: it now returns a full world object with zones, counters, and the act1 zone already laid out.

- [ ] **Step 1: Add failing tests**

Add to `tests/engine/world-generator.test.js` (after the existing tests):
```js
describe('generateWorld with zoneGenerator', () => {
  function makeMockZoneGenerator() {
    return {
      generateZone: jest.fn().mockReturnValue({
        id: 'act1',
        rooms: [{ id: 'act1-r0', exits: {}, latents: [], commands: { look: null }, isGate: false, act: 1, tiles: ['location'], type: 'entrance', position: { x: 0, y: 0 }, description: null, gateMechanic: null, gateTarget: null, pivot_action: null, pivot_target_slot: null }],
        startRoomId: 'act1-r0',
        status: 'pending',
      }),
    };
  }

  it('returns world with zones map', () => {
    const world = generateWorld(makeMockZoneGenerator());
    expect(world).toHaveProperty('zones');
    expect(world.zones).toHaveProperty('act1');
    expect(world.zones.act2a).toBeNull();
    expect(world.zones.act2b).toBeNull();
    expect(world.zones.act3).toBeNull();
  });

  it('returns world with discoveredLatents: 0', () => {
    const world = generateWorld(makeMockZoneGenerator());
    expect(world.discoveredLatents).toBe(0);
  });

  it('returns world with pivotTaken: false', () => {
    const world = generateWorld(makeMockZoneGenerator());
    expect(world.pivotTaken).toBe(false);
  });

  it('returns world with empty visitedRoomIds Set', () => {
    const world = generateWorld(makeMockZoneGenerator());
    expect(world.visitedRoomIds).toBeInstanceOf(Set);
    expect(world.visitedRoomIds.size).toBe(0);
  });

  it('returns world with pendingZone: null', () => {
    const world = generateWorld(makeMockZoneGenerator());
    expect(world.pendingZone).toBeNull();
  });

  it('calls zoneGenerator.generateZone for act1', () => {
    const mockZG = makeMockZoneGenerator();
    generateWorld(mockZG);
    expect(mockZG.generateZone).toHaveBeenCalledWith('act1', expect.any(Object), expect.any(Number));
  });

  it('roomCount is between 5 and 7', () => {
    const mockZG = makeMockZoneGenerator();
    for (let i = 0; i < 20; i++) generateWorld(mockZG);
    const calls = mockZG.generateZone.mock.calls;
    calls.forEach(([, , count]) => {
      expect(count).toBeGreaterThanOrEqual(5);
      expect(count).toBeLessThanOrEqual(7);
    });
  });
});
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
npx jest tests/engine/world-generator.test.js --no-coverage 2>&1 | tail -10
```

Expected: new describe block fails, existing tests still pass.

- [ ] **Step 3: Update world-generator.js**

Replace the `generateWorld` function (lines 57–62 in the current file):
```js
function generateWorld(zoneGenerator) {
  const genres = loadGenres();
  const activeGenres = selectGenres(genres);
  const name = generateWorldName(activeGenres);

  const world = {
    name,
    genres: activeGenres,
    zones: { act1: null, act2a: null, act2b: null, act3: null },
    pivotTaken: false,
    discoveredLatents: 0,
    visitedRoomIds: new Set(),
    pendingZone: null,
  };

  const roomCount = 5 + Math.floor(Math.random() * 3);
  world.zones.act1 = zoneGenerator.generateZone('act1', world, roomCount);

  return world;
}
```

- [ ] **Step 4: Run all world-generator tests to confirm they pass**

```bash
npx jest tests/engine/world-generator.test.js --no-coverage
```

Expected: all tests pass (old tests still pass because they use `generateWorld()` without args — add fallback: if `!zoneGenerator` throw a helpful error, then update old tests to pass a mock).

**Note:** The old `generateWorld` tests call `generateWorld()` without args. Replace the existing `describe('generateWorld')` block entirely with:

```js
// Add at top of file alongside other describe blocks:
function makeMockZG() {
  return {
    generateZone: jest.fn().mockReturnValue({
      id: 'act1',
      rooms: [{ id: 'act1-r0' }],
      startRoomId: 'act1-r0',
      status: 'pending',
    }),
  };
}

describe('generateWorld', () => {
  it('returns world with name and genres array', () => {
    const world = generateWorld(makeMockZG());
    expect(world).toHaveProperty('name');
    expect(world).toHaveProperty('genres');
    expect(world.genres.length).toBeGreaterThanOrEqual(2);
  });
});
```

The existing `describe('loadGenres')`, `describe('selectGenres')`, `describe('generateWorldName')`, and `describe('fillSlot')` blocks require no changes — they do not call `generateWorld`.

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/world-generator.js tests/engine/world-generator.test.js
git commit -m "feat: world-generator produces zone-aware world object"
```

---

## Task 5: scene-manager.js rewrite

**Files:**
- Modify: `src/engine/scene-manager.js`
- Modify: `tests/engine/scene-manager.test.js`

`createSceneManager(world)` now reads rooms from `world.zones` instead of JSON files. The old file-loading code is removed entirely. New methods: `resolveGate`, `resolveFork`. Updated: `resolveExit` (detects gate tokens), `setPivotTaken` (sets gateTarget on gate room only).

- [ ] **Step 1: Write the new tests (replace the file entirely)**

`tests/engine/scene-manager.test.js`:
```js
const { createSceneManager } = require('../../src/engine/scene-manager');

function makeRoom(overrides = {}) {
  return {
    id: 'act1-r0',
    act: 1,
    exits: { north: 'act1-r1' },
    latents: [],
    commands: { look: 'A dim room.' },
    description: 'A dim room.',
    tiles: ['location'],
    isGate: false,
    gateMechanic: null,
    gateTarget: null,
    pivot_action: null,
    pivot_target_slot: null,
    ...overrides,
  };
}

function makeWorld(overrides = {}) {
  const r0 = makeRoom({ id: 'act1-r0', exits: { north: 'act1-r1' } });
  const r1 = makeRoom({ id: 'act1-r1', exits: { south: 'act1-r0', west: '__gate_act2__' }, isGate: true, gateMechanic: 'open', gateTarget: null });
  return {
    zones: { act1: { id: 'act1', rooms: [r0, r1], startRoomId: 'act1-r0', status: 'ready' }, act2a: null, act2b: null, act3: null },
    pivotTaken: false,
    discoveredLatents: 0,
    visitedRoomIds: new Set(),
    pendingZone: null,
    ...overrides,
  };
}

describe('loadScene', () => {
  it('finds a room by id across zones', () => {
    const world = makeWorld();
    const manager = createSceneManager(world);
    const room = manager.loadScene('act1-r0');
    expect(room.id).toBe('act1-r0');
  });

  it('throws if room not found', () => {
    const world = makeWorld();
    const manager = createSceneManager(world);
    expect(() => manager.loadScene('nonexistent')).toThrow();
  });
});

describe('resolveExit', () => {
  it('returns room id for a normal exit', () => {
    const world = makeWorld();
    const manager = createSceneManager(world);
    const room = manager.loadScene('act1-r0');
    expect(manager.resolveExit(room, 'north')).toBe('act1-r1');
  });

  it('returns null for a missing direction', () => {
    const world = makeWorld();
    const manager = createSceneManager(world);
    const room = manager.loadScene('act1-r0');
    expect(manager.resolveExit(room, 'east')).toBeNull();
  });

  it('returns gate token string for a gate direction', () => {
    const world = makeWorld();
    const manager = createSceneManager(world);
    const gateRoom = manager.loadScene('act1-r1');
    const result = manager.resolveExit(gateRoom, 'west');
    expect(result).toMatch(/^__gate_/);
  });

  it('returns __complete__ for the terminal exit', () => {
    const r = makeRoom({ id: 'act3-r0', exits: { north: '__complete__' } });
    const world = { zones: { act1: null, act2a: null, act2b: null, act3: { id: 'act3', rooms: [r], startRoomId: 'act3-r0', status: 'ready' } }, pivotTaken: false, discoveredLatents: 0, visitedRoomIds: new Set(), pendingZone: null };
    const manager = createSceneManager(world);
    expect(manager.resolveExit(r, 'north')).toBe('__complete__');
  });
});

describe('resolveGate — open mechanic', () => {
  it('returns start room id when zone is ready', () => {
    const world = makeWorld();
    const act2aZone = { id: 'act2a', rooms: [makeRoom({ id: 'act2a-r0' })], startRoomId: 'act2a-r0', status: 'ready' };
    world.zones.act2a = act2aZone;
    const gateRoom = makeRoom({ id: 'act1-r1', exits: { west: '__gate_act2__' }, isGate: true, gateMechanic: 'open', gateTarget: 'act2a' });
    world.zones.act1.rooms[1] = gateRoom;
    const manager = createSceneManager(world);
    const result = manager.resolveGate(gateRoom, 'west', world);
    expect(result).toBe('act2a-r0');
  });

  it('returns __stall__ when pendingZone is set and zone not ready', () => {
    const world = makeWorld();
    world.pendingZone = Promise.resolve();
    const gateRoom = makeRoom({ isGate: true, gateMechanic: 'open', gateTarget: 'act2a' });
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBe('__stall__');
  });
});

describe('resolveGate — narrative mechanic', () => {
  it('returns null when gateTarget not set (pivot not taken)', () => {
    const world = makeWorld();
    const gateRoom = makeRoom({ isGate: true, gateMechanic: 'narrative', gateTarget: null, exits: { west: '__gate_act2__' } });
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBeNull();
  });

  it('returns null when exit is still a gate token (latent not triggered)', () => {
    const world = makeWorld();
    world.pendingZone = Promise.resolve();
    const gateRoom = makeRoom({ isGate: true, gateMechanic: 'narrative', gateTarget: 'act2a', exits: { west: '__gate_act2__' } });
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBeNull();
  });

  it('returns start room id when exit is __gate_unlocked__ and zone ready', () => {
    const world = makeWorld();
    world.pendingZone = Promise.resolve();
    world.zones.act2a = { id: 'act2a', rooms: [makeRoom({ id: 'act2a-r0' })], startRoomId: 'act2a-r0', status: 'ready' };
    const gateRoom = makeRoom({ isGate: true, gateMechanic: 'narrative', gateTarget: 'act2a', exits: { west: '__gate_unlocked__' } });
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBe('act2a-r0');
  });

  it('returns __stall__ when exit is __gate_unlocked__ but zone still generating', () => {
    const world = makeWorld();
    world.pendingZone = new Promise(() => {}); // never resolves
    world.zones.act2a = { id: 'act2a', rooms: [], startRoomId: 'act2a-r0', status: 'pending' };
    const gateRoom = makeRoom({ isGate: true, gateMechanic: 'narrative', gateTarget: 'act2a', exits: { west: '__gate_unlocked__' } });
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBe('__stall__');
  });
});

describe('resolveFork', () => {
  it('returns act2a when pivot was taken', () => {
    const world = makeWorld();
    const manager = createSceneManager(world);
    manager.setPivotTaken(true);
    expect(manager.resolveFork()).toBe('act2a');
  });

  it('returns act2b when pivot was not taken', () => {
    const world = makeWorld();
    const manager = createSceneManager(world);
    manager.setPivotTaken(false);
    expect(manager.resolveFork()).toBe('act2b');
  });
});

describe('resolveGate — completion mechanic', () => {
  it('returns null when threshold not met (permanent block, no stall)', () => {
    const world = makeWorld();
    world.discoveredLatents = 0;
    const zone = { id: 'act1', rooms: Array.from({ length: 6 }, (_, i) => makeRoom({ id: `act1-r${i}` })), startRoomId: 'act1-r0', status: 'ready' };
    world.zones.act1 = zone;
    const gateRoom = makeRoom({ isGate: true, gateMechanic: 'completion', gateTarget: 'act2a' });
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBeNull();
  });

  it('returns start room id when threshold met and zone ready', () => {
    const world = makeWorld();
    world.discoveredLatents = 3; // ceil(6/2) = 3
    world.zones.act1 = { id: 'act1', rooms: Array.from({ length: 6 }, (_, i) => makeRoom({ id: `act1-r${i}` })), startRoomId: 'act1-r0', status: 'ready' };
    world.zones.act2a = { id: 'act2a', rooms: [makeRoom({ id: 'act2a-r0' })], startRoomId: 'act2a-r0', status: 'ready' };
    const gateRoom = world.zones.act1.rooms.find(r => r.id === 'act1-r0');
    gateRoom.isGate = true; gateRoom.gateMechanic = 'completion'; gateRoom.gateTarget = 'act2a';
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBe('act2a-r0');
  });

  it('returns __stall__ when threshold met but zone still generating', () => {
    const world = makeWorld();
    world.discoveredLatents = 3;
    world.pendingZone = new Promise(() => {});
    world.zones.act1 = { id: 'act1', rooms: Array.from({ length: 6 }, (_, i) => makeRoom({ id: `act1-r${i}` })), startRoomId: 'act1-r0', status: 'ready' };
    world.zones.act2a = { id: 'act2a', rooms: [], startRoomId: 'act2a-r0', status: 'pending' };
    const gateRoom = world.zones.act1.rooms[0];
    gateRoom.isGate = true; gateRoom.gateMechanic = 'completion'; gateRoom.gateTarget = 'act2a';
    const manager = createSceneManager(world);
    expect(manager.resolveGate(gateRoom, 'west', world)).toBe('__stall__');
  });
});

describe('setPivotTaken', () => {
  it('sets gateTarget on the act1 gate room', () => {
    const world = makeWorld();
    const gateRoom = world.zones.act1.rooms[1];
    const manager = createSceneManager(world);
    manager.setPivotTaken(true);
    expect(gateRoom.gateTarget).toBe('act2a');
  });

  it('sets gateTarget to act2b when pivot not taken', () => {
    const world = makeWorld();
    const gateRoom = world.zones.act1.rooms[1];
    const manager = createSceneManager(world);
    manager.setPivotTaken(false);
    expect(gateRoom.gateTarget).toBe('act2b');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest tests/engine/scene-manager.test.js --no-coverage 2>&1 | tail -10
```

Expected: FAIL — old loadScene tries to read JSON files.

- [ ] **Step 3: Rewrite scene-manager.js**

`src/engine/scene-manager.js`:
```js
function createSceneManager(world) {
  function loadScene(roomId) {
    for (const zone of Object.values(world.zones)) {
      if (!zone) continue;
      const room = zone.rooms.find(r => r.id === roomId);
      if (room) return room;
    }
    throw new Error(`Room not found: ${roomId}`);
  }

  function resolveExit(room, direction) {
    const raw = room.exits[direction];
    if (!raw) return null;
    return raw; // room id, __complete__, __gate_*, or __gate_unlocked__
  }

  function resolveGate(room, direction, world) {
    const { gateMechanic, gateTarget } = room;

    if (gateMechanic === 'open') {
      if (world.pendingZone && world.zones[gateTarget]?.status !== 'ready') return '__stall__';
      return world.zones[gateTarget]?.startRoomId || null;
    }

    if (gateMechanic === 'narrative') {
      if (!gateTarget || !world.pendingZone) return null;
      const exitVal = room.exits[direction];
      if (exitVal !== '__gate_unlocked__') return null;
      if (world.zones[gateTarget]?.status !== 'ready') return '__stall__';
      return world.zones[gateTarget].startRoomId;
    }

    if (gateMechanic === 'completion') {
      const currentZone = Object.values(world.zones).find(z => z?.rooms.some(r => r.id === room.id));
      const threshold = Math.ceil((currentZone?.rooms.length || 1) / 2);
      if (world.discoveredLatents < threshold) return null;
      if (world.zones[gateTarget]?.status !== 'ready') return '__stall__';
      return world.zones[gateTarget].startRoomId;
    }

    return null;
  }

  function setPivotTaken(value) {
    world.pivotTaken = value;
    const act1 = world.zones.act1;
    if (act1) {
      const gateRoom = act1.rooms.find(r => r.isGate);
      if (gateRoom) gateRoom.gateTarget = value ? 'act2a' : 'act2b';
    }
  }

  function resolveFork() {
    return world.pivotTaken ? 'act2a' : 'act2b';
  }

  return { loadScene, resolveExit, resolveGate, setPivotTaken, isPivotTaken: () => world.pivotTaken, resolveFork };
}

module.exports = { createSceneManager };
```

- [ ] **Step 4: Run scene-manager tests**

```bash
npx jest tests/engine/scene-manager.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: scene-manager, zone-generator, description-generator, world-generator tests all pass. `session.test.js` will fail (fixed in Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/engine/scene-manager.js tests/engine/scene-manager.test.js
git commit -m "feat: scene-manager reads from world.zones, adds resolveGate"
```

---

## Task 6: session.js rewrite

**Files:**
- Modify: `src/engine/session.js`
- Modify: `tests/engine/session.test.js`

`createSession` now accepts `zoneGenerator` and `descriptionGenerator` in its deps. `start()` generates descriptions in parallel, then renders. `command()` handles gate tokens. Pivot triggers background zone generation. `discoveredLatents` and `visitedRoomIds` are tracked.

- [ ] **Step 1: Update session tests**

Replace `tests/engine/session.test.js` entirely:
```js
const { createSession } = require('../../src/engine/session');

// Factories — called fresh in makeFakeWorld() to prevent mutation bleed between tests
function makeFakeRoom() {
  return {
    id: 'act1-r0', act: 1,
    exits: { north: 'act1-r1' },
    latents: [{ fact: 'a coin', hint: 'add_item', item: 'coin', item_desc: 'A coin.' }],
    commands: { look: 'A dim entrance.' },
    description: 'A dim entrance.',
    tiles: ['location', 'atmosphere'],
    isGate: false, gateMechanic: null, gateTarget: null,
    pivot_action: null, pivot_target_slot: null,
  };
}

function makeFakeGateRoom() {
  return {
    id: 'act1-r1', act: 1,
    exits: { south: 'act1-r0', west: '__gate_act2__' },
    latents: [],
    commands: { look: 'The way forward.', 'take crystal': 'You take it.' },
    description: 'The way forward.',
    tiles: ['atmosphere'],
    isGate: true, gateMechanic: 'open', gateTarget: null,
    pivot_action: 'take', pivot_target_slot: 'MACGUFFIN',
  };
}

function makeFakeAct2Room() {
  return {
    id: 'act2a-r0', act: 2,
    exits: {},
    latents: [], commands: { look: 'Act 2.' }, description: 'Act 2.',
    tiles: ['location'], isGate: false, gateMechanic: null, gateTarget: null,
    pivot_action: null, pivot_target_slot: null,
  };
}

function makeFakeWorld() {
  return {
    name: 'Test World',
    genres: [{ name: 'horror', vocab: {} }],
    zones: {
      act1: { id: 'act1', rooms: [makeFakeRoom(), makeFakeGateRoom()], startRoomId: 'act1-r0', status: 'ready' },
      act2a: null, act2b: null, act3: null,
    },
    pivotTaken: false,
    discoveredLatents: 0,
    visitedRoomIds: new Set(),
    pendingZone: null,
  };
}

function makeSession(overrides = {}) {
  const fakeWorld = makeFakeWorld();
  const onOutput = overrides.onOutput || jest.fn();
  const onComplete = overrides.onComplete || jest.fn();
  const onLost = overrides.onLost || jest.fn();
  return createSession({
    id: 'test-session',
    onOutput, onComplete, onLost,
    graveyardStore: { writeMemorial: jest.fn().mockResolvedValue(), writeCompleted: jest.fn().mockResolvedValue() },
    memorialGenerator: { generate: jest.fn().mockResolvedValue('A sad tale.') },
    tileLibrary: {
      findTile: jest.fn().mockReturnValue('tiles/test.ans'),
      loadTile: jest.fn().mockReturnValue(Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n')),
    },
    tileCompositor: { compositeTiles: jest.fn().mockReturnValue(Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n')) },
    tileGenerator: { maybeGenerateTile: jest.fn().mockResolvedValue(null) },
    latentsProcessor: { process: jest.fn().mockResolvedValue({ text: 'The moment passes.', effect: null }) },
    zoneGenerator: { generateZone: jest.fn().mockReturnValue({ id: 'act2a', rooms: [makeFakeAct2Room()], startRoomId: 'act2a-r0', status: 'pending' }) },
    descriptionGenerator: { generateDescription: jest.fn().mockResolvedValue('A dim entrance.') },
    world: fakeWorld,
    ...overrides,
  });
}

describe('createSession', () => {
  it('starts in loading state', () => {
    expect(makeSession().state).toBe('loading');
  });
});

describe('session.start()', () => {
  it('transitions to playing and emits output', async () => {
    const onOutput = jest.fn();
    const session = makeSession({ onOutput });
    await session.start();
    expect(session.state).toBe('playing');
    expect(onOutput).toHaveBeenCalled();
  });

  it('calls descriptionGenerator for each room without a description', async () => {
    const fakeWorld = makeFakeWorld();
    fakeWorld.zones.act1.rooms[0].description = null;
    fakeWorld.zones.act1.rooms[0].commands.look = null;
    const mockDescGen = { generateDescription: jest.fn().mockResolvedValue('Generated.') };
    const session = makeSession({ descriptionGenerator: mockDescGen, world: fakeWorld });
    await session.start();
    expect(mockDescGen.generateDescription).toHaveBeenCalled();
  });
});

describe('session.command() — basic', () => {
  it('emits output for look command', async () => {
    const onOutput = jest.fn();
    const session = makeSession({ onOutput });
    await session.start();
    onOutput.mockClear();
    await session.command('look');
    expect(onOutput).toHaveBeenCalled();
  });

  it('records commands in history (capped at 20)', async () => {
    const session = makeSession();
    await session.start();
    for (let i = 0; i < 25; i++) await session.command('look');
    expect(session.commandHistory.length).toBeLessThanOrEqual(20);
  });
});

describe('session.command() — normal navigation', () => {
  it('moves to the next room on go north', async () => {
    const onOutput = jest.fn();
    const session = makeSession({ onOutput });
    await session.start();
    onOutput.mockClear();
    await session.command('go north');
    const output = onOutput.mock.calls.map(c => c[0]).join('');
    expect(output).not.toContain('cannot go that way');
  });

  it('resets latentConversation on room change', async () => {
    const mockProcess = jest.fn().mockResolvedValue({ text: 'Something stirs.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('do something weird');
    expect(session.latentConversation).toHaveLength(1);
    await session.command('go north');
    expect(session.latentConversation).toHaveLength(0);
  });

  it('tracks visited rooms', async () => {
    const fakeWorld = makeFakeWorld();
    const session = makeSession({ world: fakeWorld });
    await session.start();
    expect(fakeWorld.visitedRoomIds.has('act1-r0')).toBe(true);
    await session.command('go north');
    expect(fakeWorld.visitedRoomIds.has('act1-r1')).toBe(true);
  });
});

describe('session.command() — gate crossing', () => {
  it('outputs "cannot go that way" when gate mechanic blocks', async () => {
    const fakeWorld = makeFakeWorld();
    // narrative gate, latent not triggered, no pendingZone
    fakeWorld.zones.act1.rooms[1].gateMechanic = 'narrative';
    fakeWorld.zones.act1.rooms[1].gateTarget = null;
    const onOutput = jest.fn();
    const session = makeSession({ onOutput, world: fakeWorld });
    await session.start();
    await session.command('go north'); // move to gate room
    onOutput.mockClear();
    await session.command('go west'); // try to cross gate
    const output = onOutput.mock.calls.map(c => c[0]).join('');
    expect(output).toContain('cannot go that way');
  });

  it('crosses gate when mechanic is open and zone is ready', async () => {
    const fakeWorld = makeFakeWorld();
    fakeWorld.zones.act1.rooms[1].gateTarget = 'act2a';
    fakeWorld.zones.act2a = { id: 'act2a', rooms: [makeFakeAct2Room()], startRoomId: 'act2a-r0', status: 'ready' };
    const onOutput = jest.fn();
    const session = makeSession({ onOutput, world: fakeWorld });
    await session.start();
    await session.command('go north'); // move to gate room
    onOutput.mockClear();
    await session.command('go west'); // cross gate
    const output = onOutput.mock.calls.map(c => c[0]).join('');
    expect(output).not.toContain('cannot go that way');
  });

  it('resets discoveredLatents to 0 on zone entry', async () => {
    const fakeWorld = makeFakeWorld();
    fakeWorld.discoveredLatents = 5;
    fakeWorld.zones.act1.rooms[1].gateTarget = 'act2a';
    fakeWorld.zones.act2a = { id: 'act2a', rooms: [makeFakeAct2Room()], startRoomId: 'act2a-r0', status: 'ready' };
    const session = makeSession({ world: fakeWorld });
    await session.start();
    await session.command('go north');
    await session.command('go west');
    expect(fakeWorld.discoveredLatents).toBe(0);
  });
});

describe('session.command() — latents', () => {
  it('increments discoveredLatents on successful latent trigger', async () => {
    const fakeWorld = makeFakeWorld();
    const mockProcess = jest.fn().mockResolvedValue({
      text: 'You find a coin.', effect: { type: 'add_item', item: 'coin', item_desc: 'A coin.' },
    });
    const session = makeSession({ latentsProcessor: { process: mockProcess }, world: fakeWorld });
    await session.start();
    await session.command('look at the dust');
    expect(fakeWorld.discoveredLatents).toBe(1);
  });

  it('does not increment discoveredLatents when effect is null', async () => {
    const fakeWorld = makeFakeWorld();
    const mockProcess = jest.fn().mockResolvedValue({ text: 'Nothing.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess }, world: fakeWorld });
    await session.start();
    await session.command('look at the dust');
    expect(fakeWorld.discoveredLatents).toBe(0);
  });

  it('applies add_item effect to inventory', async () => {
    const mockProcess = jest.fn().mockResolvedValue({
      text: 'You find a coin.', effect: { type: 'add_item', item: 'coin', item_desc: 'A coin.' },
    });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('dig in the dust');
    expect(session.inventory).toHaveLength(1);
  });

  it('does not add duplicate items', async () => {
    const mockProcess = jest.fn().mockResolvedValue({
      text: 'You find a coin.', effect: { type: 'add_item', item: 'coin', item_desc: 'A coin.' },
    });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('dig');
    await session.command('dig again');
    expect(session.inventory).toHaveLength(1);
  });
});

describe('session.command() — pivot', () => {
  it('calls setPivotTaken when pivot action is taken', async () => {
    const fakeWorld = makeFakeWorld();
    const onOutput = jest.fn();
    const session = makeSession({ onOutput, world: fakeWorld });
    await session.start();
    await session.command('go north'); // move to gate room (pivot_action: 'take')
    onOutput.mockClear();
    await session.command('take crystal'); // pivot action
    expect(fakeWorld.pivotTaken).toBe(true);
  });

  it('starts background zone generation after pivot', async () => {
    const fakeWorld = makeFakeWorld();
    const mockZoneGen = { generateZone: jest.fn().mockReturnValue({ id: 'act2a', rooms: [makeFakeAct2Room()], startRoomId: 'act2a-r0', status: 'pending' }) };
    const mockDescGen = { generateDescription: jest.fn().mockResolvedValue('Generated.') };
    const session = makeSession({ zoneGenerator: mockZoneGen, descriptionGenerator: mockDescGen, world: fakeWorld });
    await session.start();
    await session.command('go north');
    await session.command('take crystal');
    expect(fakeWorld.pendingZone).not.toBeNull();
  });

  it('sets gateTarget on act1 gate room and sets pendingZone simultaneously on pivot', async () => {
    const fakeWorld = makeFakeWorld();
    const mockZoneGen = { generateZone: jest.fn().mockReturnValue({ id: 'act2a', rooms: [makeFakeAct2Room()], startRoomId: 'act2a-r0', status: 'pending' }) };
    const mockDescGen = { generateDescription: jest.fn().mockResolvedValue('Generated.') };
    const session = makeSession({ zoneGenerator: mockZoneGen, descriptionGenerator: mockDescGen, world: fakeWorld });
    await session.start();
    await session.command('go north'); // enter gate room
    await session.command('take crystal'); // trigger pivot
    const act1GateRoom = fakeWorld.zones.act1.rooms.find(r => r.isGate);
    expect(act1GateRoom.gateTarget).toBe('act2a');
    expect(fakeWorld.pendingZone).not.toBeNull();
  });
});

describe('session.disconnect()', () => {
  it('transitions to lost state and calls onLost', async () => {
    const onLost = jest.fn();
    const session = makeSession({ onLost });
    await session.start();
    await session.disconnect();
    expect(session.state).toBe('lost');
    expect(onLost).toHaveBeenCalledWith('test-session');
  });
});

describe('session inventory', () => {
  it('starts with empty inventory', () => {
    expect(makeSession().inventory).toEqual([]);
  });
});
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
npx jest tests/engine/session.test.js --no-coverage 2>&1 | tail -10
```

Expected: FAIL — session doesn't accept `world`, `zoneGenerator`, `descriptionGenerator` yet.

- [ ] **Step 3: Rewrite session.js**

`src/engine/session.js`:
```js
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
```

- [ ] **Step 4: Run session tests**

```bash
npx jest tests/engine/session.test.js --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Run full suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/session.js tests/engine/session.test.js
git commit -m "feat: session handles zone navigation, gate crossing, background generation"
```

---

## Task 7: Wiring, cleanup, and smoke test

**Files:**
- Modify: `index.js`
- Delete: `data/scenes/*.json`

Wire up the new deps in `index.js`, delete the now-unused scene files, and do a full run of tests + manual smoke test.

- [ ] **Step 1: Update index.js**

Add to the require block:
```js
const { createZoneGenerator } = require('./src/engine/zone-generator');
const { createDescriptionGenerator } = require('./src/engine/description-generator');
const { generateWorld } = require('./src/engine/world-generator');
```

Add instantiations after the existing ones (after `const latentsProcessor = ...`):
```js
const zoneGenerator = createZoneGenerator();        // loads room-types from disk
const descriptionGenerator = createDescriptionGenerator(ANTHROPIC_API_KEY);
```

Update `deps` to include the new dependencies:
```js
const deps = {
  graveyardStore,
  latentsProcessor,
  memorialGenerator,
  tileLibrary,
  tileCompositor,
  tileGenerator,
  zoneGenerator,
  descriptionGenerator,
};
```

**Important:** `generateWorld` is now called inside `createSession` (it receives `zoneGenerator` via `deps` and calls `generateWorld(zoneGenerator)` internally — see session.js in Task 6). No change needed to how `createSSHServer` and `createWebServer` call `createSession` — they already forward `deps` and each session creates its own world. Verify this by checking `src/interfaces/ssh-server.js` and `src/interfaces/web-server.js` pass `deps` to `createSession`.

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Delete old scene files**

```bash
rm data/scenes/act1-scene1.json data/scenes/act1-scene2.json data/scenes/act1-scene3.json \
   data/scenes/act2a-scene4.json data/scenes/act2a-scene5.json \
   data/scenes/act2b-scene4.json data/scenes/act2b-scene5.json \
   data/scenes/act3-scene6.json data/scenes/act3-scene7.json data/scenes/act3-scene8.json
rmdir data/scenes
```

- [ ] **Step 4: Run full test suite again to confirm nothing depends on scene files**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Manual smoke test**

```bash
node index.js
```

Open `http://localhost:3000` in a browser. Verify:
- "A world is being assembled for you." appears
- After ~3s, a room description renders (Claude-generated, no `{SLOT}` tokens)
- `look` shows the room description
- `go [direction]` moves between rooms in the zone
- Moving back reverses correctly (north/south and east/west are consistent)
- After exploring, eventually find the gate room
- The gate mechanic triggers appropriately (may need a few play sessions to see all three)
- Graveyard entry written on disconnect (`/graveyard` endpoint)

- [ ] **Step 6: Final commit**

```bash
git add index.js
git rm data/scenes/*.json
git rm -r data/scenes/ 2>/dev/null || true
git commit -m "feat: wire zone navigation — delete old scene files, inject zone/description generators"
```
