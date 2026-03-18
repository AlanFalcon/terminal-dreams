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
    latentsProcessor: { process: jest.fn().mockResolvedValue({ text: 'The moment passes.', effect: null }) },
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

describe('unknown command routing', () => {
  it('calls latentsProcessor.process on unknown command', async () => {
    const mockProcess = jest.fn().mockResolvedValue({ text: 'Nothing happens.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('shout at the ceiling');
    expect(mockProcess).toHaveBeenCalledWith('shout at the ceiling', expect.any(Object), expect.any(Array));
  });

  it('appends to latentConversation after latents response', async () => {
    const mockProcess = jest.fn().mockResolvedValue({ text: 'The coin glints.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('look at the dust');
    expect(session.latentConversation).toHaveLength(1);
    expect(session.latentConversation[0]).toEqual({ command: 'look at the dust', response: 'The coin glints.' });
  });

  it('applies add_item effect to inventory', async () => {
    const mockProcess = jest.fn().mockResolvedValue({
      text: 'You find a coin.',
      effect: { type: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' },
    });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('dig in the dust');
    expect(session.inventory).toHaveLength(1);
    expect(session.inventory[0]).toEqual({ item: 'tarnished coin', item_desc: 'A worn coin.' });
  });

  it('applies unlock_exit effect so go <direction> works afterwards', async () => {
    let callCount = 0;
    const mockProcess = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { text: 'A door appears in the east wall.', effect: { type: 'unlock_exit', exit: 'east', target_scene: 'act1-scene2' } };
      }
      return { text: 'Nothing more happens.', effect: null };
    });
    const onOutput = jest.fn();
    const session = makeSession({ latentsProcessor: { process: mockProcess }, onOutput });
    await session.start();
    onOutput.mockClear();
    await session.command('push the tapestry'); // fires unlock_exit
    onOutput.mockClear();
    await session.command('go east'); // should now route to act1-scene2, not "cannot go that way"
    const outputCalls = onOutput.mock.calls.map(c => c[0]).join('');
    expect(outputCalls).not.toContain('cannot go that way');
  });

  it('resets latentConversation when moving to a new scene', async () => {
    const mockProcess = jest.fn().mockResolvedValue({ text: 'Something stirs.', effect: null });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('do something weird'); // adds to latentConversation
    expect(session.latentConversation).toHaveLength(1);
    await session.command('go north'); // moves to next scene
    expect(session.latentConversation).toHaveLength(0);
  });

  it('does not add duplicate items to inventory', async () => {
    const mockProcess = jest.fn().mockResolvedValue({
      text: 'You find a coin.',
      effect: { type: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' },
    });
    const session = makeSession({ latentsProcessor: { process: mockProcess } });
    await session.start();
    await session.command('dig in the dust');
    await session.command('dig in the dust again');
    expect(session.inventory).toHaveLength(1);
  });
});
