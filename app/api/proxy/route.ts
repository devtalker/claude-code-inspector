import { handleMessages } from '@/lib/proxy/handlers';

/**
 * 代理服务器入口
 * 拦截 /v1/messages 请求并记录
 */
export async function POST(request: Request) {
  try {
    // 提取请求头和 body
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = await request.json();

    // 转发到处理器
    return handleMessages(request, body, headers);
  } catch (error: any) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Proxy error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET 请求用于健康检查
 */
export async function GET() {
  return new Response(
    JSON.stringify({ status: 'ok', message: 'CC Inspector Proxy Running' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
