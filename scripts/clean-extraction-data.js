/**
 * 清理文章提取相关数据脚本
 * 
 * 清理范围：
 * 1. article_extractions - 文章提取主表
 * 2. extraction_layers - 层级提取结果
 * 3. extraction_assets - 数字资产
 * 4. material_library - 来源为 article 的素材
 */

const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require'
});

async function main() {
  await client.connect();
  console.log('数据库连接成功\n');

  // 设置 search_path 到 dev_schema
  await client.query('SET search_path TO dev_schema, public');
  console.log('已设置 search_path: dev_schema, public\n');

  // 0. 检查现有表
  console.log('=== 相关表 ===');
  const tablesResult = await client.query(`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name LIKE '%extraction%' OR table_name LIKE '%material%'
    ORDER BY table_schema, table_name
  `);
  console.log(tablesResult.rows);
  console.log('');

  // 1. 查询数据量
  console.log('=== 当前数据量 ===');
  const tables = [
    { name: 'article_extractions', sql: 'SELECT COUNT(*) as count FROM article_extractions' },
    { name: 'extraction_layers', sql: 'SELECT COUNT(*) as count FROM extraction_layers' },
    { name: 'extraction_assets', sql: 'SELECT COUNT(*) as count FROM extraction_assets' },
    { name: 'material_library (article来源)', sql: "SELECT COUNT(*) as count FROM material_library WHERE source_type = 'article'" },
    { name: 'material_library (全部)', sql: 'SELECT COUNT(*) as count FROM material_library' },
  ];

  for (const t of tables) {
    try {
      const result = await client.query(t.sql);
      console.log(`${t.name}: ${result.rows[0].count} 条`);
    } catch (e) {
      console.log(`${t.name}: 表不存在 - ${e.message}`);
    }
  }

  // 2. 确认是否清理
  console.log('\n=== 执行清理 ===');
  
  // 开始事务
  await client.query('BEGIN');

  try {
    // 清理顺序：先删子表，再删主表
    
    // 2.1 删除 extraction_assets
    const assetsResult = await client.query('DELETE FROM extraction_assets RETURNING id');
    console.log(`✓ 删除 extraction_assets: ${assetsResult.rowCount} 条`);

    // 2.2 删除 extraction_layers
    const layersResult = await client.query('DELETE FROM extraction_layers RETURNING id');
    console.log(`✓ 删除 extraction_layers: ${layersResult.rowCount} 条`);

    // 2.3 删除 article_extractions
    const extractionsResult = await client.query('DELETE FROM article_extractions RETURNING id');
    console.log(`✓ 删除 article_extractions: ${extractionsResult.rowCount} 条`);

    // 2.4 删除 material_library 中来源为 article 的素材
    const materialsResult = await client.query("DELETE FROM material_library WHERE source_type = 'article' RETURNING id");
    console.log(`✓ 删除 material_library (article来源): ${materialsResult.rowCount} 条`);

    // 提交事务
    await client.query('COMMIT');
    console.log('\n✅ 清理完成！');

  } catch (e) {
    await client.query('ROLLBACK');
    console.log('\n❌ 清理失败，已回滚:', e.message);
  }

  await client.end();
}

main().catch(console.error);
