import { NextRequest, NextResponse } from 'next/server';
import { commandResultService } from '@/lib/services/command-result-service';

/**
 * 测试 insurance-d 完成文章并触发合规校验的完整流程
 *
 * POST /api/test/insurance-d-complete-article
 *
 * 流程：
 * 1. 创建 insurance-d 的文章任务结果（初始状态为 in_progress）
 * 2. 模拟 insurance-d 完成文章（更新状态为 completed）
 * 3. 自动触发 Agent B 合规校验
 * 4. 返回校验结果
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      articleTitle = '测试文章：如何选择适合的保险产品',
      articleContent = `# 如何选择适合的保险产品

保险是现代生活中重要的风险管理工具。本文将为您介绍如何选择适合的保险产品。

## 为什么需要保险？

保险可以为您提供以下保障：

1. **意外保障**：应对突发意外事件
2. **健康保障**：医疗费用报销
3. **寿险保障**：家庭经济支柱保障
4. **养老保障**：退休后的收入来源

## 如何选择保险产品？

### 1. 了解自己的需求

首先要明确自己的保险需求，包括：
- 年龄和家庭状况
- 收入水平
- 健康状况
- 职业风险

### 2. 比较不同产品

在选择保险产品时，要比较：
- 保障范围
- 保费价格
- 理赔条件
- 公司信誉

### 3. 注意条款细节

特别注意以下条款：
- 责任免除
- 等待期
- 理赔流程
- 退保规定

## 常见保险类型

### 重疾险

重疾险可以在被保险人确诊重大疾病时一次性给付保险金，用于支付医疗费用或弥补收入损失。

**特点**：
- 保额通常为年收入的3-5倍
- 覆盖多种重大疾病
- 一次性给付

### 医疗险

医疗险可以报销医疗费用，包括住院费用、手术费用、门诊费用等。

**特点**：
- 实报实销
- 通常有免赔额
- 需要提供医疗发票

### 寿险

寿险在被保险人身故或全残时给付保险金，为家人提供经济保障。

**特点**：
- 保障家庭经济支柱
- 指定受益人
- 保费相对较低

## 风险提示

1. **如实告知**：投保时必须如实告知健康状况，否则可能影响理赔
2. **仔细阅读条款**：了解保障范围和责任免除
3. **理性选择**：根据自身需求选择合适的保险产品
4. **及时续保**：避免保险中断

## 总结

选择适合的保险产品需要综合考虑个人需求、产品特点和市场情况。建议在购买前充分了解产品信息，如有疑问可咨询专业人士。

*本文仅供参考，具体保险条款请以保险公司官方文件为准。*`,
    } = body;

    console.log('🧪 开始测试 insurance-d 完成文章并触发合规校验的流程');

    // 1. 创建 insurance-d 的文章任务结果（初始状态为 in_progress）
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const resultId = `result_${timestamp}_${randomId}_insurance-d`;
    const taskId = `task-A-to-insurance-d-${timestamp}-${randomId}`;

    const initialResult = await commandResultService.createResult({
      taskId,
      commandId: `cmd-${taskId}`,
      fromAgentId: 'A',
      toAgentId: 'insurance-d',
      originalCommand: `创作一篇关于"${articleTitle}"的文章`,
      executionStatus: 'in_progress',
      executionResult: '',
      outputData: {},
      // 🔥 设置 metadata，包含 taskType，以便触发合规校验
      // 注意：createResult 方法不会设置这个 metadata，需要在 update 时确保
    });

    console.log(`✅ 创建初始结果: ${initialResult.resultId}`);

    // 2. 先设置 metadata.taskType，确保合规校验能被触发
    // 需要直接更新 dailyTask 表
    const db = await import('@/lib/db').then(m => m.db);
    const { dailyTask } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    await db
      .update(dailyTask)
      .set({
        metadata: {
          ...(initialResult.metadata || {}),
          taskType: 'article_creation', // 🔥 设置任务类型为文章创建
        },
        updatedAt: new Date(),
      })
      .where(eq(dailyTask.resultId, initialResult.resultId));

    console.log(`✅ 设置 metadata.taskType 为 article_creation`);

    // 3. 模拟 insurance-d 完成文章（更新状态为 completed）
    // 这里会自动触发 Agent B 合规校验
    const completedResult = await commandResultService.updateResult({
      resultId: initialResult.resultId,
      executionStatus: 'completed',
      executionResult: JSON.stringify({
        title: articleTitle,
        content: articleContent,
        completedAt: new Date().toISOString(),
      }),
      outputData: {
        title: articleTitle,
        content: articleContent,
      },
    });

    console.log(`✅ insurance-d 完成文章: ${completedResult.resultId}`);

    // 4. 等待合规校验完成
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. 重新查询结果，获取合规校验数据
    const finalResult = await commandResultService.getResult(initialResult.resultId);

    console.log(`✅ 合规校验完成`);
    console.log(`📊 合规评分: ${finalResult?.metadata?.complianceCheck?.score}`);
    console.log(`✅ 是否合规: ${finalResult?.metadata?.complianceCheck?.isCompliant ? '是' : '否'}`);

    // 5. 返回测试结果
    return NextResponse.json({
      success: true,
      data: {
        resultId: initialResult.resultId,
        taskId,
        articleTitle,
        complianceCheck: finalResult?.metadata?.complianceCheck,
        message: '测试完成，合规校验已自动触发',
      },
      message: '测试成功',
    });
  } catch (error) {
    console.error('❌ 测试 insurance-d 完成文章流程失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
