#!/usr/bin/env node

const { createServer } = require('http');
const next = require('next');
const { WebSocketServer } = require('ws');
const { parse } = require('url');

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';

// 禁用 Turbopack，使用 Webpack
if (dev) {
  delete process.env.TURBOPACK;
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler();
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // 注册 WebSocket upgrade 处理器
  server.on('upgrade', async (req, socket, head) => {
    console.log('[SERVER] Upgrade request received for URL:', req.url);
    try {
      await upgradeHandler(req, socket, head);
      console.log('[SERVER] Upgrade handler completed successfully');
    } catch (error) {
      console.error('[SERVER] Upgrade handler error:', error);
    }
  });

  // WebSocket 服务器
  const wss = new WebSocketServer({ server, path: '/api/ws' });

  wss.on('connection', (ws) => {
    console.log('Client connected. Total clients:', wss.clients.size);

    ws.on('close', () => {
      console.log('Client disconnected. Total clients:', wss.clients.size);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> WebSocket available on ws://localhost:${port}/api/ws`);
    console.log(`> Dashboard: http://localhost:${port}/dashboard`);
  });
});
