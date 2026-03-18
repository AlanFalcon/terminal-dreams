// tests/interfaces/render.test.js
const { renderInventory } = require('../../src/interfaces/render');

describe('renderInventory', () => {
  it('returns empty string for empty inventory', () => {
    expect(renderInventory([])).toBe('');
  });

  it('returns dim carrying line for one item', () => {
    const result = renderInventory([{ item: 'tarnished coin', item_desc: 'A worn coin.' }]);
    expect(result).toContain('tarnished coin');
    expect(result).toContain('Carrying:');
  });

  it('joins multiple items with comma', () => {
    const result = renderInventory([
      { item: 'tarnished coin', item_desc: 'A worn coin.' },
      { item: 'folded note', item_desc: 'A note.' },
    ]);
    expect(result).toContain('tarnished coin');
    expect(result).toContain('folded note');
    expect(result).toContain(',');
  });
});
