/**
 * Anthropic API 定价 (每 1M tokens)
 * 参考：https://www.anthropic.com/pricing
 */
export interface ModelPricing {
  input: number; // 每 1M input tokens 的价格 (USD)
  output: number; // 每 1M output tokens 的价格 (USD)
  cacheRead?: number; // 每 1M cache read tokens 的价格 (USD)
  cacheCreation?: number; // 每 1M cache creation tokens 的价格 (USD)
}

export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  // Claude 3.7 Sonnet
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  'claude-3-7-sonnet-20250219': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  // Claude 3.5 Sonnet
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  'claude-3-5-sonnet-20240620': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': {
    input: 1.0,
    output: 5.0,
    cacheRead: 0.1,
    cacheCreation: 1.25,
  },
  // Claude 3 Opus
  'claude-3-opus-20240229': {
    input: 15.0,
    output: 75.0,
    cacheRead: 1.5,
    cacheCreation: 18.75,
  },
  // Claude 3 Haiku
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25,
    cacheRead: 0.025,
    cacheCreation: 0.3125,
  },
};

/**
 * 默认定价 (如果使用未知模型)
 */
const DEFAULT_PRICING: ModelPricing = {
  input: 3.0,
  output: 15.0,
  cacheRead: 0.3,
  cacheCreation: 3.75,
};

/**
 * 根据模型名称获取定价
 */
export function getModelPricing(model: string): ModelPricing {
  // 尝试精确匹配
  if (ANTHROPIC_PRICING[model]) {
    return ANTHROPIC_PRICING[model];
  }

  // 尝试模糊匹配
  for (const [key, pricing] of Object.entries(ANTHROPIC_PRICING)) {
    if (model.includes(key) || key.includes(model)) {
      return pricing;
    }
  }

  // 返回默认定价
  return DEFAULT_PRICING;
}

/**
 * 计算请求成本 (USD)
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheCreationTokens: number = 0
): number {
  const pricing = getModelPricing(model);

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * (pricing.cacheRead || 0);
  const cacheCreationCost = (cacheCreationTokens / 1_000_000) * (pricing.cacheCreation || 0);

  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}

/**
 * 格式化成本为美元字符串
 */
export function formatCost(cost: number): string {
  if (cost < 0.0001) {
    return `$${cost.toFixed(6)}`;
  } else if (cost < 0.01) {
    return `$${cost.toFixed(5)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(4)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}
