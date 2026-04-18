#!/usr/bin/env tsx

import { checkStepHistoryStatus } from './src/lib/test/db-query-utils';
import { validateTestCaseStepHistory, comprehensiveValidation } from './src/lib/test/test-case-validation';

async function testValidation() {
  console.log('🔍 测试验证模块...');

  // 1. 检查 step_history 状态
  console.log('1. 检查 step_history 表状态...');
  const status = await checkStepHistoryStatus();
  console.log('   总记录数:', status.totalCount);
  console.log('   最近5条记录:', status.recentRecords);
  console.log('');

  // 2. 如果有数据，测试用一个 command_result_id 进行验证
  if (status.totalCount > 0 && status.topGroups.length > 0) {
    const testCmdId = status.topGroups[0].cmd_id_hex;
    console.log(`2. 测试验证 command_result_id (hex): ${testCmdId}`);

    // 转换为标准 UUID 格式
    const normalizedUuid = `${testCmdId.slice(0, 8)}-${testCmdId.slice(8, 12)}-${testCmdId.slice(12, 16)}-${testCmdId.slice(16, 20)}-${testCmdId.slice(20, 32)}`;
    console.log(`   标准 UUID: ${normalizedUuid}`);

    const validation = await validateTestCaseStepHistory(normalizedUuid);
    console.log('   验证结果:', JSON.stringify(validation, null, 2));
  }

  console.log('✅ 测试完成!');
}

testValidation().catch(console.error);
