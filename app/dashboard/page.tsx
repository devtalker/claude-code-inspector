'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import JsonViewer from '@/components/JsonViewer';
import JsonModal from '@/components/JsonModal';

interface RequestLog {
  id: string;
  session_id?: string;
  endpoint: string;
  method: string;
  response_status?: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  latency_ms?: number;
  first_token_ms?: number;
  model?: string;
  cost_usd?: number;
  created_at: string;
}

interface RequestDetail extends RequestLog {
  request_headers?: Record<string, string> | null;
  request_body?: any;
  response_headers?: Record<string, string> | null;
  response_body?: any;
  streaming_events?: any[] | null;
  error_message?: string | null;
}

export default function Dashboard() {
  const [requests, setRequests] = useState<RequestLog[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [requestDetail, setRequestDetail] = useState<RequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'request' | 'response' | 'streaming'>('request');
  const [modalData, setModalData] = useState<any>(null); // 用于浮窗显示的数据
  const [modalSnapshot, setModalSnapshot] = useState<any>(null); // 浮窗快照，防止刷新
  const [stats, setStats] = useState({ total: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 });
  const [filter, setFilter] = useState({ endpoint: '', status: '', search: '' });
  const wsRef = useRef<WebSocket | null>(null);

  // 打开浮窗时保存快照，防止后续刷新丢失状态
  const handleExpandModal = useCallback((data: any) => {
    const snapshot = JSON.parse(JSON.stringify(data));
    setModalData(data);
    setModalSnapshot(snapshot);
    isModalOpenRef.current = true;
  }, []);

  // 关闭浮窗时清除快照 - 使用 useCallback 稳定引用
  const handleCloseModal = useCallback(() => {
    setModalData(null);
    setModalSnapshot(null);
    isModalOpenRef.current = false;
  }, []);

  // 防止 WebSocket 更新时意外关闭浮窗
  // 使用 useRef 跟踪浮窗是否正在被用户查看
  const isModalOpenRef = useRef(false);

  // 获取最近请求
  const fetchRecentRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      setRequests(data);
      updateStats(data);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  // 更新统计
  const updateStats = (reqs: RequestLog[]) => {
    const total = reqs.length;
    const inputTokens = reqs.reduce((sum, r) => sum + r.input_tokens, 0);
    const outputTokens = reqs.reduce((sum, r) => sum + r.output_tokens, 0);
    const totalCost = reqs.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
    setStats({ total, inputTokens, outputTokens, totalCost } as any);
  };

  // 获取请求详情
  const fetchRequestDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/requests/${id}`);
      const data = await res.json();
      setRequestDetail(data);
    } catch (error) {
      console.error('Failed to fetch request detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // 选中请求变化时获取详情
  useEffect(() => {
    if (selectedRequest) {
      fetchRequestDetail(selectedRequest.id);
      setActiveTab('request');
    } else {
      setRequestDetail(null);
    }
  }, [selectedRequest?.id]);

  // WebSocket 连接 - 已临时注释用于测试
  // useEffect(() => {
  //   // 初始加载
  //   fetchRecentRequests();

  //   // 连接 WebSocket
  //   const connectWebSocket = () => {
  //     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  //     wsRef.current = new WebSocket(`${protocol}//${window.location.host}/api/ws`);

  //     wsRef.current.onopen = () => {
  //       console.log('WebSocket connected');
  //     };

  //     wsRef.current.onmessage = (event) => {
  //       const message: { type: string; data?: RequestLog; requestId?: string; event?: any } = JSON.parse(event.data);

  //       if (message.type === 'new_request' && message.data) {
  //         setRequests((prev) => [message.data!, ...prev]);
  //       } else if (message.type === 'request_update' && message.data) {
  //         setRequests((prev) => prev.map((r) => (r.id === message.data!.id ? message.data! : r)));
  //         // 注意：不更新 requestDetail，保持打开浮层时的数据快照
  //         // 用户可手动刷新或重新选择查看最新数据
  //       } else if (message.type === 'sse_event') {
  //         console.log('SSE Event:', message);
  //       }
  //     };

  //     wsRef.current.onclose = () => {
  //       console.log('WebSocket disconnected, reconnecting...');
  //       setTimeout(connectWebSocket, 3000);
  //     };

  //     wsRef.current.onerror = (error) => {
  //       console.error('WebSocket error:', error);
  //     };
  //   };

  //   connectWebSocket();

  //   return () => {
  //     if (wsRef.current) {
  //       wsRef.current.close();
  //     }
  //   };
  // }, []);

  // 临时替代：只加载一次数据，不连接 WebSocket
  useEffect(() => {
    fetchRecentRequests();
  }, []);

  // 过滤请求
  const filteredRequests = requests.filter((req) => {
    if (filter.endpoint && !req.endpoint.includes(filter.endpoint)) return false;
    if (filter.status && req.response_status !== parseInt(filter.status)) return false;
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      return (
        req.id.toLowerCase().includes(searchLower) ||
        req.session_id?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // 导出功能
  const exportRequests = async (format: 'json' | 'csv') => {
    const ids = filteredRequests.map((r) => r.id).join(',');
    const url = `/api/requests/export?format=${format}&ids=${encodeURIComponent(ids)}`;

    // 创建临时链接触发下载
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'json' ? 'cc-inspector-requests.json' : 'cc-inspector-requests.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 格式化时间
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  // 格式化数字
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // 格式化成本
  const formatCost = (cost: number) => {
    if (cost < 0.0001) {
      return `$${cost.toFixed(6)}`;
    } else if (cost < 0.01) {
      return `$${cost.toFixed(5)}`;
    } else if (cost < 1) {
      return `$${cost.toFixed(4)}`;
    } else {
      return `$${cost.toFixed(2)}`;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status?: number) => {
    if (!status) return 'bg-gray-400';
    if (status >= 200 && status < 300) return 'bg-green-500';
    if (status >= 400 && status < 500) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // 获取状态文本
  const getStatusText = (status: number) => {
    const statusText: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return statusText[status] || '';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 头部 */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold text-blue-400">CC Inspector</h1>
        <p className="text-sm text-gray-400 mt-1">Claude Code 请求监控面板</p>
      </header>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">总请求数</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Input Tokens</div>
          <div className="text-2xl font-bold text-green-400">{formatNumber(stats.inputTokens)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Output Tokens</div>
          <div className="text-2xl font-bold text-blue-400">{formatNumber(stats.outputTokens)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">总成本 (USD)</div>
          <div className="text-2xl font-bold text-yellow-400">${stats.totalCost.toFixed(4)}</div>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="px-6 py-2 flex gap-4 items-center">
        <input
          type="text"
          placeholder="搜索 ID 或 Session..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm flex-1 max-w-xs"
        />
        <input
          type="text"
          placeholder="端点过滤 (如/v1/messages)"
          value={filter.endpoint}
          onChange={(e) => setFilter({ ...filter, endpoint: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm w-48"
        />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm w-32"
        >
          <option value="">全部状态</option>
          <option value="200">200 OK</option>
          <option value="400">400</option>
          <option value="401">401</option>
          <option value="429">429</option>
          <option value="500">500</option>
        </select>
        <button
          onClick={() => setFilter({ endpoint: '', status: '', search: '' })}
          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
        >
          清除
        </button>
        <div className="flex-1" />
        <button
          onClick={() => exportRequests('json')}
          className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded"
        >
          导出 JSON
        </button>
        <button
          onClick={() => exportRequests('csv')}
          className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 rounded"
        >
          导出 CSV
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex h-[calc(100vh-200px)]">
        {/* 请求列表 */}
        <div className="w-1/2 border-r border-gray-700 overflow-auto">
          <div className="px-4 py-2 text-xs text-gray-500">
            显示 {filteredRequests.length} / {requests.length} 个请求
          </div>
          <table className="w-full">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">状态</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">端点</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">模型</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Tokens</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">延迟</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">成本</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req) => (
                <tr
                  key={req.id}
                  className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800 ${
                    selectedRequest?.id === req.id ? 'bg-gray-700' : ''
                  }`}
                  onClick={() => setSelectedRequest(req)}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(req.response_status)}`} />
                  </td>
                  <td className="px-4 py-3 text-sm">{req.endpoint}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {req.model || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-400">{formatNumber(req.input_tokens)}</span>
                    <span className="text-gray-500 mx-1">/</span>
                    <span className="text-blue-400">{formatNumber(req.output_tokens)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {req.latency_ms ? `${req.latency_ms}ms` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-400">
                    {req.cost_usd ? formatCost(req.cost_usd) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatTime(req.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {requests.length === 0 ? '暂无请求，请在 Claude Code 中发起请求' : '没有符合过滤条件的请求'}
            </div>
          )}
        </div>

        {/* 请求详情 */}
        <div className="w-1/2 overflow-auto p-4">
          {selectedRequest ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">请求详情</h2>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(selectedRequest.response_status)}`} />
                  <span className="text-sm">{selectedRequest.response_status || 'Pending'}</span>
                </div>
              </div>

              {/* 基本信息 */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Model:</span>
                    <span className="ml-2 font-mono">{selectedRequest.model || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Latency:</span>
                    <span className="ml-2 font-mono">{selectedRequest.latency_ms ? `${selectedRequest.latency_ms}ms` : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Input:</span>
                    <span className="ml-2 text-green-400 font-mono">{formatNumber(selectedRequest.input_tokens)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Output:</span>
                    <span className="ml-2 text-blue-400 font-mono">{formatNumber(selectedRequest.output_tokens)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Cost:</span>
                    <span className="ml-2 text-yellow-400 font-mono">{selectedRequest.cost_usd ? formatCost(selectedRequest.cost_usd) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Session:</span>
                    <span className="ml-2 font-mono text-xs">{selectedRequest.session_id?.slice(0, 8) || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Tab 导航 */}
              <div className="flex border-b border-gray-700 mb-4">
                <button
                  onClick={() => setActiveTab('request')}
                  className={`px-4 py-2 text-sm ${activeTab === 'request' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                >
                  Request
                </button>
                <button
                  onClick={() => setActiveTab('response')}
                  className={`px-4 py-2 text-sm ${activeTab === 'response' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                >
                  Response
                </button>
                <button
                  onClick={() => setActiveTab('streaming')}
                  className={`px-4 py-2 text-sm ${activeTab === 'streaming' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                >
                  Streaming
                </button>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 text-sm ${activeTab === 'overview' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                >
                  Overview
                </button>
              </div>

              {/* Tab 内容 */}
              {detailLoading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : (
                <>
                  {/* Request Tab */}
                  {activeTab === 'request' && requestDetail && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Request Body</div>
                        <JsonViewer data={requestDetail.request_body} maxHeight="400px" onExpand={handleExpandModal} />
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Request Headers</div>
                        <JsonViewer data={requestDetail.request_headers} maxHeight="200px" onExpand={handleExpandModal} />
                      </div>
                    </div>
                  )}

                  {/* Response Tab */}
                  {activeTab === 'response' && requestDetail && (
                    <div className="space-y-4">
                      {requestDetail.error_message && (
                        <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-400 text-sm">
                          Error: {requestDetail.error_message}
                        </div>
                      )}
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Response Body</div>
                        <JsonViewer data={requestDetail.response_body} maxHeight="400px" onExpand={handleExpandModal} />
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Response Headers</div>
                        <JsonViewer data={requestDetail.response_headers} maxHeight="200px" onExpand={handleExpandModal} />
                      </div>
                    </div>
                  )}

                  {/* Streaming Tab */}
                  {activeTab === 'streaming' && requestDetail && (
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Streaming Events ({requestDetail.streaming_events?.length || 0})</div>
                      {requestDetail.streaming_events && requestDetail.streaming_events.length > 0 ? (
                        <div className="space-y-2 max-h-[500px] overflow-auto">
                          {requestDetail.streaming_events.map((event: any, idx: number) => (
                            <div key={idx} className="bg-gray-800 rounded p-2">
                              <div className="text-xs text-gray-500 mb-1">Event #{idx + 1}</div>
                              <JsonViewer data={event} maxHeight="200px" onExpand={handleExpandModal} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">No streaming events</div>
                      )}
                    </div>
                  )}

                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div className="bg-gray-800 rounded-lg p-4">
                        <h3 className="text-sm font-semibold mb-3">Token 统计</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-gray-400 text-xs">Input Tokens</div>
                            <div className="text-green-400 font-mono text-lg">{formatNumber(selectedRequest.input_tokens)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Output Tokens</div>
                            <div className="text-blue-400 font-mono text-lg">{formatNumber(selectedRequest.output_tokens)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Cache Read</div>
                            <div className="text-purple-400 font-mono text-lg">{formatNumber(selectedRequest.cache_read_tokens)}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">Cache Creation</div>
                            <div className="text-orange-400 font-mono text-lg">{formatNumber(selectedRequest.cache_creation_tokens)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800 rounded-lg p-4">
                        <h3 className="text-sm font-semibold mb-3">性能指标</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-gray-400 text-xs">Latency</div>
                            <div className="font-mono text-lg">{selectedRequest.latency_ms ? `${selectedRequest.latency_ms}ms` : '-'}</div>
                          </div>
                          <div>
                            <div className="text-gray-400 text-xs">First Token</div>
                            <div className="font-mono text-lg">{selectedRequest.first_token_ms ? `${selectedRequest.first_token_ms}ms` : '-'}</div>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        <div>Request ID: {selectedRequest.id}</div>
                        <div>Created: {selectedRequest.created_at}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              选择一个请求查看详情
            </div>
          )}
        </div>
      </div>

      {/* JSON 浮窗 - 使用 key 防止重新挂载 */}
      {modalSnapshot && (
        <JsonModal key={modalSnapshot ? 'modal-active' : 'modal-closed'} data={modalSnapshot} onClose={handleCloseModal} allowClickAway={true} />
      )}
    </div>
  );
}
