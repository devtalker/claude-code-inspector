#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const next = require('next');
const { WebSocketServer } = require('ws');
const { parse } = require('url');

// 切换到包的安装目录，确保 Next.js 能正确找到文件
const installDir = path.resolve(__dirname, '..');
process.chdir(installDir);

// 临时重命名 tsconfig.json，防止 Next.js 尝试安装 TypeScript 依赖
// 但创建一个包含路径别名的简化版本，确保模块解析正确
const tsconfigPath = path.join(installDir, 'tsconfig.json');
const tsconfigBackupPath = path.join(installDir, 'tsconfig.json.bak');
let tsconfigMoved = false;

if (fs.existsSync(tsconfigPath)) {
  fs.renameSync(tsconfigPath, tsconfigBackupPath);
  tsconfigMoved = true;
  // 创建一个简化的 tsconfig.json，只包含路径别名配置
  const minimalTsconfig = {
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@/*': ['./*']
      }
    }
  };
  fs.writeFileSync(tsconfigPath, JSON.stringify(minimalTsconfig, null, 2));

  // 进程退出时恢复原始文件
  process.on('exit', () => {
    if (tsconfigMoved && fs.existsSync(tsconfigBackupPath)) {
      fs.renameSync(tsconfigBackupPath, tsconfigPath);
    }
  });

  // 捕获信号，确保恢复文件
  process.on('SIGINT', () => {
    if (tsconfigMoved && fs.existsSync(tsconfigBackupPath)) {
      fs.renameSync(tsconfigBackupPath, tsconfigPath);
    }
    process.exit();
  });

  process.on('SIGTERM', () => {
    if (tsconfigMoved && fs.existsSync(tsconfigBackupPath)) {
      fs.renameSync(tsconfigBackupPath, tsconfigPath);
    }
    process.exit();
  });
}

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
