import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('');
    console.log('🔍 开始查询 agent_sub_tasks_mcp_executions 表数据...');
    console.log('============================================================================');
    console.log('');

    // 1. 查询 command_result_id = 'e41a73e1' 的所有记录
    console.log('📋 步骤1: 查询 command_result_id = e41a73e1 的记录...');
    const mcpExecutions = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(eq(agentSubTasksMcpExecutions.commandResultId, 'e41a73e1'))
      .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp));

    console.log('✅ 找到 MCP 执行记录数量:', mcpExecutions.length);
    console.log('');

    if (mcpExecutions.length > 0) {
      console.log('📊 MCP 执行记录详情:');
      mcpExecutions.forEach((record, index) => {
        console.log(`────────────────────────────────────────────────────────────────`);
        console.log(`  记录 ${index + 1}:`);
        console.log(`    - id: ${record.id}`);
        console.log(`    - order_index: ${record.orderIndex}`);
        console.log(`    - attempt_id: ${record.attemptId}`);
        console.log(`    - attempt_number: ${record.attemptNumber}`);
        console.log(`    - tool_name: ${record.toolName || 'null'}`);
        console.log(`    - action_name: ${record.actionName || 'null'}`);
        console.log(`    - result_status: ${record.resultStatus}`);
        console.log(`    - error_code: ${record.errorCode || 'null'}`);
        console.log(`    - error_message: ${record.errorMessage || 'null'}`);
        console.log(`    - error_type: ${record.errorType || 'null'}`);
        console.log(`    - execution_time_ms: ${record.executionTimeMs}`);
        console.log(`    - is_retryable: ${record.isRetryable}`);
        console.log(`    - attempt_timestamp: ${record.attemptTimestamp}`);
        console.log('');
      });

      // 2. 按 order_index 分组统计
      console.log('📈 按 order_index 分组统计:');
      const groupedByOrderIndex: Record<number, any[]> = {};
      mcpExecutions.forEach(record => {
        if (!groupedByOrderIndex[record.orderIndex]) {
          groupedByOrderIndex[record.orderIndex] = [];
        }
        groupedByOrderIndex[record.orderIndex].push(record);
      });

      Object.keys(groupedByOrderIndex).sort().forEach(orderIndex => {
        const records = groupedByOrderIndex[parseInt(orderIndex)];
        const successCount = records.filter(r => r.resultStatus === 'success').length;
        const failedCount = records.filter(r => r.resultStatus === 'failed').length;
        console.log(`  order_index=${orderIndex}:`);
        console.log(`    - 总记录数: ${records.length}`);
        console.log(`    - 成功: ${successCount}`);
        console.log(`    - 失败: ${failedCount}`);
      });
    } else {
      console.log('⚠️  未找到任何 MCP 执行记录');
    }

    console.log('');
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'MCP 执行记录查询完成',
      data: {
        totalCount: mcpExecutions.length,
        records: mcpExecutions
      }
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
