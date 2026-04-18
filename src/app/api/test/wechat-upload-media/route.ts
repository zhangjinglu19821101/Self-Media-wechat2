import { NextRequest, NextResponse } from 'next/server';
import { wechatUploadMedia, wechatAddDraft } from '@/lib/mcp/wechat-tools';
import { DEFAULT_THUMB_BASE64 } from '@/config/default-thumb-base64';

export async function POST(request: NextRequest) {
  try {
    console.log('[Test Full Flow] 测试完整的草稿上传流程...');
    
    // 1. 上传封面图片
    console.log('[Test Full Flow] 步骤1: 上传封面图片...');
    const uploadResult = await wechatUploadMedia({
      accountId: 'insurance-account',
      mediaType: 'image',
      fileBase64: DEFAULT_THUMB_BASE64,
    });
    
    console.log('[Test Full Flow] 封面上传结果:', JSON.stringify(uploadResult));
    
    if (!uploadResult.success || !uploadResult.data?.mediaId) {
      return NextResponse.json({
        success: false,
        step: 'upload_thumb',
        error: uploadResult.error || '封面上传失败',
      });
    }
    
    // 2. 添加草稿
    console.log('[Test Full Flow] 步骤2: 添加草稿...');
    const draftResult = await wechatAddDraft({
      accountId: 'insurance-account',
      articles: [{
        title: '测试文章',
        author: '测试作者',
        digest: '这是测试摘要',
        content: '<p>这是测试内容</p>',
        thumb_media_id: uploadResult.data.mediaId,
        show_cover_pic: 1,
      }]
    });
    
    console.log('[Test Full Flow] 草稿添加结果:', JSON.stringify(draftResult));
    
    return NextResponse.json({
      success: draftResult.success,
      thumb: {
        mediaId: uploadResult.data.mediaId,
      },
      draft: draftResult,
    });
    
  } catch (error) {
    console.error('[Test Full Flow] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '测试失败',
    }, { status: 500 });
  }
}
