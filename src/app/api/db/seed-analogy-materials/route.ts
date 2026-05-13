/**
 * 数据库迁移 API：预置产品测评和投保指南的类比素材数据
 * 
 * Phase 2 所需的预置素材：
 * - 产品测评类比素材（5条）：买车类比、买房类比、投资类比、手机类比、体检类比
 * - 投保指南类比素材（5条）：导航类比、驾照类比、雨伞类比、防火墙类比、保险箱类比
 * - 误区辟谣类比素材（5条）：已覆盖在现有行业案例中
 * 
 * GET: 查看预置数据状态
 * POST: 执行预置数据迁移
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, sql } from 'drizzle-orm';

// 产品测评类比素材
const PRODUCT_EVAL_MATERIALS = [
  {
    title: '买车看配置 vs 买保险看条款',
    content: '买车时你会仔细对比发动机参数、安全配置、油耗数据，因为不同配置意味着不同的驾驶体验和安全保障。买保险也是一样——保障范围、免赔额、等待期、续保条件就是保险的"配置参数"，不看清楚就下单，等于闭眼买豪车却不看配置表。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['产品测评', '买车类比', '条款对比'],
    sceneTags: ['开头案例', '收益对比'],
    emotionTags: ['理性', '专业'],
  },
  {
    title: '买房看地段 vs 买保险看保障',
    content: '买房最重要的三件事：地段、地段、还是地段。买保险最重要的三件事：保障、保障、还是保障。不要被花哨的分红收益吸引眼球，核心保障是否覆盖你的风险缺口，才是"地段"所在。好地段的房子抗跌，好保障的产品抗风险。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['产品测评', '买房类比', '保障优先'],
    sceneTags: ['开头案例', '收益对比'],
    emotionTags: ['理性', '专业'],
  },
  {
    title: '投资看底层资产 vs 保险看底层条款',
    content: '聪明人投资前会研究底层资产——这支基金投的是什么、风险等级如何、历史回撤多大。买保险也需要研究"底层条款"——保障责任是什么、除外责任有哪些、理赔条件是否苛刻。只看收益率的投资是赌博，只看保额的保险也是。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['产品测评', '投资类比', '底层条款'],
    sceneTags: ['收益对比', '专业分析'],
    emotionTags: ['理性', '专业'],
  },
  {
    title: '手机参数对比 vs 保险条款对比',
    content: '买手机时你会对比处理器、摄像头、电池容量、屏幕素质，因为有对比才知道哪款适合自己。保险产品同样需要"参数对比"：保障范围、等待期、免赔额、续保条件、增值服务，只有逐条对比，才能找到最适合自己需求的那款。别让"看起来差不多"蒙蔽了判断。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['产品测评', '手机类比', '参数对比'],
    sceneTags: ['收益对比', '专业分析'],
    emotionTags: ['理性', '专业'],
  },
  {
    title: '体检选套餐 vs 保险选方案',
    content: '体检时不同套餐覆盖不同检查项目——基础套餐只查常规，高端套餐加CT加核磁。保险方案也是一样：低保费方案只覆盖基础风险，全面方案覆盖重疾+医疗+意外。选择的关键不是"越贵越好"，而是"这个套餐是否覆盖我的健康风险盲区"。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['产品测评', '体检类比', '方案选择'],
    sceneTags: ['开头案例', '收益对比'],
    emotionTags: ['理性', '省钱'],
  },
];

// 投保指南类比素材
const INSURANCE_GUIDE_MATERIALS = [
  {
    title: '导航规划路线 vs 保险规划保障',
    content: '出门远行你会用导航规划路线——先看目的地，再选最优路径，中途还要留意限速和路况。保险规划就是人生的"导航系统"：先明确保障目标（目的地），再选择合适的险种组合（路线），还要定期检视保单是否需要调整（留意路况变化）。没有导航的旅行容易走弯路，没有规划的保障容易留死角。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['投保指南', '导航类比', '保障规划'],
    sceneTags: ['开头案例', '专业分析'],
    emotionTags: ['理性', '专业'],
  },
  {
    title: '考驾照分步骤 vs 买保险分阶段',
    content: '考驾照要先学科目一理论，再学科目二桩考，然后科目三路考，最后科目四安全文明。没有人一上来就上高速。买保险也需要分阶段：先配基础保障（医疗险+意外险），再加重疾保障，然后考虑养老和教育规划。一口吃不成胖子，一步到位也不现实。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['投保指南', '驾照类比', '分阶段投保'],
    sceneTags: ['开头案例', '专业分析'],
    emotionTags: ['理性', '专业'],
  },
  {
    title: '出门带伞 vs 提前投保',
    content: '晴天出门你会看天气预报，如果可能下雨就带把伞——不是因为现在在下雨，而是为可能到来的雨做准备。保险就是人生的"那把伞"：在你健康时投保，不是因为你现在需要理赔，而是为未来可能的风险做好准备。等到下雨再找伞，已经来不及了。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['投保指南', '雨伞类比', '提前规划'],
    sceneTags: ['开头案例', '理赔纠纷'],
    emotionTags: ['温情', '警醒'],
  },
  {
    title: '电脑装防火墙 vs 保险做防火墙',
    content: '电脑要装防火墙防病毒、防黑客、防勒索软件，不装防火墙裸奔上网，早晚中招。人也一样需要"防火墙"：社保是系统自带的防火墙（基础防护），商保是第三方专业防火墙（深度防护）。只靠社保裸奔在风险社会里，就像只用Windows Defender就敢随意下载——不是不行，但风险自负。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['投保指南', '防火墙类比', '社保+商保'],
    sceneTags: ['开头案例', '专业分析'],
    emotionTags: ['理性', '警醒'],
  },
  {
    title: '贵重物品存保险箱 vs 风险用保险转嫁',
    content: '你会把房产证、存折、贵重首饰放进保险箱，因为这些东西太重要，不能有闪失。同样，你最重要的"资产"——健康、收入能力、家庭责任——也需要一个"保险箱"来守护。保险就是人生的保险箱：把你无法承受的风险锁进去，让保险公司来承担。',
    materialType: 'case' as const,
    sceneType: 'analogy' as const,
    sourceType: 'system_admin',
    ownerType: 'system' as const,
    topicTags: ['投保指南', '保险箱类比', '风险转嫁'],
    sceneTags: ['开头案例', '专业分析'],
    emotionTags: ['理性', '专业'],
  },
];

export async function GET(_request: NextRequest) {
  try {
    const db = getDatabase();
    
    // 检查已有的预置素材数量
    const existingCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(materialLibrary)
      .where(eq(materialLibrary.ownerType, 'system'))
      .then(rows => rows[0]?.count || 0);

    // 检查产品测评/投保指南类素材
    const analogyCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(materialLibrary)
      .where(sql`${materialLibrary.topicTags}::text LIKE '%产品测评%' OR ${materialLibrary.topicTags}::text LIKE '%投保指南%'`)
      .then(rows => rows[0]?.count || 0);

    return NextResponse.json({
      status: 'ok',
      existingSystemMaterials: existingCount,
      existingAnalogyMaterials: analogyCount,
      toInsert: {
        productEval: PRODUCT_EVAL_MATERIALS.length,
        insuranceGuide: INSURANCE_GUIDE_MATERIALS.length,
        total: PRODUCT_EVAL_MATERIALS.length + INSURANCE_GUIDE_MATERIALS.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: '检查预置数据状态失败', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    const db = getDatabase();
    // 系统素材不绑定 workspaceId
    
    let inserted = 0;
    let skipped = 0;

    // 检查是否已存在同标题的预置素材（避免重复插入）
    const allMaterials = [...PRODUCT_EVAL_MATERIALS, ...INSURANCE_GUIDE_MATERIALS];
    
    for (const mat of allMaterials) {
      // 检查同标题是否已存在
      const existing = await db
        .select({ id: materialLibrary.id })
        .from(materialLibrary)
        .where(eq(materialLibrary.title, mat.title))
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(materialLibrary).values({
        title: mat.title,
        content: mat.content,
        type: mat.materialType,
        sceneType: mat.sceneType,
        sourceType: mat.sourceType,
        ownerType: mat.ownerType,
        topicTags: mat.topicTags,
        sceneTags: mat.sceneTags,
        emotionTags: mat.emotionTags,
        workspaceId: null, // 系统素材不绑定工作区
        useCount: 0,
      });
      inserted++;
    }

    return NextResponse.json({
      success: true,
      message: `预置类比素材迁移完成：插入 ${inserted} 条，跳过 ${skipped} 条（已存在）`,
      inserted,
      skipped,
      total: allMaterials.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '预置类比素材迁移失败', detail: String(error) },
      { status: 500 }
    );
  }
}
