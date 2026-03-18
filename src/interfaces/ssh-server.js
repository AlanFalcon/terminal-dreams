// src/interfaces/ssh-server.js
const { Server } = require('ssh2');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createSession } = require('../engine/session');

const KEY_PATH = path.join(__dirname, '../../.ssh/host_key');

function ensureHostKey() {
  const keyDir = path.dirname(KEY_PATH);
  if (!fs.existsSync(keyDir)) fs.mkdirSync(keyDir, { recursive: true });
  if (!fs.existsSync(KEY_PATH)) {
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(KEY_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  }
  return fs.readFileSync(KEY_PATH);
}

function createSSHServer({ port, deps }) {
  const hostKey = ensureHostKey();

  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    let session = null;

    client.on('authentication', ctx => ctx.accept());
    client.on('ready', () => {
      client.once('session', (accept) => {
        const sshSession = accept();

        // Handle graveyard SSH command: `ssh host graveyard` or `ssh host graveyard 1`
        sshSession.once('exec', (accept, reject, info) => {
          const parts = info.command.trim().split(/\s+/);
          if (parts[0] !== 'graveyard') { reject(); return; }
          const stream = accept();
          const memorials = deps.graveyardStore.listMemorials();
          const lost = memorials.length;

          if (parts[1]) {
            // Read individual memorial by 1-based index
            const idx = parseInt(parts[1], 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= memorials.length) {
              stream.write(`No memorial at index ${parts[1]}. There are ${lost} worlds lost.\n`);
            } else {
              const content = deps.graveyardStore.getMemorial(memorials[idx].slug);
              stream.write((content || 'Memorial not found.') + '\n');
            }
          } else {
            // List index
            stream.write(`${lost} world${lost !== 1 ? 's' : ''} have been lost.\n\n`);
            memorials.forEach((m, i) => {
              stream.write(`[${i + 1}] ${m.worldName} — ${m.firstLine}\n`);
            });
            stream.write('\nRead a memorial: ssh [host] graveyard [number]\n');
          }

          stream.exit(0);
          stream.end();
          client.end();
        });

        sshSession.once('pty', (accept) => { accept(); });
        sshSession.once('shell', (accept) => {
          const stream = accept();

          const id = `ssh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          session = createSession({
            id,
            onOutput: (text) => stream.write(text),
            onComplete: () => { stream.end(); client.end(); },
            onLost: () => {},
            ...deps,
          });

          session.start().catch(err => stream.write('\nError: ' + err.message + '\n'));

          let inputBuf = '';
          stream.on('data', (data) => {
            const str = data.toString();
            for (const ch of str) {
              if (ch === '\r' || ch === '\n') {
                stream.write('\r\n');
                session.command(inputBuf);
                inputBuf = '';
              } else if (ch === '\x7f' || ch === '\b') {
                if (inputBuf.length > 0) {
                  inputBuf = inputBuf.slice(0, -1);
                  stream.write('\b \b');
                }
              } else {
                inputBuf += ch;
                stream.write(ch);
              }
            }
          });

          stream.on('close', () => {
            if (session) session.disconnect();
          });
        });
      });
    });

    client.on('close', () => {
      if (session) session.disconnect();
    });
  });

  return {
    listen() {
      server.listen(port, '0.0.0.0', () => {
        console.log(`SSH server listening on port ${port}`);
      });
    },
  };
}

module.exports = { createSSHServer };
