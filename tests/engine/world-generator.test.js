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

describe('generateWorld', () => {
  it('returns world with name and genres array', () => {
    const world = generateWorld();
    expect(world).toHaveProperty('name');
    expect(world).toHaveProperty('genres');
    expect(world.genres.length).toBeGreaterThanOrEqual(2);
  });
});
