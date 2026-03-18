import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 从 Claude Code 配置文件中加载环境变量
 */
export function loadClaudeEnv(): Record<string, string> {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);
      if (settings.env) {
        console.log('=== Loaded from Claude Code settings ===');
        return settings.env;
      }
    }
  } catch (error) {
    console.error('Failed to load Claude settings:', error);
  }
  return {};
}

/**
 * 初始化环境变量：合并 Claude Code 配置和系统环境变量
 * Claude Code 配置优先于系统环境变量
 */
export function initEnv() {
  const claudeSettings = loadClaudeEnv();

  // 直接用 Claude Code 配置覆盖系统环境变量
  for (const key of Object.keys(claudeSettings)) {
    if (claudeSettings[key]) {
      process.env[key] = claudeSettings[key];
    }
  }

  // 如果 UPSTREAM_BASE_URL 未在 Claude Code 中设置，但 ANTHROPIC_BASE_URL 设置了
  // 则将 ANTHROPIC_BASE_URL 的值复制给 UPSTREAM_BASE_URL
  if (!process.env.UPSTREAM_BASE_URL && process.env.ANTHROPIC_BASE_URL) {
    process.env.UPSTREAM_BASE_URL = process.env.ANTHROPIC_BASE_URL;
  }

  // 如果 UPSTREAM_API_KEY 未设置，但 ANTHROPIC_API_KEY 设置了
  // 则复制 ANTHROPIC_API_KEY
  if (!process.env.UPSTREAM_API_KEY && process.env.ANTHROPIC_API_KEY) {
    process.env.UPSTREAM_API_KEY = process.env.ANTHROPIC_API_KEY;
  }

  return process.env as Record<string, string>;
}