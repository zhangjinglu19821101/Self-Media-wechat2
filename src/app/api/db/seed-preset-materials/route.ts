/**
 * 预置系统素材初始化 API
 * 插入设计文档 3.4 节定义的 26 条预置素材
 * GET /api/db/seed-preset-materials
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, and, count } from 'drizzle-orm';

// 误区素材 (6条)
const MISCONCEPTION_MATERIALS = [
  {
    title: '重疾险确诊即赔',
    content: '很多人以为重疾险是"确诊即赔"，实际上重疾险的赔付条件分为三类：1)确诊即赔（如恶性肿瘤）；2)实施了约定手术才赔（如冠状动脉搭桥术）；3)达到约定状态才赔（如脑中风后遗症需确诊180天后仍有后遗症）。并非所有重疾都是确诊即赔。',
    materialType: 'case',
    sourceType: 'system_admin',
    topicTags: ['重疾险', '理赔'],
    sceneTags: ['误区纠正', '理赔纠纷'],
    emotionTags: ['踩坑', '避坑'],
    sceneType: 'misconception',
    summary: '重疾险并非所有病种都确诊即赔，分三类赔付条件',
  },
  {
    title: '医疗险和重疾险是同一回事',
    content: '医疗险是报销制，花多少报多少，凭发票报销；重疾险是给付制，确诊符合条件直接赔付保额，与实际花费无关。两者的功能完全不同：医疗险解决看病费用，重疾险弥补收入损失和康复费用。',
    materialType: 'case',
    sourceType: 'system_admin',
    topicTags: ['医疗险', '重疾险'],
    sceneTags: ['误区纠正', '产品对比'],
    emotionTags: ['踩坑', '避坑'],
    sceneType: 'misconception',
    summary: '医疗险报销制vs重疾险给付制，功能完全不同',
  },
  {
    title: '有了社保就不需要商业保险',
    content: '社保有起付线、封顶线、报销比例和目录限制。以北京职工医保为例，住院报销比例85%封顶30万，但自费药、进口器械等都不在报销范围内。重大疾病平均治疗费用50万+，社保只能覆盖其中一部分，剩余需要商业保险来补充。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['医疗险', '社保'],
    sceneTags: ['误区纠正', '收益对比'],
    emotionTags: ['踩坑', '避坑'],
    sceneType: 'misconception',
    summary: '社保有报销限制，重大疾病自费部分需商业险补充',
  },
  {
    title: '买了保险什么都能赔',
    content: '每份保险都有保障范围和免责条款。比如意外险不赔疾病导致的医疗费用，医疗险不赔既往症，重疾险只赔条款中列明的疾病。买了保险不等于什么都能赔，关键要看清保障范围和免责条款。',
    materialType: 'case',
    sourceType: 'system_admin',
    topicTags: ['意外险', '理赔'],
    sceneTags: ['误区纠正', '理赔纠纷'],
    emotionTags: ['踩坑', '避坑'],
    sceneType: 'misconception',
    summary: '每份保险有保障范围和免责条款，不是什么都赔',
  },
  {
    title: '保费越贵保障越好',
    content: '保费高低受多种因素影响：保障范围、保额、缴费年限、被保人年龄等。贵不一定好，便宜也不一定差。关键看保障内容是否匹配需求。有些产品保费高是因为返还功能或附加了不必要的保障，而非核心保障更好。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['重疾险', '意外险'],
    sceneTags: ['误区纠正', '收益对比'],
    emotionTags: ['省钱', '避坑'],
    sceneType: 'misconception',
    summary: '保费高低受多因素影响，贵不等于保障更好',
  },
  {
    title: '年轻人不需要买保险',
    content: '年轻人虽然患病概率低，但一旦发生风险，经济损失可能更大。25-35岁是收入增长黄金期，一旦因大病或意外中断收入，房贷车贷和家庭开支将面临巨大压力。越年轻投保，保费越低，核保也更容易通过。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['重疾险', '意外险'],
    sceneTags: ['误区纠正', '收益对比'],
    emotionTags: ['警惕', '避坑'],
    sceneType: 'misconception',
    summary: '年轻人风险概率低但经济损失大，越早投保越划算',
  },
];

// 类比素材 (8条)
const ANALOGY_MATERIALS = [
  {
    title: '保险是雨伞',
    content: '保险就像雨伞：晴天时嫌多余，雨天时恨没带。你不会因为今天不下雨就扔掉雨伞，也不会因为买了雨伞就盼着下雨。保险也是一样——不是为了用上，而是为了万一需要时不至于淋雨。',
    materialType: 'quote',
    sourceType: 'system_admin',
    topicTags: ['保险理念'],
    sceneTags: ['开头案例', '理念说服'],
    emotionTags: ['温情', '共情'],
    sceneType: 'analogy',
    summary: '保险如雨伞，不为用上，为防万一',
  },
  {
    title: '保险是备胎',
    content: '每辆车上都有一个备胎，没人希望用到它，但没人会因为它占地方就扔掉。保险就是家庭财务的备胎——正常时候看不到它的价值，但关键时刻它是唯一能让你继续前行的保障。',
    materialType: 'quote',
    sourceType: 'system_admin',
    topicTags: ['保险理念'],
    sceneTags: ['开头案例', '理念说服'],
    emotionTags: ['理性', '专业'],
    sceneType: 'analogy',
    summary: '保险如备胎，关键时刻是唯一保障',
  },
  {
    title: '保险是灭火器',
    content: '写字楼每层都配灭火器，不是因为这栋楼一定会着火，而是万一着火，没有灭火器的后果不可承受。保险是家庭财务的灭火器——概率虽低，后果太重，必须准备。',
    materialType: 'quote',
    sourceType: 'system_admin',
    topicTags: ['保险理念'],
    sceneTags: ['开头案例', '理念说服'],
    emotionTags: ['警示', '理性'],
    sceneType: 'analogy',
    summary: '保险如灭火器，概率虽低后果太重',
  },
  {
    title: '保费是停车费',
    content: '有人觉得每年交保费太亏，就像有人觉得停车场收费太贵。但你想：停车费再贵，也比违章停车被贴罚单便宜得多；保费再心疼，也比一场大病自掏几十万划算得多。保费的代价是确定的、可控的，风险的代价是不确定的、不可控的。',
    materialType: 'quote',
    sourceType: 'system_admin',
    topicTags: ['保险理念', '保费'],
    sceneTags: ['收益对比', '理念说服'],
    emotionTags: ['理性', '省钱'],
    sceneType: 'analogy',
    summary: '保费如停车费，确定的代价vs不确定的风险',
  },
  {
    title: '重疾险是收入补偿',
    content: '很多人以为重疾险是"看病钱"，其实医疗险才是看病钱，重疾险是"生活钱"。就像公司给你发的病假工资——不是因为看病需要花钱，而是因为不上班就没有收入。重疾险保额建议覆盖3-5年收入，就是这3-5年你不用为钱发愁，安心养病。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['重疾险'],
    sceneTags: ['产品对比', '收益对比'],
    emotionTags: ['理性', '专业'],
    sceneType: 'analogy',
    summary: '重疾险是收入补偿，建议保额覆盖3-5年收入',
  },
  {
    title: '医疗险是医保的补充层',
    content: '如果把医疗体系比作穿衣：社保是内衣（基础覆盖），百万医疗是外套（大额补充），小额医疗是帽子（日常小额）。光穿内衣冬天会冷，光穿外套里面漏风。合理的医疗保障需要多层搭配，不是二选一。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['医疗险', '社保'],
    sceneTags: ['产品对比', '理念说服'],
    emotionTags: ['理性', '专业'],
    sceneType: 'analogy',
    summary: '医疗保障需多层搭配：社保+百万医疗+小额医疗',
  },
  {
    title: '买保险是给风险定价',
    content: '没人能阻止风险发生，但你可以选择是自己承担后果还是转移给保险公司。这就像房价：你可以选择全款买房（自担风险），也可以选择贷款（保费换保障）。买保险本质上是给风险标了一个你能承受的价格。',
    materialType: 'quote',
    sourceType: 'system_admin',
    topicTags: ['保险理念'],
    sceneTags: ['理念说服', '收益对比'],
    emotionTags: ['理性', '专业'],
    sceneType: 'analogy',
    summary: '买保险是给风险标一个你能承受的价格',
  },
  {
    title: '保单是家庭的防火墙',
    content: '电脑装防火墙不是因为你一定会中毒，而是把风险挡在外面。家庭也需要防火墙：一场大病可能烧掉积蓄，一次意外可能烧掉未来。保单就是那道防火墙，把风险挡在家庭之外。',
    materialType: 'quote',
    sourceType: 'system_admin',
    topicTags: ['保险理念'],
    sceneTags: ['开头案例', '理念说服'],
    emotionTags: ['警示', '理性'],
    sceneType: 'analogy',
    summary: '保单是家庭防火墙，把风险挡在外面',
  },
];

// 法规素材 (8条)
const REGULATION_MATERIALS = [
  {
    title: '《健康保险管理办法》第二十七条',
    content: '2020年银保监会《健康保险管理办法》第二十七条：健康保险产品不得设置不合理的产品责任免除条款，不得以被保险人健康状况为依据设置差异化的保障范围。这意味着保险公司不能因为你的体检异常就随意拒赔，只要投保时如实告知，合同生效后就必须按约赔付。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['理赔', '健康险'],
    sceneTags: ['法规引用', '理赔纠纷'],
    emotionTags: ['专业', '理性'],
    sceneType: 'regulation',
    summary: '健康险不得设置不合理免责条款，如实告知后必须赔付',
  },
  {
    title: '《保险法》第十六条如实告知义务',
    content: '《保险法》第十六条规定：订立保险合同，保险人就保险标的或者被保险人的有关情况提出询问的，投保人应当如实告知。投保人故意或者因重大过失未履行如实告知义务，足以影响保险人决定是否同意承保或者提高保险费率的，保险人有权解除合同。关键点：是"询问告知"而非"无限告知"，保险公司问什么答什么，不问可以不说。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['理赔', '投保'],
    sceneTags: ['法规引用', '理赔纠纷'],
    emotionTags: ['专业', '理性'],
    sceneType: 'regulation',
    summary: '如实告知是询问告知，非无限告知，不问可不说',
  },
  {
    title: '《保险法》第三十条不利解释原则',
    content: '《保险法》第三十条：采用保险人提供的格式条款订立的保险合同，保险人与投保人、被保险人或者受益人对合同条款有争议的，应当按照通常理解予以解释。对合同条款有两种以上解释的，人民法院或者仲裁机构应当作出有利于被保险人和受益人的解释。这被称为"不利解释原则"，是保护消费者的利器。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['理赔'],
    sceneTags: ['法规引用', '理赔纠纷'],
    emotionTags: ['专业', '理性'],
    sceneType: 'regulation',
    summary: '格式条款争议应作有利于被保险人的解释',
  },
  {
    title: '《个人养老金实施办法》',
    content: '2022年人社部等五部门联合发布《个人养老金实施办法》，明确个人养老金制度：每年缴费上限12000元，可享受税前扣除优惠。投资收益暂不征税，领取时仅按3%缴纳个税。这是国家鼓励个人养老储蓄的政策，商业养老保险是个人养老金的重要投资方向。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['养老险', '税优'],
    sceneTags: ['法规引用', '收益对比'],
    emotionTags: ['专业', '理性'],
    sceneType: 'regulation',
    summary: '个人养老金年缴1.2万享税优，领取仅3%个税',
  },
  {
    title: '《互联网保险业务监管办法》',
    content: '2021年银保监会《互联网保险业务监管办法》：互联网保险产品必须充分披露产品信息，不得进行虚假宣传或误导性描述。消费者通过互联网购买保险，享有15天犹豫期（长期险），犹豫期内退保无损失。这一规定保障了线上投保的消费者权益。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['投保', '互联网保险'],
    sceneTags: ['法规引用', '权益保护'],
    emotionTags: ['专业', '理性'],
    sceneType: 'regulation',
    summary: '互联网保险需充分披露信息，长期险享15天犹豫期',
  },
  {
    title: '《保险销售行为可回溯管理办法》',
    content: '2017年原保监会《保险销售行为可回溯管理办法》：保险销售关键环节需录音录像（双录），包括投保人确认投保意愿、了解产品责任免除、确认如实告知等。双录制度保护消费者知情权，也规范了销售行为。如遇销售误导，双录是重要维权证据。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['投保', '销售'],
    sceneTags: ['法规引用', '权益保护'],
    emotionTags: ['专业', '理性'],
    sceneType: 'regulation',
    summary: '保险销售需双录，关键环节录音录像保护消费者',
  },
  {
    title: '《重大疾病保险的疾病定义使用规范》2020修订版',
    content: '2020年中国保险行业协会、中国医师协会联合发布《重大疾病保险的疾病定义使用规范》（2020修订版），统一定义了28种重大疾病和3种轻度疾病。所有重疾险必须包含28种重疾，且不得超出规范定义。这保证了重疾险产品核心保障的一致性，消费者不必担心不同公司重疾定义差异过大。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['重疾险'],
    sceneTags: ['法规引用', '产品对比'],
    emotionTags: ['专业', '理性'],
    sceneType: 'regulation',
    summary: '2020版重疾规范统一28种重疾+3种轻症定义',
  },
  {
    title: '银保监会《关于规范短期健康保险的通知》',
    content: '2021年银保监会《关于规范短期健康保险的通知》：短期健康险（含百万医疗）不得在条款中使用"终身保证续保"等误导性表述，必须在产品条款中明确标注"不保证续保"。消费者购买百万医疗时需注意区分"保证续保"和"不保证续保"产品，了解续保条件和停售风险。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['医疗险', '百万医疗'],
    sceneTags: ['法规引用', '误区纠正'],
    emotionTags: ['警惕', '专业'],
    sceneType: 'regulation',
    summary: '短期健康险不得标注"终身保证续保"，需注意续保条件',
  },
];

// 事件素材 (4条)
const EVENT_MATERIALS = [
  {
    title: '2023年甲状腺癌理赔数据',
    content: '据某大型保险公司2023年理赔报告：甲状腺癌在重疾险理赔中占比超30%，女性甲状腺癌理赔率是男性的3倍。2020年重疾新规将TNM分期T1N0M0的甲状腺癌从重疾调整为轻症（赔付比例30%），意味着早期甲状腺癌只能获得轻症赔付。建议女性投保时特别关注甲状腺相关保障和轻症赔付比例。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['重疾险', '甲状腺癌'],
    sceneTags: ['数据支撑', '理赔案例'],
    emotionTags: ['理性', '专业'],
    sceneType: 'event',
    summary: '甲状腺癌占重疾理赔30%+，新规后早期降为轻症',
  },
  {
    title: '2024年百万医疗险理赔趋势',
    content: '2024年行业数据显示：百万医疗险人均理赔金额约1.8万元，其中住院医疗占比超60%。理赔高发疾病为：恶性肿瘤（25%）、心脑血管疾病（18%）、呼吸系统疾病（12%）。百万医疗险的高免赔额（通常1万元）意味着小病用不上，但一旦发生大额医疗支出，保障价值非常显著。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['医疗险', '百万医疗'],
    sceneTags: ['数据支撑', '收益对比'],
    emotionTags: ['理性', '专业'],
    sceneType: 'event',
    summary: '百万医疗人均理赔1.8万，高免赔额下大额支出才有价值',
  },
  {
    title: '年轻人猝死事件频发',
    content: '2023-2024年多家媒体报道年轻人猝死事件增多，30-40岁成为高发年龄段。值得关注的是：猝死通常不在意外险保障范围内（意外险要求"外来的、突发的、非本意的、非疾病的"，而猝死本质是疾病导致），需要通过寿险或含身故责任的重疾险来覆盖这一风险。',
    materialType: 'case',
    sourceType: 'system_admin',
    topicTags: ['意外险', '寿险', '重疾险'],
    sceneTags: ['开头案例', '理赔纠纷'],
    emotionTags: ['警示', '警惕'],
    sceneType: 'event',
    summary: '猝死属疾病非意外，意外险不赔需靠寿险/重疾险',
  },
  {
    title: '保险消费投诉数据分析',
    content: '2023年银保监会消费者权益保护局通报：保险消费投诉中，理赔纠纷占比42%，销售误导占比28%，退保纠纷占比15%。理赔纠纷主要集中在：1)不如实告知被拒赔；2)疾病不在保障范围；3)等待期内出险。这些数据提醒消费者：投保时如实告知、了解保障范围和等待期至关重要。',
    materialType: 'data',
    sourceType: 'system_admin',
    topicTags: ['理赔', '投保'],
    sceneTags: ['数据支撑', '理赔纠纷'],
    emotionTags: ['警惕', '理性'],
    sceneType: 'event',
    summary: '理赔投诉占42%，如实告知和了解保障范围是关键',
  },
];

const ALL_MATERIALS = [
  ...MISCONCEPTION_MATERIALS,
  ...ANALOGY_MATERIALS,
  ...REGULATION_MATERIALS,
  ...EVENT_MATERIALS,
];

export async function GET() {
  try {
    // 检查是否已插入
    const existingCount = await db
      .select({ cnt: count() })
      .from(materialLibrary)
      .where(and(eq(materialLibrary.sourceType, 'system_admin'), eq(materialLibrary.ownerType, 'system')));

    if (existingCount[0]?.cnt >= ALL_MATERIALS.length) {
      return NextResponse.json({
        success: true,
        message: `预置素材已存在(${existingCount[0].cnt}条)，跳过插入`,
        count: existingCount[0].cnt,
      });
    }

    const now = new Date();
    const defaultWorkspaceId = 'system-preset';

    const values = ALL_MATERIALS.map((m) => ({
      workspaceId: defaultWorkspaceId,
      title: m.title,
      content: m.content,
      type: m.materialType,
      sourceType: m.sourceType as 'system_admin',
      ownerType: 'system' as const,
      topicTags: m.topicTags,
      sceneTags: m.sceneTags,
      emotionTags: m.emotionTags,
      sceneType: m.sceneType,
      summary: m.summary,
      status: 'active' as const,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    }));

    await db.insert(materialLibrary).values(values).onConflictDoNothing();

    return NextResponse.json({
      success: true,
      message: `成功插入${values.length}条预置系统素材`,
      count: values.length,
      breakdown: {
        misconception: MISCONCEPTION_MATERIALS.length,
        analogy: ANALOGY_MATERIALS.length,
        regulation: REGULATION_MATERIALS.length,
        event: EVENT_MATERIALS.length,
      },
    });
  } catch (error) {
    console.error('[SeedPresetMaterials] 插入失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
