// src/art/tile-generator.js
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { validateTile } = require('./tile-validator');

const TILES_DIR = path.join(__dirname, '../../tiles');
const TILE_BUDGET_MAX = 200;
const TILE_BUDGET_PER_SESSION_FULL = 10;
const TILE_BUDGET_PER_SESSION_STABLE = 2;
const MAX_RETRIES = 2;

const TILE_PROMPT = (genres, sceneType) =>
  `Generate a 40-column × 12-row ASCII art tile.
Genre tags: ${genres.join(', ')}
Scene type: ${sceneType}
Use plain ASCII characters (no ANSI colour). Every row must be exactly 40 characters wide (pad with spaces). Output only the 12 rows, no commentary, no blank lines before or after.`;

function createTileGenerator(apiKey, writeQueue, tileLibrary) {
  const client = new Anthropic({ apiKey });
  let sessionGenerated = 0;

  async function generateOneTile(genres, sceneType) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: TILE_PROMPT(genres, sceneType) }],
      });
      const content = message.content[0].text.trim();
      const result = validateTile(content);
      if (result.valid) return content;
    }
    return null;
  }

  async function maybeGenerateTile({ genres, sceneType }) {
    const count = tileLibrary.tileCount ? tileLibrary.tileCount() : 999;
    const budget = count < TILE_BUDGET_MAX ? TILE_BUDGET_PER_SESSION_FULL : TILE_BUDGET_PER_SESSION_STABLE;
    if (sessionGenerated >= budget) return null;

    return writeQueue.enqueue(async () => {
      const currentCount = tileLibrary.getAllTilePaths ? tileLibrary.getAllTilePaths().length : 999;
      const currentBudget = currentCount < TILE_BUDGET_MAX ? TILE_BUDGET_PER_SESSION_FULL : TILE_BUDGET_PER_SESSION_STABLE;
      if (sessionGenerated >= currentBudget) return;

      const content = await generateOneTile(genres, sceneType);
      if (!content) return;

      const genre = genres[0];
      const tileName = `${sceneType}-generated-${Date.now()}.ans`;
      const tileDir = path.join(TILES_DIR, genre);
      fs.mkdirSync(tileDir, { recursive: true });
      fs.writeFileSync(path.join(tileDir, tileName), content, 'utf8');
      sessionGenerated++;
    });
  }

  return { maybeGenerateTile };
}

module.exports = { createTileGenerator };
