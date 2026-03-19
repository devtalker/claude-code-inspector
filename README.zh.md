# CC Inspector

CC Inspector 是一个用于监控和记录 Claude Code API 请求的开发者工具。它通过代理拦截 `/v1/messages` 请求，记录详细的请求/响应数据，并提供实时可视化仪表板。

## 安装

### 通过 npm 安装（推荐）

```bash
npm install -g claude-code-inspector
```

### 从源代码安装

```bash
git clone https://github.com/devtalker/claude-code-inspector.git
cd claude-code-inspector
npm install
```

## 功能特性

- **请求代理**：拦截并转发 Claude Code API 请求到上游服务器
- **实时日志**：记录所有请求的头部、正文、响应和流式事件
- **仪表板**：可视化请求状态、Token 使用量、延迟和成本
- **WebSocket 推送**：实时推送新请求和更新到前端
- **数据持久化**：使用 SQLite 存储所有请求日志
- **导出功能**：支持 JSON 或 CSV 格式导出请求数据
- **Token 统计**：自动计算输入/输出 Token 和缓存使用量
- **成本估算**：根据模型定价计算每个请求的成本

## 技术栈

- **框架**：Next.js 16 + React 19
- **语言**：TypeScript
- **数据库**：SQLite (better-sqlite3)
- **WebSocket**：ws
- **样式**：Tailwind CSS 4
- **测试**：Vitest

## 快速开始

### 方式一：使用 npm 包（推荐）

安装后，使用 `cc-inspector` 命令启动服务：

```bash
# 启动服务
cc-inspector
```

启动后访问：
- **仪表板**：http://localhost:3000/dashboard
- **首页**：http://localhost:3000

### 方式二：从源代码运行

**环境要求：**
- Node.js 18+
- npm / yarn / pnpm

**安装依赖：**

```bash
npm install
```

**启动开发服务器：**

```bash
npm run dev
```

访问：
- **仪表板**：http://localhost:3000/dashboard
- **首页**：http://localhost:3000

### 配置环境变量

CC Inspector 需要知道将请求转发到哪个 LLM 服务提供商。有两种配置方式：

**方式一：在 Claude Code 全局配置中设置（推荐 npm 包用户）**

编辑 `~/.claude/settings.json`：

```json
{
  "env": {
    "UPSTREAM_BASE_URL": "https://api.anthropic.com",
    "UPSTREAM_API_KEY": "your-api-key"
  }
}
```

**方式二：创建 `.env.local` 文件（适合源代码运行用户）**

```bash
# .env.local
UPSTREAM_BASE_URL=https://api.anthropic.com  # 上游 API 基础 URL
UPSTREAM_API_KEY=your-api-key                 # 上游 API 密钥
```

> 注意：如果未设置 `UPSTREAM_BASE_URL`，程序将自动使用 `ANTHROPIC_BASE_URL` 的值。

### 配置 Claude Code 使用代理

启动 CC Inspector 后，需要配置 Claude Code 将请求发送到代理服务器，而不是直接发送到 Anthropic API。

在 Claude Code 中运行以下命令配置 baseURL：

```bash
/mcp set anthropic_base_url http://localhost:3000/api/proxy
```

或者手动编辑 `~/.claude/settings.json`：

```json
{
  "anthropic_base_url": "http://localhost:3000/api/proxy"
}
```

配置完成后，所有来自 Claude Code 的 API 请求都会先经过 CC Inspector，然后被转发到上游 API。

**验证配置：**

1. 启动 CC Inspector：`cc-inspector` 或 `npm run dev`
2. 访问仪表板：http://localhost:3000/dashboard
3. 在 Claude Code 中发起任意请求
4. 仪表板应显示新的请求记录

## 项目结构

```
claude-code-inspector/
├── app/                       # Next.js App Router
│   ├── dashboard/            # 监控仪表板页面
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
│       └── schema.ts        # 数据库模式
├── components/              # React 组件
│   ├── JsonViewer.tsx      # JSON 查看器
│   └── JsonModal.tsx       # JSON 模态框
├── db/                      # SQLite 数据库文件
└── server.ts               # 自定义服务器（WebSocket + Next.js）
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/proxy` | POST | 代理并转发请求到上游 |
| `/api/requests` | GET | 获取最近的请求日志 |
| `/api/requests/:id` | GET | 获取单个请求详情 |
| `/api/requests/export` | GET | 导出请求数据（JSON/CSV） |
| `/api/events` | GET | SSE 事件流 |
| `/api/ws` | WebSocket | 实时推送连接 |

## 数据模型

请求日志包含以下字段：

- `id`: 唯一请求标识符
- `session_id`: 会话标识符
- `endpoint`: 请求端点
- `method`: HTTP 方法
- `request_headers/body`: 请求头部和正文
- `response_status/body/headers`: 响应状态、正文和头部
- `streaming_events`: SSE 流式事件
- `input_tokens/output_tokens`: 输入/输出 Token
- `cache_read_tokens/cache_creation_tokens`: 缓存读取/创建 Token
- `latency_ms`: 请求延迟（毫秒）
- `first_token_ms`: 首 Token 时间（毫秒）
- `model`: 使用的模型
- `cost_usd`: 估算成本（美元）
- `error_message`: 错误消息（如有）

## 脚本命令

**源代码运行用户：**

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

**npm 包用户：**

```bash
cc-inspector         # 启动服务
```

## 数据库

数据存储在 `db/inspector.sqlite` 中，包含以下表：

- `request_logs`: 请求日志表
- `settings`: 配置设置表

## 注意事项

1. **WebSocket**：生产环境请使用 `wss://` 连接
2. **代理模式**：确保 Claude Code 已配置使用代理端点
3. **Token 计算**：成本估算基于官方定价，仅供参考

## 开发

### 运行测试

```bash
npm run test
```

### 调试

服务器日志会输出所有请求和 WebSocket 连接信息。检查控制台输出或使用 `db/inspector.sqlite` 直接查询数据库。

## 许可证

MIT
