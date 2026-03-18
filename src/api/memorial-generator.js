// src/api/memorial-generator.js
const Anthropic = require('@anthropic-ai/sdk');

const VOICE = `You are a Love Island host having a very bad personal day, and not afraid to let it show. Passive-aggressive. Slightly bereaved. Personally affronted by the disconnection. Cannot believe the player did this to you. Write a 2–3 paragraph memorial.`;

function createMemorialGenerator(apiKey) {
  const client = new Anthropic({ apiKey });

  async function generate({ worldName, genres, act, scene, commands }) {
    const prompt = `The player was exploring "${worldName}" (genres: ${genres.join(', ')}). They reached Act ${act}, scene ${scene}. Their last commands were: ${commands.slice(-10).join(', ') || 'none'}. They then disconnected prematurely. Write a memorial.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: VOICE,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].text;
  }

  return { generate };
}

module.exports = { createMemorialGenerator };
