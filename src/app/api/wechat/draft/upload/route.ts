/**
 * 草稿箱上传 API (增强版)
 * POST /api/wechat/draft/upload
 * 支持两种模式：
 * 1. 旧模式：agent, title, content
 * 2. 新模式：taskId, accountId, overrides (推荐)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentAccount,
  WechatDraft,
  WechatOfficialAccount,
  getDraftDefaults,
} from '@/config/wechat-official-account.config';
import {
  addDraft,
  formatArticleForWechat,
  uploadMedia,
  uploadPermanentThumb,
} from '@/lib/wechat-official-account/api';

/**
 * POST /api/wechat/draft/upload
 * 上传文章到公众号草稿箱
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 🔥 模式1：新模式 - 优先检查是否有 taskId
    if (body.taskId) {
      const { taskId, accountId, overrides } = body;
      
      console.log('[上传 API] 新模式 - taskId:', taskId);
      
      // 获取任务信息，提取 title 和 content
      let title = '';
      let content = '';
      let author = '';
      
      try {
        const taskResponse = await fetch(`${request.nextUrl.origin}/api/agents/tasks/${taskId}/detail`);
        const taskData = await taskResponse.json();
        
        if (taskData.success && taskData.data?.task) {
          const task = taskData.data.task;
          title = task.taskTitle || `文章 #${task.orderIndex}`;
          author = task.executor || '智者足迹-探寻';
          
          // 尝试从 MCP 执行记录中提取文章内容
          if (taskData.data?.mcpExecutions?.length > 0) {
            // 找最新的完成的 mcp 执行记录
            const completedMcp = taskData.data.mcpExecutions
              .filter((m: any) => m.status === 'success' || m.isSuccess)
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            
            if (completedMcp?.result) {
              if (typeof completedMcp.result === 'string') {
                content = completedMcp.result;
              } else if (completedMcp.result.content) {
                content = completedMcp.result.content;
              } else if (completedMcp.result.article) {
                content = completedMcp.result.article;
              }
            }
          }
          
          // 如果还没有内容，用任务描述
          if (!content && task.taskDescription) {
            content = task.taskDescription;
          }
        }
      } catch (error) {
        console.warn('[上传 API] 获取任务信息失败，继续使用默认值:', error);
      }
      
      // 验证必须参数
      if (!title) {
        title = '未命名文章';
      }
      if (!content) {
        content = '（文章内容待补充）';
      }
      
      // 获取公众号配置
      let account: WechatOfficialAccount | undefined;
      
      if (accountId) {
        const { getAccountById } = await import('@/config/wechat-official-account.config');
        account = getAccountById(accountId);
      } else {
        // 默认用 insurance-account
        account = getAgentAccount('insurance-d');
      }
      
      if (!account) {
        return NextResponse.json(
          {
            success: false,
            error: '未找到对应的公众号配置，请先配置公众号信息',
          },
          { status: 404 }
        );
      }
      
      if (!account.enabled) {
        return NextResponse.json(
          {
            success: false,
            error: '公众号已禁用',
          },
          { status: 400 }
        );
      }
      
      if (!account.appId || !account.appSecret) {
        return NextResponse.json(
          {
            success: false,
            error: '公众号配置不完整，请先配置 AppID 和 AppSecret',
          },
          { status: 400 }
        );
      }
      
      console.log('[上传 API] 新模式 - 准备上传:', { title, author, accountId: account.id });
      
      // 🔥 使用新版 formatArticleForWechat，支持完整配置
      const draft: WechatDraft = formatArticleForWechat(
        title,
        content,
        author,
        undefined,  // digest
        undefined,  // contentSourceUrl
        account.id, // accountId 用于获取默认配置
        overrides    // 用户临时配置覆盖
      );
      
      // 🔥🔥🔥 补充封面图片：微信公众号要求 thumb_media_id 必须是永久素材的 ID
      let thumbMediaId = draft.thumb_media_id;
      
      if (!thumbMediaId) {
        console.log('[上传 API] 没有封面图片，使用默认封面...');
        try {
          // 使用 MCP 工具相同的默认封面 URL
          const thumbResponse = await fetch('https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2F1774631936856.jpg&nonce=2028a82c-3c17-4dc8-8ece-5641a0d95db3&project_id=7601333505219002402&sign=25d962af92bff1d8f96b502598d1a893ea2d7a0fe937284647bca7c4cb8a5ac6');
          
          if (thumbResponse.ok) {
            const arrayBuffer = await thumbResponse.arrayBuffer();
            const thumbBuffer = Buffer.from(arrayBuffer);
            
            // 上传为永久素材
            const thumbResult = await uploadPermanentThumb(account, thumbBuffer);
            thumbMediaId = thumbResult.mediaId;
            
            console.log(`[上传 API] 永久缩略图上传成功，media_id: ${thumbMediaId}`);
          } else {
            console.warn(`[上传 API] 下载默认封面失败: ${thumbResponse.status}`);
          }
        } catch (thumbError: any) {
          console.error(`[上传 API] 上传永久缩略图失败: ${thumbError.message}`);
        }
      }
      
      // 组装最终草稿数据（包含封面）
      const finalDraft: WechatDraft = {
        ...draft,
        thumb_media_id: thumbMediaId,
      };
      
      // 上传到草稿箱
      const result = await addDraft(account, [finalDraft]);
      
      return NextResponse.json({
        success: true,
        data: {
          mediaId: result.media_id,
          createTime: result.create_time,
          account: {
            id: account.id,
            name: account.name,
          },
          draft: {
            title,
            author: draft.author,
            digest: draft.digest,
          },
        },
        message: '文章已成功上传到草稿箱',
      });
    }
    
    // 🔥 模式2：旧模式兼容 - agent, title, content
    const {
      agent,
      title,
      content,
      author,
      digest,
      contentSourceUrl,
      accountId,
    } = body;
    
    // 参数验证
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agent 必填（insurance-d 或 agent-d）',
        },
        { status: 400 }
      );
    }
    
    if (!title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：title 和 content 必填',
        },
        { status: 400 }
      );
    }
    
    // 获取公众号配置
    let account: WechatOfficialAccount | undefined;
    
    if (accountId) {
      const { getAccountById } = await import('@/config/wechat-official-account.config');
      account = getAccountById(accountId);
    } else {
      account = getAgentAccount(agent);
    }
    
    if (!account) {
      return NextResponse.json(
        {
          success: false,
          error: '未找到对应的公众号配置，请先配置公众号信息',
        },
        { status: 404 }
      );
    }
    
    if (!account.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: '公众号已禁用',
        },
        { status: 400 }
      );
    }
    
    if (!account.appId || !account.appSecret) {
      return NextResponse.json(
        {
          success: false,
          error: '公众号配置不完整，请先配置 AppID 和 AppSecret',
        },
        { status: 400 }
      );
    }
    
    // 格式化文章内容 - 使用新版，accountId 用于获取默认配置
    const draft: WechatDraft = formatArticleForWechat(
      title,
      content,
      author || account.defaultAuthor,
      digest,
      contentSourceUrl,
      accountId
    );
    
    // 🔥🔥🔥 补充封面图片：微信公众号要求 thumb_media_id 必须是永久素材的 ID
    let thumbMediaId = draft.thumb_media_id;
    
    if (!thumbMediaId) {
      console.log('[上传 API] 旧模式 - 没有封面图片，使用默认封面...');
      try {
        // 使用 MCP 工具相同的默认封面 URL
        const thumbResponse = await fetch('https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2F1774631936856.jpg&nonce=2028a82c-3c17-4dc8-8ece-5641a0d95db3&project_id=7601333505219002402&sign=25d962af92bff1d8f96b502598d1a893ea2d7a0fe937284647bca7c4cb8a5ac6');
        
        if (thumbResponse.ok) {
          const arrayBuffer = await thumbResponse.arrayBuffer();
          const thumbBuffer = Buffer.from(arrayBuffer);
          
          // 上传为永久素材
          const thumbResult = await uploadPermanentThumb(account, thumbBuffer);
          thumbMediaId = thumbResult.mediaId;
          
          console.log(`[上传 API] 旧模式 - 永久缩略图上传成功，media_id: ${thumbMediaId}`);
        } else {
          console.warn(`[上传 API] 旧模式 - 下载默认封面失败: ${thumbResponse.status}`);
        }
      } catch (thumbError: any) {
        console.error(`[上传 API] 旧模式 - 上传永久缩略图失败: ${thumbError.message}`);
      }
    }
    
    // 组装最终草稿数据（包含封面）
    const finalDraft: WechatDraft = {
      ...draft,
      thumb_media_id: thumbMediaId,
    };
    
    // 上传到草稿箱
    const result = await addDraft(account, [finalDraft]);
    
    return NextResponse.json({
      success: true,
      data: {
        mediaId: result.media_id,
        createTime: result.create_time,
        account: {
          id: account.id,
          name: account.name,
        },
        draft: {
          title,
          author: draft.author,
          digest: draft.digest,
        },
      },
      message: '文章已成功上传到草稿箱',
    });
  } catch (error: any) {
    console.error('上传草稿失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '上传草稿失败',
      },
      { status: 500 }
    );
  }
}
