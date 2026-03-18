const { validateTile, stripAnsi } = require('../../src/art/tile-validator');

const makeRow = (len) => ' '.repeat(len);
const makeValidTile = () => Array.from({ length: 12 }, () => makeRow(40)).join('\n');

describe('stripAnsi', () => {
  it('removes colour escape codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
  });
  it('removes cursor movement codes', () => {
    expect(stripAnsi('\x1b[2Jtext')).toBe('text');
  });
});

describe('validateTile', () => {
  it('passes a 40x12 plain tile', () => {
    expect(validateTile(makeValidTile())).toEqual({ valid: true });
  });

  it('fails if row count is not 12', () => {
    const tile = Array.from({ length: 10 }, () => makeRow(40)).join('\n');
    const result = validateTile(tile);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/12/);
  });

  it('fails if a row is not 40 columns wide', () => {
    const rows = Array.from({ length: 12 }, () => makeRow(40));
    rows[3] = makeRow(35);
    const result = validateTile(rows.join('\n'));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/40/);
  });

  it('passes a tile with ANSI colour where stripped width is 40', () => {
    const ansiRow = '\x1b[32m' + ' '.repeat(40) + '\x1b[0m';
    const tile = Array.from({ length: 12 }, () => ansiRow).join('\n');
    expect(validateTile(tile)).toEqual({ valid: true });
  });
});
