/**
 * 更新 capability_list 表中的合规审核能力名称
 * 将"微信公众号内容合规审核"改为"保险内容合规审核（支持全平台）"
 * 
 * 背景：合规审核能力实际是通用的，支持所有平台（微信公众号、小红书、知乎、头条、微博等）
 * 但旧名称"微信公众号内容合规审核"导致 Agent T 拒绝执行其他平台的合规校验任务
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[DB] 开始更新 capability_list 合规审核能力名称...');

    // 1. 查询当前记录
    const beforeUpdate = await db
      .select()
      .from(capabilityList)
      .where(inArray(capabilityList.id, [20, 21]));

    console.log('[DB] 更新前记录:', beforeUpdate);

    // 2. 更新 ID=20（完整审核）
    const result20 = await db
      .update(capabilityList)
      .set({
        functionDesc: '保险内容合规审核（关键词 + RAG + LLM 三层审核，支持全平台）',
        metadata: {
          platforms: ['wechat_official', 'xiaohongshu', 'zhihu', 'douyin', 'weibo'],
          description: '支持所有平台的保险内容合规审核，包括微信公众号、小红书、知乎、头条、微博等',
        },
      })
      .where(eq(capabilityList.id, 20))
      .returning();

    console.log('[DB] 更新 ID=20:', result20);

    // 3. 更新 ID=21（快速检查）
    const result21 = await db
      .update(capabilityList)
      .set({
        functionDesc: '保险内容合规审核（快速检查 - 仅关键词匹配，支持全平台）',
        metadata: {
          platforms: ['wechat_official', 'xiaohongshu', 'zhihu', 'douyin', 'weibo'],
          description: '支持所有平台的保险内容快速合规检查，仅使用关键词匹配',
        },
      })
      .where(eq(capabilityList.id, 21))
      .returning();

    console.log('[DB] 更新 ID=21:', result21);

    return NextResponse.json({
      success: true,
      message: '成功更新合规审核能力名称为通用名称',
      before: beforeUpdate,
      after: {
        id20: result20[0],
        id21: result21[0],
      },
    });
  } catch (error) {
    console.error('[DB] 更新失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新失败',
    }, { status: 500 });
  }
}
