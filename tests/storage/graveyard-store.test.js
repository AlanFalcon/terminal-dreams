// tests/storage/graveyard-store.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createGraveyardStore } = require('../../src/storage/graveyard-store');

let tmpDir;
let store;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graveyard-test-'));
  store = createGraveyardStore(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe('writeMemorial', () => {
  it('creates a markdown file in the graveyard dir', async () => {
    await store.writeMemorial({
      worldName: 'Test World',
      genres: ['deep-sea', 'cyberpunk'],
      act: 1, scene: 2,
      memorial: 'It was a short journey.\n\nYou left too soon.',
      timestamp: '2026-03-18T12:00:00Z',
    });
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.md'));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/test-world/);
  });
});

describe('writeCompleted', () => {
  it('appends a line to completed.log', async () => {
    await store.writeCompleted({
      worldName: 'Done World',
      genres: ['western'],
      scenes: 10,
      timestamp: '2026-03-18T13:00:00Z',
    });
    const logPath = path.join(tmpDir, 'completed.log');
    expect(fs.existsSync(logPath)).toBe(true);
    expect(fs.readFileSync(logPath, 'utf8')).toMatch('Done World');
  });
});

describe('listMemorials', () => {
  it('returns an array of memorial summaries', async () => {
    await store.writeMemorial({
      worldName: 'Lost World',
      genres: ['high-fantasy'],
      act: 2, scene: 1,
      memorial: 'You vanished in the Shattered Keep.\n\nForgettable.',
      timestamp: '2026-03-18T14:00:00Z',
    });
    const list = store.listMemorials();
    expect(list.length).toBe(1);
    expect(list[0]).toHaveProperty('worldName');
    expect(list[0]).toHaveProperty('slug');
    expect(list[0]).toHaveProperty('firstLine');
  });
});
