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
 * 从 SSE 事件中提取 usage 信息（兼容多种 API 格式）
 */
function extractUsageFromSse(json: any): { input_tokens: number; output_tokens: number } {
  // Claude/智谱 GLM 格式: message_start 事件中的 message.usage
  if (json.type === 'message_start' && json.message?.usage) {
    return {
      input_tokens: json.message.usage.input_tokens || 0,
      output_tokens: json.message.usage.output_tokens || 0,
    };
  }

  // Claude/智谱 GLM 格式: message_delta 事件中的 usage
  if (json.type === 'message_delta' && json.usage) {
    return {
      input_tokens: json.usage.input_tokens || 0,
      output_tokens: json.usage.output_tokens || 0,
    };
  }

  // OpenAI / Anthropic 格式
  if (json.usage) {
    return {
      input_tokens: json.usage.input_tokens || json.usage.prompt_tokens || 0,
      output_tokens: json.usage.output_tokens || json.usage.completion_tokens || 0,
    };
  }

  // 智谱 GLM 格式 (usage 在顶层)
  if (json.input_tokens !== undefined || json.output_tokens !== undefined) {
    return {
      input_tokens: json.input_tokens || 0,
      output_tokens: json.output_tokens || 0,
    };
  }

  return { input_tokens: 0, output_tokens: 0 };
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
  const allEvents: any[] = [];  // 收集所有事件用于记录完整响应

  // 提取上游响应头
  const upstreamHeaders: Record<string, string> = {};
  if (response.headers) {
    for (const [key, value] of Object.entries(response.headers)) {
      upstreamHeaders[key] = String(value);
    }
  }

  // 使用 ReadableStream 包装 Node.js stream
  const nodeStream = response.data;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of nodeStream) {
          const text = chunk.toString();
          const lines = text.split('\n').filter((line: string) => line.trim());

          for (const line of lines) {
            // 处理 data: 行（支持 "data:" 和 "data: " 两种格式）
            if (line.startsWith('data:')) {
              // 提取 data 后的内容（跳过可能的空格）
              const data = line.startsWith('data: ') ? line.slice(6) : line.slice(5);

              if (data === '[DONE]') {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                continue;
              }

              try {
                const json = JSON.parse(data);
                allEvents.push(json);

                // 记录首个 token 时间（兼容多种格式）
                if (!firstTokenTime.recorded) {
                  // Claude 格式: content_block_delta 中的 delta.text 或 delta.thinking
                  const hasContent =
                    json.delta?.text ||
                    json.delta?.thinking ||
                    json.choices?.[0]?.delta?.content ||
                    json.content;
                  if (hasContent) {
                    firstTokenTime.recorded = true;
                    firstTokenTime.value = Date.now() - startTime;
                    await recordSseEvent(requestId, { type: 'first_token', latency: firstTokenTime.value });
                  }
                }

                // 提取 usage（兼容多种格式）
                const extractedUsage = extractUsageFromSse(json);
                if (extractedUsage.input_tokens > 0 || extractedUsage.output_tokens > 0) {
                  usage.input_tokens = extractedUsage.input_tokens;
                  usage.output_tokens = extractedUsage.output_tokens;
                }

                // 记录 SSE 事件
                await recordSseEvent(requestId, json);

                // 广播 SSE 事件
                broadcastSseEvent(requestId, json);
              } catch (parseError) {
                // 记录解析错误以便调试
                console.error('[SSE Parse Error] Failed to parse:', data.substring(0, 100));
              }
            }
            // 转发所有行（包括 event: 行）
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
        headers: upstreamHeaders,
        body: { usage, events: allEvents },
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
