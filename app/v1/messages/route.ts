import { handleMessages } from '@/lib/proxy/handlers';

/**
 * 处理 Claude API /v1/messages 请求
 * 这是 Claude Code 请求的入口点
 */
export async function POST(request: Request) {
  try {
    // 提取请求头
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = await request.json();

    // 转发到处理器
    return handleMessages(request, body, headers);
  } catch (error: any) {
    console.error('/v1/messages error:', error);
    console.error('Stack:', error?.stack);
    return new Response(
      JSON.stringify({ error: error?.message || 'Proxy error', stack: error?.stack }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}