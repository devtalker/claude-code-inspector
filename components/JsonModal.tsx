'use client';

import React, { useState } from 'react';

// 语法高亮颜色
const colors = {
  key: 'text-purple-400',
  string: 'text-green-400',
  number: 'text-yellow-400',
  boolean: 'text-blue-400',
  null: 'text-gray-500',
  bracket: 'text-white',
};

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

interface JsonModalProps {
  data: any;
  onClose: () => void;
  allowClickAway?: boolean; // 是否允许点击背景关闭，默认 false（防止 WebSocket 更新时意外关闭）
}

const JsonModal = React.memo<JsonModalProps>(function JsonModal({ data, onClose, allowClickAway = false }) {
  const handleBackgroundClick = () => {
    if (allowClickAway) {
      onClose();
    }
    // 如果 allowClickAway 为 false，点击背景不执行任何操作
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleBackgroundClick}
    >
      <div
        className="bg-gray-900 rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">JSON Viewer</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(data, null, 2));
              }}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            >
              复制
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            >
              关闭
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          <div className="font-mono text-sm">
            <JsonNode value={data} depth={0} maxDepth={10} defaultExpanded={true} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default JsonModal;