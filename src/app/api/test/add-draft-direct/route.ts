import { NextRequest, NextResponse } from 'next/server';
import { wechatAddDraft } from '@/lib/mcp/wechat-tools';

export async function POST(request: NextRequest) {
  try {
    const testArticle = {
      title: '保险知识普及：如何选择适合您的医疗险',
      author: '保险顾问团队',
      digest: '本文介绍如何选择适合的医疗险产品',
      content: `<p>随着人们对健康保障的重视程度不断提高，医疗险已成为许多家庭必备的保障之一。然而，面对市场上琳琅满目的医疗险产品，如何选择一款适合自己的产品成为了许多人关心的问题。</p>

<p><strong>一、了解医疗险的基本类型</strong></p>
<p>医疗险主要分为两种类型：定额给付型和费用报销型。定额给付型保险在被保险人患有合同约定的疾病时，保险公司会一次性支付约定的保险金；而费用报销型保险则是对被保险人因疾病或意外产生的医疗费用进行报销。</p>

<p><strong>二、选择医疗险的关键要素</strong></p>
<ul>
<li><strong>保障范围</strong>：选择医疗险时，首先要关注保障范围是否广泛，是否包含常见疾病和特殊疾病的治疗费用。</li>
<li><strong>免赔额</strong>：免赔额越低，实际获得的保障越多，但相应的保费可能也会更高。</li>
<li><strong>报销比例</strong>：报销比例越高，自付部分越少，保障力度越强。</li>
<li><strong>续保条件</strong>：优先选择保证续保的产品，避免因健康状况变化而失去保障。</li>
</ul>

<p><strong>三、不同人群的医疗险选择建议</strong></p>
<p>对于年轻人来说，可以选择保费较低、保障适中的产品；而对于中老年人，则应重点关注保障范围和续保条件。</p>

<p>总之，选择一款合适的医疗险需要综合考虑多方面因素。建议您在购买前详细了解产品条款，必要时可以咨询专业的保险顾问。</p>`,
      showCoverPic: false,
      needOpenComment: false,
    };

    console.log('[Test Route] 开始测试 add_draft...');
    
    const result = await wechatAddDraft({
      accountId: 'insurance-account',
      articles: [testArticle],
    });

    console.log('[Test Route] add_draft 结果:', JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: 'add_draft 测试完成',
      result,
    });
  } catch (error) {
    console.error('[Test Route] 执行失败:', error);
    return NextResponse.json({
      success: false,
      message: '执行失败',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
