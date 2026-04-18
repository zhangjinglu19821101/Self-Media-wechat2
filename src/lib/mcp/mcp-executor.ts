/**
 * MCP 执行器基础模块
 * 提供通用的 MCP 能力执行逻辑，所有 MCP 能力都基于此实现
 *
 * 设计原则：
 * 1. 易读：代码结构清晰，注释完善
 * 2. 易维护：通用逻辑抽离，具体能力只需实现特定接口
 * 3. 易扩展：新增 MCP 能力只需添加新的实现类
 */

import {
  AgentBResponse,
  AgentResponseSpec,
  MCPExecutionResult,
  MCPCallContext,
  ValidationResult,
} from './types';

/**
 * MCP 能力执行器基类
 * 所有具体的 MCP 能力都需要继承此类并实现 execute 方法
 */
export abstract class BaseMCPCapabilityExecutor {
  /**
   * 能力 ID（对应 capability_list 表的 id）
   */
  abstract readonly capabilityId: number;

  /**
   * 能力名称
   */
  abstract readonly capabilityName: string;

  /**
   * 执行 MCP 能力（具体实现由子类提供）
   * @param params 从 Agent B 返回中提取的参数
   * @returns MCP 执行结果
   */
  protected abstract execute(params: Record<string, any>): Promise<MCPExecutionResult>;

  /**
   * 验证 Agent B 返回的指令（通用逻辑）
   * @param agentBResponse Agent B 返回的指令
   * @param spec agent_response_spec 规范
   * @returns 验证结果
   */
  validateAgentResponse(
    agentBResponse: AgentBResponse,
    spec: AgentResponseSpec
  ): ValidationResult {
    // 1. 校验必填参数
    for (const param of spec.required_params) {
      // 如果参数是 optional 的，跳过校验
      if ((param as any).optional) {
        continue;
      }

      if (!agentBResponse[param.param_name]) {
        return {
          valid: false,
          msg: `缺少必填参数：${param.param_name}`,
        };
      }

      // 校验参数类型
      const actualType = typeof agentBResponse[param.param_name];
      if (actualType !== param.param_type) {
        return {
          valid: false,
          msg: `${param.param_name} 类型错误，需为 ${param.param_type}，实际为 ${actualType}`,
        };
      }
    }

    // 2. 校验通过
    return { valid: true, msg: '指令合规' };
  }

  /**
   * 从 Agent B 返回中提取参数（通用逻辑）
   * @param agentBResponse Agent B 返回的指令
   * @param spec agent_response_spec 规范
   * @returns 提取后的参数
   */
  extractParams(
    agentBResponse: AgentBResponse,
    spec: AgentResponseSpec
  ): Record<string, any> {
    const params: Record<string, any> = {};

    spec.required_params.forEach((param) => {
      params[param.param_name] = agentBResponse[param.param_name];
    });

    return params;
  }

  /**
   * 完整的 MCP 调用流程（模板方法）
   * @param context MCP 调用上下文
   * @param spec agent_response_spec 规范
   * @returns MCP 执行结果
   */
  async call(
    context: MCPCallContext,
    spec: AgentResponseSpec
  ): Promise<MCPExecutionResult> {
    const startTime = new Date();

    console.log(`[MCP Executor] 开始执行能力：${this.capabilityName} (ID: ${this.capabilityId})`);
    console.log(`[MCP Executor] Agent B 返回：`, JSON.stringify(context.agentBResponse));

    try {
      // 步骤 1：验证 Agent B 指令
      console.log(`[MCP Executor] 步骤 1：验证 Agent B 指令...`);
      const validationResult = this.validateAgentResponse(context.agentBResponse, spec);

      if (!validationResult.valid) {
        console.error(`[MCP Executor] 验证失败：${validationResult.msg}`);
        return {
          success: false,
          error: validationResult.msg,
          executionTime: new Date().toISOString(),
        };
      }

      console.log(`[MCP Executor] 验证通过`);

      // 步骤 2：提取参数
      console.log(`[MCP Executor] 步骤 2：提取参数...`);
      const params = this.extractParams(context.agentBResponse, spec);
      console.log(`[MCP Executor] 提取的参数：`, JSON.stringify(params));

      // 步骤 3：执行具体的 MCP 能力（由子类实现）
      console.log(`[MCP Executor] 步骤 3：执行 MCP 能力...`);
      const result = await this.execute(params);

      // 补充执行时间
      result.executionTime = new Date().toISOString();

      console.log(`[MCP Executor] 执行完成，结果：`, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error(`[MCP Executor] 执行异常：`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executionTime: new Date().toISOString(),
      };
    } finally {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      console.log(`[MCP Executor] 总耗时：${duration}ms`);
    }
  }
}

/**
 * MCP 执行器工厂
 * 用于根据 capabilityId 获取对应的执行器
 */
export class MCPCapabilityExecutorFactory {
  private static executors: Map<number, BaseMCPCapabilityExecutor> = new Map();

  /**
   * 注册 MCP 能力执行器
   * @param executor 执行器实例
   */
  static registerExecutor(executor: BaseMCPCapabilityExecutor): void {
    MCPCapabilityExecutorFactory.executors.set(executor.capabilityId, executor);
    console.log(`[MCP Factory] 注册执行器：${executor.capabilityName} (ID: ${executor.capabilityId})`);
  }

  /**
   * 根据 capabilityId 获取执行器
   * @param capabilityId 能力 ID
   * @returns 执行器实例，找不到返回 undefined
   */
  static getExecutor(capabilityId: number): BaseMCPCapabilityExecutor | undefined {
    return MCPCapabilityExecutorFactory.executors.get(capabilityId);
  }

  /**
   * 获取所有已注册的执行器
   * @returns 执行器列表
   */
  static getAllExecutors(): BaseMCPCapabilityExecutor[] {
    return Array.from(MCPCapabilityExecutorFactory.executors.values());
  }
}
