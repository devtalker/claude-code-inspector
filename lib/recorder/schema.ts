/**
 * 数据库表结构定义
 */
export const CREATE_TABLES = `
-- 请求日志表
CREATE TABLE IF NOT EXISTS request_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    request_headers TEXT,
    request_body TEXT,
    response_status INTEGER,
    response_headers TEXT,
    response_body TEXT,
    streaming_events TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER,
    first_token_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    model TEXT,
    cost_usd REAL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_request_logs_session ON request_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
`;
