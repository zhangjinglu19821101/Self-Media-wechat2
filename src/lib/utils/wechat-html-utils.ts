/**
 * 微信公众号 HTML 格式化工具
 * 
 * 新版规则（公众号API上传专用）：
 * - 所有内容必须使用 <p> 标签，禁止 <section>/<div>/<h1>-<h6>/<hr>
 * - 所有样式必须写在 style 属性内，禁止 <style> 标签
 * - 所有元素必须有 font-size、line-height 和 color
 * - 所有单位必须使用 px，禁止 em/rem
 * - 绝对禁止 !important
 */

/**
 * 清理微信 HTML 内容，确保符合公众号 API 上传格式规范
 * 
 * 规则：
 * 1. 移除 <style> 标签及其内容
 * 2. 移除 <section>/<div> 包裹标签（保留内容）
 * 3. 将 <h1>-<h6> 转换为 <p> 标签
 * 4. 将 <hr> 转换为 <p>+<span> 分割线
 * 5. 移除 !important
 * 6. 将 em/rem 单位替换为 px
 */
export function sanitizeWechatHtml(html: string): string {
  if (!html) return '';
  
  let processed = html.trim();
  
  // 移除 <style> 标签及其内容
  processed = processed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // 移除外层 <section>/<div> 包裹（新版不使用包裹）
  processed = processed.replace(/<\/?(section|div)[^>]*>/gi, '');
  
  // 将 <h1>-<h6> 转换为 <p> 标签（保留内联样式）
  processed = processed.replace(/<h([1-6])([^>]*)>/gi, '<p$2>');
  processed = processed.replace(/<\/h[1-6]>/gi, '</p>');
  
  // 移除 <hr> 标签（用 <p>+<span> 分割线替代）
  processed = processed.replace(/<hr[^>]*\/?>/gi, 
    '<p style="text-align:center; margin:0 0 16px 0; padding:0;"><span style="display:inline-block; width:60px; height:2px; background-color:#eee;"></span></p>');
  
  // 移除 !important
  processed = processed.replace(/!important/gi, '');
  
  // 将 em/rem 单位替换为 px（简单替换常见值）
  processed = processed.replace(/font-size:\s*([\d.]+)em/gi, (_, val) => {
    const px = Math.round(parseFloat(val) * 14);
    return `font-size:${px}px`;
  });
  processed = processed.replace(/font-size:\s*([\d.]+)rem/gi, (_, val) => {
    const px = Math.round(parseFloat(val) * 14);
    return `font-size:${px}px`;
  });
  
  // 如果内容为空，返回占位
  if (!processed.trim()) {
    processed = '<p style="margin:0 0 16px 0; padding:0 12px; color:#3E3E3E; font-size:14px; line-height:1.6;">（内容为空）</p>';
  }
  
  return processed;
}

/**
 * 估算微信公众号文章的渲染高度（像素）
 * 新版规则：所有内容使用 <p> 标签，不再有 <h2>/<h3>/<hr>
 */
export function estimateWechatArticleHeight(html: string): number {
  if (!html) return 0;
  
  const sanitized = sanitizeWechatHtml(html);
  const pCount = (sanitized.match(/<p[\s>]/gi) || []).length;
  
  // 每个 <p> 标签平均约 40px 高度（包含 margin/padding）
  // 这只是粗略估算，实际渲染高度取决于内容长度
  return pCount * 40 + 100; // 加 100px 作为顶部/底部留白
}
