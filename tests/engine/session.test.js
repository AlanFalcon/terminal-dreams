// tests/engine/session.test.js
const { createSession } = require('../../src/engine/session');

function makeSession(overrides = {}) {
  const onOutput = overrides.onOutput || jest.fn();
  const onComplete = overrides.onComplete || jest.fn();
  const onLost = overrides.onLost || jest.fn();
  return createSession({
    id: 'test-session',
    onOutput,
    onComplete,
    onLost,
    graveyardStore: { writeMemorial: jest.fn().mockResolvedValue(), writeCompleted: jest.fn().mockResolvedValue() },
    memorialGenerator: { generate: jest.fn().mockResolvedValue('A sad tale.') },
    tileLibrary: {
      findTile: jest.fn().mockReturnValue('tiles/deep-sea/location-trench.ans'),
      loadTile: jest.fn().mockReturnValue(Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n')),
    },
    tileCompositor: { compositeTiles: jest.fn().mockReturnValue(Array.from({ length: 12 }, () => ' '.repeat(40)).join('\n')) },
    tileGenerator: { maybeGenerateTile: jest.fn().mockResolvedValue(null) },
    ...overrides,
  });
}

describe('createSession', () => {
  it('starts in loading state', () => {
    const session = makeSession();
    expect(session.state).toBe('loading');
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
});

describe('session.command()', () => {
  it('emits a response for known command', async () => {
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
  it('starts with empty inventory', async () => {
    const session = makeSession();
    expect(session.inventory).toEqual([]);
  });
});

describe('session latentConversation', () => {
  it('starts with empty latentConversation', async () => {
    const session = makeSession();
    expect(session.latentConversation).toEqual([]);
  });
});
