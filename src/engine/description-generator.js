// src/engine/description-generator.js
const Anthropic = require('@anthropic-ai/sdk');

function createDescriptionGenerator(apiKey) {
  const client = new Anthropic({ apiKey });

  async function generateDescription(room, world) {
    const genreNames = world.genres.map(g => g.name).join(', ');
    const prompt = `Write exactly 2 sentences describing a ${room.type} in a world shaped by these genres: ${genreNames}. Act ${room.act} of 3. Terse, atmospheric, uncanny. No dialogue. No character names. Present tense.`;
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].text.trim();
    } catch {
      return `A ${room.type}. The air here is still.`;
    }
  }

  return { generateDescription };
}

module.exports = { createDescriptionGenerator };
