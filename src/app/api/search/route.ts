import { NextRequest, NextResponse } from 'next/server';
import { SearchClient, Config } from 'coze-coding-dev-sdk';
import { requireAuth } from '@/lib/auth/context';

/**
 * 搜索 API 接口
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const count = parseInt(searchParams.get('count') || '10');
    const type = searchParams.get('type') || 'web_summary';
    const needContent = searchParams.get('needContent') === 'true';
    const agentId = searchParams.get('agentId');

    // 验证参数
    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: '查询词不能为空',
        },
        { status: 400 }
      );
    }

    if (count < 1 || count > 50) {
      return NextResponse.json(
        {
          success: false,
          error: '结果数量必须在1-50之间',
        },
        { status: 400 }
      );
    }

    if (!['web', 'web_summary', 'image'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: '搜索类型必须是 web、web_summary 或 image',
        },
        { status: 400 }
      );
    }

    // 调用搜索集成
    const config = new Config();
    const client = new SearchClient(config);

    let result;

    if (type === 'web') {
      result = await client.webSearch(query, count);
    } else if (type === 'web_summary') {
      result = await client.webSearchWithSummary(query, count);
    } else if (type === 'image') {
      result = await client.imageSearch(query, count);
    }

    // 如果需要完整内容
    if (needContent && result.web_items) {
      for (const item of result.web_items) {
        try {
          // 这里可以添加获取完整内容的逻辑
          // 例如使用 fetch 获取网页内容
          // 但要注意遵守 robots.txt 和版权规则
        } catch (error) {
          console.error('获取完整内容失败:', item.url, error);
        }
      }
    }

    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        query,
        type,
        count,
        agentId,
        timestamp: new Date().toISOString(),
        result,
      },
    });
  } catch (error) {
    console.error('搜索失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '搜索失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * POST 请求支持更高级的搜索配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      query,
      count = 10,
      type = 'web_summary',
      needContent = false,
      agentId,
      sites, // 指定搜索的网站
      blockHosts, // 排除的网站
      timeRange, // 时间范围：1d, 1w, 1m
    } = body;

    // 验证必需参数
    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: '查询词不能为空',
        },
        { status: 400 }
      );
    }

    // 调用搜索集成
    const config = new Config();
    const client = new SearchClient(config);

    let result;

    if (type === 'web') {
      result = await client.webSearch(query, count);
    } else if (type === 'web_summary') {
      result = await client.webSearchWithSummary(query, count);
    } else if (type === 'image') {
      result = await client.imageSearch(query, count);
    } else if (type === 'advanced') {
      // 高级搜索
      result = await client.advancedSearch(query, {
        searchType: 'web',
        count,
        needContent,
        sites,
        blockHosts,
        timeRange,
      });
    }

    // 返回结果
    return NextResponse.json({
      success: true,
      data: {
        query,
        type,
        count,
        agentId,
        timestamp: new Date().toISOString(),
        result,
      },
    });
  } catch (error) {
    console.error('搜索失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '搜索失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
