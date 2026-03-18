import { extractSessionId, extractUsage, isSseResponse, forwardRequest, UpstreamConfig } from './forwarder';
import { recordRequest, updateRequestResponse, recordSseEvent } from '../recorder';
import { broadcastNewRequest, broadcastRequestUpdate, broadcastSseEvent } from './ws-server';
import { v4 as uuidv4 } from 'uuid';
import { calculateCost } from '../pricing';
import { initEnv } from '../../lib/env';

// 确保环境变量已初始化（兼容 dev 和 start 模式）
let envInitialized = false;
function ensureEnvInitialized() {
  if (!envInitialized) {
    initEnv();
    envInitialized = true;
  }
}

/**
 * 处理 /v1/messages 请求 (Claude API)
 */
export async function handleMessages(
  request: Request,
  body: any,
  headers: Record<string, string>
): Promise<Response> {
  // 确保环境变量已初始化
  ensureEnvInitialized();

  const requestId = uuidv4();
  const startTime = Date.now();

  // 提取 session_id
  const sessionId = extractSessionId(headers, body);

  // 提取 model
  const model = body?.model || '';

  // 1. 记录请求
  await recordRequest({
    id: requestId,
    session_id: sessionId || undefined,
    endpoint: '/v1/messages',
    method: 'POST',
    headers,
    body,
    model,
  });

  // 广播新请求
  broadcastNewRequest({
    id: requestId,
    session_id: sessionId,
    endpoint: '/v1/messages',
    method: 'POST',
    input_tokens: 0,
    output_tokens: 0,
    created_at: new Date().toISOString(),
  });

  // 2. 获取上游配置
  // UPSTREAM_* 用于转发，ANTHROPIC_* 作为 fallback
  const config: UpstreamConfig = {
    baseUrl: process.env.UPSTREAM_BASE_URL || 'https://api.anthropic.com',
    apiKey: process.env.UPSTREAM_API_KEY || process.env.ANTHROPIC_API_KEY || '',
  };


  try {
    // 3. 转发请求
    const response = await forwardRequest('/v1/messages', body, headers, config);

    // 4. 处理响应
    if (isSseResponse(response)) {
      return handleStreamingResponse(response, requestId, startTime, body);
    } else {
      return handleNonStreamingResponse(response, requestId, startTime, body);
    }
  } catch (error: any) {
    // 5. 处理错误
    const errorMessage = error?.response?.data?.error?.message || error?.message || 'Unknown error';
    await updateRequestResponse({
      id: requestId,
      status: error?.response?.status || 500,
      headers: {},
      body: { error: errorMessage },
      latency_ms: Date.now() - startTime,
      input_tokens: 0,
      output_tokens: 0,
    });

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: error?.response?.status || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * 处理流式响应
 */
async function handleStreamingResponse(
  response: any,
  requestId: string,
  startTime: number,
  body: any
): Promise<Response> {
  const firstTokenTime = { recorded: false, value: 0 };
  const usage = { input_tokens: 0, output_tokens: 0 };

  // 使用 ReadableStream 包装 Node.js stream
  const nodeStream = response.data;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of nodeStream) {
          const text = chunk.toString();
          const lines = text.split('\n').filter((line: string) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                continue;
              }

              try {
                const json = JSON.parse(data);

                // 记录首个 token 时间
                if (!firstTokenTime.recorded && json.delta?.text) {
                  firstTokenTime.recorded = true;
                  firstTokenTime.value = Date.now() - startTime;
                  await recordSseEvent(requestId, { type: 'first_token', latency: firstTokenTime.value });
                }

                // 提取 usage
                if (json.usage) {
                  usage.input_tokens = json.usage.input_tokens || 0;
                  usage.output_tokens = json.usage.output_tokens || 0;
                }

                // 记录 SSE 事件
                await recordSseEvent(requestId, json);

                // 广播 SSE 事件
                broadcastSseEvent(requestId, json);
              } catch {
                // 忽略解析错误
              }
            }
            controller.enqueue(new TextEncoder().encode(line + '\n'));
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
      }

      // 完成时更新数据库
      const costUsd = calculateCost(
        body.model || '',
        usage.input_tokens,
        usage.output_tokens
      );

      await updateRequestResponse({
        id: requestId,
        status: 200,
        headers: {},
        body: { usage },
        latency_ms: Date.now() - startTime,
        first_token_ms: firstTokenTime.value,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        model: body.model || '',
        cost_usd: costUsd,
      });

      // 广播请求完成
      broadcastRequestUpdate({
        id: requestId,
        status: 200,
        latency_ms: Date.now() - startTime,
        first_token_ms: firstTokenTime.value,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * 从 stream 中读取所有数据
 */
async function readStream(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * 处理非流式响应
 */
async function handleNonStreamingResponse(
  response: any,
  requestId: string,
  startTime: number,
  body: any
): Promise<Response> {
  // 从 stream 中读取数据
  const rawData = await readStream(response.data);
  const data = JSON.parse(rawData);
  const usage = extractUsage(data);

  // 提取 headers 为简单对象（避免循环引用）
  const responseHeaders: Record<string, string> = {};
  if (response.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      responseHeaders[key] = String(value);
    }
  }

  // 计算成本
  const costUsd = calculateCost(
    body.model || '',
    usage.input_tokens,
    usage.output_tokens,
    usage.cache_read_tokens,
    usage.cache_creation_tokens
  );

  // 更新响应记录
  await updateRequestResponse({
    id: requestId,
    status: response.status,
    headers: responseHeaders,
    body: data,
    latency_ms: Date.now() - startTime,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    cache_creation_tokens: usage.cache_creation_tokens,
    model: body.model || '',
    cost_usd: costUsd,
  });

  // 广播请求完成
  broadcastRequestUpdate({
    id: requestId,
    status: response.status,
    latency_ms: Date.now() - startTime,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    cache_creation_tokens: usage.cache_creation_tokens,
  });

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
