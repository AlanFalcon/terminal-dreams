const { processCommand } = require('../../src/engine/command-processor');

const scene = {
  commands: {
    'look': 'You see a drowned enforcer.',
    'go north': { exit: 'act1-scene2' },
    'take pressure capsule': 'You pick it up.',
  },
  exits: { north: 'act1-scene2' },
  pivot_action: 'take',
  pivot_target_slot: 'MACGUFFIN',
};

describe('processCommand', () => {
  it('matches exact command and returns response text', () => {
    const result = processCommand('look', scene);
    expect(result.type).toBe('response');
    expect(result.text).toBe('You see a drowned enforcer.');
  });

  it('matches go command and returns exit', () => {
    const result = processCommand('go north', scene);
    expect(result.type).toBe('exit');
    expect(result.direction).toBe('north');
  });

  it('detects pivot action taken', () => {
    const result = processCommand('take pressure capsule', scene);
    expect(result.pivotTaken).toBe(true);
  });

  it('returns unknown for unrecognized command', () => {
    const result = processCommand('dance', scene);
    expect(result.type).toBe('unknown');
  });
});
