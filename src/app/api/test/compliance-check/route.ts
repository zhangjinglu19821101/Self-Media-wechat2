import { NextRequest, NextResponse } from 'next/server';
import { agentTask } from '@/lib/services/agent-task';

/**
 * 测试完整的合规校验流程
 *
 * POST /api/test/compliance-check
 *
 * 功能：
 * 1. 创建一个 insurance-d 的文章任务
 * 2. 模拟 insurance-d 完成文章
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

    console.log('🧪 开始测试合规校验流程');

    // 1. 创建 insurance-d 的文章任务
    const taskId = await agentTask.createTask({
      fromAgentId: 'A', // 由 Agent A 创建
      toAgentId: 'insurance-d', // 下达给 insurance-d
      command: '创作一篇关于"如何选择适合的保险产品"的文章',
      commandType: 'article_creation',
      priority: 'normal',
      metadata: {
        taskName: articleTitle,
        taskType: 'article_creation', // 🔥 文章创建任务类型
        acceptanceCriteria: '完成一篇高质量、合规的保险科普文章',
        totalDeliverables: '1篇文章',
      },
    });

    console.log(`✅ 创建文章任务: ${taskId}`);

    // 2. 模拟 insurance-d 完成文章
    const result = await agentTask.completeTask(taskId, JSON.stringify({
      title: articleTitle,
      content: articleContent,
      articleTitle,
      articleContent,
    }));

    console.log(`✅ insurance-d 完成文章`);

    // 3. 合规校验会自动触发（在 completeTask 中）
    // 等待一段时间，让合规校验完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`✅ Agent B 合规校验完成`);

    // 4. 返回测试结果
    return NextResponse.json({
      success: true,
      data: {
        taskId,
        complianceTriggered: true,
        message: '测试完成，合规校验已自动触发',
      },
      message: '测试成功',
    });
  } catch (error) {
    console.error('❌ 测试合规校验流程失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
