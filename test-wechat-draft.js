// 简单测试微信草稿箱接口
const { getDraftList, getAccessToken } = require('./src/lib/wechat-official-account/api');
const { getAccountById } = require('./src/config/wechat-official-account.config');

async function test() {
  console.log('🧪 开始测试微信草稿箱接口');
  
  try {
    // 1. 获取账号
    console.log('🔍 获取公众号账号...');
    const account = getAccountById('insurance-account');
    if (!account) {
      console.error('❌ 未找到账号');
      return;
    }
    console.log('✅ 账号获取成功:', { id: account.id, name: account.name });

    // 2. 测试获取 Access Token
    console.log('🔑 测试获取 Access Token...');
    const token = await getAccessToken(account);
    console.log('✅ Access Token 获取成功:', token.substring(0, 20) + '...');

    // 3. 测试获取草稿列表
    console.log('📋 测试获取草稿列表...');
    const draftList = await getDraftList(account, 0, 10);
    console.log('✅ 草稿列表获取成功:', draftList);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

test();
