# CC Inspector

CC Inspector 是一个用于监控和记录 Claude Code API 请求的开发者工具。它通过代理拦截 `/v1/messages` 请求，记录详细的请求/响应数据，并提供实时可视化面板。

## 功能特性

- **请求代理**: 拦截并转发 Claude Code API 请求到上游服务器
- **实时日志**: 记录所有请求的 headers、body、response 和 streaming events
- **监控面板**: 可视化展示请求状态、tokens 使用量、延迟和成本
- **WebSocket 推送**: 实时推送新请求和更新到前端
- **数据持久化**: 使用 SQLite 存储所有请求日志
- **导出功能**: 支持 JSON 和 CSV 格式导出请求数据
- **Token 统计**: 自动计算 input/output tokens 和缓存使用量
- **成本估算**: 根据模型自动计算每次请求的成本

## 技术栈

- **框架**: Next.js 16 + React 19
- **语言**: TypeScript
- **数据库**: SQLite (better-sqlite3)
- **WebSocket**: ws
- **样式**: Tailwind CSS 4
- **测试**: Vitest

## 快速开始

### 环境要求

- Node.js 18+
- npm / yarn / pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问以下地址：
- **Dashboard**: http://localhost:3000/dashboard
- **首页**: http://localhost:3000

### 配置 LLM 服务 API

CC Inspector 需要知道将请求转发到哪个 LLM 服务提供商。配置方式有两种：

**方式 1：在项目根目录创建 `.env.local` 文件**

```bash
# .env.local
UPSTREAM_BASE_URL=https://api.anthropic.com  # 上游 API 基础 URL
UPSTREAM_API_KEY=your-api-key                 # 上游 API Key
```

**方式 2：在 Claude Code 全局配置中设置 (`~/.claude/settings.json`)**

```json
{
  "env": {
    "UPSTREAM_BASE_URL": "https://api.anthropic.com",
    "UPSTREAM_API_KEY": "your-api-key"
  }
}
```

> 注意：如果未设置 `UPSTREAM_BASE_URL`，程序会自动使用 `ANTHROPIC_BASE_URL` 的值。

### 配置 Claude Code 使用代理

CC Inspector 启动后，需要让 Claude Code 将请求发送到代理服务器而不是直接发送到 Anthropic API。

在 Claude Code 中执行以下命令配置 baseURL：

```bash
/mcp set anthropic_base_url http://localhost:3000/api/proxy
```

或者手动编辑 `~/.claude/settings.json`：

```json
{
  "anthropic_base_url": "http://localhost:3000/api/proxy"
}
```

配置完成后，Claude Code 的所有 API 请求都会先经过 CC Inspector，然后转发到上游 API。

**验证配置：**

1. 启动 CC Inspector：`npm run dev`
2. 访问 Dashboard：http://localhost:3000/dashboard
3. 在 Claude Code 中发起任意请求
4. Dashboard 应显示新请求的记录

## 项目结构

```
cc-inspector/
├── app/                       # Next.js App Router
│   ├── dashboard/            # 监控面板页面
│   ├── api/                  # API 路由
│   │   ├── proxy/           # 代理端点
│   │   ├── requests/        # 请求日志 API
│   │   └── events/          # SSE 事件 API
│   └── v1/messages/         # 原始消息端点
├── lib/                      # 核心逻辑库
│   ├── proxy/               # 代理转发器
│   │   ├── handlers.ts      # 请求处理器
│   │   ├── forwarder.ts     # 转发器
│   │   └── ws-server.ts     # WebSocket 服务器
│   └── recorder/            # 数据记录器
│       ├── index.ts         # 记录器入口
│       ├── store.ts         # SQLite 存储
│       └── schema.ts        # 数据库 Schema
├── components/              # React 组件
│   ├── JsonViewer.tsx      # JSON 查看器
│   └── JsonModal.tsx       # JSON 模态框
├── db/                      # SQLite 数据库文件
└── server.ts               # 自定义服务器（WebSocket + Next.js）
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/proxy` | POST | 代理转发请求到上游 |
| `/api/requests` | GET | 获取最近的请求日志 |
| `/api/requests/:id` | GET | 获取单个请求详情 |
| `/api/requests/export` | GET | 导出请求数据（JSON/CSV） |
| `/api/events` | GET | SSE 事件流 |
| `/api/ws` | WebSocket | 实时推送连接 |

## 数据模型

请求日志包含以下字段：

- `id`: 请求唯一标识
- `session_id`: 会话标识
- `endpoint`: 请求端点
- `method`: HTTP 方法
- `request_headers/body`: 请求头和请求体
- `response_status/body/headers`: 响应状态、响应体和响应头
- `streaming_events`: SSE 流式事件
- `input_tokens/output_tokens`: 输入/输出 tokens
- `cache_read_tokens/cache_creation_tokens`: 缓存读取/创建 tokens
- `latency_ms`: 请求延迟（毫秒）
- `first_token_ms`: 首 token 时间（毫秒）
- `model`: 使用的模型
- `cost_usd`: 估算成本（美元）
- `error_message`: 错误信息（如有）

## 脚本命令

```bash
# 开发
npm run dev          # 启动开发服务器

# 构建和运行
npm run build        # 构建生产版本
npm run start        # 启动生产服务器

# 测试和检查
npm run test         # 运行测试
npm run lint         # ESLint 检查
```

## 数据库

数据存储在 `db/inspector.sqlite`，包含以下表：

- `request_logs`: 请求日志
- `settings`: 配置设置

## 注意事项

1. **WebSocket**: 生产环境建议使用 `wss://` 连接
2. **代理模式**: 确保 Claude Code 配置为使用代理端点
3. **Token 计算**: 成本估算基于官方定价，仅供参考

## 开发

### 运行测试

```bash
npm run test
```

### 调试

服务器日志会输出所有请求和 WebSocket 连接信息。查看控制台输出或使用 `db/inspector.sqlite` 直接查询数据库。

## License

MIT
