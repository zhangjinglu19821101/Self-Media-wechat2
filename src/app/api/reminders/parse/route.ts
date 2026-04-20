/**
 * 提醒智能解析 API
 * POST /api/reminders/parse
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { parseReminderInput, isoToLocalDatetime, INPUT_CONSTRAINTS } from '@/lib/services/reminder-parse-service';

/**
 * 输入安全校验
 * @param input 用户输入
 * @returns 校验结果 { valid: boolean, error?: string }
 */
function validateInput(input: unknown): { valid: boolean; error?: string; sanitized?: string } {
  // 类型检查
  if (input === undefined || input === null) {
    return { valid: false, error: '缺少 input 参数' };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: 'input 参数必须是字符串' };
  }

  // 去除首尾空白
  const sanitized = input.trim();

  // 长度检查
  if (sanitized.length === 0) {
    return { valid: false, error: '请输入提醒内容' };
  }

  if (sanitized.length < INPUT_CONSTRAINTS.MIN_INPUT_LENGTH) {
    return { valid: false, error: `输入内容过短，至少需要 ${INPUT_CONSTRAINTS.MIN_INPUT_LENGTH} 个字符` };
  }

  if (sanitized.length > INPUT_CONSTRAINTS.MAX_INPUT_LENGTH) {
    return { valid: false, error: `输入内容过长，最多允许 ${INPUT_CONSTRAINTS.MAX_INPUT_LENGTH} 个字符` };
  }

  // 安全检查：防止潜在的注入攻击
  // 移除控制字符（除换行和制表符外）
  const safeInput = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return { valid: true, sanitized: safeInput };
}

export async function POST(request: NextRequest) {
  try {
    // 获取工作区ID
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { input } = body;

    // P1-3: 输入安全校验
    const validation = validateInput(input);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 调用解析服务
    const result = await parseReminderInput(validation.sanitized!, workspaceId);

    // P1-2: 时间格式转换
    // 将 ISO 格式的 deadline 转换为 datetime-local 格式（本地时间，无时区偏移）
    if (result.deadline) {
      const localDatetime = isoToLocalDatetime(result.deadline);
      if (localDatetime) {
        // 返回转换后的格式，同时保留原始 ISO 格式供参考
        return NextResponse.json({
          success: true,
          data: {
            ...result,
            deadlineLocal: localDatetime,  // 前端 datetime-local 可直接使用
            deadlineIso: result.deadline,   // 原始 ISO 格式（可选）
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API /reminders/parse] 解析失败:', error);
    return NextResponse.json(
      {
        error: '解析失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
