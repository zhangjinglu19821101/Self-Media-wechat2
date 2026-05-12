import { NextRequest, NextResponse } from 'next/server';
import { Branch1IntelligentExecutor } from '@/lib/mcp/branch1-intelligent-executor';
import { DomainKnowledgeRetriever } from '@/lib/mcp/domain-knowledge-retriever';
import { db } from '@/lib/db';
import { domainCase, domainRule, domainTerminology } from '@/lib/db/schema';

export const maxDuration = 120;

/**
 * 分支1智能执行测试API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, solutionNum, taskContent, skipInsuranceD = false } = body;

    console.log('[分支1智能测试API] 收到请求:', {
      taskId,
      solutionNum,
      taskContent,
      skipInsuranceD
    });

    // 验证参数
    if (!taskId || !solutionNum || !taskContent) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: taskId, solutionNum, taskContent'
      }, { status: 400 });
    }

    // 执行分支1智能流程
    const result = await Branch1IntelligentExecutor.execute(
      taskId,
      solutionNum,
      taskContent,
      { skipInsuranceD }
    );

    console.log('[分支1智能测试API] 执行完成:', {
      success: result.success,
      executionMode: result.executionMode
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[分支1智能测试API] 执行失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '执行失败'
    }, { status: 500 });
  }
}

/**
 * GET: 查询领域知识库状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      // 返回知识库统计
      const [ruleCount, caseCount, termCount] = await Promise.all([
        db.select().from(domainRule).then(r => r.length),
        db.select().from(domainCase).then(r => r.length),
        db.select().from(domainTerminology).then(r => r.length)
      ]);

      return NextResponse.json({
        success: true,
        data: {
          domainRules: ruleCount,
          domainCases: caseCount,
          domainTerminology: termCount
        }
      });
    }

    if (action === 'knowledge' && searchParams.get('solutionNum')) {
      // 获取特定能力的领域知识
      const solutionNum = parseInt(searchParams.get('solutionNum')!);
      const knowledge = await DomainKnowledgeRetriever.getDomainKnowledge({
        solutionNum,
        capabilityId: solutionNum
      });

      return NextResponse.json({
        success: true,
        data: {
          knowledge,
          formatted: DomainKnowledgeRetriever.formatKnowledgeForPrompt(knowledge)
        }
      });
    }

    if (action === 'cases') {
      // 查看所有案例
      const cases = await db.select().from(domainCase).orderBy(domainCase.createdAt);
      return NextResponse.json({
        success: true,
        data: cases
      });
    }

    // 默认返回帮助信息
    return NextResponse.json({
      success: true,
      data: {
        message: '分支1智能执行测试API',
        endpoints: {
          POST: '/api/test/branch1-intelligent - 执行分支1智能流程',
          GET: {
            '?action=stats': '查看知识库统计',
            '?action=knowledge&solutionNum=16': '查看指定能力的领域知识',
            '?action=cases': '查看所有案例'
          }
        }
      }
    });

  } catch (error) {
    console.error('[分支1智能测试API] 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    }, { status: 500 });
  }
}
