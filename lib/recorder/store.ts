import Database from 'better-sqlite3';
import { CREATE_TABLES } from './schema';
import path from 'path';
import fs from 'fs';

export interface RequestLog {
  id: string;
  session_id?: string | null;
  endpoint: string;
  method: string;
  request_headers?: string | null;
  request_body?: string | null;
  response_status?: number | null;
  response_headers?: string | null;
  response_body?: string | null;
  streaming_events?: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  latency_ms?: number | null;
  first_token_ms?: number | null;
  status_code?: number | null;
  error_message?: string | null;
  model?: string | null;
  cost_usd?: number | null;
  created_at: string;
}

export class RequestStore {
  private db: ReturnType<typeof Database>;

  constructor(dbPath: string) {
    const fullPath = path.resolve(dbPath);
    // 确保数据库目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(fullPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    this.db.exec(CREATE_TABLES);
  }

  public insert(log: RequestLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO request_logs (
        id, session_id, endpoint, method,
        request_headers, request_body,
        response_status, response_headers, response_body,
        streaming_events,
        input_tokens, output_tokens,
        cache_read_tokens, cache_creation_tokens,
        latency_ms, first_token_ms, status_code, error_message,
        model, cost_usd,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.id,
      log.session_id || null,
      log.endpoint,
      log.method,
      log.request_headers ? JSON.stringify(JSON.parse(log.request_headers)) : null,
      log.request_body ? JSON.stringify(JSON.parse(log.request_body)) : null,
      log.response_status || null,
      log.response_headers ? JSON.stringify(JSON.parse(log.response_headers)) : null,
      log.response_body ? JSON.stringify(JSON.parse(log.response_body)) : null,
      log.streaming_events ? JSON.stringify(JSON.parse(log.streaming_events)) : null,
      log.input_tokens,
      log.output_tokens,
      log.cache_read_tokens,
      log.cache_creation_tokens,
      log.latency_ms || null,
      log.first_token_ms || null,
      log.status_code || null,
      log.error_message || null,
      log.model || null,
      log.cost_usd || 0,
      log.created_at
    );
  }

  public findById(id: string): RequestLog | undefined {
    const stmt = this.db.prepare('SELECT * FROM request_logs WHERE id = ?');
    return stmt.get(id) as RequestLog | undefined;
  }

  public findAll(limit: number = 100): RequestLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM request_logs
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as RequestLog[];
  }

  public findBySessionId(sessionId: string): RequestLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM request_logs
      WHERE session_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(sessionId) as RequestLog[];
  }

  public getRecentRequests(limit: number = 50): RequestLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM request_logs
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as RequestLog[];
  }

  public getTotalStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms
      FROM request_logs
    `);
    return stmt.get() as {
      total_requests: number;
      total_input_tokens: number;
      total_output_tokens: number;
      avg_latency_ms: number;
    };
  }

  public close() {
    this.db.close();
  }
}
