/**
 * 缓存详细测试
 * 详细验证缓存的设置、获取、命中等行为
 */

import { Cache } from './src/lib/cache.ts';

console.log('='.repeat(60));
console.log('🧪 缓存详细测试');
console.log('='.repeat(60));

// 创建缓存实例
const cache = new Cache({
  ttl: 5 * 60 * 1000,
  maxSize: 1000,
});

console.log('\n📋 缓存实例已创建');

// 测试 1: 设置缓存
console.log('\n' + '='.repeat(60));
console.log('📝 测试 1: 设置缓存');
console.log('='.repeat(60));

const testData = { message: '测试数据' };
cache.set('test-key-1', testData);

console.log('✅ 已设置缓存: test-key-1');

// 测试 2: 获取缓存（第一次）
console.log('\n' + '='.repeat(60));
console.log('📝 测试 2: 获取缓存（第一次）');
console.log('='.repeat(60));

const result1 = cache.get('test-key-1');
console.log('结果:', result1);
console.log('是否一致:', JSON.stringify(result1) === JSON.stringify(testData) ? '✅ 一致' : '❌ 不一致');

// 测试 3: 获取缓存（第二次）
console.log('\n' + '='.repeat(60));
console.log('📝 测试 3: 获取缓存（第二次）');
console.log('='.repeat(60));

const result2 = cache.get('test-key-1');
console.log('结果:', result2);

// 测试 4: 获取不存在的缓存
console.log('\n' + '='.repeat(60));
console.log('📝 测试 4: 获取不存在的缓存');
console.log('='.repeat(60));

const result3 = cache.get('not-exist');
console.log('结果:', result3);
console.log('预期: null');

// 测试 5: 查看统计
console.log('\n' + '='.repeat(60));
console.log('📝 测试 5: 查看统计');
console.log('='.repeat(60));

const stats = cache.getStats();
console.log('统计:', JSON.stringify(stats, null, 2));

console.log('\n' + '='.repeat(60));
console.log('✅ 测试完成');
console.log('='.repeat(60));
