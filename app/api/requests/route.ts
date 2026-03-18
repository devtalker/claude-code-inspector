import { NextResponse } from 'next/server';
import { requestStore } from '@/lib/recorder';

/**
 * 获取最近的请求列表
 */
export async function GET() {
  try {
    const requests = requestStore.getRecentRequests(100);
    // 转换为前端需要的格式
    const formattedRequests = requests.map((r: any) => ({
      id: r.id,
      session_id: r.session_id,
      endpoint: r.endpoint,
      method: r.method,
      response_status: r.status_code,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cache_read_tokens: r.cache_read_tokens,
      cache_creation_tokens: r.cache_creation_tokens,
      latency_ms: r.latency_ms,
      first_token_ms: r.first_token_ms,
      model: r.model,
      cost_usd: r.cost_usd,
      created_at: r.created_at,
    }));
    return NextResponse.json(formattedRequests);
  } catch (error: any) {
    console.error('Failed to fetch requests:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch requests' }, { status: 500 });
  }
}
