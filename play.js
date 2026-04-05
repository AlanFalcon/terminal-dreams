// play.js — run a Terminal Dreams session from the command line
// Usage: node play.js [command1] [command2] ...
// Or: node play.js (interactive)
const path = require('path');
const readline = require('readline');

const { createSession } = require('./src/engine/session');
const { createGraveyardStore } = require('./src/storage/graveyard-store');
const { createMemorialGenerator } = require('./src/api/memorial-generator');
const { createTileGenerator } = require('./src/art/tile-generator');
const { createLatentsProcessor } = require('./src/engine/latents-processor');
const { createWriteQueue } = require('./src/storage/write-queue');
const { createDescriptionGenerator } = require('./src/engine/description-generator');
const { createZoneGenerator } = require('./src/engine/zone-generator');
const tileLibrary = require('./src/art/tile-library');
const tileCompositor = require('./src/art/tile-compositor');

const API_KEY = process.env.ANTHROPIC_API_KEY || 'stub';

const graveyardStore = createGraveyardStore(path.join(__dirname, 'graveyard'));
const writeQueue = createWriteQueue();
const memorialGenerator = createMemorialGenerator(API_KEY);
const tileGenerator = createTileGenerator(API_KEY, writeQueue, tileLibrary);
const latentsProcessor = createLatentsProcessor(API_KEY);
const zoneGenerator = createZoneGenerator();
const descriptionGenerator = createDescriptionGenerator(API_KEY);

let output = '';
const session = createSession({
  id: 'local-play',
  onOutput: (text) => { process.stdout.write(text); output += text; },
  onComplete: () => { process.exit(0); },
  onLost: () => { process.exit(0); },
  graveyardStore,
  memorialGenerator,
  tileLibrary,
  tileCompositor,
  tileGenerator,
  latentsProcessor,
  zoneGenerator,
  descriptionGenerator,
});

const args = process.argv.slice(2);

async function run() {
  await session.start();

  if (args.length > 0) {
    // Scripted commands
    for (const cmd of args) {
      await new Promise(r => setTimeout(r, 100));
      process.stdout.write('\n[> ' + cmd + ']\n');
      await session.command(cmd);
    }
    await new Promise(r => setTimeout(r, 200));
    process.exit(0);
  } else {
    // Interactive
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    rl.on('line', async (line) => {
      await session.command(line);
    });
    rl.on('close', async () => {
      await session.disconnect();
    });
  }
}

run().catch(console.error);
