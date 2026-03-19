// tests/engine/latents-processor.test.js
jest.mock('@anthropic-ai/sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { createLatentsProcessor } = require('../../src/engine/latents-processor');

const SCENE = {
  description: 'A dim room. Something watches from the corner.',
  exits: { north: 'act1-scene2' },
  latents: [
    { fact: 'a tarnished coin half-buried in the dust', hint: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' },
    { fact: 'the character keeps glancing at the floor panel', hint: 'npc_note' },
  ],
};
const HISTORY = [];

function mockClaude(responseObj) {
  const mockCreate = jest.fn().mockResolvedValue({
    content: [{ text: JSON.stringify(responseObj) }],
  });
  Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
  return mockCreate;
}

describe('createLatentsProcessor', () => {
  it('returns text and null effect when Claude returns no effect', async () => {
    mockClaude({ response: 'The air shifts. Nothing more.', effect: null });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('shout at the sky', SCENE, HISTORY);
    expect(result.text).toBe('The air shifts. Nothing more.');
    expect(result.effect).toBeNull();
  });

  it('returns text and add_item effect when Claude fires one', async () => {
    mockClaude({ response: 'The coin rolls out.', effect: { type: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('dig in the dust', SCENE, HISTORY);
    expect(result.text).toBe('The coin rolls out.');
    expect(result.effect).toEqual({ type: 'add_item', item: 'tarnished coin', item_desc: 'A worn coin.' });
  });

  it('returns text and strips effect if add_item is missing item field', async () => {
    mockClaude({ response: 'Something falls.', effect: { type: 'add_item', item_desc: 'A worn coin.' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('reach down', SCENE, HISTORY);
    expect(result.text).toBe('Something falls.');
    expect(result.effect).toBeNull();
  });

  it('returns text and strips effect if effect type is invalid', async () => {
    mockClaude({ response: 'Strange.', effect: { type: 'explode_world' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('do something weird', SCENE, HISTORY);
    expect(result.text).toBe('Strange.');
    expect(result.effect).toBeNull();
  });

  it('returns fallback when Claude response is not valid JSON', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ content: [{ text: 'oops not json' }] });
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('anything', SCENE, HISTORY);
    expect(result.text).toBe('The moment passes without consequence.');
    expect(result.effect).toBeNull();
  });

  it('returns fallback when API call throws', async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error('network error'));
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('anything', SCENE, HISTORY);
    expect(result.text).toBe('The moment passes without consequence.');
    expect(result.effect).toBeNull();
  });

  it('includes conversation history in the prompt', async () => {
    const mockCreate = mockClaude({ response: 'The coin falls.', effect: null });
    const processor = createLatentsProcessor('fake-key');
    const history = [{ command: 'look at dust', response: 'You see something glinting.' }];
    await processor.process('reach for it', SCENE, history);
    const promptSent = mockCreate.mock.calls[0][0].messages[0].content;
    expect(promptSent).toContain('look at dust');
    expect(promptSent).toContain('You see something glinting.');
  });

  it('returns text and unlock_exit effect when Claude fires one', async () => {
    mockClaude({ response: 'A door reveals itself.', effect: { type: 'unlock_exit', exit: 'east', target_scene: 'act2a-scene4' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('push the tapestry', SCENE, HISTORY);
    expect(result.effect).toEqual({ type: 'unlock_exit', exit: 'east', target_scene: 'act2a-scene4' });
  });

  it('strips unlock_exit effect if target_scene is missing', async () => {
    mockClaude({ response: 'A gap appears.', effect: { type: 'unlock_exit', exit: 'east' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('push the wall', SCENE, HISTORY);
    expect(result.effect).toBeNull();
  });

  it('returns exit effect when Claude fires one', async () => {
    mockClaude({ response: 'You move north into the dark.', effect: { type: 'exit', direction: 'north' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('go north', SCENE, HISTORY);
    expect(result.effect).toEqual({ type: 'exit', direction: 'north' });
  });

  it('strips exit effect if direction is missing', async () => {
    mockClaude({ response: 'You move somewhere.', effect: { type: 'exit' } });
    const processor = createLatentsProcessor('fake-key');
    const result = await processor.process('go somewhere', SCENE, HISTORY);
    expect(result.effect).toBeNull();
  });
});
