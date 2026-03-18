import { NextRequest, NextResponse } from 'next/server';

/**
 * SSE 实时推送端点
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始连接消息
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`));

      // 定期发送心跳
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`));
      }, 30000);

      // 当客户端断开时清理
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
