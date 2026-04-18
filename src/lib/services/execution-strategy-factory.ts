
/**
 * 执行策略工厂
 * 
 * 根据配置创建对应的执行策略
 */

import { 
  SubtaskExecutionStrategy, 
  ExecutionStrategyType 
} from './subtask-execution-strategy';
import { MockExecutionStrategy } from './mock-execution-strategy';
import { RealExecutionStrategy } from './real-execution-strategy';

/**
 * 执行策略配置
 */
export interface ExecutionStrategyConfig {
  /**
   * 使用的策略类型
   */
  strategyType: ExecutionStrategyType;

  /**
   * 是否启用 Mock（通过环境变量）
   */
  useMock: boolean;
}

/**
 * 执行策略工厂
 */
export class ExecutionStrategyFactory {
  private static instance: ExecutionStrategyFactory;
  private currentStrategy: SubtaskExecutionStrategy;
  private config: ExecutionStrategyConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.currentStrategy = this.createStrategy(this.config.strategyType);
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ExecutionStrategyFactory {
    if (!ExecutionStrategyFactory.instance) {
      ExecutionStrategyFactory.instance = new ExecutionStrategyFactory();
    }
    return ExecutionStrategyFactory.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): ExecutionStrategyConfig {
    // 1. 优先从环境变量读取
    const useMockFromEnv = process.env.SUBTASK_USE_MOCK === 'true';
    
    // 2. 默认使用真实策略，只有当 SUBTASK_USE_MOCK=true 时才使用 Mock
    const strategyType: ExecutionStrategyType = useMockFromEnv ? 'mock' : 'real';

    return {
      strategyType,
      useMock: useMockFromEnv,
    };
  }

  /**
   * 创建策略
   */
  private createStrategy(type: ExecutionStrategyType): SubtaskExecutionStrategy {
    switch (type) {
      case 'mock':
        console.log(`[StrategyFactory] 使用 Mock 执行策略`);
        return new MockExecutionStrategy();
      case 'real':
        console.log(`[StrategyFactory] 使用真实执行策略`);
        return new RealExecutionStrategy();
      default:
        console.warn(`[StrategyFactory] 未知策略类型: ${type}, 默认使用 Mock`);
        return new MockExecutionStrategy();
    }
  }

  /**
   * 获取当前策略
   */
  getStrategy(): SubtaskExecutionStrategy {
    return this.currentStrategy;
  }

  /**
   * 获取配置
   */
  getConfig(): ExecutionStrategyConfig {
    return this.config;
  }

  /**
   * 切换策略
   */
  switchStrategy(type: ExecutionStrategyType): void {
    console.log(`[StrategyFactory] 切换策略: ${this.config.strategyType} -> ${type}`);
    this.config.strategyType = type;
    this.currentStrategy = this.createStrategy(type);
  }

  /**
   * 重新加载配置
   */
  reloadConfig(): void {
    console.log(`[StrategyFactory] 重新加载配置`);
    this.config = this.loadConfig();
    this.currentStrategy = this.createStrategy(this.config.strategyType);
  }
}

/**
 * 便捷函数：获取当前策略
 */
export function getExecutionStrategy(): SubtaskExecutionStrategy {
  return ExecutionStrategyFactory.getInstance().getStrategy();
}

/**
 * 便捷函数：切换到 Mock 策略
 */
export function useMockStrategy(): void {
  ExecutionStrategyFactory.getInstance().switchStrategy('mock');
}

/**
 * 便捷函数：切换到真实策略
 */
export function useRealStrategy(): void {
  ExecutionStrategyFactory.getInstance().switchStrategy('real');
}

