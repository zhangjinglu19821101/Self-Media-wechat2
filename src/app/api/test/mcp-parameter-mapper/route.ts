
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getMcpParameterMapper } from '@/lib/services/mcp-parameter-mapper';

export async function GET() {
  try {
    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'))
      .limit(10);

    return NextResponse.json({
      success: true,
      message: 'MCP 参数映射服务测试 API',
      data: {
        availableCapabilities: capabilities.length,
        capabilities: capabilities
      }
    });
  } catch (error) {
    console.error('[Test API] 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, upstreamContent, capabilityId, dedicatedTaskType, useMockData } = body;

    const mapper = getMcpParameterMapper();

    // 根据 action 执行不同的操作
    switch (action) {
      case 'testConnection': {
        return NextResponse.json({
          success: true,
          message: 'McpParameterMapper 服务连接正常',
          data: {
            service: 'McpParameterMapper',
            status: 'operational'
          }
        });
      }

      case 'testMockMapping': {
        // 使用模拟数据进行测试，不依赖数据库
        const mockCapability = {
          id: 1,
          toolName: 'wechat',
          actionName: 'complianceAudit',
          capabilityType: 'compliance_audit',
          functionDesc: '微信内容合规审核',
          status: 'available',
          paramDesc: {
            content: '需要审核的文章内容',
            title: '文章标题',
            author: '作者名称'
          },
          paramExamples: {
            content: '这是一篇关于保险产品介绍的文章...',
            title: '保险产品介绍',
            author: '保险事业部'
          },
          exampleOutput: {
            approved: true,
            riskLevel: 'low',
            suggestions: []
          },
          dedicatedTaskType: 'compliance_audit',
          dedicatedTaskPriority: 1,
          isPrimaryForTask: true,
          requiresOnSiteExecution: false,
          metadata: {}
        };

        const testContent = upstreamContent || '这是一篇测试文章，内容是关于重大疾病保险的介绍，包括保障责任包括：100种重大疾病，确诊即赔，保额50万。';

        const result = await mapper.mapParameters({
          upstreamContent: testContent,
          capability: mockCapability,
          taskType: 'compliance_audit'
        });

        return NextResponse.json({
          success: true,
          message: '模拟参数映射完成',
          data: {
            result,
            mockCapability,
            testContent
          }
        });
      }

      case 'mapParameters': {
        if (!upstreamContent || !capabilityId) {
          return NextResponse.json({
            success: false,
            error: '缺少必要参数：upstreamContent 和 capabilityId'
          }, { status: 400 });
        }

        // 查询能力配置
        const capabilities = await db
          .select()
          .from(capabilityList)
          .where(eq(capabilityList.id, Number(capabilityId)));

        if (capabilities.length === 0) {
          return NextResponse.json({
            success: false,
            error: `找不到 ID 为 ${capabilityId} 的能力`
          }, { status: 404 });
        }

        const capability = capabilities[0];

        // 执行参数映射
        const result = await mapper.mapParameters({
          upstreamContent,
          capability,
          taskType: body.taskType
        });

        return NextResponse.json({
          success: true,
          message: '参数映射完成',
          data: result
        });
      }

      case 'mapByDedicatedTaskType': {
        if (!upstreamContent || !dedicatedTaskType) {
          return NextResponse.json({
            success: false,
            error: '缺少必要参数：upstreamContent 和 dedicatedTaskType'
          }, { status: 400 });
        }

        // 查询所有可用能力
        const capabilities = await db
          .select()
          .from(capabilityList)
          .where(eq(capabilityList.status, 'available'));

        // 按专用任务类型映射
        const result = await mapper.mapByDedicatedTaskType(
          upstreamContent,
          dedicatedTaskType,
          capabilities
        );

        return NextResponse.json({
          success: true,
          message: '按专用任务类型参数映射完成',
          data: result
        });
      }

      default: {
        return NextResponse.json({
          success: false,
          error: `未知的 action: ${action}，支持的 action: testConnection, testMockMapping, mapParameters, mapByDedicatedTaskType`
        }, { status: 400 });
      }
    }
  } catch (error) {
    console.error('[Test API] 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
