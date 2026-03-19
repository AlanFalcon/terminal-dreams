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
    expect(() => manager.loadScene('nonexistent')).toThrow('Room not found: nonexistent');
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
    const world = makeWorld({ zones: { ...makeWorld().zones, act3: { id: 'act3', rooms: [r], startRoomId: 'act3-r0', status: 'ready' } } });
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

  it('returns null when zone slot is null and no pending', () => {
    const room = makeRoom({ gateMechanic: 'open', gateTarget: 'act2a' });
    const world = makeWorld({ pendingZone: null, zones: { act1: null, act2a: null, act2b: null, act3: null } });
    const manager = createSceneManager(world);
    expect(manager.resolveGate(room, 'north', world)).toBeNull();
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
    expect(world.pivotTaken).toBe(true);
  });

  it('sets gateTarget to act2b when pivot not taken', () => {
    const world = makeWorld();
    const gateRoom = world.zones.act1.rooms[1];
    const manager = createSceneManager(world);
    manager.setPivotTaken(false);
    expect(gateRoom.gateTarget).toBe('act2b');
    expect(world.pivotTaken).toBe(false);
  });
});
