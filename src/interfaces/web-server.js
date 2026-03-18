// src/interfaces/web-server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { createSession } = require('../engine/session');

const GRACE_PERIOD_MS = 5000;

function createWebServer({ port, deps }) {
  const app = express();
  const httpServer = http.createServer(app);
  const wss = new WebSocket.Server({ server: httpServer });

  app.use(express.static(path.join(__dirname, '../../public')));

  // Graveyard index
  app.get('/graveyard', (req, res) => {
    const memorials = deps.graveyardStore.listMemorials();
    const lost = memorials.length;
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Graveyard</title>
<style>body{background:#111;color:#ccc;font-family:monospace;padding:2em}a{color:#888}h1{color:#fff}</style>
</head><body><h1>The Graveyard</h1><p>${lost} world${lost !== 1 ? 's' : ''} have been lost.</p><ul>`;
    memorials.forEach(m => {
      html += `<li><a href="/graveyard/${m.slug}">${m.worldName}</a> — ${m.firstLine}</li>`;
    });
    html += '</ul></body></html>';
    res.send(html);
  });

  app.get('/graveyard/:slug', (req, res) => {
    const content = deps.graveyardStore.getMemorial(req.params.slug);
    if (!content) return res.status(404).send('Not found');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Memorial</title>
<style>body{background:#111;color:#ccc;font-family:monospace;padding:2em;max-width:60em}pre{white-space:pre-wrap}</style>
</head><body><pre>${content.replace(/</g, '&lt;')}</pre><p><a href="/graveyard">← Back</a></p></body></html>`;
    res.send(html);
  });

  // Active sessions map for reconnection grace period
  const activeSessions = new Map(); // id → { session, timer, ws }

  wss.on('connection', (ws) => {
    let sessionId = null;
    let session = null;
    let firstMessage = true;

    ws.on('message', async (data) => {
      const text = data.toString().trim();

      // First message: check for reconnect token
      if (firstMessage) {
        firstMessage = false;
        if (activeSessions.has(text)) {
          // Reconnect to existing session
          const entry = activeSessions.get(text);
          clearTimeout(entry.timer);
          sessionId = text;
          session = entry.session;
          activeSessions.set(sessionId, { session, ws, timer: null });
          ws.send('Reconnected.\n');
          return;
        }
        // New session
        sessionId = `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        ws.send(JSON.stringify({ type: 'session', token: sessionId }));

        session = createSession({
          id: sessionId,
          onOutput: (text) => { if (ws.readyState === WebSocket.OPEN) ws.send(text); },
          onComplete: () => { ws.close(); activeSessions.delete(sessionId); },
          onLost: () => { activeSessions.delete(sessionId); },
          ...deps,
        });
        activeSessions.set(sessionId, { session, ws, timer: null });
        await session.start().catch(err => ws.send('\nError: ' + err.message + '\n'));
        return;
      }

      if (session) {
        await session.command(text).catch(() => {});
      }
    });

    ws.on('close', () => {
      if (!sessionId || !activeSessions.has(sessionId)) return;
      const entry = activeSessions.get(sessionId);
      // Start grace period timer
      entry.timer = setTimeout(async () => {
        const current = activeSessions.get(sessionId);
        if (current && current.timer) {
          await current.session.disconnect();
          activeSessions.delete(sessionId);
        }
      }, GRACE_PERIOD_MS);
      activeSessions.set(sessionId, entry);
    });
  });

  return {
    listen() {
      httpServer.listen(port, '0.0.0.0', () => {
        console.log(`Web server listening on port ${port}`);
      });
    },
  };
}

module.exports = { createWebServer };
