/**
 * Block Puzzle — игра + PeerJS на одном сервере (Render)
 * URL: https://block-puzzle-peer.onrender.com/
 */
const path = require('path');
const express = require('express');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');
const http = require('http');

const PORT = Number(process.env.PORT) || 9000;
const PEER_PATH = process.env.PEER_PATH || '/peerjs';
const PEER_KEY = process.env.PEER_KEY || 'peerjs';
const PUBLIC = path.join(__dirname, 'public');

const app = express();
app.use(cors({ origin: true }));
app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'block-puzzle',
    peerPath: PEER_PATH,
    key: PEER_KEY,
    uptime: Math.floor(process.uptime())
  });
});

// Статика игры (index.html, css, js)
app.use(express.static(PUBLIC, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

const server = http.createServer(app);

// PeerJS signaling: /peerjs
const peerServer = ExpressPeerServer(server, {
  path: '/',
  key: PEER_KEY,
  allow_discovery: false,
  proxied: true
});
app.use(PEER_PATH, peerServer);

// SPA-fallback: неизвестные пути → игра
app.get('*', (req, res, next) => {
  if (req.path.startsWith(PEER_PATH) || req.path === '/health') return next();
  res.sendFile(path.join(PUBLIC, 'index.html'), (err) => {
    if (err) next(err);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Block Puzzle + Peer on port', PORT, '| peer path', PEER_PATH);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
