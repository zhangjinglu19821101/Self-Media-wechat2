/**
 * 调试 API：查看 capability_list 表的数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const capability = await db.query.capabilityList.findFirst({
      where: eq(capabilityList.id, 11),
    });

    return NextResponse.json({
      success: true,
      data: capability,
      keys: Object.keys(capability || {}),
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
