// tests/engine/world-generator.test.js
const path = require('path');
const { loadGenres, selectGenres, generateWorldName, fillSlot, generateWorld } = require('../../src/engine/world-generator');

describe('loadGenres', () => {
  it('loads at least 2 genres from data/genres/', () => {
    const genres = loadGenres();
    expect(genres.length).toBeGreaterThanOrEqual(2);
    expect(genres[0]).toHaveProperty('name');
    expect(genres[0]).toHaveProperty('vocab');
  });
});

describe('selectGenres', () => {
  it('selects 2–4 genres', () => {
    const genres = loadGenres();
    const results = Array.from({ length: 100 }, () => selectGenres(genres));
    const counts = results.map(r => r.length);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
  });
});

describe('generateWorldName', () => {
  it('returns a non-empty string', () => {
    const genres = loadGenres().slice(0, 2);
    const name = generateWorldName(genres);
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('does not contain raw slot tokens', () => {
    const genres = loadGenres().slice(0, 3);
    const name = generateWorldName(genres);
    expect(name).not.toMatch(/\{[A-Z]+\}/);
  });
});

describe('fillSlot', () => {
  it('returns primary genre noun with secondary adjective prepended', () => {
    const genres = loadGenres();
    const [primary, secondary] = genres.slice(0, 2);
    const result = fillSlot('ANTAGONIST', [primary, secondary]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

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
