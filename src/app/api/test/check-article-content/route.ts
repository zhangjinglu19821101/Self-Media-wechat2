
/**
 * 直接查看文章初稿内容
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const commandResultId = '58ea520c-e7f1-4c27-bd24-2b3aab034066';
  
  try {
    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
    
    const results = records.map((record) => {
      const content = record.interactContent as any;
      let articleContent = null;
      
      // 查找文章内容
      if (content?.execution_result) {
        try {
          const execResult = typeof content.execution_result === 'string' 
            ? JSON.parse(content.execution_result)
            : content.execution_result;
          
          if (execResult?.title || execResult?.content) {
            articleContent = {
              title: execResult.title,
              content: execResult.content?.substring(0, 500) + '...',
              keywords: execResult.keywords,
            };
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
      
      return {
        stepNo: record.stepNo,
        interactNum: record.interactNum,
        interactType: record.interactType,
        interactUser: record.interactUser,
        hasExecutionResult: !!content?.execution_result,
        hasResponse: !!content?.response,
        articleContent,
        rawContent: content,
      };
    });
    
    return NextResponse.json({
      success: true,
      commandResultId,
      totalRecords: records.length,
      results,
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

