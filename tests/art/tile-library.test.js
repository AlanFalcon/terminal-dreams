const path = require('path');
const { loadTile, findTile, tileCount, getAllTilePaths } = require('../../src/art/tile-library');

describe('tileCount', () => {
  it('returns a number >= 0', () => {
    expect(typeof tileCount()).toBe('number');
    expect(tileCount()).toBeGreaterThanOrEqual(0);
  });
});

describe('findTile', () => {
  it('returns a tile path for an existing genre', () => {
    const result = findTile({ genres: ['deep-sea'], sceneType: 'location' });
    expect(result).toBeTruthy();
    expect(result).toMatch(/\.ans$/);
  });

  it('falls back to any same-type tile when genre has none', () => {
    const result = findTile({ genres: ['nonexistent-genre'], sceneType: 'location' });
    expect(result).toBeTruthy();
  });

  it('falls back to any tile when nothing else matches', () => {
    const result = findTile({ genres: ['nonexistent'], sceneType: 'nonexistent' });
    expect(result).toBeTruthy();
  });
});

describe('loadTile', () => {
  it('returns file content as a string', () => {
    const tilePath = findTile({ genres: ['deep-sea'], sceneType: 'location' });
    const content = loadTile(tilePath);
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(0);
  });
});
