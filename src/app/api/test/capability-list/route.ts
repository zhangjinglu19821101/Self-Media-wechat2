import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq, like } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = db.select().from(capabilityList);
    
    if (search) {
      query = query.where(like(capabilityList.functionDesc, `%${search}%`));
    }

    const capabilities = await query.limit(50);

    return NextResponse.json({
      success: true,
      data: capabilities
    });
  } catch (error) {
    console.error('查询 capability_list 失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '查询失败' 
    }, { status: 500 });
  }
}
