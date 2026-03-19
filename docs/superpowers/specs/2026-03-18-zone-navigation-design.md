# Zone Navigation Design

## Goal

Replace the linear 10-scene structure with procedurally generated zones. Each act is a small cluster of 5–7 rooms on a consistent grid. Players can wander freely within a zone; crossing to the next act requires finding the gate room and satisfying a randomised gate mechanic. The Act 2 fork is preserved.

## Architecture

### Data model

Each zone is generated at runtime and stored on the `world` object:

```js
// Zone
{
  id: 'act1',
  rooms: [
    {
      id: 'act1-r0',
      type: 'entrance',          // key into room-type library
      position: { x: 1, y: 0 }, // grid position (for generation only)
      exits: {                   // cardinal directions → room id or gate token
        south: 'act1-r1',
        east:  'act1-r2',
      },
      description: '...',        // Claude-generated, filled async
      latents: [...],            // from room-type template, slot-filled
      isGate: false,
    },
    {
      id: 'act1-r4',
      type: 'threshold',
      position: { x: 2, y: 2 },
      exits: {
        north: 'act1-r3',
        west:  '__gate_act2__',  // gate token; direction varies per session
      },
      isGate: true,
      gateMechanic: 'narrative', // narrative | open | completion
      gateTarget: 'act2a',       // set after pivot resolution
    }
  ],
  startRoomId: 'act1-r0',
  status: 'pending',             // pending | generating | ready
}
```

Rooms connect on a consistent grid — exits are spatially honest (east/west and north/south are reversible). Room count per zone: 5–7, chosen randomly at world-gen time.

The `world` object gains:
- `zones` map: `{ act1, act2a, act2b, act3 }` (act2a/b and act3 start as `null`, populated lazily)
- `pivotTaken: false` — set to `true` when player takes the macguffin; determines active act2 zone
- `discoveredLatents: 0` — incremented on every successful latent trigger; **resets to 0 on each zone entry**; used only for the `completion` gate mechanic of the current zone
- `visitedRoomIds: Set()` — accumulates across entire session; used by `complete()`
- `pendingZone: null` — holds the background generation promise for the next zone

### New modules

**`src/engine/zone-generator.js`**

`createZoneGenerator()` → `{ generateZone(zoneId, world, roomCount) }`

- Picks `roomCount` room types from the library (weighted toward variety)
- Places rooms on a grid using a drunk-walk: start at origin, each new room attaches to an existing one in a random open cardinal direction — guarantees full connectivity
- Assigns one room as the gate room; picks a random unoccupied exit direction for the gate and a random gate mechanic (`narrative | open | completion`)
- Returns zone object with `status: 'pending'` (no descriptions yet)

**`src/engine/description-generator.js`**

`createDescriptionGenerator(apiKey)` → `{ generateDescription(room, world) }`

- Single Claude haiku call per room
- Prompt: room type, genre names, slot values (LOCATION, CHARACTER, etc.), act number
- Returns a 2-sentence atmospheric description string
- Errors fall back to a generic description derived from room type name

**`data/room-types/*.json`** (34 files)

Replace the current 10 scene files as the content library. Each file:

```json
{
  "type": "forge",
  "tiles": ["atmosphere", "location"],
  "latents": [
    { "fact": "...", "hint": "add_item", "item": "...", "item_desc": "..." },
    { "fact": "...", "hint": "npc_note" },
    { "fact": "...", "hint": "unlock_exit", "exit": "east", "exit_desc": "...", "target_scene": "__adjacent__" }
  ]
}
```

No descriptions (generated), no exits (built by zone-generator), no positions.

**Token resolution at placement time** (zone-generator's responsibility):
- `unlock_exit` latents with `target_scene: "__adjacent__"` — resolved to the actual id of an adjacent room in the zone
- `unlock_exit` latents with `target_scene: "__gate_target__"` — used only when `gateMechanic` is `narrative`; zone-generator injects the gate token (e.g. `__gate_act2__`) into the latent's `target_scene` at placement time. When triggered, `applyEffect` writes `__gate_unlocked__` into `room.exits[gateDirection]` — not a room id, because the next zone's start room may not exist yet. `resolveGate` for the `narrative` mechanic checks for `__gate_unlocked__` (any value that is neither a gate token nor `null`) and, at that moment, resolves the actual start room id from `world.zones[gateTarget].startRoomId` (awaiting `world.pendingZone` first if the zone is still generating).

**Full token vocabulary:**
| Token | Meaning |
|---|---|
| `__gate_act2__` | Exit value for the act1→act2 gate direction |
| `__gate_act3__` | Exit value for the act2→act3 gate direction |
| `__complete__` | Exit value for the final room's completion exit |
| `__stall__` | Returned by `resolveGate` when next zone is still generating (transient) |
| `__gate_unlocked__` | Written to `room.exits[direction]` by `applyEffect` for `narrative` gate latents |
| `__adjacent__` | Placeholder in room-type templates; resolved at placement time |
| `__gate_target__` | Placeholder in room-type templates for narrative gate latents; resolved at placement time |

Room types (34): entrance, corridor, chamber, crossroads, ruin, threshold, sanctum, antechamber, observatory, vault, gallery, atrium, cellar, archive, laboratory, market, watchtower, infirmary, greenhouse, forge, catacombs, chapel, armory, dock, cistern, pit, rampart, workshop, shrine, terminus, switchboard, esplanade, sump, reliquary

### Changed modules

**`src/engine/world-generator.js`**

- Still generates genre blend and slot values
- Now also calls `zoneGenerator.generateZone('act1', world, roomCount)` synchronously (layout only)
- Returns `world` with `zones: { act1: {...} }` plus `pendingZones: ['act2a', 'act2b', 'act3']`
- Act 2A/2B zone generated later, after pivot resolution

**`src/engine/scene-manager.js`**

- `loadScene(roomId)` — looks up room across `world.zones` instead of reading JSON files
- `resolveExit(room, direction)` — reads `room.exits[direction]`. Returns: `null` (no exit), a room id string, `'__complete__'`, or a gate token (`__gate_act2__`, `__gate_act3__`). Gate tokens are **not** room ids — callers must detect them (any value starting with `__gate_`) and route to `resolveGate` instead of `loadScene`.
- `resolveGate(room, direction, world)` — new method; called when `resolveExit` returns a gate token. Returns one of: a start room id string (proceed), `null` (mechanic not satisfied — permanent block), or `'__stall__'` (next zone still generating — transient). Checks gate mechanic:
  - `open`: if `world.pendingZone` is still resolving, returns `'__stall__'`; otherwise returns `world.zones[room.gateTarget].startRoomId`
  - `narrative`: first checks that `room.gateTarget` is set and `world.pendingZone` is non-null (i.e. pivot has been taken); if either is absent, returns `null` (gate is unlocked structurally but destination is not yet determined — player must take the macguffin first). If `room.exits[direction] === '__gate_unlocked__'` and zone is ready, returns start room id; if zone is still generating, returns `'__stall__'`; if exit is still a gate token (latent not triggered), returns `null`
  - `completion`: if `world.discoveredLatents >= ceil(currentZone.rooms.length / 2)` and zone ready, returns start room id; if threshold met but zone still generating, returns `'__stall__'`; if threshold not met, returns `null` (permanent — never stalls)
- `setPivotTaken(bool)` — sets `gateTarget` on the act1 gate room only; does **not** initiate background generation (that is `session.js`'s responsibility)
- `resolveFork()` — determines active act2 zone id based on `world.pivotTaken`

**`src/engine/session.js`**

- `start()` — generates Act 1 room descriptions in parallel (one Claude call per room), then renders start room. Does **not** pre-generate Act 2; that fires after pivot resolution.
- `command()` — revised gate-crossing flow:
  ```
  result = processCommand(normalized, currentScene)   // 'exit' type as before
  if result.type === 'exit':
    raw = resolveExit(currentScene, result.direction)
    if raw starts with '__gate_':
      nextRoomId = resolveGate(currentScene, result.direction, world)
      if nextRoomId === null → 'You cannot go that way.'
      if nextRoomId === '__stall__' → output stall message, retry up to 3× at 1s intervals; after 3 failures fall back to open mechanic
      else → load zone start room, render
    else if raw === '__complete__' → complete()
    else if raw === null → 'You cannot go that way.'
    else → loadScene(raw), renderScene
  ```
- Scene transition — clears `latentConversation`, resets per-room state as before
- Latent discovery — increments `world.discoveredLatents` counter on any successful latent trigger (for `completion` gate mechanic)
- Pivot + background generation — `session.js` calls `sceneManager.setPivotTaken(true)` (which sets `gateTarget` on the gate room), then immediately kicks off background `zoneGenerator` + `descriptionGenerator` for the active act2 zone and stores the promise as `world.pendingZone`. When player crosses the act2 gate, `session.js` fires background generation of act3 in the same way.
- Zone entry — on each zone entry, `session.js` resets `world.discoveredLatents = 0`.
- `complete()` — writes `rooms: world.visitedRoomIds.size` to graveyard store instead of hardcoded `10`. Session tracks visited rooms in `world.visitedRoomIds` (a `Set`).

### Gate mechanics

One mechanic is chosen randomly at world-gen time per zone transition and stored on the gate room.

| Mechanic | Gate opens when… | Player signal |
|---|---|---|
| `narrative` | A `hint: unlock_exit` latent in the gate room is triggered | Discovered through free-form interaction |
| `open` | Always passable | Player just has to find the room and direction |
| `completion` | `discoveredLatents >= ceil(rooms.length / 2)` in current zone | `'Something shifts. A way forward has opened.'` |

The gate direction is randomised (north, south, east, or west) and is never the direction the player entered from.

### Generation timing

```
session.start()
  └─ generateZone('act1')            ← layout only, instant
  └─ generateDescriptions(act1)      ← parallel Claude calls, ~3s
  └─ render start room

player takes pivot action (macguffin)
  └─ setPivotTaken(true) → resolves gateTarget (act2a or act2b)
  └─ [background] generateZone(act2a|act2b) + descriptions → world.pendingZone

player crosses act1 gate
  └─ await world.pendingZone (act2 generation)
  └─ stall message if not ready (rare)
  └─ reset world.discoveredLatents = 0
  └─ render act2 start room
  └─ [background] generateZone('act3') + descriptions → world.pendingZone

player crosses act2 gate
  └─ await world.pendingZone (act3 generation)
  └─ stall message if not ready (rare)
  └─ reset world.discoveredLatents = 0
  └─ render act3 start room
```

## What stays the same

- Latents processor (Claude haiku adjudicator for free-form commands)
- Command processor (look, go, take, talk to)
- Render module (`bold`, `dim`, `clear`, `renderInventory`)
- Graveyard store and memorial generator
- Tile library, tile compositor, tile generator
- SSH and web server interfaces
- Slot-filling system (LOCATION, CHARACTER, ANTAGONIST, etc.)
- Pivot action detection (macguffin at act1 gate room)

## Out of scope

- Persisting the generated world graph between sessions (each session generates fresh)
- Displaying a map to the player
- Room descriptions that reference other rooms in the same zone
