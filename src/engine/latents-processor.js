// src/engine/latents-processor.js
const Anthropic = require('@anthropic-ai/sdk');

const VALID_EFFECT_TYPES = ['add_item', 'unlock_exit', 'npc_note', 'nothing'];
const FALLBACK = { text: 'The moment passes without consequence.', effect: null };

function buildPrompt(command, scene, history) {
  const factsText = scene.latents.map((l, i) => `${i + 1}. ${l.fact}`).join('\n');
  const historyText = history.length
    ? history.map(h => `> ${h.command}\n${h.response}`).join('\n\n')
    : 'None yet.';

  return `You are the hidden layer of a text adventure world.

SCENE: ${scene.description}

LATENT FACTS (the player cannot see these):
${factsText}

CONVERSATION SO FAR IN THIS SCENE:
${historyText}

PLAYER COMMAND: ${command}

Decide: does this action interact with any latent fact?
- If yes: write a response that naturally reveals or develops it. If the interaction reaches a natural conclusion, include an effect.
- If no: write a brief atmospheric response. No effect.

Respond in JSON only:
{"response": "narrative text shown to player", "effect": {"type": "add_item|unlock_exit|npc_note|nothing", ...payload} | null}`;
}

function validateEffect(effect) {
  if (!effect) return null;
  if (!VALID_EFFECT_TYPES.includes(effect.type)) return null;
  if (effect.type === 'add_item' && (!effect.item || !effect.item_desc)) return null;
  if (effect.type === 'unlock_exit' && (!effect.exit || !effect.target_scene)) return null;
  return effect;
}

function createLatentsProcessor(apiKey) {
  const client = new Anthropic({ apiKey });

  async function process(command, scene, history) {
    try {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: buildPrompt(command, scene, history) }],
      });
      const raw = message.content[0].text.trim();
      const parsed = JSON.parse(raw);
      if (typeof parsed.response !== 'string' || !parsed.response) return FALLBACK;
      return { text: parsed.response, effect: validateEffect(parsed.effect) };
    } catch {
      return FALLBACK;
    }
  }

  return { process };
}

module.exports = { createLatentsProcessor };
