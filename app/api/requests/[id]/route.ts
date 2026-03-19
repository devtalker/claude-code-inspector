import { NextResponse } from 'next/server';
import { getStore } from '@/lib/recorder';

/**
 * 获取单个请求的详细信息
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const req = getStore().findById(id);

    if (!req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // 解析 JSON 字符串
    let requestBody = null;
    let responseBody = null;
    let requestHeaders = null;
    let responseHeaders = null;
    let streamingEvents = null;

    try {
      requestBody = req.request_body ? JSON.parse(req.request_body) : null;
    } catch {
      requestBody = req.request_body;
    }

    try {
      responseBody = req.response_body ? JSON.parse(req.response_body) : null;
    } catch {
      responseBody = req.response_body;
    }

    try {
      requestHeaders = req.request_headers ? JSON.parse(req.request_headers) : null;
    } catch {
      requestHeaders = req.request_headers;
    }

    try {
      responseHeaders = req.response_headers ? JSON.parse(req.response_headers) : null;
    } catch {
      responseHeaders = req.response_headers;
    }

    try {
      streamingEvents = req.streaming_events ? JSON.parse(req.streaming_events) : null;
    } catch {
      streamingEvents = req.streaming_events;
    }

    return NextResponse.json({
      id: req.id,
      session_id: req.session_id,
      endpoint: req.endpoint,
      method: req.method,
      request_headers: requestHeaders,
      request_body: requestBody,
      response_status: req.response_status,
      response_headers: responseHeaders,
      response_body: responseBody,
      streaming_events: streamingEvents,
      input_tokens: req.input_tokens,
      output_tokens: req.output_tokens,
      cache_read_tokens: req.cache_read_tokens,
      cache_creation_tokens: req.cache_creation_tokens,
      latency_ms: req.latency_ms,
      first_token_ms: req.first_token_ms,
      model: req.model,
      cost_usd: req.cost_usd,
      error_message: req.error_message,
      created_at: req.created_at,
    });
  } catch (error: any) {
    console.error('Failed to fetch request:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch request' }, { status: 500 });
  }
}