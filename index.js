require('dotenv').config({ path: '.env' });
const path = require('path');
const { createSSHServer } = require('./src/interfaces/ssh-server');
const { createWebServer } = require('./src/interfaces/web-server');
const { createGraveyardStore } = require('./src/storage/graveyard-store');
const { createMemorialGenerator } = require('./src/api/memorial-generator');
const { createTileGenerator } = require('./src/art/tile-generator');
const { createLatentsProcessor } = require('./src/engine/latents-processor');
const { createWriteQueue } = require('./src/storage/write-queue');
const tileLibrary = require('./src/art/tile-library');
const tileCompositor = require('./src/art/tile-compositor');

const SSH_PORT = parseInt(process.env.SSH_PORT || '2222');
const WEB_PORT = parseInt(process.env.WEB_PORT || '3000');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required. Copy .env.example to .env and set your key.');
  process.exit(1);
}

const graveyardStore = createGraveyardStore(path.join(__dirname, 'graveyard'));
const writeQueue = createWriteQueue();
const memorialGenerator = createMemorialGenerator(ANTHROPIC_API_KEY);
const tileGenerator = createTileGenerator(ANTHROPIC_API_KEY, writeQueue, tileLibrary);
const latentsProcessor = createLatentsProcessor(ANTHROPIC_API_KEY);

const deps = {
  graveyardStore,
  latentsProcessor,
  memorialGenerator,
  tileLibrary,
  tileCompositor,
  tileGenerator,
};

const sshServer = createSSHServer({ port: SSH_PORT, deps });
const webServer = createWebServer({ port: WEB_PORT, deps });

sshServer.listen();
webServer.listen();

console.log(`Terminal Dreams running.`);
console.log(`  Web: http://localhost:${WEB_PORT}`);
console.log(`  SSH: ssh -p ${SSH_PORT} localhost`);
console.log(`  Graveyard: http://localhost:${WEB_PORT}/graveyard`);
