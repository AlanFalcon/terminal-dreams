const { compositeTiles } = require('../../src/art/tile-compositor');

const makeTile = () => Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n');

describe('compositeTiles', () => {
  it('returns single tile unchanged', () => {
    const tile = makeTile();
    expect(compositeTiles([tile])).toBe(tile);
  });

  it('composites 2 tiles side by side (80 cols wide)', () => {
    const result = compositeTiles([makeTile(), makeTile()]);
    const rows = result.split('\n').filter(Boolean);
    expect(rows).toHaveLength(12);
    rows.forEach(row => expect(row.length).toBe(80));
  });

  it('composites 3 tiles side by side (120 cols wide)', () => {
    const result = compositeTiles([makeTile(), makeTile(), makeTile()]);
    const rows = result.split('\n').filter(Boolean);
    expect(rows).toHaveLength(12);
    rows.forEach(row => expect(row.length).toBe(120));
  });
});
