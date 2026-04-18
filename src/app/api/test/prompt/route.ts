import { NextResponse } from 'next/server';
import { loadAgentPrompt } from '@/lib/agents/prompt-loader';

export async function GET() {
  try {
    const prompt = loadAgentPrompt('insurance-d');
    
    return NextResponse.json({
      success: true,
      promptLength: prompt.length,
      includesCanComplete: prompt.includes('canComplete'),
      includesIsNeedMcp: prompt.includes('isNeedMcp'),
      promptPreview: prompt.substring(0, 500),
      formatSection: prompt.includes('## 返回格式要求') ? prompt.substring(prompt.indexOf('## 返回格式要求'), prompt.indexOf('## 返回格式要求') + 800) : 'NOT FOUND'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
