
const { execSync } = require('child_process');
const fs = require('fs');

try {
  // 从 git 恢复文件
  const content = execSync('git show HEAD:src/lib/services/cron-split-trigger.ts', { encoding: 'utf8' });
  
  // 直接写回文件
  fs.writeFileSync('src/lib/services/cron-split-trigger.ts', content, 'utf8');
  
  console.log('✅ 文件已从 git 恢复');
} catch (error) {
  console.error('❌ 恢复失败:', error.message);
}
