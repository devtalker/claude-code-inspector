# CC Inspector

> 🌐 Read in other languages: [English](README.md) | [简体中文](README.zh.md) | [日本語](README.ja.md)

CC Inspector is a developer tool for monitoring and logging Claude Code API requests. It intercepts `/v1/messages` requests through a proxy, records detailed request/response data, and provides a real-time visualization dashboard.

## Installation

### Install via npm (Recommended)

```bash
npm install -g claude-code-inspector
```

### Install from Source

```bash
git clone https://github.com/devtalker/claude-code-inspector.git
cd claude-code-inspector
npm install
```

## Features

- **Request Proxy**: Intercept and forward Claude Code API requests to upstream servers
- **Real-time Logging**: Record all request headers, body, response, and streaming events
- **Dashboard**: Visualize request status, token usage, latency, and costs
- **WebSocket Push**: Real-time push of new requests and updates to the frontend
- **Data Persistence**: Store all request logs in SQLite
- **Export Functionality**: Export request data in JSON or CSV format
- **Token Statistics**: Automatically calculate input/output tokens and cache usage
- **Cost Estimation**: Calculate cost per request based on model pricing

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **WebSocket**: ws
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest

## Quick Start

### Option 1: Using npm Package (Recommended)

After installation, start the service using the `cc-inspector` command:

```bash
# Start the service
cc-inspector
```

After the service starts, access:
- **Dashboard**: http://localhost:3000/dashboard
- **Home**: http://localhost:3000

### Option 2: Running from Source

**Requirements:**
- Node.js 18+
- npm / yarn / pnpm

**Install dependencies:**

```bash
npm install
```

**Start development server:**

```bash
npm run dev
```

Access:
- **Dashboard**: http://localhost:3000/dashboard
- **Home**: http://localhost:3000

### Configure Environment Variables

CC Inspector needs to know which LLM service provider to forward requests to. There are two configuration methods:

**Option 1: Configure in Claude Code global settings (Recommended for npm package users)**

Edit `~/.claude/settings.json`:

```json
{
  "env": {
    "UPSTREAM_BASE_URL": "https://api.anthropic.com",
    "UPSTREAM_API_KEY": "your-api-key"
  }
}
```

**Option 2: Create `.env.local` file (For source running users)**

```bash
# .env.local
UPSTREAM_BASE_URL=https://api.anthropic.com  # Upstream API base URL
UPSTREAM_API_KEY=your-api-key                 # Upstream API Key
```

> Note: If `UPSTREAM_BASE_URL` is not set, the program will automatically use the value of `ANTHROPIC_BASE_URL`.

### Configure Claude Code to Use Proxy

After starting CC Inspector, you need to configure Claude Code to send requests to the proxy server instead of directly to Anthropic API.

Run the following command in Claude Code to configure baseURL:

```bash
/mcp set anthropic_base_url http://localhost:3000/api/proxy
```

Or manually edit `~/.claude/settings.json`:

```json
{
  "anthropic_base_url": "http://localhost:3000/api/proxy"
}
```

After configuration, all API requests from Claude Code will go through CC Inspector and then be forwarded to the upstream API.

**Verify Configuration:**

1. Start CC Inspector: `cc-inspector` or `npm run dev`
2. Access Dashboard: http://localhost:3000/dashboard
3. Make any request in Claude Code
4. Dashboard should display the new request record

## Project Structure

```
claude-code-inspector/
├── app/                       # Next.js App Router
│   ├── dashboard/            # Monitoring dashboard page
│   ├── api/                  # API routes
│   │   ├── proxy/           # Proxy endpoint
│   │   ├── requests/        # Request logs API
│   │   └── events/          # SSE events API
│   └── v1/messages/         # Original messages endpoint
├── lib/                      # Core logic library
│   ├── proxy/               # Proxy forwarder
│   │   ├── handlers.ts      # Request handlers
│   │   ├── forwarder.ts     # Forwarder
│   │   └── ws-server.ts     # WebSocket server
│   └── recorder/            # Data recorder
│       ├── index.ts         # Recorder entry
│       ├── store.ts         # SQLite storage
│       └── schema.ts        # Database schema
├── components/              # React components
│   ├── JsonViewer.tsx      # JSON viewer
│   └── JsonModal.tsx       # JSON modal
├── db/                      # SQLite database files
└── server.ts               # Custom server (WebSocket + Next.js)
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/proxy` | POST | Proxy and forward requests to upstream |
| `/api/requests` | GET | Get recent request logs |
| `/api/requests/:id` | GET | Get single request details |
| `/api/requests/export` | GET | Export request data (JSON/CSV) |
| `/api/events` | GET | SSE event stream |
| `/api/ws` | WebSocket | Real-time push connection |

## Data Model

Request logs include the following fields:

- `id`: Unique request identifier
- `session_id`: Session identifier
- `endpoint`: Request endpoint
- `method`: HTTP method
- `request_headers/body`: Request headers and body
- `response_status/body/headers`: Response status, body, and headers
- `streaming_events`: SSE streaming events
- `input_tokens/output_tokens`: Input/output tokens
- `cache_read_tokens/cache_creation_tokens`: Cache read/creation tokens
- `latency_ms`: Request latency (milliseconds)
- `first_token_ms`: First token time (milliseconds)
- `model`: Model used
- `cost_usd`: Estimated cost (USD)
- `error_message`: Error message (if any)

## Scripts

**For source running users:**

```bash
# Development
npm run dev          # Start development server

# Build and run
npm run build        # Build production version
npm run start        # Start production server

# Testing and checking
npm run test         # Run tests
npm run lint         # ESLint check
```

**For npm package users:**

```bash
cc-inspector         # Start service
```

## Database

Data is stored in `db/inspector.sqlite`, containing the following tables:

- `request_logs`: Request logs
- `settings`: Configuration settings

## Notes

1. **WebSocket**: Use `wss://` connection in production environment
2. **Proxy Mode**: Ensure Claude Code is configured to use the proxy endpoint
3. **Token Calculation**: Cost estimation is based on official pricing and is for reference only

## Development

### Run Tests

```bash
npm run test
```

### Debugging

Server logs output all request and WebSocket connection information. Check console output or query the database directly using `db/inspector.sqlite`.

## License

MIT
