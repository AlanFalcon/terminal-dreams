// src/api/memorial-generator.js
const Anthropic = require('@anthropic-ai/sdk');

const VOICE_LOST = `You are a Love Island host having a very bad personal day, and not afraid to let it show. Passive-aggressive. Slightly bereaved. Personally affronted by the disconnection. Cannot believe the player did this to you. Write a 2–3 paragraph memorial.`;

const VOICE_COMPLETED = `You are a Love Island host who is reluctantly, grudgingly impressed. You cannot quite believe the player actually finished. You wanted them to quit. You had the whole memorial ready. Now you have to stand there and acknowledge they did it, and it is personally very inconvenient for you. Write 2–3 short paragraphs. Passive-aggressive admiration. You will not be giving them the satisfaction of sounding genuinely moved, even if you are.`;

function createMemorialGenerator(apiKey) {
  const client = new Anthropic({ apiKey });

  async function generate({ worldName, genres, act, scene, commands, completed = false }) {
    const voice = completed ? VOICE_COMPLETED : VOICE_LOST;
    const situation = completed
      ? `The player explored "${worldName}" (genres: ${genres.join(', ')}) and actually finished. They reached Act ${act}, scene ${scene}. Their last commands were: ${commands.slice(-10).join(', ') || 'none'}. They completed the world. Write a closing.`
      : `The player was exploring "${worldName}" (genres: ${genres.join(', ')}). They reached Act ${act}, scene ${scene}. Their last commands were: ${commands.slice(-10).join(', ') || 'none'}. They then disconnected prematurely. Write a memorial.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: voice,
      messages: [{ role: 'user', content: situation }],
    });

    return message.content[0].text;
  }

  return { generate };
}

module.exports = { createMemorialGenerator };
