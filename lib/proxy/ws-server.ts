import { WebSocketServer } from 'ws';

// 全局 WebSocket 服务器实例（由 server.ts 设置）
let wssInstance: WebSocketServer | null = null;

/**
 * 设置 WebSocket 服务器实例（由 server.ts 调用）
 */
export function setWssInstance(wss: WebSocketServer) {
  wssInstance = wss;
}

/**
 * 获取 WebSocket 服务器实例
 */
export function getWssInstance(): WebSocketServer | null {
  return wssInstance;
}

/**
 * 广播 SSE 事件到所有客户端
 */
export function broadcastSseEvent(requestId: string, event: any) {
  if (!wssInstance) return;

  const message = JSON.stringify({
    type: 'sse_event',
    requestId,
    event,
    timestamp: Date.now(),
  });

  wssInstance.clients.forEach((client: any) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

/**
 * 广播新请求到所有客户端
 */
export function broadcastNewRequest(data: any) {
  if (!wssInstance) return;

  const message = JSON.stringify({
    type: 'new_request',
    data,
    timestamp: Date.now(),
  });

  wssInstance.clients.forEach((client: any) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

/**
 * 广播请求更新到所有客户端
 */
export function broadcastRequestUpdate(data: any) {
  if (!wssInstance) return;

  const message = JSON.stringify({
    type: 'request_update',
    data,
    timestamp: Date.now(),
  });

  wssInstance.clients.forEach((client: any) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}
