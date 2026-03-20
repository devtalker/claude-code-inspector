/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用 HMR 的自动刷新，防止 WebSocket 错误时页面重新加载
  reactStrictMode: false,
  // 开发服务器配置 - 防止页面被 unloaded
  onDemandEntries: {
    // 页面在不活动后保持活跃的毫秒数（设置为最大值）
    maxInactiveAge: 24 * 60 * 60 * 1000, // 24 小时
    // 保持多少个页面活跃
    pagesBufferLength: 10,
  },
  // 完全禁用 Fast Refresh
  compiler: {
    reactRemoveProperties: true,
  },
  // 空的 turbopack 配置，避免警告
  turbopack: {},
  //  webpack 配置
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // 禁用 HMR 的自动刷新
      config.plugins = config.plugins.filter(
        (plugin) => plugin?.constructor?.name !== 'HotModuleReplacementPlugin'
      );

      // 禁用所有文件监听
      config.watchOptions = {
        // 超长聚合延迟，等效于禁用
        aggregateTimeout: 300000, // 5 分钟
        // 忽略所有非源代码文件
        ignored: [
          '**/db/**',
          '**/*.sqlite',
          '**/*.sqlite-wal',
          '**/*.sqlite-shm',
          '**/node_modules/**',
          '**/.git/**',
          '**/*.log',
          '**/dist/**',
          '**/build/**',
          '**/*.json',
        ],
        // 禁用轮询
        poll: false,
        // 完全禁用跟随符号链接
        followSymlinks: false,
      };

      // 禁用性能监听
      config.performance = {
        hints: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
