import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { loadAgentPrompt } from '@/lib/agents/prompt-loader';

export async function POST(request: NextRequest) {
  try {
    const { model, temperature = 0.7 } = await request.json();
    
    // 获取 insurance-d 的提示词
    const agentPrompt = loadAgentPrompt('insurance-d');
    
    // 测试提示词
    const testPrompt = `请根据你的角色提示词，返回一个 JSON 格式的响应，格式如下：
- 如果你能完成任务：{"canComplete": true, "result": "任务已完成..."}
- 如果你不能完成任务：{"canComplete": false, "reason": "无法完成的原因"}

当前任务：创作一篇关于保险的文章标题，20字左右。

请直接返回 JSON，不要添加任何额外文字。`;

    const fullPrompt = `${agentPrompt}

${testPrompt}`;

    const config = new Config();
    const client = new LLMClient(config);
    
    const messages = [
      { role: "user", content: fullPrompt }
    ];

    const llmConfig: any = {
      temperature,
    };
    
    if (model) {
      llmConfig.model = model;
    }

    let response = '';
    const stream = client.stream(messages, llmConfig);
    
    for await (const chunk of stream) {
      if (chunk.content) {
        response += chunk.content.toString();
      }
    }

    // 尝试解析 JSON
    let parsed = null;
    try {
      // 移除 ```json 和 ``` 标记
      let cleanResponse = response.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
      
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // 解析失败
    }

    return NextResponse.json({
      success: true,
      model: model || 'doubao-seed-1-8-251228 (default)',
      temperature,
      rawResponse: response,
      parsed,
      hasCanComplete: parsed && 'canComplete' in parsed,
      hasIsNeedMcp: parsed && 'isNeedMcp' in parsed,
      hasIsTaskDown: parsed && 'isTaskDown' in parsed,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
