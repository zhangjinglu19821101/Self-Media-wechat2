/**
 * 创作引导安全工具函数 - 优化版本
 * 
 * 解决问题：
 * - 大纲模板字符串注入风险
 * - 用户输入净化
 * - 安全的数据序列化
 */

/**
 * 安全的文本截断函数
 */
export function safeTruncate(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 安全的文本净化函数（移除潜在的XSS风险字符）
 * 注意：React的JSX已做转义，此函数用于额外防护
 */
export function sanitizeTemplateInput(text: string): string {
  if (!text) return '';
  
  // 重要：必须先替换 &，否则后续替换产生的 &lt; 等会被二次编码为 &amp;lt;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 安全的大纲模板生成（适配多结构版本）
 * 
 * 根据传入的结构模板动态生成大纲，不再硬编码7段
 */
interface OutlineTemplateData {
  openingCase: string;
  coreViewpoint: string;
  endingConclusion: string;
  keyMaterials?: string;
  relatedMaterials?: string;
  targetWordCount: string;
  structure?: import('./types').StructureTemplate;
}

export function generateSafeOutline(data: OutlineTemplateData): string {
  const {
    openingCase,
    coreViewpoint,
    endingConclusion,
    keyMaterials,
    relatedMaterials,
    targetWordCount,
    structure
  } = data;

  // 安全截断
  const truncatedOpening = safeTruncate(openingCase, 50);
  const truncatedViewpoint = safeTruncate(coreViewpoint, 50);
  const truncatedConclusion = safeTruncate(endingConclusion, 50);

  // 如果有结构模板，动态生成大纲
  if (structure && structure.sections.length > 0) {
    const outlineLines = [
      '【创作大纲】',
      '',
      `结构模板：${structure.name}`,
      '',
    ];

    structure.sections.forEach((section, index) => {
      outlineLines.push(`${index + 1}. ${section.name}（约${section.suggestedWordCount}字）`);
      outlineLines.push(`   - ${section.description}`);

      // 在特定段落注入用户核心数据
      if (section.id === 'opening-case' || section.id === 'hook' || section.id === 'story-opening' || section.id === 'direct-opening') {
        outlineLines.push(`   - 核心素材：${truncatedOpening}...`);
      }
      if (section.id === 'emotional-position' || section.id === 'core-issue' || section.id === 'turning-point' || section.id === 'problem-statement') {
        outlineLines.push(`   - 核心观点：${truncatedViewpoint}...`);
      }
      if (section.id === 'conclusion-interaction' || section.id === 'conclusion' || section.id === 'story-ending' || section.id === 'quick-conclusion') {
        outlineLines.push(`   - 结尾内容：${truncatedConclusion}...`);
      }
      if (section.id === 'data-support' || section.id === 'data-analysis') {
        outlineLines.push(keyMaterials ? '   - 数据支撑：有用户提供的关键素材' : '   - 数据支撑：使用默认素材');
      }
      if (section.id === 'rational-analysis' || section.id === 'expert-opinion' || section.id === 'background') {
        if (relatedMaterials) outlineLines.push('   - 使用关联素材');
      }
    });

    outlineLines.push('');
    outlineLines.push('【结构说明】严格按照选定结构创作');
    outlineLines.push(`【字数控制】目标${targetWordCount}字，浮动±200字`);

    return outlineLines.filter(line => line.trim() !== '').join('\n');
  }

  // 后备：默认7段大纲（保持向后兼容）
  const fallbackLines = [
    '【创作大纲】',
    '',
    '1. 真实故事/案例开头（约300字）',
    `   - 核心素材：${truncatedOpening}...`,
    '2. 抛出用户最关心的疑问（约150字）',
    '3. 情绪/立场表达（约150字）',
    `   - 核心观点：${truncatedViewpoint}...`,
    '4. 理性拆解真相（约400字）',
    relatedMaterials ? '   - 使用关联素材' : '',
    '5. 权威数据/规则支撑（约300字）',
    keyMaterials ? '   - 数据支撑：有用户提供的关键素材' : '   - 数据支撑：使用默认素材',
    '6. 给普通人可落地的避坑建议（约300字）',
    '7. 结尾互动+合规声明（约200字）',
    `   - 结尾内容：${truncatedConclusion}...`,
    '',
    '【结构说明】严格按照用户专属7段结构创作',
    `【字数控制】目标${targetWordCount}字，浮动±200字`
  ];

  return fallbackLines.filter(line => line.trim() !== '').join('\n');
}

/**
 * 安全的JSON序列化/反序列化
 */
export function safeJsonParse<T>(text: string, defaultValue: T): T {
  try {
    if (!text) return defaultValue;
    const parsed = JSON.parse(text);
    return parsed as T;
  } catch (error) {
    console.warn('JSON解析失败:', error);
    return defaultValue;
  }
}

export function safeJsonStringify(data: object, space?: number): string {
  try {
    return JSON.stringify(data, null, space);
  } catch (error) {
    console.warn('JSON序列化失败:', error);
    return '{}';
  }
}

/**
 * 输入验证工具
 */
export interface InputValidationOptions {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  required?: boolean;
}

export interface InputValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedValue: string;
}

export function validateInput(
  value: string,
  options: InputValidationOptions = {}
): InputValidationResult {
  const {
    maxLength = Infinity,
    minLength = 0,
    required = false
  } = options;

  const errors: string[] = [];
  let sanitizedValue = value.trim();

  // 必填检查
  if (required && !sanitizedValue) {
    errors.push('此字段为必填项');
  }

  // 长度检查
  if (sanitizedValue.length > maxLength) {
    errors.push(`内容长度不能超过 ${maxLength} 字符`);
    sanitizedValue = sanitizedValue.substring(0, maxLength);
  }

  if (sanitizedValue.length < minLength && sanitizedValue) {
    errors.push(`内容长度至少需要 ${minLength} 字符`);
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedValue
  };
}

/**
 * 存储大小检查工具
 */
const MAX_SAFE_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB

export function checkStorageSize(data: object): {
  valid: boolean;
  size: number;
  sizeFormatted: string;
} {
  const size = safeJsonStringify(data).length;
  const sizeFormatted = formatBytes(size);
  
  return {
    valid: size <= MAX_SAFE_STORAGE_SIZE,
    size,
    sizeFormatted
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}
