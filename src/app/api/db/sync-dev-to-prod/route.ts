/**
 * 将 dev_schema 的表结构和素材数据同步到生产环境（public schema）
 *
 * 功能：
 * 1. 表结构同步：将 dev_schema 中 public 缺失的表和列补齐
 * 2. 素材数据同步：将 dev_schema.material_library 的数据复制到 public，
 *    并将 owner_type 设为 'system'，让所有用户可见
 *
 * 安全机制：
 * - 仅同步表结构和素材数据，不覆盖现有数据
 * - 素材数据使用 INSERT ON CONFLICT DO NOTHING，避免主键冲突
 * - owner_type 强制设为 'system'
 * - workspace_id 设为 NULL（系统素材不属于任何工作区）
 * - source_type 映射为系统来源类型
 */

import { NextResponse } from 'next/server';

const DB_URL = process.env.DATABASE_URL || process.env.RAW_DATABASE_URL || '';

function getConnectionString(): string {
  if (!DB_URL) {
    throw new Error('DATABASE_URL not configured');
  }
  // 确保连接字符串包含 sslmode
  if (!DB_URL.includes('sslmode')) {
    return DB_URL + (DB_URL.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  return DB_URL;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step') || 'all'; // all | schema | data | verify
  const dryRun = searchParams.get('dryRun') === 'true';

  const results: Array<{ step: string; status: string; detail: string }> = [];

  try {
    // 动态导入 postgres（避免构建时连接）
    const { default: postgres } = await import('postgres');
    const sql = postgres(getConnectionString(), { max: 2 });

    try {
      // ==========================================
      // Step 1: 表结构同步
      // ==========================================
      if (step === 'all' || step === 'schema') {
        if (dryRun) {
          // 预览模式：仅显示差异
          const onlyInDev = await sql`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'dev_schema' AND table_type = 'BASE TABLE'
            AND table_name NOT IN (
              SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            )
            ORDER BY table_name
          `;
          results.push({
            step: 'schema_diff_tables',
            status: 'dry_run',
            detail: `public缺失${onlyInDev.length}张表: ${onlyInDev.map((t: any) => t.table_name).join(', ')}`
          });

          // 列差异
          const onlyDevCols = await sql`
            SELECT d.table_name, d.column_name, d.data_type, d.is_nullable, d.column_default
            FROM information_schema.columns d
            WHERE d.table_schema = 'dev_schema'
            AND NOT EXISTS (
              SELECT 1 FROM information_schema.columns p
              WHERE p.table_schema = 'public'
              AND p.table_name = d.table_name
              AND p.column_name = d.column_name
            )
            ORDER BY d.table_name, d.column_name
          `;
          results.push({
            step: 'schema_diff_columns',
            status: 'dry_run',
            detail: `public缺失${onlyDevCols.length}个列: ${onlyDevCols.slice(0, 20).map((c: any) => `${c.table_name}.${c.column_name}(${c.data_type})`).join(', ')}${onlyDevCols.length > 20 ? '...' : ''}`
          });
        } else {
          // 执行表结构同步

          // 1.1 补齐缺失的表（使用 CREATE TABLE ... LIKE）
          const onlyInDev = await sql`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'dev_schema' AND table_type = 'BASE TABLE'
            AND table_name NOT IN (
              SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            )
            ORDER BY table_name
          `;

          let tablesCreated = 0;
          for (const row of onlyInDev) {
            const tableName = row.table_name;
            try {
              await sql`EXECUTE FORMAT('CREATE TABLE public.%I (LIKE dev_schema.%I INCLUDING ALL)', ${tableName}, ${tableName})`;
              tablesCreated++;
            } catch (e: any) {
              // FORMAT 在 postgres.js 中不支持，改用原始SQL
              try {
                await sql.unsafe(`CREATE TABLE IF NOT EXISTS public."${tableName}" (LIKE dev_schema."${tableName}" INCLUDING ALL)`);
                tablesCreated++;
              } catch (e2: any) {
                results.push({
                  step: `schema_create_table_${tableName}`,
                  status: 'error',
                  detail: e2.message
                });
              }
            }
          }
          results.push({
            step: 'schema_create_tables',
            status: tablesCreated > 0 ? 'success' : 'skipped',
            detail: tablesCreated > 0 ? `创建了${tablesCreated}张缺失的表` : '无需创建新表'
          });

          // 1.2 补齐缺失的列
          const onlyDevCols = await sql`
            SELECT d.table_name, d.column_name, d.data_type, d.character_maximum_length,
                   d.is_nullable, d.column_default, d.udt_name,
                   d.numeric_precision, d.numeric_scale
            FROM information_schema.columns d
            WHERE d.table_schema = 'dev_schema'
            AND EXISTS (
              SELECT 1 FROM information_schema.tables p
              WHERE p.table_schema = 'public' AND p.table_name = d.table_name AND p.table_type = 'BASE TABLE'
            )
            AND NOT EXISTS (
              SELECT 1 FROM information_schema.columns p
              WHERE p.table_schema = 'public'
              AND p.table_name = d.table_name
              AND p.column_name = d.column_name
            )
            ORDER BY d.table_name, d.ordinal_position
          `;

          let colsAdded = 0;
          let colsErrors = 0;
          for (const col of onlyDevCols) {
            // 构建列类型
            let colType = col.udt_name;
            // 映射常见类型
            const typeMap: Record<string, string> = {
              'int4': 'INTEGER', 'int8': 'BIGINT', 'varchar': 'VARCHAR',
              'text': 'TEXT', 'boolean': 'BOOLEAN', 'timestamptz': 'TIMESTAMPTZ',
              'timestamp': 'TIMESTAMP', 'date': 'DATE', 'numeric': 'NUMERIC',
              'uuid': 'UUID', 'jsonb': 'JSONB', 'json': 'JSON',
              'bytea': 'BYTEA', 'float8': 'DOUBLE PRECISION',
            };
            colType = typeMap[col.udt_name] || col.udt_name;
            
            if (col.character_maximum_length && col.udt_name === 'varchar') {
              colType = `VARCHAR(${col.character_maximum_length})`;
            }
            if (col.numeric_precision && col.udt_name === 'numeric') {
              colType = `NUMERIC(${col.numeric_precision},${col.numeric_scale || 0})`;
            }

            const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';

            try {
              await sql.unsafe(
                `ALTER TABLE public."${col.table_name}" ADD COLUMN IF NOT EXISTS "${col.column_name}" ${colType}${nullable}${defaultVal}`
              );
              colsAdded++;
            } catch (e: any) {
              colsErrors++;
              results.push({
                step: `schema_add_col_${col.table_name}.${col.column_name}`,
                status: 'error',
                detail: e.message
              });
            }
          }
          results.push({
            step: 'schema_add_columns',
            status: colsErrors > 0 ? 'partial' : 'success',
            detail: `添加了${colsAdded}个缺失列${colsErrors > 0 ? `，${colsErrors}个失败` : ''}`
          });

          // 1.3 补齐缺失的索引
          const devIndexes = await sql`
            SELECT i.indexname, i.tablename, i.indexdef 
            FROM pg_indexes i
            WHERE i.schemaname = 'dev_schema'
            AND NOT EXISTS (
              SELECT 1 FROM pg_indexes p 
              WHERE p.schemaname = 'public' AND p.indexname = i.indexname
            )
          `;
          let indexesCreated = 0;
          for (const idx of devIndexes) {
            // 替换 schema 限定符
            const prodIndexDef = idx.indexdef.replace(/dev_schema\./g, 'public.');
            try {
              await sql.unsafe(prodIndexDef);
              indexesCreated++;
            } catch (e: any) {
              // 索引可能因数据不同而失败，记录但不中断
              results.push({
                step: `schema_create_index_${idx.indexname}`,
                status: 'warning',
                detail: e.message
              });
            }
          }
          results.push({
            step: 'schema_create_indexes',
            status: indexesCreated > 0 ? 'success' : 'skipped',
            detail: indexesCreated > 0 ? `创建了${indexesCreated}个缺失索引` : '无需创建索引'
          });
        }
      }

      // ==========================================
      // Step 2: 素材数据同步
      // ==========================================
      if (step === 'all' || step === 'data') {
        if (dryRun) {
          // 预览模式：仅显示将要同步的数据量
          const count = await sql`SELECT COUNT(*) as cnt FROM dev_schema.material_library`;
          const typeDist = await sql`
            SELECT type, COUNT(*) as cnt FROM dev_schema.material_library GROUP BY type ORDER BY cnt DESC
          `;
          results.push({
            step: 'data_material_preview',
            status: 'dry_run',
            detail: `将同步${count[0].cnt}条素材到public，类型分布: ${typeDist.map((r: any) => `${r.type}:${r.cnt}`).join(', ')}`
          });
        } else {
          // 确保public表结构存在且有owner_type列
          const hasOwnerType = await sql`
            SELECT COUNT(*) as cnt FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'material_library' AND column_name = 'owner_type'
          `;
          if (Number(hasOwnerType[0].cnt) === 0) {
            await sql`ALTER TABLE public.material_library ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'user'`;
            results.push({
              step: 'data_add_owner_type_column',
              status: 'success',
              detail: '添加了owner_type列'
            });
          }

          // 获取dev_schema素材的列名
          const devColumns = await sql`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'dev_schema' AND table_name = 'material_library'
            ORDER BY ordinal_position
          `;
          const colNames = devColumns.map((c: any) => c.column_name);

          // 读取dev_schema素材数据
          const devMaterials = await sql`
            SELECT * FROM dev_schema.material_library ORDER BY created_at ASC
          `;

          let synced = 0;
          let skipped = 0;
          let errors = 0;

          for (const mat of devMaterials) {
            try {
              // 检查public中是否已存在同ID素材
              const existing = await sql`
                SELECT id FROM public.material_library WHERE id = ${mat.id}
              `;
              if (existing.length > 0) {
                skipped++;
                continue;
              }

              // 构建INSERT语句，将owner_type设为system
              // workspace_id设为NULL（系统素材不属于任何工作区）
              // source_type映射为系统来源类型
              const systemSourceMap: Record<string, string> = {
                'manual': 'system_admin',
                'article': 'system_admin',
                'ai_generate': 'system_admin',
                'import': 'system_admin',
              };
              const newOwnerType = 'system';
              const newSourceType = systemSourceMap[mat.source_type] || 'system_admin';
              const newWorkspaceId = null;

              // 动态构建INSERT
              const insertCols: string[] = [];
              const insertVals: any[] = [];
              const placeholders: string[] = [];
              let paramIdx = 1;

              for (const col of colNames) {
                insertCols.push(`"${col}"`);
                if (col === 'owner_type') {
                  placeholders.push(`'${newOwnerType}'`);
                } else if (col === 'source_type') {
                  placeholders.push(`'${newSourceType}'`);
                } else if (col === 'workspace_id') {
                  placeholders.push('NULL');
                } else {
                  const val = mat[col];
                  if (val === null || val === undefined) {
                    placeholders.push('NULL');
                  } else if (val instanceof Date) {
                    // Date必须在object之前判断，因为instanceof Date也是typeof object
                    placeholders.push(`'${val.toISOString()}'`);
                  } else if (typeof val === 'string') {
                    // 转义单引号
                    placeholders.push(`'${val.replace(/'/g, "''")}'`);
                  } else if (typeof val === 'object') {
                    // JSONB
                    placeholders.push(`'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
                  } else if (typeof val === 'boolean') {
                    placeholders.push(val ? 'TRUE' : 'FALSE');
                  } else {
                    placeholders.push(String(val));
                  }
                }
              }

              await sql.unsafe(
                `INSERT INTO public.material_library (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`
              );
              synced++;
            } catch (e: any) {
              errors++;
              if (errors <= 3) {
                results.push({
                  step: `data_sync_material_${mat.id?.substring(0, 8)}`,
                  status: 'error',
                  detail: `${mat.title?.substring(0, 30)}: ${e.message?.substring(0, 100)}`
                });
              }
            }
          }

          results.push({
            step: 'data_sync_materials',
            status: errors > 0 ? 'partial' : 'success',
            detail: `同步${synced}条，跳过${skipped}条(已存在)，错误${errors}条`
          });
        }
      }

      // ==========================================
      // Step 3: 验证比对
      // ==========================================
      if (step === 'all' || step === 'verify') {
        // 3.1 表数量比对
        const devTableCount = await sql`
          SELECT COUNT(*) as cnt FROM information_schema.tables 
          WHERE table_schema = 'dev_schema' AND table_type = 'BASE TABLE'
        `;
        const pubTableCount = await sql`
          SELECT COUNT(*) as cnt FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `;
        results.push({
          step: 'verify_table_count',
          status: devTableCount[0].cnt === pubTableCount[0].cnt ? 'pass' : 'mismatch',
          detail: `dev: ${devTableCount[0].cnt} 张表, public: ${pubTableCount[0].cnt} 张表`
        });

        // 3.2 素材数据量比对
        const devMatCount = await sql`SELECT COUNT(*) as cnt FROM dev_schema.material_library`;
        const pubMatCount = await sql`SELECT COUNT(*) as cnt FROM public.material_library`;
        const pubSysCount = await sql`SELECT COUNT(*) as cnt FROM public.material_library WHERE owner_type = 'system'`;
        results.push({
          step: 'verify_material_count',
          status: Number(pubMatCount[0].cnt) >= Number(devMatCount[0].cnt) ? 'pass' : 'mismatch',
          detail: `dev: ${devMatCount[0].cnt}条, public: ${pubMatCount[0].cnt}条(其中system: ${pubSysCount[0].cnt}条)`
        });

        // 3.3 素材类型分布比对
        const devTypeDist = await sql`
          SELECT type, COUNT(*) as cnt FROM dev_schema.material_library GROUP BY type ORDER BY cnt DESC
        `;
        const pubTypeDist = await sql`
          SELECT type, COUNT(*) as cnt FROM public.material_library WHERE owner_type = 'system' GROUP BY type ORDER BY cnt DESC
        `;
        const devTypeMap: Record<string, number> = {};
        devTypeDist.forEach((r: any) => { devTypeMap[r.type] = Number(r.cnt); });
        const pubTypeMap: Record<string, number> = {};
        pubTypeDist.forEach((r: any) => { pubTypeMap[r.type] = Number(r.cnt); });

        let typeMatch = true;
        const typeDetails: string[] = [];
        for (const [type, cnt] of Object.entries(devTypeMap)) {
          const pubCnt = pubTypeMap[type] || 0;
          if (pubCnt < cnt) typeMatch = false;
          typeDetails.push(`${type}: dev=${cnt} pub_sys=${pubCnt}`);
        }
        results.push({
          step: 'verify_type_distribution',
          status: typeMatch ? 'pass' : 'mismatch',
          detail: typeDetails.join(', ')
        });

        // 3.4 字段一致性抽样检查（取5条数据比对title和content）
        const devSamples = await sql`
          SELECT id, title, content, type FROM dev_schema.material_library ORDER BY RANDOM() LIMIT 5
        `;
        let sampleMatch = 0;
        let sampleTotal = devSamples.length;
        for (const s of devSamples) {
          const pubSample = await sql`
            SELECT title, content, owner_type FROM public.material_library WHERE id = ${s.id}
          `;
          if (pubSample.length > 0 && pubSample[0].title === s.title && pubSample[0].owner_type === 'system') {
            sampleMatch++;
          }
        }
        results.push({
          step: 'verify_sample_integrity',
          status: sampleMatch === sampleTotal ? 'pass' : 'mismatch',
          detail: `抽样${sampleTotal}条，匹配${sampleMatch}条`
        });

        // 3.5 列完整性检查（剩余差异列）
        const remainingDiffCols = await sql`
          SELECT COUNT(*) as cnt FROM information_schema.columns d
          WHERE d.table_schema = 'dev_schema'
          AND EXISTS (
            SELECT 1 FROM information_schema.tables p
            WHERE p.table_schema = 'public' AND p.table_name = d.table_name AND p.table_type = 'BASE TABLE'
          )
          AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns p
            WHERE p.table_schema = 'public' AND p.table_name = d.table_name AND p.column_name = d.column_name
          )
        `;
        results.push({
          step: 'verify_column_completeness',
          status: Number(remainingDiffCols[0].cnt) === 0 ? 'pass' : 'mismatch',
          detail: `剩余差异列数: ${remainingDiffCols[0].cnt}`
        });
      }

    } finally {
      await sql.end();
    }

    return NextResponse.json({
      success: true,
      dryRun,
      step,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}

// POST 方法也支持（与GET相同逻辑，方便通过表单触发）
export async function POST(request: Request) {
  return GET(request);
}
