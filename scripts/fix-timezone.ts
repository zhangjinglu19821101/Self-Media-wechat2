#!/usr/bin/env node
/**
 * 时区问题修复脚本
 * 批量替换项目中所有使用 new Date() 设置时间字段的地方
 * 统一使用 getCurrentBeijingTime()
 */

import * as fs from 'fs';
import * as path from 'path';

// 需要处理的文件列表（核心业务文件，排除测试文件）
const targetFiles = [
  // API 路由（排除 test 目录）
  '/workspace/projects/src/app/api/agent-a-todos/route.ts',
  '/workspace/projects/src/app/api/agent-sub-tasks/confirm-split/route.ts',
  '/workspace/projects/src/app/api/subtasks/[id]/status/route.ts',
  '/workspace/projects/src/app/api/commands/approve/route.ts',
  '/workspace/projects/src/app/api/commands/[id]/consult/route.ts',
  '/workspace/projects/src/app/api/commands/reject/route.ts',
  '/workspace/projects/src/app/api/commands/send/route.ts',
  '/workspace/projects/src/app/api/fast-track/route.ts',
  '/workspace/projects/src/app/api/exceptions/[failureId]/assign/route.ts',
  '/workspace/projects/src/app/api/exceptions/[failureId]/resolve/route.ts',
  '/workspace/projects/src/app/api/test-task-flow/route.ts',
  '/workspace/projects/src/app/api/drafts/route.ts',
  '/workspace/projects/src/app/api/cron/monitor-subtasks-timeout/route.ts',
  '/workspace/projects/src/app/api/cron/escalate-unresolved-issues/route.ts',
  '/workspace/projects/src/app/api/cron/retry-failed-assignments/route.ts',
  '/workspace/projects/src/app/api/agents/user-decision/route.ts',
  '/workspace/projects/src/app/api/agents/problem-report/[id]/solve/route.ts',
  '/workspace/projects/src/app/api/agents/[id]/subtasks/route.ts',
  '/workspace/projects/src/app/api/agents/tasks/[taskId]/split/route.ts',
  
  // 核心服务文件
  '/workspace/projects/src/lib/services/ts-scheduler.ts',
  '/workspace/projects/src/lib/services/subtask-state-machine.ts',
  '/workspace/projects/src/lib/services/task-manager.ts',
  '/workspace/projects/src/lib/services/subtask-execution-engine.ts',
  '/workspace/projects/src/lib/services/split-retry-manager.ts',
  '/workspace/projects/src/lib/services/agent-memory.ts',
  '/workspace/projects/src/lib/services/notification-service-v2.ts',
];

// 需要导入的工具函数
const importStatement = "import { getCurrentBeijingTime } from '@/lib/utils/date-time';\n";

function fixFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在，跳过: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // 1. 检查是否已经导入了 getCurrentBeijingTime
  if (!content.includes("getCurrentBeijingTime")) {
    // 找到合适的位置插入导入语句（通常在其他 import 语句之后）
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    if (importLines.length > 0) {
      const lastImportLine = importLines[importLines.length - 1];
      const lastImportIndex = content.indexOf(lastImportLine) + lastImportLine.length;
      content = content.slice(0, lastImportIndex) + '\n' + importStatement + content.slice(lastImportIndex);
      modified = true;
      console.log(`✅ 添加导入语句: ${filePath}`);
    }
  }

  // 2. 替换所有的 new Date() 为 getCurrentBeijingTime()
  // 注意：只替换设置时间字段的地方，避免误替换
  const patterns = [
    // 匹配: startedAt: new Date(),
    /(startedAt|started_at|completedAt|completed_at|updatedAt|updated_at|interactTime):\s*new\s+Date\(\)/g,
    // 匹配: updateData.startedAt = new Date();
    /(updateData\.\w+)\s*=\s*new\s+Date\(\)/g,
    // 匹配: updates.completedAt = new Date();
    /(updates\.\w+)\s*=\s*new\s+Date\(\)/g,
    // 匹配: execution.completedAt = new Date(body.completedAt); - 这个特殊，不替换
  ];

  // 替换简单的赋值
  const originalContent = content;
  content = content.replace(
    /(startedAt|started_at|completedAt|completed_at|updatedAt|updated_at|interactTime):\s*new\s+Date\(\)/g,
    (match, field) => `${field}: getCurrentBeijingTime()`
  );

  // 替换 updateData.xxx = new Date()
  content = content.replace(
    /(updateData\.\w+)\s*=\s*new\s+Date\(\)/g,
    (match, field) => `${field} = getCurrentBeijingTime()`
  );

  // 替换 updates.xxx = new Date()
  content = content.replace(
    /(updates\.\w+)\s*=\s*new\s+Date\(\)/g,
    (match, field) => `${field} = getCurrentBeijingTime()`
  );

  if (content !== originalContent) {
    modified = true;
    console.log(`✅ 替换时间字段: ${filePath}`);
  }

  // 3. 写入文件
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ 已修改: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  无需修改: ${filePath}`);
    return false;
  }
}

function main() {
  console.log('🔧 开始修复时区问题...\n');

  let modifiedCount = 0;

  for (const filePath of targetFiles) {
    if (fixFile(filePath)) {
      modifiedCount++;
    }
  }

  console.log(`\n🎉 时区问题修复完成！`);
  console.log(`📊 共修改 ${modifiedCount} 个文件`);
}

main();
