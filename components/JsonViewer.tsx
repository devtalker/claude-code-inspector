'use client';

import { useState } from 'react';

interface JsonViewerProps {
  data: any;
  maxHeight?: string;
  onExpand?: (data: any) => void;
}

// 语法高亮颜色
const colors = {
  key: 'text-purple-400',
  string: 'text-green-400',
  number: 'text-yellow-400',
  boolean: 'text-blue-400',
  null: 'text-gray-500',
  bracket: 'text-white',
};

// 格式化 JSON 并添加语法高亮
function highlightJson(value: any, indent: number = 0): string {
  if (value === null) {
    return `<span class="${colors.null}">null</span>`;
  }

  if (typeof value === 'boolean') {
    return `<span class="${colors.boolean}">${value}</span>`;
  }

  if (typeof value === 'number') {
    return `<span class="${colors.number}">${value}</span>`;
  }

  if (typeof value === 'string') {
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<span class="${colors.string}">"${escaped}"</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `<span class="${colors.bracket}">[]</span>`;
    return `<span class="${colors.bracket}">[...]</span>`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return `<span class="${colors.bracket}">{}</span>`;
    return `<span class="${colors.bracket}">{...}</span>`;
  }

  return String(value);
}

interface JsonNodeProps {
  keyName?: string;
  value: any;
  depth: number;
  defaultExpanded?: boolean;
  maxDepth?: number;
}

function JsonNode({ keyName, value, depth, defaultExpanded = false, maxDepth = 3 }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < maxDepth);

  const isExpandable = value !== null && (Array.isArray(value) || typeof value === 'object');
  const isEmpty = isExpandable && (
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );

  // 简单值或空对象/数组
  if (!isExpandable || isEmpty) {
    return (
      <div className="flex items-start">
        {keyName !== undefined && (
          <span className={`${colors.key} mr-2`}>{`"${keyName}":`}</span>
        )}
        <span className={getValueColor(value)}>
          {isEmpty ? (Array.isArray(value) ? '[]' : '{}') : formatSimpleValue(value)}
        </span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [i, v] as [number, any])
    : Object.entries(value);

  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-500 hover:text-white mr-1 w-4 text-center select-none"
        >
          {expanded ? '▼' : '▶'}
        </button>
        {keyName !== undefined && (
          <span className={`${colors.key} mr-2`}>{`"${keyName}":`}</span>
        )}
        <span className={colors.bracket}>
          {expanded ? (Array.isArray(value) ? '[' : '{') : `${Array.isArray(value) ? '[' : '{'}${entries.length}${Array.isArray(value) ? ']' : '}'}`}
        </span>
      </div>

      {expanded && (
        <>
          <div className="ml-4 border-l border-gray-700 pl-2">
            {entries.map(([k, v], idx) => (
              <JsonNode
                key={idx}
                keyName={typeof k === 'string' ? k : undefined}
                value={v}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </div>
          <span className={colors.bracket}>{Array.isArray(value) ? ']' : '}'}</span>
        </>
      )}
    </div>
  );
}

function getValueColor(value: any): string {
  if (value === null) return colors.null;
  if (typeof value === 'boolean') return colors.boolean;
  if (typeof value === 'number') return colors.number;
  if (typeof value === 'string') return colors.string;
  return '';
}

function formatSimpleValue(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

export default function JsonViewer({ data, maxHeight = '400px', onExpand }: JsonViewerProps) {
  if (data === null || data === undefined) {
    return <div className="text-gray-500 text-sm">No data</div>;
  }

  return (
    <div className="relative">
      {/* 展开/复制按钮 */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {onExpand && (
          <button
            onClick={() => onExpand(data)}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
            title="放大查看"
          >
            ⛶
          </button>
        )}
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
          }}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          title="复制"
        >
          📋
        </button>
      </div>

      {/* JSON 内容 */}
      <div
        className="bg-gray-800 rounded p-3 font-mono text-xs overflow-auto"
        style={{ maxHeight }}
      >
        <JsonNode value={data} depth={0} />
      </div>
    </div>
  );
}

// 导出 JsonNode 供外部使用
export { JsonNode };