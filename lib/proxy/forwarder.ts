import axios from 'axios';

export interface UpstreamConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * 提取 Session ID
 */
export function extractSessionId(headers: Record<string, string>, body: any): string | null {
  return (
    headers['x-session-id'] ||
    headers['X-Session-Id'] ||
    body?.metadata?.session_id ||
    null
  );
}

/**
 * 提取 Token 使用量
 */
export function extractUsage(response: any): {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
} {
  const usage = response?.usage;
  if (!usage) {
    return {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
    };
  }

  return {
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    cache_read_tokens: usage.cache_read_input_tokens || 0,
    cache_creation_tokens: usage.cache_creation_input_tokens || 0,
  };
}

/**
 * 构建转发 Headers
 */
export function buildForwardHeaders(
  originalHeaders: Record<string, string>,
  config: UpstreamConfig
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };

  // 保留部分原始 headers
  const preserveHeaders = ['x-api-key', 'x-request-id', 'user-agent'];
  for (const key of preserveHeaders) {
    if (originalHeaders[key]) {
      headers[key] = originalHeaders[key];
    }
  }

  return headers;
}

/**
 * 判断是否为 SSE 响应
 */
export function isSseResponse(response: any): boolean {
  const contentType = response?.headers?.['content-type'] || '';
  return contentType.includes('text/event-stream');
}

/**
 * 转发请求到上游 API
 */
export async function forwardRequest(
  endpoint: string,
  body: any,
  headers: Record<string, string>,
  config: UpstreamConfig
): Promise<any> {
  const url = `${config.baseUrl}${endpoint}`;


  const forwardHeaders = buildForwardHeaders(headers, config);

  return axios.post(url, body, {
    headers: forwardHeaders,
    responseType: 'stream',
  });
}
