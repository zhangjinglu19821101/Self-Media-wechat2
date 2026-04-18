
const fs = require('fs');

// 读取文件
const filePath = 'src/lib/services/cron-split-trigger.ts';
const content = fs.readFileSync(filePath, 'utf8');

// 替换 HTML 实体编码
const fixedContent = content
  .replace(/&amp;lt;/g, '&lt;')
  .replace(/&amp;gt;/g, '&gt;')
  .replace(/&amp;amp;/g, '&amp;')
  .replace(/&lt;/g, '&lt;')
  .replace(/&gt;/g, '&gt;')
  .replace(/&amp;/g, '&amp;');

// 写回文件
fs.writeFileSync(filePath, fixedContent, 'utf8');

console.log('✅ 文件编码问题已修复');
