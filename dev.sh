#!/bin/bash

# 快速开发脚本 - 使用生产构建避免自动刷新

echo "=== 构建生产版本 ==="
npm run build

if [ $? -ne 0 ]; then
  echo "构建失败!"
  exit 1
fi

echo ""
echo "=== 启动生产服务器 ==="
echo "访问 http://localhost:3000/dashboard"
echo "按 Ctrl+C 停止服务器"
echo ""

NODE_ENV=production npm start
