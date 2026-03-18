import { RequestStore, RequestLog } from './store';
import path from 'path';

// 创建全局 store 实例
const dbPath = path.resolve(process.cwd(), 'db/inspector.sqlite');
export const requestStore = new RequestStore(dbPath);

/**
 * 记录请求
 */
export async function recordRequest(data: {
  id: string;
  session_id?: string;
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  model?: string;
}): Promise<void> {
  const log: RequestLog = {
    id: data.id,
    session_id: data.session_id,
    endpoint: data.endpoint,
    method: data.method,
    request_headers: JSON.stringify(data.headers),
    request_body: JSON.stringify(data.body),
    response_status: 0,
    response_headers: null,
    response_body: null,
    streaming_events: null,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    latency_ms: 0,
    first_token_ms: 0,
    status_code: 0,
    error_message: null,
    model: data.model || null,
    cost_usd: 0,
    created_at: new Date().toISOString(),
  };
  requestStore.insert(log);
}

/**
 * 更新请求响应
 */
export async function updateRequestResponse(data: {
  id: string;
  status: number;
  headers: Record<string, string>;
  body: any;
  latency_ms: number;
  first_token_ms?: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
  model?: string;
  cost_usd?: number;
}): Promise<void> {
  const db = (requestStore as any).db as any;
  const stmt = db.prepare(`
    UPDATE request_logs
    SET
      response_status = ?,
      response_headers = ?,
      response_body = ?,
      latency_ms = ?,
      first_token_ms = ?,
      input_tokens = ?,
      output_tokens = ?,
      cache_read_tokens = ?,
      cache_creation_tokens = ?,
      model = ?,
      cost_usd = ?,
      status_code = ?
    WHERE id = ?
  `);

  stmt.run(
    data.status,
    JSON.stringify(data.headers),
    JSON.stringify(data.body),
    data.latency_ms,
    data.first_token_ms || null,
    data.input_tokens,
    data.output_tokens,
    data.cache_read_tokens || 0,
    data.cache_creation_tokens || 0,
    data.model || null,
    data.cost_usd || 0,
    data.status,
    data.id
  );
}

/**
 * 记录 SSE 事件
 */
export async function recordSseEvent(requestId: string, event: any): Promise<void> {
  const db = (requestStore as any).db as any;

  // 获取现 streaming_events
  const current = db.prepare('SELECT streaming_events FROM request_logs WHERE id = ?').get(requestId) as any;
  let events: any[] = [];

  if (current?.streaming_events) {
    try {
      events = JSON.parse(current.streaming_events);
    } catch {
      events = [];
    }
  }

  events.push({
    timestamp: Date.now(),
    data: event,
  });

  const stmt = db.prepare(`
    UPDATE request_logs
    SET streaming_events = ?
    WHERE id = ?
  `);

  stmt.run(JSON.stringify(events), requestId);
}

/**
 * 记录错误
 */
export async function recordError(requestId: string, error: string): Promise<void> {
  const db = (requestStore as any).db as any;
  const stmt = db.prepare(`
    UPDATE request_logs
    SET error_message = ?, status_code = 500
    WHERE id = ?
  `);
  stmt.run(error, requestId);
}
