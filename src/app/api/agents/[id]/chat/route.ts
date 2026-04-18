import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError } from '@/lib/api/route-error-handler';
import { getWorkspaceId } from '@/lib/auth/context';
import { agentBuilder } from '@/lib/agent-builder';
import { workflowTriggerParser } from '@/lib/workflow-trigger';
import { conversationHistoryManager } from '@/storage/database';
import { getRAGIntegration } from '@/lib/rag/rag-integration';
import postgres from 'postgres';

/**
 * POST /api/agents/[id]/chat
 * Agent 对话接口（支持流式输出和工作流程触发）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client: postgres.Sql | null = null;

  try {
    const { id } = await params;
    const body = await request.json();
    const { message, conversationHistory = [], sessionId } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: '消息不能为空' },
        { status: 400 }
      );
    }

    // 获取 Agent 配置
    const agent = agentBuilder.getAgent(id as 'A' | 'B' | 'C' | 'D' | 'insurance-c' | 'insurance-d' | 'insurance-xiaohongshu');

    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent ${id} 不存在` },
        { status: 404 }
      );
    }

    // 📌 加载最近收到的 Agent 指令（来自其他 Agent）
    let pendingCommands: any[] = [];
    try {
      const connectionString = process.env.DATABASE_URL || '';
      client = postgres(connectionString, { ssl: 'require' });

      console.log(`🔍 开始查询 Agent ${id} 的指令...`);

      // 查询该 Agent 最近 5 条收到的指令
      pendingCommands = await client.unsafe(`
        SELECT DISTINCT c.id, c.session_id, c.metadata, c.created_at
        FROM conversations c
        WHERE c.agent_id = $1
          AND c.metadata->>'type' = 'agent-to-agent'
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [id]);

      console.log(`✅ 查询完成，Agent ${id} 收到 ${pendingCommands.length} 条指令`);

      if (pendingCommands.length > 0) {
        // 获取每个指令的详细内容
        for (const conv of pendingCommands) {
          console.log(`  🔍 正在查询会话 ${conv.id} 的消息...`);
          
          // 使用更简单的方式查询消息
          const messages = await client`
            SELECT id, role, content, metadata, created_at
            FROM messages
            WHERE conversation_id = ${conv.id}
              AND metadata->>'isCommand' = 'true'
            ORDER BY created_at ASC
            LIMIT 1
          `;

          console.log(`  查询结果: 找到 ${messages ? messages.length : 0} 条消息`);

          if (messages && messages.length > 0) {
            const msg = messages[0];
            // 确保 content 是字符串类型
            const content = String(msg.content || '');
            conv.commandMessage = {
              ...msg,
              content: content,
            };
            console.log(`  ✅ 指令 ${conv.id} 的内容 (${content.length} 字符)`);
            console.log(`  📝 完整内容:`, content);
            console.log(`  📋 Metadata:`, JSON.stringify(msg.metadata));
          } else {
            console.log(`  ⚠️ 指令 ${conv.id} 没有关联的 isCommand=true 消息`);
            // 🔥 尝试获取该会话的所有消息（不加 isCommand 过滤）
            const allMessages = await client.unsafe(`
              SELECT m.id, m.role, m.content, m.metadata, m.created_at
              FROM messages m
              WHERE m.conversation_id = $1
              ORDER BY m.created_at ASC
            `, [conv.id]);
            console.log(`  📝 该会话的所有消息 (${allMessages ? allMessages.length : 0} 条):`);
            if (allMessages) {
              for (const m of allMessages) {
                console.log(`    - ${m.role}: ${m.content.substring(0, 30)}... (metadata: ${JSON.stringify(m.metadata)})`);
              }
            }
          }
        }

        await client.end();
        client = null;
      }
    } catch (error) {
      console.error('❌ Error loading pending commands from database:', error);
      if (client) {
        try {
          await client.end();
        } catch (e) {
          console.error('❌ Error closing database connection:', e);
        }
        client = null;
      }

      // 🔥 降级方案：通过 API 端点获取指令
      console.log(`🔄 降级方案：通过 API 端点获取指令`);
      try {
        const commandsResponse = await fetch(`http://localhost:5000/api/agents/${id}/commands`, {
          headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07' },
        });
        if (commandsResponse.ok) {
          const commandsData = await commandsResponse.json();
          if (commandsData.success && commandsData.data.commands) {
            pendingCommands = commandsData.data.commands.map((cmd: any) => ({
              id: cmd.id,
              session_id: cmd.sessionId,
              metadata: {
                fromAgentId: cmd.fromAgentId,
                toAgentId: cmd.toAgentId,
                commandType: cmd.commandType,
                priority: cmd.priority,
              },
              created_at: cmd.createdAt,
              commandMessage: {
                content: cmd.content,
              },
            }));
            console.log(`✅ 通过 API 获取了 ${pendingCommands.length} 条指令`);
          }
        }
      } catch (apiError) {
        console.error('❌ 降级方案也失败了:', apiError);
      }
    }

    // 检查是否包含工作流程触发指令
    const containsTrigger = workflowTriggerParser.containsTrigger(message);
    let triggerResult = null;

    if (containsTrigger) {
      try {
        triggerResult = await workflowTriggerParser.parse(message, id as 'A' | 'B' | 'C' | 'D' | 'insurance-c' | 'insurance-d');
      } catch (error) {
        console.error('Workflow trigger error:', error);
      }
    }

    // 构建 LLM 消息
    let systemPrompt = agent.systemPrompt;
    console.log(`📝 初始 systemPrompt 长度: ${systemPrompt.length}`);

    // 🆕 RAG 集成：增强用户查询
    console.log(`🔍 [RAG] 开始分析用户查询...`);
    const ragIntegration = getRAGIntegration();
    const ragResult = await ragIntegration.enhanceQuery(message, id);

    console.log(`📊 [RAG] 分析结果:`, {
      used: ragResult.used,
      collectionName: ragResult.metadata.collectionName,
      retrievalCount: ragResult.metadata.retrievalCount,
      avgScore: ragResult.metadata.avgScore,
      queryTime: ragResult.metadata.queryTime,
    });

    // 🆕 如果 RAG 检索到内容，加入 systemPrompt
    if (ragResult.used && ragResult.context) {
      systemPrompt += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 【知识库检索结果】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下是基于知识库检索到的相关信息，请基于这些内容回答用户问题：

${ragResult.context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ 注意事项：
1. 请优先参考上述知识库内容回答
2. 如果知识库内容与常识冲突，以知识库为准
3. 回答时请标注信息来源（如"根据合规规则..."）
4. 如果知识库内容不完整，可以补充常识性回答

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      console.log(`✅ [RAG] 已将 ${ragResult.metadata.retrievalCount} 个文档片段加入 systemPrompt`);
    }

    // 🆕 如果 RAG 未检索到内容但使用了 RAG，添加提示
    if (ragResult.used && !ragResult.context) {
      systemPrompt += `

⚠️ 【系统提示】已尝试检索知识库，但未找到相关内容。请基于你的通用知识回答问题。

`;
      console.log(`⚠️ [RAG] 检索完成但未找到相关内容`);
    }

    // 📌 如果有待处理的指令，在系统提示词中添加指令上下文
    console.log(`🔍 pendingCommands.length = ${pendingCommands.length}`);
    if (pendingCommands.length > 0) {
      console.log(`✅ 进入添加指令到 systemPrompt 的逻辑`);
      const agentNames: Record<string, string> = {
        A: '总裁',
        B: '技术负责人',
        C: 'AI运营总监',
        D: 'AI内容负责人',
        'insurance-c': '保险运营总监',
        'insurance-d': '保险内容负责人',
        'insurance-xiaohongshu': '小红书创作专家',
        'insurance-zhihu': '知乎创作专家',
        'insurance-toutiao': '头条创作专家',
      };

      systemPrompt += `

【📋 待处理指令】
你当前有 ${pendingCommands.length} 条来自其他 Agent 的待处理指令：

`;
      pendingCommands.forEach((cmd: any, index: number) => {
        const fromAgentId = cmd.metadata?.fromAgentId || 'unknown';
        const fromAgentName = agentNames[fromAgentId] || fromAgentId;
        
        console.log(`  🔍 指令 ${index + 1} 的 cmd.commandMessage:`, JSON.stringify(cmd.commandMessage));
        
        const commandContent = cmd.commandMessage?.content || '';
        const priority = cmd.metadata?.priority || 'normal';

        console.log(`  📝 添加指令 ${index + 1}: from=${fromAgentId}, contentLength=${commandContent.length}`);
        console.log(`  📝 commandContent 的值:`, commandContent ? `"${commandContent}"` : 'null/empty');

        systemPrompt += `
${index + 1}. 来自 ${fromAgentName}（Agent ${fromAgentId}）的指令
   优先级：${priority}
   发送时间：${new Date(cmd.created_at).toLocaleString('zh-CN')}
   指令内容：
   ${commandContent}
`;
      });

      systemPrompt += `
请注意：在回复时，请确认你是否理解并准备执行这些指令。如果有任何疑问，请及时向发送方反馈。`;
      
      console.log(`✅ 添加指令后 systemPrompt 长度: ${systemPrompt.length}`);
      console.log(`📋 systemPrompt 预览 (最后 500 字符):`, systemPrompt.slice(-500));
      
      // 🔥 将完整的 systemPrompt 写入临时文件便于调试
      try {
        const fs = await import('fs');
        await fs.promises.writeFile('/tmp/system-prompt-debug.txt', systemPrompt);
        console.log(`✅ 已将完整 systemPrompt 写入 /tmp/system-prompt-debug.txt`);
      } catch (e) {
        console.error(`❌ 写入调试文件失败:`, e);
      }
    } else {
      console.log(`⚠️ pendingCommands 为空，跳过添加指令逻辑`);
    }

    // 如果有触发指令，在系统提示词中添加触发说明
    if (triggerResult) {
      systemPrompt += `\n\n[系统提示] ${triggerResult}\n\n工作流程触发指令：\n${workflowTriggerParser.getTriggerInstructions().join('\n')}`;
    }

    // 🔥 限制对话历史长度，避免 Token 使用过多
    const MAX_HISTORY_LENGTH = 20; // 限制最近 20 条消息
    const limitedHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);

    console.log(`📝 对话历史: 原始 ${conversationHistory.length} 条, 限制后 ${limitedHistory.length} 条`);

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...limitedHistory,
      { role: 'user' as const, content: message },
    ];

    // 保存用户消息到数据库（如果有 sessionId）
    if (sessionId) {
      try {
        await conversationHistoryManager.saveMessage({
          agentId: id,
          sessionId,
          role: 'user',
          content: message,
          metadata: { hasTrigger: containsTrigger },
        });
      } catch (error) {
        console.error('Failed to save user message:', error);
      }
    }

    // 初始化 LLM 客户端（BYOK：优先使用用户 Key）
    const workspaceId = await getWorkspaceId(request);
    const { client: llmClient } = await createUserLLMClient(workspaceId);

    // 设置响应头为流式
    const encoder = new TextEncoder();
    let controllerClosed = false;
    let assistantContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 如果有触发结果，先发送触发通知
          if (triggerResult && !controllerClosed) {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `\n\n🚀 ${triggerResult}\n\n` })}\n\n`));
            } catch (e) {
              console.error('Error enqueueing trigger result:', e);
              controllerClosed = true;
            }
          }

          if (!controllerClosed) {
            const llmStream = llmClient.stream(messages, {
              temperature: 0.7,
            });

            for await (const chunk of llmStream) {
              if (chunk.content && !controllerClosed) {
                try {
                  const text = chunk.content.toString();
                  assistantContent += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
                } catch (e: any) {
                  // 客户端断开连接是正常情况，不记录错误
                  if (e.message?.includes('already closed') || e.message?.includes('Invalid state')) {
                    controllerClosed = true;
                    break;
                  }
                  console.error('Error enqueueing chunk:', e);
                  controllerClosed = true;
                  break;
                }
              }
            }
          }

          // 保存助手回复到数据库（如果有 sessionId）
          if (sessionId && assistantContent && !controllerClosed) {
            try {
              await conversationHistoryManager.saveMessage({
                agentId: id,
                sessionId,
                role: 'assistant',
                content: assistantContent,
                metadata: { hasTrigger: containsTrigger },
              });
            } catch (error) {
              console.error('Failed to save assistant message:', error);
            }
          }

          if (!controllerClosed) {
            try {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (e) {
              console.error('Error closing controller:', e);
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          if (!controllerClosed) {
            try {
              controller.error(error);
              controllerClosed = true;
            } catch (e) {
              console.error('Error reporting stream error:', e);
            }
          }
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in agent chat:', error);

    // 确保关闭数据库连接
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing database connection:', e);
      }
    }

    return handleRouteError(error, '处理失败');
  }
}
