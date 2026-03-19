// tests/engine/description-generator.test.js
const { createDescriptionGenerator } = require('../../src/engine/description-generator');

jest.mock('@anthropic-ai/sdk');
const Anthropic = require('@anthropic-ai/sdk');

const WORLD = {
  name: 'Test World',
  genres: [{ name: 'horror', vocab: {} }],
};

const ROOM = {
  id: 'act1-r0',
  type: 'entrance',
  act: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  Anthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'A dim entrance. The threshold is cold.' }],
      }),
    },
  }));
});

describe('generateDescription', () => {
  it('returns a string description', async () => {
    const gen = createDescriptionGenerator('test-key');
    const desc = await gen.generateDescription(ROOM, WORLD);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('passes room type and world info to Claude', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ text: 'A grim entrance.' }],
    });
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
    const gen = createDescriptionGenerator('test-key');
    await gen.generateDescription(ROOM, WORLD);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.stringContaining('haiku') })
    );
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('entrance');
    expect(prompt).toContain('horror');
  });

  it('falls back to generic description on API error', async () => {
    Anthropic.mockImplementation(() => ({
      messages: { create: jest.fn().mockRejectedValue(new Error('API error')) },
    }));
    const gen = createDescriptionGenerator('test-key');
    const desc = await gen.generateDescription(ROOM, WORLD);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
    expect(desc.toLowerCase()).toContain('entrance');
  });
});
