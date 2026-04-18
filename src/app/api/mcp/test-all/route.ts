import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { MCPService } from '@/lib/mcp/mcp-service';

interface TestResult {
  toolName: string;
  actionName: string;
  functionDesc: string;
  success: boolean;
  data?: any;
  error?: string;
  durationMs: number;
}

export async function POST(request: NextRequest) {
  try {
    const allCapabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'));

    if (allCapabilities.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No available capabilities found in capability_list',
      });
    }

    const mcpService = MCPService.getInstance();
    const results: TestResult[] = [];
    const startTime = Date.now();

    for (const capability of allCapabilities) {
      const toolName = capability.toolName || 'unknown';
      const actionName = capability.actionName || 'unknown';
      const functionDesc = capability.functionDesc;

      console.log(`Testing MCP: ${toolName}.${actionName}`);

      const testStart = Date.now();
      
      try {
        let testData: any = null;
        
        if (toolName === 'search' && actionName === 'webSearch') {
          testData = await mcpService.executeTool('search', 'webSearch', {
            query: '人工智能最新发展 2024',
            num: 3,
          });
        } else if (toolName === 'wechat' && actionName === 'addDraft') {
          testData = await mcpService.executeTool('wechat', 'addDraft', {
            title: 'MCP测试文章',
            content: '<p>这是一篇通过MCP系统创建的测试文章。</p>',
            author: 'AI助手',
            digest: 'MCP功能测试',
            thumbMediaId: '',
          });
        } else if (toolName === 'search' && actionName === 'webpage') {
          testData = await mcpService.executeTool('search', 'webpage', {
            url: 'https://www.baidu.com',
            query: '百度',
          });
        } else {
          const mockResult = await mcpService.executeTool(toolName, actionName, {});
          testData = mockResult;
        }

        results.push({
          toolName,
          actionName,
          functionDesc,
          success: true,
          data: testData,
          durationMs: Date.now() - testStart,
        });
      } catch (error) {
        results.push({
          toolName,
          actionName,
          functionDesc,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Date.now() - testStart,
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    const report = {
      summary: {
        totalTests: results.length,
        successCount,
        failCount,
        successRate: `${((successCount / results.length) * 100).toFixed(1)}%`,
        totalDurationMs: totalDuration,
        testTimestamp: new Date().toISOString(),
      },
      results,
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('MCP comprehensive test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
