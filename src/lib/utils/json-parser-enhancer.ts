/**
 * JSON 解析增强模块
 * 支持多种 JSON 格式，提高解析成功率
 * 专门针对 Agent 标准返回格式优化
 */

/**
 * 标准格式类型
 */
type StandardFormatType = 'agent-b' | 'executor' | 'unknown';

interface ParsedResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
}

interface GenericParseResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
}

interface SubTask {
  taskTitle: string;
  commandContent: string;
  executor: string;
  taskType: string;
  priority: string;
  deadline?: string;
  estimatedHours?: number;
  acceptanceCriteria?: string;
}

interface SplitResult {
  subTasks: SubTask[];
  totalDeliverables?: string;
  timeFrame?: string;
  summary?: string;
}

/**
 * JSON 解析增强器
 * 专门针对 Agent 标准返回格式优化
 */
export class JsonParserEnhancer {
  /**
   * 🔧 优化：检测标准格式类型，增加更多特征判断
   * 修复：避免因 reasoning 等字段内容包含关键词而误判格式
   */
  static detectStandardFormat(text: string): StandardFormatType {
    // 🔧 改进：使用更精确的特征检测，避免误判
    
    // 检测 Agent B 标准格式（嵌套格式）
    // 特征：type + reasonCode + reasoning + context + data
    const agentBPatterns = [
      /"type"\s*:\s*"(PASS|FAIL|NEED_USER|EXECUTE_MCP|REEXECUTE_EXECUTOR|COMPLETE)"/,
      /"reasonCode"\s*:/,
      /"reasoning"\s*:/,
      /"context"\s*:\s*\{/,
    ];
    
    const agentBMatchCount = agentBPatterns.filter(p => p.test(text)).length;
    if (agentBMatchCount >= 3) {
      console.log('[JsonParserEnhancer] 🔍 检测到 Agent B 标准格式（嵌套）');
      return 'agent-b';
    }
    
    // 检测执行 Agent 标准格式（扁平格式）
    // 特征：isCompleted + structuredResult + executionSummary + selfEvaluation + briefResponse
    const executorPatterns = [
      /"isCompleted"\s*:/,
      /"structuredResult"\s*:/,
      /"executionSummary"\s*:/,
      /"selfEvaluation"\s*:/,
      /"briefResponse"\s*:/,
      /"resultText"\s*:/,
      /"actionsTaken"\s*:/,
    ];
    
    const executorMatchCount = executorPatterns.filter(p => p.test(text)).length;
    // 🔴🔴🔴 P0-修复：只要有 isCompleted 就认为是执行 Agent 格式
    // 原因：很多执行 Agent 只返回 isCompleted + selfEvaluation + briefResponse，没有 structuredResult
    if (executorMatchCount >= 1 && /"isCompleted"\s*:/.test(text)) {
      console.log('[JsonParserEnhancer] 🔍 检测到执行 Agent 标准格式（匹配模式数:', executorMatchCount, '）');
      return 'executor';
    }
    
    // 🔧 额外检查：如果是纯 JSON 且只有一个顶层对象
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      // 检查是否包含 Agent B 格式的 type 字段
      if (/"type"\s*:\s*"(PASS|FAIL|NEED_USER|EXECUTE_MCP|REEXECUTE_EXECUTOR|COMPLETE)"/.test(text)) {
        console.log('[JsonParserEnhancer] 🔍 纯 JSON 检测为 Agent B 格式');
        return 'agent-b';
      }
      // 🔴 新增：检查是否包含 isCompleted 字段（执行 Agent 格式）
      if (/"isCompleted"\s*:/.test(text)) {
        console.log('[JsonParserEnhancer] 🔍 纯 JSON 检测为执行 Agent 格式');
        return 'executor';
      }
    }
    
    return 'unknown';
  }

  /**
   * 🔴 新增：专门针对 Agent B 标准格式的解析
   */
  static parseAgentBStandardFormat(text: string): GenericParseResult {
    const warnings: string[] = [];
    
    console.log('[JsonParserEnhancer] 🔴 使用 Agent B 标准格式专门解析');
    
    try {
      // 使用通用解析
      const result = this.parseGenericJson(text);
      
      if (result.success && result.data) {
        // 🔴🔴🔴 修复：验证 Agent B 标准格式必需字段
        // Agent B 输出格式：type, reasonCode, reasoning, decisionBasis, notCompletedReason, context, data
        const requiredFields = ['type', 'reasonCode', 'reasoning', 'context', 'data'];
        const missingFields = requiredFields.filter(field => !(field in result.data));
        
        if (missingFields.length > 0) {
          warnings.push(`Agent B 标准格式缺少字段: ${missingFields.join(', ')}`);
        }
        
        // 🔴 新增：检查新版 Agent B 格式的必需字段
        const newFormatFields = ['decisionBasis', 'notCompletedReason'];
        const missingNewFields = newFormatFields.filter(field => !(field in result.data));
        if (missingNewFields.length > 0) {
          warnings.push(`Agent B 新版格式缺少字段: ${missingNewFields.join(', ')}（不影响解析，继续处理）`);
        }
        
        console.log('[JsonParserEnhancer] ✅ Agent B 标准格式解析成功');
      }
      
      return {
        ...result,
        warnings: [...(result.warnings || []), ...warnings]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings
      };
    }
  }

  /**
   * 🔴 新增：专门针对执行 Agent 标准格式的解析
   * 🔴🔴🔴 P0-修复：优先尝试直接解析整个文本为 JSON 对象
   */
  static parseExecutorStandardFormat(text: string): GenericParseResult {
    const warnings: string[] = [];
    
    console.log('[JsonParserEnhancer] 🔴 使用执行 Agent 标准格式专门解析');
    
    try {
      // 🔴🔴🔴 P0-修复：优先尝试直接解析整个文本为 JSON 对象
      // 原因：LLM 返回的响应通常就是纯 JSON 对象，不需要复杂的提取逻辑
      const trimmedText = text.trim();
      
      // 检查是否以 { 开头且以 } 结尾（可能是有效的 JSON 对象）
      if (trimmedText.startsWith('{')) {
        // 找到第一个完整的 JSON 对象
        let depth = 0;
        let inString = false;
        let escape = false;
        let endPos = -1;
        
        for (let i = 0; i < trimmedText.length; i++) {
          const char = trimmedText[i];
          
          if (escape) {
            escape = false;
            continue;
          }
          
          if (char === '\\') {
            escape = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              if (depth === 0) {
                endPos = i;
                break;
              }
            }
          }
        }
        
        if (endPos > 0) {
          const jsonCandidate = trimmedText.substring(0, endPos + 1);
          console.log('[JsonParserEnhancer] 🔍 尝试直接解析顶层 JSON 对象，长度:', jsonCandidate.length);
          
          try {
            const data = JSON.parse(jsonCandidate);
            // 验证是否是对象且包含 isCompleted
            if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
              if ('isCompleted' in data) {
                console.log('[JsonParserEnhancer] ✅ 直接解析成功，找到 isCompleted 字段');
                return {
                  success: true,
                  data,
                  warnings: ['使用直接解析模式']
                };
              } else {
                console.log('[JsonParserEnhancer] ⚠️ 直接解析成功，但缺少 isCompleted 字段');
                warnings.push('执行 Agent 标准格式缺少字段: isCompleted');
                return {
                  success: true,
                  data,
                  warnings
                };
              }
            } else {
              console.log('[JsonParserEnhancer] ⚠️ 直接解析结果不是对象，类型:', typeof data, Array.isArray(data) ? 'array' : '');
            }
          } catch (directParseError) {
            console.log('[JsonParserEnhancer] ⚠️ 直接解析失败:', directParseError instanceof Error ? directParseError.message : String(directParseError));
          }
        }
      }
      
      // 回退到通用解析
      console.log('[JsonParserEnhancer] 🔄 回退到通用解析');
      const result = this.parseGenericJson(text);
      
      if (result.success && result.data) {
        // 验证执行 Agent 标准格式必需字段
        if (!('isCompleted' in result.data)) {
          warnings.push('执行 Agent 标准格式缺少字段: isCompleted');
        }
        
        console.log('[JsonParserEnhancer] ✅ 执行 Agent 标准格式解析成功');
      }
      
      return {
        ...result,
        warnings: [...(result.warnings || []), ...warnings]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings
      };
    }
  }

  /**
   * 🔴 新增：智能解析入口 - 自动检测格式并选择最优解析策略
   */
  static smartParse(text: string, expectedFormat?: StandardFormatType): GenericParseResult {
    console.log('[JsonParserEnhancer] 🧠 开始智能解析');
    console.log('[JsonParserEnhancer] 输入文本长度:', text.length, '字符');
    
    // 1. 检测格式类型
    const formatType = expectedFormat || this.detectStandardFormat(text);
    console.log('[JsonParserEnhancer] 检测到的格式类型:', formatType);
    
    // 2. 根据格式类型选择解析策略
    let result: GenericParseResult;
    
    switch (formatType) {
      case 'agent-b':
        result = this.parseAgentBStandardFormat(text);
        break;
      case 'executor':
        result = this.parseExecutorStandardFormat(text);
        break;
      default:
        console.log('[JsonParserEnhancer] 使用通用解析策略');
        result = this.parseGenericJson(text);
    }
    
    // 3. 如果专门解析失败，回退到通用解析
    if (!result.success && formatType !== 'unknown') {
      console.warn('[JsonParserEnhancer] ⚠️  专门解析失败，回退到通用解析');
      result = this.parseGenericJson(text);
    }
    
    console.log('[JsonParserEnhancer] 🧠 智能解析完成，结果:', {
      success: result.success,
      hasData: !!result.data,
      error: result.error,
      warningsCount: (result.warnings || []).length
    });
    
    return result;
  }
  /**
   * 🔴 新增：通用的 JSON 解析方法（适用于任何 JSON 格式）
   */
  static parseGenericJson(text: string): GenericParseResult {
    const warnings: string[] = [];

    try {
      // 1. 尝试多种提取模式（通用）
      let jsonStr = this.extractGenericJsonString(text, warnings);
      
      if (!jsonStr) {
        return {
          success: false,
          error: '未找到 JSON 数据',
          warnings,
        };
      }

      // 2. 清理和标准化 JSON 字符串
      jsonStr = this.cleanJsonString(jsonStr, warnings);

      // 3. 尝试解析 JSON
      try {
        const data = JSON.parse(jsonStr);
        return {
          success: true,
          data,
          warnings,
        };
      } catch (parseError) {
        // 🔴🔴🔴 4. 如果直接解析失败，尝试修复常见格式错误
        console.log('[JsonParserEnhancer] ⚠️  直接解析失败，尝试修复常见错误...');
        console.log('[JsonParserEnhancer] 🔴 解析错误:', parseError instanceof Error ? parseError.message : String(parseError));
        
        const repairedJson = this.repairCommonJsonErrors(jsonStr);
        
        // 5. 再次尝试解析修复后的 JSON
        try {
          const data = JSON.parse(repairedJson);
          console.log('[JsonParserEnhancer] ✅ JSON 修复成功');
          warnings.push('JSON 已自动修复');
          return {
            success: true,
            data,
            warnings,
          };
        } catch (repairError) {
          console.log('[JsonParserEnhancer] 🔴 修复后仍然失败:', repairError instanceof Error ? repairError.message : String(repairError));
          return {
            success: false,
            error: repairError instanceof Error ? repairError.message : String(repairError),
            warnings,
          };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings,
      };
    }
  }

  /**
   * 🔴 新增：通用的 JSON 字符串提取（不局限于 subTasks）
   * 🔧 修复：使用栈匹配代替贪婪正则，避免多 JSON 块干扰
   * 🔴🔴🔴 2025-04-10 修复：移除贪婪的数组匹配正则，避免匹配到 [微信公众号] 等非 JSON 内容
   */
  private static extractGenericJsonString(text: string, warnings: string[]): string | null {
    // 1. 尝试多种提取模式
    const patterns = [
      // 1. ```json\n...\n``` 标准格式
      { regex: /```json\s*\n([\s\S]*?)\n```/, name: '标准代码块' },
      // 2. ```\n...\n``` 简单代码块
      { regex: /```\s*\n([\s\S]*?)\n```/, name: '简单代码块' },
      // 🔴🔴🔴 修复：移除贪婪的数组匹配正则 `/(\[[\s\S]*\])/`
      // 问题：该正则会匹配任何以 [ 开头的文本，如 [微信公众号]、[小红书] 等
      // 解决：改用栈匹配精确提取 JSON 数组（见下方的 extractJsonArrayWithStackMatching）
    ];

    for (const { regex, name } of patterns) {
      const match = text.match(regex);
      if (match) {
        const captured = match[1] || match[0];
        if (captured && captured.trim().length > 10) {
          console.log(`🔍 [通用解析] 使用提取模式: ${name}`);
          return captured.trim();
        }
      }
    }

    // 🔴🔴🔴 P0-修复：交换顺序，JSON 对象提取优先于数组
    // 原因：大多数 Agent 响应的顶层结构是对象（如 {isCompleted: true, ...}）
    // 如果先提取数组，会错误地匹配到内部的 actionsTaken 等数组字段
    const stackResult = this.extractJsonWithStackMatching(text);
    if (stackResult) {
      console.log(`🔍 [通用解析] 使用提取模式: 栈匹配 JSON 对象`);
      return stackResult;
    }

    // 🔴 新增：使用栈匹配精确提取 JSON 数组（仅当对象提取失败时才尝试）
    const arrayResult = this.extractJsonArrayWithStackMatching(text);
    if (arrayResult) {
      console.log(`🔍 [通用解析] 使用提取模式: 栈匹配 JSON 数组`);
      return arrayResult;
    }

    return null;
  }

  /**
   * 🔴🔴🔴 新增：使用栈匹配精确提取 JSON 数组
   * 解决贪婪正则 /(\[[\s\S]*\])/ 匹配到 [微信公众号] 等非 JSON 内容的问题
   */
  private static extractJsonArrayWithStackMatching(text: string): string | null {
    // 找到第一个可能的 JSON 数组开始位置
    const firstBracket = text.indexOf('[');
    if (firstBracket === -1) {
      return null;
    }

    // 从第一个 [ 开始尝试匹配
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;
    let end = -1;

    for (let i = firstBracket; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      // 只在字符串外部处理括号
      if (!inString) {
        if (char === '[') {
          if (depth === 0) {
            start = i;
          }
          depth++;
        } else if (char === ']') {
          depth--;
          if (depth === 0) {
            end = i;
            // 找到完整的 JSON 数组
            let jsonCandidate = text.substring(start, end + 1);
            
            // 🔴🔴🔴 验证是否是有效的 JSON 数组
            // 必须以 [{ 或 [" 或 [数字 或 [true/false/null 开头（跳过空白后）
            const trimmed = jsonCandidate.substring(1).trim();
            const isValidArrayStart = 
              trimmed.startsWith('{') ||
              trimmed.startsWith('"') ||
              trimmed.startsWith('[') ||
              /^[0-9]/.test(trimmed) ||
              trimmed.startsWith('true') ||
              trimmed.startsWith('false') ||
              trimmed.startsWith('null');
            
            if (!isValidArrayStart) {
              // 不是有效的 JSON 数组开头，继续搜索
              depth = 0;
              inString = false;
              escape = false;
              continue;
            }
            
            // 尝试解析
            if (this.isValidJson(jsonCandidate)) {
              return jsonCandidate;
            }
            
            // 尝试修复后解析
            const repairedJson = this.repairCommonJsonErrors(jsonCandidate);
            if (this.isValidJson(repairedJson)) {
              console.log('[JsonParserEnhancer] ✅ JSON 数组修复成功');
              return repairedJson;
            }
            
            // 当前不是有效 JSON，继续寻找下一个可能的 JSON
            depth = 0;
            inString = false;
            escape = false;
          }
        } else if (char === '{') {
          // 嵌套对象，继续处理
        } else if (char === '}') {
          // 嵌套对象结束，继续处理
        }
      }
    }

    return null;
  }

  /**
   * 🔴🔴🔴 【新增】修复缺失的闭合括号
   * 问题：LLM 有时会忘记闭合外层对象，导致 JSON 格式错误
   * 策略：统计左右括号数量，补充缺失的闭合括号
   */
  private static fixMissingClosingBraces(jsonStr: string): string {
    let openBraces = 0;   // {
    let openBrackets = 0; // [
    let inString = false;
    let escape = false;
    
    // 先移除首尾空白
    let result = jsonStr.trim();
    
    // 统计括号
    for (let i = 0; i < result.length; i++) {
      const char = result[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
    
    // 补充缺失的闭合括号
    if (openBraces > 0) {
      const missing = '}'.repeat(openBraces);
      console.log(`🔍 [JsonParserEnhancer] 补充 ${openBraces} 个缺失的闭合大括号: ${missing}`);
      result += missing;
    }
    
    if (openBrackets > 0) {
      const missing = ']'.repeat(openBrackets);
      console.log(`🔍 [JsonParserEnhancer] 补充 ${openBrackets} 个缺失的闭合中括号: ${missing}`);
      result += missing;
    }
    
    return result;
  }

  /**
   * 🔴 新增：使用栈匹配精确提取 JSON 对象
   * 解决贪婪正则 /(\{[\s\S]*\})/ 无法处理多 JSON 块的问题
   */
  private static extractJsonWithStackMatching(text: string): string | null {
    // 找到第一个可能的 JSON 开始位置
    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) {
      return null;
    }

    // 从第一个 { 开始尝试匹配
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;
    let end = -1;

    for (let i = firstBrace; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      // 只在字符串外部处理括号
      if (!inString) {
        if (char === '{') {
          if (depth === 0) {
            start = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            // 找到完整的 JSON 对象
            let jsonCandidate = text.substring(start, end + 1);
            
            // 🔴🔴🔴 先尝试直接解析
            if (this.isValidJson(jsonCandidate)) {
              return jsonCandidate;
            }
            
            // 🔴🔴🔴 如果直接解析失败，尝试修复常见格式错误
            console.log('[JsonParserEnhancer] ⚠️  原始 JSON 解析失败，尝试修复常见错误...');
            console.log('[JsonParserEnhancer] 🔴 栈匹配到的 JSON（前 150 字符）:', jsonCandidate.substring(0, 150));
            
            // 尝试解析并获取详细错误信息
            try {
              JSON.parse(jsonCandidate);
            } catch (e) {
              console.log('[JsonParserEnhancer] 🔴 JSON 解析错误详情:', e instanceof Error ? e.message : String(e));
            }
            
            const repairedJson = this.repairCommonJsonErrors(jsonCandidate);
            if (this.isValidJson(repairedJson)) {
              console.log('[JsonParserEnhancer] ✅ JSON 修复成功');
              return repairedJson;
            }
            
            // 修复后仍然失败，打印修复后的内容
            console.log('[JsonParserEnhancer] 🔴 修复后仍然失败，修复后内容（前 150 字符）:', repairedJson.substring(0, 150));
            try {
              JSON.parse(repairedJson);
            } catch (e) {
              console.log('[JsonParserEnhancer] 🔴 修复后 JSON 解析错误详情:', e instanceof Error ? e.message : String(e));
            }
            
            // 当前不是有效 JSON，继续寻找下一个可能的 JSON
            // 重置状态，继续从当前位置之后搜索
            depth = 0;
            inString = false;
            escape = false;
          }
        }
      }
    }

    // 如果上述方法失败，使用回退策略：尝试直接匹配完整文本
    // 这是为了处理整个文本就是一个 JSON 的情况
    let trimmed = text.trim();
    console.log('[JsonParserEnhancer] 🔴 栈匹配失败，使用回退策略');
    console.log('[JsonParserEnhancer] 🔴 回退策略 - trimmed 内容（前 150 字符）:', trimmed.substring(0, 150));
    console.log('[JsonParserEnhancer] 🔴 回退策略 - trimmed 长度:', trimmed.length);
    
    if (this.isValidJson(trimmed)) {
      return trimmed;
    }
    
    // 尝试解析并获取详细错误信息
    try {
      JSON.parse(trimmed);
    } catch (e) {
      console.log('[JsonParserEnhancer] 🔴 回退策略 - trimmed JSON 解析错误详情:', e instanceof Error ? e.message : String(e));
    }
    
    // 尝试修复完整文本
    const repairedTrimmed = this.repairCommonJsonErrors(trimmed);
    if (this.isValidJson(repairedTrimmed)) {
      console.log('[JsonParserEnhancer] ✅ 完整文本 JSON 修复成功');
      return repairedTrimmed;
    }
    
    // 修复后仍然失败
    console.log('[JsonParserEnhancer] 🔴 回退策略 - 修复后仍然失败');
    console.log('[JsonParserEnhancer] 🔴 回退策略 - repairedTrimmed（前 150 字符）:', repairedTrimmed.substring(0, 150));
    try {
      JSON.parse(repairedTrimmed);
    } catch (e) {
      console.log('[JsonParserEnhancer] 🔴 回退策略 - 修复后 JSON 解析错误详情:', e instanceof Error ? e.message : String(e));
    }

    return null;
  }
  
  /**
   * 🔴 新增：修复常见的 JSON 格式错误
   * 🔴 增强：更强大的修复能力，处理 LLM 输出的各种边界情况
   */
  private static repairCommonJsonErrors(jsonStr: string): string {
    let repaired = jsonStr;
    
    // 🔴🔴🔴 调试：打印修复前的原始内容（强制输出到控制台）
    const debugPrefix = '[JsonParserEnhancer] 🔴🔴🔴';
    console.log(`${debugPrefix} 修复前原始 JSON（前 300 字符）:`, repaired.substring(0, 300));
    console.log(`${debugPrefix} 修复前位置 490-520 字符:`, repaired.substring(490, 520));
    console.log(`${debugPrefix} 修复前位置 500-510 字符:`, repaired.substring(500, 510));
    console.log(`${debugPrefix} 修复前字符码:`, repaired.split('').slice(500, 510).map(c => `${c}:${c.charCodeAt(0)}`));
    
    // 0. 🔴🔴🔴 首先移除 markdown 代码块标记
    repaired = repaired.replace(/^```json\s*/g, '');
    repaired = repaired.replace(/^```\s*/g, '');
    repaired = repaired.replace(/\s*```$/g, '');
    
    // 1. 🔴🔴🔴 新增：修复字符串中未转义的双引号（最常见的问题！）
    // 策略：逐字符扫描，识别字符串边界，转义字符串内的未转义引号
    repaired = this.escapeUnescapedQuotes(repaired);
    
    // 1.2 🔴🔴🔴 【新增】修复属性值为空的无效 JSON
    // 问题：LLM 返回 "suggestion": , 或 "result": , 导致解析失败
    // 修复：把 "xxx": , 改成 "xxx": null
    repaired = repaired.replace(/,"\s*:/g, ',null:');  // 处理中间
    repaired = repaired.replace(/:"\s*,/g, ':null,');  // 处理末尾
    
    // 1.1 🔴🔴🔴 【新增】修复字面 \\n（两个字符：反斜杠+字母n）→ 真正的换行符转义 \n
    // 问题：LLM 返回的 content 字段中包含字面 \\n，导致 JSON 解析失败
    // 正确做法：把 \\n 转换成 \n（JSON 有效转义），而不是转成真正的换行符
    repaired = repaired.replace(/\\\\n/g, '\\n');
    repaired = repaired.replace(/\\\\r/g, '\\r');
    repaired = repaired.replace(/\\\\t/g, '\\t');
    
    // 2. 修复未转义的换行符和制表符在字符串中的问题
    // 使用 [\s\S] 代替 . 来匹配任意字符（包括换行符），兼容 ES2017
    repaired = repaired.replace(/"([^"\\]|\\[\s\S])*"/g, (match) => {
      // 将字符串内的所有换行符、回车符、制表符转义
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    });
    
    // 3. 修复尾随逗号
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    
    // 🔴🔴🔴 修复：移除全局单引号转换，因为会破坏字符串内容中的单引号
    // 原问题：'([^'\\]*(\\.[^'\\]*)*)'/g 会把 HTML 内容中的 'Segoe UI' 转换成 "Segoe UI"
    // 导致 JSON 字符串值内部的双引号破坏 JSON 结构
    // 解决：不在 repairCommonJsonErrors 中进行单引号转换
    // 如果确实需要处理单引号属性名，应该在更精确的位置处理
    
    // 🔴🔴🔴 新增：修复属性名缺少引号的问题（最常见的问题之一）
    // 错误示例: { type: "EXECUTE_MCP", notCompletedReason: "..." }
    // 正确示例: { "type": "EXECUTE_MCP", "notCompletedReason": "..." }
    // 策略：只修复在冒号前面的属性名（不在字符串值内）
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    
    // 5. 修复未加引号的属性名（通用版本）
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // 6. 🔴🔴🔴 新增：修复缺失的逗号（属性之间）
    // 匹配: "value"后面直接跟着属性名的情况，补充逗号
    repaired = repaired.replace(/"(\s*)"/g, '",'); // 先处理空字符串后的逗号
    repaired = repaired.replace(/"([^"]*)"\s*\n\s*"([^"]*)":/g, '"$1",\n"$2":'); // 处理换行后缺少逗号的情况
    
    // 7. 🔴🔴🔴 新增：修复 true/false/null 拼写错误
    repaired = repaired.replace(/:\s*True\s*([,}\]])/g, ': true$1');
    repaired = repaired.replace(/:\s*False\s*([,}\]])/g, ': false$1');
    repaired = repaired.replace(/:\s*None\s*([,}\]])/g, ': null$1');
    repaired = repaired.replace(/:\s*TRUE\s*([,}\]])/g, ': true$1');
    repaired = repaired.replace(/:\s*FALSE\s*([,}\]])/g, ': false$1');
    repaired = repaired.replace(/:\s*NULL\s*([,}\]])/g, ': null$1');
    
    // 8. 🔴🔴🔴 修复：移除 JSON 对象外的多余文本
    // 找到第一个 { 和最后一个 }
    const firstBrace = repaired.indexOf('{');
    const lastBrace = repaired.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      repaired = repaired.substring(firstBrace, lastBrace + 1);
    }
    
    // 🔴🔴🔴 调试：打印修复后的内容
    console.log(`${debugPrefix} 修复后 JSON（前 300 字符）:`, repaired.substring(0, 300));
    console.log(`${debugPrefix} 修复后位置 490-520 字符:`, repaired.substring(490, 520));
    console.log(`${debugPrefix} 修复后位置 500-510 字符:`, repaired.substring(500, 510));
    console.log(`${debugPrefix} 修复后字符码:`, repaired.split('').slice(500, 510).map(c => `${c}:${c.charCodeAt(0)}`));

    // 🔴🔴🔴 【新增】修复缺失的闭合括号
    // 问题：LLM 有时会忘记闭合外层对象，导致 JSON 格式错误
    // 例如: {"a": 1, "b": 2 } 缺少最后的 }
    repaired = this.fixMissingClosingBraces(repaired);

    return repaired;
  }
  
  /**
   * 🔴 新增：转义字符串中未转义的双引号
   * 这是最常见的 JSON 错误原因
   * 
   * 🔴 改进版本：使用更可靠的判断逻辑
   * 🔴🔴🔴 2024-04-09: 针对 HTML 内容中的引号问题，改进判断逻辑
   */
  private static escapeUnescapedQuotes(jsonStr: string): string {
    let result = '';
    let inString = false;
    let escape = false;
    
    // 🔥 新增：记录当前所在的属性名（用于判断是否在 content 字段中）
    let currentPropertyName = '';
    let isInContentField = false;
    
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      
      if (escape) {
        // 当前字符是被转义的，直接添加
        result += char;
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        // 遇到反斜杠，标记下一个字符被转义
        result += char;
        escape = true;
        continue;
      }
      
      if (char === '"') {
        if (!inString) {
          // 进入字符串
          inString = true;
          result += char;
          
          // 🔥 尝试获取属性名
          let propNameEnd = i + 1;
          while (propNameEnd < jsonStr.length && jsonStr[propNameEnd] !== '"' && jsonStr[propNameEnd] !== ':') {
            propNameEnd++;
          }
          const propNameMatch = jsonStr.substring(i + 1, propNameEnd);
          if (propNameMatch && !propNameMatch.includes(' ') && propNameMatch.length < 50) {
            currentPropertyName = propNameMatch;
          }
        } else {
          // 在字符串内遇到引号，需要判断是字符串结束还是内容中的引号
          
          // 先跳过空白字符
          let j = i + 1;
          while (j < jsonStr.length && (jsonStr[j] === ' ' || jsonStr[j] === '\t')) {
            j++;
          }
          const charAfterSpaces = jsonStr[j];
          
          // 🔥 改进：增加更多有效结束的判断条件
          // 如果后面紧跟的是 JSON 结构字符，则认为是字符串结束
          const isValidEnd = 
            charAfterSpaces === ':' ||    // 属性名结束
            charAfterSpaces === ',' ||    // 属性值结束，后面还有
            charAfterSpaces === '}' ||    // 对象结束
            charAfterSpaces === ']' ||    // 数组结束
            charAfterSpaces === '\n' ||   // 换行（可能是格式化的 JSON）
            charAfterSpaces === '\r' ||   // 回车
            charAfterSpaces === undefined || // 字符串结束
            charAfterSpaces === '';       // 字符串结束
          
          // 🔥🔥🔥 新增：如果当前在 content 字段中，使用更宽松的判断
          // content 字段通常包含 HTML，HTML 中的引号后面可能紧跟各种字符
          // 只有在明确的结构字符后面才认为是字符串结束
          if (isValidEnd) {
            // 这是字符串结束
            inString = false;
            result += char;
            isInContentField = false;
          } else if (currentPropertyName === 'content') {
            // 🔥🔥🔥 在 content 字段中，假设引号是 HTML 内容的一部分，转义它
            // 但要检查是否到达了 content 字段的末尾（后面应该是 , 或 }）
            // 检查更长的上下文：如果后面很近（比如20个字符内）有 } 或 ,"，可能是真正的结束
            const nearbyContext = jsonStr.substring(i + 1, i + 30);
            const hasNearbyEnd = /[,\}]"\s*$/.test(nearbyContext) || /"\s*[,}]/.test(nearbyContext.substring(0, 20));
            
            if (hasNearbyEnd && (charAfterSpaces === ' ' || charAfterSpaces === '\n')) {
              // 可能是真正的结束
              inString = false;
              result += char;
              isInContentField = false;
            } else {
              // 这是 HTML 内容中的引号，需要转义
              console.log('[JsonParserEnhancer] 🔴 content 字段中的引号被转义，位置:', i);
              result += '\\"';
            }
          } else {
            // 这是字符串内的未转义引号，需要转义
            console.log('[JsonParserEnhancer] 🔴 检测到未转义的引号在位置', i, '后面字符:', jsonStr[i + 1], '跳过空白后:', charAfterSpaces);
            result += '\\"';
          }
        }
        continue;
      }
      
      // 🔥 检测是否进入 content 字段
      if (!inString && char === ':' && currentPropertyName === 'content') {
        isInContentField = true;
      }
      
      // 其他字符直接添加
      result += char;
    }
    
    return result;
  }

  /**
   * 🔴 新增：验证字符串是否是有效的 JSON
   */
  private static isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 从文本中解析拆解结果 JSON
   */
  static parseSplitResult(text: string): ParsedResult {
    const warnings: string[] = [];

    try {
      // 1. 尝试多种提取模式
      let jsonStr = this.extractJsonString(text, warnings);
      
      if (!jsonStr) {
        return {
          success: false,
          error: '未找到 JSON 数据',
          warnings,
        };
      }

      // 2. 清理和标准化 JSON 字符串
      jsonStr = this.cleanJsonString(jsonStr, warnings);

      // 3. 尝试解析 JSON
      let data = JSON.parse(jsonStr);

      // 4. 验证和转换数据结构
      const result = this.validateAndTransform(data, warnings);

      return {
        success: true,
        data: result,
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings,
      };
    }
  }

  /**
   * 提取 JSON 字符串
   */
  private static extractJsonString(text: string, warnings: string[]): string | null {
    const patterns = [
      // 1. ```json\n...\n``` 标准格式
      { regex: /```json\s*\n([\s\S]*?)\n```/, name: '标准代码块' },
      // 2. ```\n...\n``` 简单代码块
      { regex: /```\s*\n([\s\S]*?)\n```/, name: '简单代码块' },
      // 3. { "subTasks": ... } 直接 JSON 对象
      { regex: /\{[\s\S]*"subTasks"[\s\S]*\}/, name: '直接 JSON 对象' },
      // 4. [ {...}, {...} ] 直接 JSON 数组（仅包含 subTasks）
      { regex: /(\[[\s\S]*\])/, name: '直接 JSON 数组' },
    ];

    for (const { regex, name } of patterns) {
      const match = text.match(regex);
      if (match) {
        const captured = match[1] || match[0];
        if (captured && captured.trim().length > 10) {
          console.log(`🔍 使用提取模式: ${name}`);
          return captured.trim();
        }
      }
    }

    // 5. 如果上述方法都失败，尝试从文本中提取可能的 JSON 片段
    return this.tryExtractJsonFragments(text, warnings);
  }

  /**
   * 尝试从文本中提取 JSON 片段
   */
  private static tryExtractJsonFragments(text: string, warnings: string[]): string | null {
    // 尝试提取子任务数组
    const subTasksMatch = text.match(/"subTasks"\s*:\s*(\[[\s\S]*?\])/);
    if (subTasksMatch) {
      warnings.push('仅提取到 subTasks 字段，其他字段将使用默认值');
      return `{ "subTasks": ${subTasksMatch[1]} }`;
    }

    // 尝试提取可能的数组模式（如：[ {...}, {...} ]）
    const arrayMatch = text.match(/(\[\s*\{[\s\S]*\}\s*\])/);
    if (arrayMatch) {
      warnings.push('仅提取到数组，将作为 subTasks 处理');
      return `{ "subTasks": ${arrayMatch[1]} }`;
    }

    return null;
  }

  /**
   * 清理和标准化 JSON 字符串
   */
  private static cleanJsonString(jsonStr: string, warnings: string[]): string {
    let cleaned = jsonStr;

    // 1. 移除注释（// 和 /* */）
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

    // 2. 移除尾随逗号（JSON 不支持）
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    // 🔴🔴🔴 修复：移除全局单引号转换，因为会破坏字符串内容中的单引号
    // 原问题：'([^']*)'/g 会把 HTML 内容中的 'Segoe UI' 转换成 "Segoe UI"
    // 导致 JSON 字符串值内部的双引号破坏 JSON 结构
    // 解决：不在 cleanJsonString 中进行单引号转换，只在 repairCommonJsonErrors 中
    // 对明确的属性名单引号进行转换

    // 4. 修复可能的非标准属性名（如不使用引号的属性名）
    cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // 5. 🔧 修复：智能处理换行符 - 保留引号内的换行符，将引号外的换行转为空格
    // 问题场景：reasoning 字段中的 \n 需要保留，但外部的换行需要处理
    cleaned = this.smartHandleNewlines(cleaned, warnings);

    // 6. 移除多余的空白字符（但保留引号内的必要空格）
    // 注意：这里不使用全局空格替换，而是使用更智能的方式
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    if (jsonStr !== cleaned) {
      // 🔴🔴🔴 优化：只在 JSON 实际被修改时才添加警告，并说明具体修改
      const changes: string[] = [];
      if (jsonStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '') !== jsonStr) {
        changes.push('移除注释');
      }
      if (jsonStr.replace(/,\s*([}\]])/g, '$1') !== jsonStr) {
        changes.push('移除尾随逗号');
      }
      if (this.smartHandleNewlines(jsonStr, []) !== jsonStr) {
        changes.push('处理换行符');
      }
      if (jsonStr.replace(/\s+/g, ' ').trim() !== jsonStr) {
        changes.push('压缩空白');
      }
      
      if (changes.length > 0) {
        warnings.push(`JSON 标准化: ${changes.join(', ')}`);
      }
    }

    return cleaned;
  }

  /**
   * 🔧 新增：智能处理换行符
   * 问题：Agent T 生成的 reasoning 字段包含未转义的换行符
   * 解决：保留引号内的换行符，将引号外的换行转为空格或移除
   */
  private static smartHandleNewlines(jsonStr: string, warnings: string[]): string {
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (escape) {
        result += char;
        escape = false;
        continue;
      }

      if (char === '\\') {
        result += char;
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      // 在字符串内部，保留所有字符（包括换行符）
      if (inString) {
        result += char;
        continue;
      }

      // 在字符串外部，处理换行符
      if (char === '\n' || char === '\r') {
        // 跳过连续的换行符
        if (result.length > 0 && result[result.length - 1] !== ' ' && result[result.length - 1] !== '\n') {
          result += ' ';
        }
        continue;
      }

      result += char;
    }

    // 清理多余空格
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * 验证和转换数据结构
   */
  private static validateAndTransform(data: any, warnings: string[]): SplitResult {
    const result: SplitResult = {
      subTasks: [],
    };

    // 情况1：直接是数组
    if (Array.isArray(data)) {
      result.subTasks = this.normalizeSubTasks(data, warnings);
      warnings.push('输入为直接数组，已转换为 subTasks');
    }
    // 情况2：包含 subTasks 字段的对象
    else if (data.subTasks && Array.isArray(data.subTasks)) {
      result.subTasks = this.normalizeSubTasks(data.subTasks, warnings);
      result.totalDeliverables = data.totalDeliverables || String(data.subTasks.length);
      result.timeFrame = data.timeFrame || '';
      result.summary = data.summary || '';
    }
    // 情况3：其他格式，尝试提取可能的子任务
    else {
      warnings.push('数据格式不符合预期，尝试提取子任务');
      const possibleSubTasks = this.extractPossibleSubTasks(data);
      if (possibleSubTasks.length > 0) {
        result.subTasks = possibleSubTasks;
      }
    }

    // 验证必填字段
    if (result.subTasks.length === 0) {
      throw new Error('未找到有效的 subTasks 数据');
    }

    return result;
  }

  /**
   * 标准化子任务数组
   */
  private static normalizeSubTasks(subTasks: any[], warnings: string[]): SubTask[] {
    const normalized: SubTask[] = [];

    for (const task of subTasks) {
      if (!task || typeof task !== 'object') {
        warnings.push('跳过无效的子任务');
        continue;
      }

      normalized.push({
        taskTitle: task.taskTitle || task.title || task.task || '未命名任务',
        commandContent: task.commandContent || task.command || task.description || task.content || '',
        executor: task.executor || task.agent || task.assignee || task.agentId || 'insurance-c',
        taskType: task.taskType || task.type || '内容生产',
        priority: task.priority || '中',
        deadline: task.deadline || task.dueDate || '',
        estimatedHours: task.estimatedHours || task.hours || task.duration || undefined,
        acceptanceCriteria: task.acceptanceCriteria || task.criteria || task.acceptance || '',
      });
    }

    return normalized;
  }

  /**
   * 尝试从非标准数据结构中提取子任务
   */
  private static extractPossibleSubTasks(data: any): SubTask[] {
    const subTasks: SubTask[] = [];

    // 如果数据包含 tasks 字段
    if (data.tasks && Array.isArray(data.tasks)) {
      return this.normalizeSubTasks(data.tasks, []);
    }

    // 如果数据包含 items 字段
    if (data.items && Array.isArray(data.items)) {
      return this.normalizeSubTasks(data.items, []);
    }

    // 尝试将对象的每个值作为子任务
    if (typeof data === 'object' && data !== null) {
      const tasks = Object.values(data).filter(v => typeof v === 'object' && v !== null);
      if (tasks.length > 0) {
        return this.normalizeSubTasks(tasks as any[], []);
      }
    }

    return subTasks;
  }

  /**
   * 生成格式错误提示信息
   */
  static generateFormatErrorFeedback(error: string, warnings: string[]): string {
    let feedback = `【格式错误纠正提示】\n\n`;
    feedback += `你的拆解结果格式不符合要求，请按照以下格式重新生成：\n\n`;
    
    feedback += `错误原因：${error}\n\n`;
    
    if (warnings.length > 0) {
      feedback += `警告信息：\n`;
      warnings.forEach(w => feedback += `- ${w}\n`);
      feedback += `\n`;
    }

    feedback += `【样例说明】\n`;
    feedback += `这是一个将任务拆分成 3 天的 JSON 样例，请参考此格式生成你的拆解结果：\n\n`;
    feedback += `\`\`\`json\n`;
    feedback += `{\n`;
    feedback += `  "totalDeliverables": "3",\n`;
    feedback += `  "timeFrame": "3天",\n`;
    feedback += `  "summary": "将保险爆文筛选任务拆解为3个每日子任务",\n`;
    feedback += `  "subTasks": [\n`;
    feedback += `    {\n`;
    feedback += `      "taskTitle": "第1天：筛选保险爆文",\n`;
    feedback += `      "commandContent": "从公众号全平台筛选2篇近3个月内阅读量≥10万的保险爆文",\n`;
    feedback += `      "executor": "insurance-c",\n`;
    feedback += `      "taskType": "内容生产",\n`;
    feedback += `      "priority": "高",\n`;
    feedback += `      "deadline": "2026-06-26",\n`;
    feedback += `      "estimatedHours": 4,\n`;
    feedback += `      "acceptanceCriteria": "筛选结果清单（包含爆文标题、阅读量、点赞数、评论数）+ 数据截图"\n`;
    feedback += `    },\n`;
    feedback += `    {\n`;
    feedback += `      "taskTitle": "第2天：分析爆文特征",\n`;
    feedback += `      "commandContent": "分析爆文特征，输出《爆文复用运营计划初稿》",\n`;
    feedback += `      "executor": "insurance-c",\n`;
    feedback += `      "taskType": "内容生产",\n`;
    feedback += `      "priority": "高",\n`;
    feedback += `      "deadline": "2026-06-27",\n`;
    feedback += `      "estimatedHours": 6,\n`;
    feedback += `      "acceptanceCriteria": "《爆文复用运营计划初稿》（包含爆文特征拆解、推送策略、获流玩法）"\n`;
    feedback += `    },\n`;
    feedback += `    {\n`;
    feedback += `      "taskTitle": "第3天：优化运营计划",\n`;
    feedback += `      "commandContent": "优化运营计划，输出最终版《爆文复用运营落地计划》",\n`;
    feedback += `      "executor": "insurance-c",\n`;
    feedback += `      "taskType": "内容生产",\n`;
    feedback += `      "priority": "高",\n`;
    feedback += `      "deadline": "2026-06-28",\n`;
    feedback += `      "estimatedHours": 8,\n`;
    feedback += `      "acceptanceCriteria": "《爆文复用运营落地计划》+《执行SOP》+ 落地准备验收清单"\n`;
    feedback += `    }\n`;
    feedback += `  ]\n`;
    feedback += `}\n`;
    feedback += `\`\`\`\n\n`;

    feedback += `【重要提示】\n`;
    feedback += `1. 必须包含 subTasks 字段，且是数组\n`;
    feedback += `2. executor 必须是有效的 Agent ID（insurance-c、insurance-d 等）\n`;
    feedback += `3. priority 必须是：高、中、低\n`;
    feedback += `4. estimatedHours 必须是数字，不是字符串\n`;
    feedback += `5. 只返回 JSON 数据，不要包含其他文字说明\n`;
    feedback += `6. 请参考上述 3 天拆解样例的格式和结构\n`;

    return feedback;
  }
}
