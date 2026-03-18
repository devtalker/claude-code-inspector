import { createServer } from 'http';
import next from 'next';
import { WebSocketServer } from 'ws';
import { parse } from 'url';
import { setWssInstance } from './lib/proxy/ws-server';
import { initEnv } from './lib/env';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';

// 初始化环境变量
initEnv();

// 禁用 Turbopack，使用 Webpack
if (dev) {
  // 正确禁用 Turbopack：删除环境变量或使用空字符串
  // 注意：'0' 在 JavaScript 中是 truthy，会导致 if (process.env.TURBOPACK) 判断为 true
  delete process.env.TURBOPACK;
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const upgradeHandler = app.upgradeHandler;
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // 注册 WebSocket upgrade 处理器，用于处理 Next.js HMR 连接
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

  // 注册 WebSocket 服务器实例
  setWssInstance(wss);

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
  });
});
