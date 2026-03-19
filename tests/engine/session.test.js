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
    const fakeWorld = makeFakeWorld();
    const onOutput = jest.fn();
    const session = makeSession({ onOutput, world: fakeWorld });
    await session.start();
    onOutput.mockClear();
    await session.command('go north');
    const output = onOutput.mock.calls.map(c => c[0]).join('');
    expect(output).not.toContain('cannot go that way');
    expect(fakeWorld.visitedRoomIds.has('act1-r1')).toBe(true);
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
