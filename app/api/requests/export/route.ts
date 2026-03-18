import { NextResponse } from 'next/server';
import { requestStore } from '@/lib/recorder';

/**
 * 导出请求数据为 JSON 或 CSV 格式
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const ids = searchParams.get('ids'); // 可选，导出指定 ID 的请求

    let requests: any[];

    if (ids) {
      // 导出指定 ID 的请求
      const idList = ids.split(',');
      requests = idList.map((id) => requestStore.findById(id.trim())).filter(Boolean) as any[];
    } else {
      // 导出最近的请求
      requests = requestStore.getRecentRequests(500);
    }

    // 转换为前端友好的格式
    const formattedRequests = requests.map((r) => ({
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

    if (format === 'csv') {
      return exportToCSV(formattedRequests);
    } else {
      return exportToJSON(formattedRequests);
    }
  } catch (error: any) {
    console.error('Failed to export requests:', error);
    return NextResponse.json({ error: error?.message || 'Failed to export requests' }, { status: 500 });
  }
}

/**
 * 导出为 JSON 格式
 */
function exportToJSON(requests: any[]) {
  const jsonContent = JSON.stringify(requests, null, 2);

  return new NextResponse(jsonContent, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="cc-inspector-requests.json"',
    },
  });
}

/**
 * 导出为 CSV 格式
 */
function exportToCSV(requests: any[]) {
  const headers = [
    'id',
    'session_id',
    'endpoint',
    'method',
    'response_status',
    'input_tokens',
    'output_tokens',
    'cache_read_tokens',
    'cache_creation_tokens',
    'latency_ms',
    'first_token_ms',
    'model',
    'cost_usd',
    'created_at',
  ];

  const rows = requests.map((r) =>
    [
      r.id,
      r.session_id || '',
      r.endpoint,
      r.method,
      r.response_status || '',
      r.input_tokens,
      r.output_tokens,
      r.cache_read_tokens,
      r.cache_creation_tokens,
      r.latency_ms || '',
      r.first_token_ms || '',
      r.model || '',
      r.cost_usd || '',
      r.created_at,
    ]
      .map((field) => {
        // 处理包含逗号或引号的字段
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="cc-inspector-requests.csv"',
    },
  });
}
