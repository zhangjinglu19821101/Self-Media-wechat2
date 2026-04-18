#!/usr/bin/env node

/**
 * 数据库查询工具
 * 使用方法:
 *   node scripts/query-db.js                    # 交互式模式
 *   node scripts/query-db.js --table insurance-d --executor insurance-d  # 命令行模式
 */

const { Pool } = require('pg');
const readline = require('readline');

// 数据库配置
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

// 表配置
const TABLES = {
  'insurance-d': {
    name: 'daily_task',
    displayName: 'insurance-d 表 (daily_task)',
    fields: [
      { name: 'id', label: 'ID' },
      { name: 'task_id', label: '任务ID' },
      { name: 'task_title', label: '任务标题' },
      { name: 'task_description', label: '任务描述' },
      { name: 'executor', label: '执行Agent' },
      { name: 'execution_status', label: '状态' },
      { name: 'created_at', label: '创建时间' },
      { name: 'updated_at', label: '更新时间' },
    ],
    conditions: [
      { name: 'executor', label: '执行Agent', placeholder: '如: insurance-d' },
      { name: 'task_id', label: '任务ID', placeholder: '支持模糊匹配' },
      { name: 'execution_status', label: '状态', placeholder: '如: pending, completed' },
      { name: 'start_time', label: '开始时间', placeholder: '格式: 2026-02-01' },
      { name: 'end_time', label: '结束时间', placeholder: '格式: 2026-02-28' },
    ],
  },
  'agent-sub-tasks': {
    name: 'agent_sub_tasks',
    displayName: 'agent_sub_tasks 表',
    fields: [
      { name: 'id', label: 'ID' },
      { name: 'command_result_id', label: 'Command Result ID' },
      { name: 'agent_id', label: 'Agent ID' },
      { name: 'task_title', label: '任务标题' },
      { name: 'task_description', label: '任务描述' },
      { name: 'status', label: '状态' },
      { name: 'order_index', label: '顺序' },
      { name: 'created_at', label: '创建时间' },
      { name: 'updated_at', label: '更新时间' },
    ],
    conditions: [
      { name: 'agent_id', label: 'Agent ID', placeholder: '如: insurance-d' },
      { name: 'command_result_id', label: 'Command Result ID', placeholder: '支持模糊匹配' },
      { name: 'status', label: '状态', placeholder: '如: pending, completed' },
      { name: 'start_time', label: '开始时间', placeholder: '格式: 2026-02-01' },
      { name: 'end_time', label: '结束时间', placeholder: '格式: 2026-02-28' },
    ],
  },
};

// 创建数据库连接池
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 问答函数
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// 打印表格
function printTable(headers, rows) {
  // 计算每列最大宽度
  const colWidths = headers.map((header, index) => {
    const maxWidth = Math.max(
      header.length,
      ...rows.map(row => String(row[index] || '').length)
    );
    return maxWidth + 2;
  });

  // 打印分隔线
  const separator = '+' + colWidths.map(width => '-'.repeat(width)).join('+') + '+';

  // 打印表头
  console.log(separator);
  console.log(
    '|' +
      headers.map((header, index) =>
        header.padEnd(colWidths[index] - 1)
      ).join('|') +
      ' |'
  );
  console.log(separator);

  // 打印数据行
  rows.forEach(row => {
    console.log(
      '|' +
        row.map((cell, index) => {
          const cellStr = String(cell || '');
          if (cellStr.length > colWidths[index] - 3) {
            return cellStr.substring(0, colWidths[index] - 3) + '...';
          }
          return cellStr.padEnd(colWidths[index] - 1);
        }).join('|') +
      ' |'
    );
  });

  console.log(separator);
  console.log(`\n共 ${rows.length} 条记录\n`);
}

// 构建 SQL 查询
function buildQuery(tableConfig, conditions, fields, limit = 50) {
  const tableName = tableConfig.name;
  const selectedFields = fields.map(f => `${f.name}`).join(', ');

  const whereConditions = [];
  const params = [];
  let paramIndex = 1;

  if (conditions.executor) {
    whereConditions.push(`executor = $${paramIndex++}`);
    params.push(conditions.executor);
  }

  if (conditions.agent_id) {
    whereConditions.push(`agent_id = $${paramIndex++}`);
    params.push(conditions.agent_id);
  }

  if (conditions.task_id) {
    whereConditions.push(`task_id LIKE $${paramIndex++}`);
    params.push(`%${conditions.task_id}%`);
  }

  if (conditions.command_result_id) {
    whereConditions.push(`command_result_id LIKE $${paramIndex++}`);
    params.push(`%${conditions.command_result_id}%`);
  }

  if (conditions.execution_status) {
    whereConditions.push(`execution_status = $${paramIndex++}`);
    params.push(conditions.execution_status);
  }

  if (conditions.status) {
    whereConditions.push(`status = $${paramIndex++}`);
    params.push(conditions.status);
  }

  if (conditions.start_time) {
    whereConditions.push(`created_at >= $${paramIndex++}`);
    params.push(conditions.start_time);
  }

  if (conditions.end_time) {
    whereConditions.push(`created_at <= $${paramIndex++}`);
    params.push(conditions.end_time);
  }

  const whereClause = whereConditions.length > 0
    ? 'WHERE ' + whereConditions.join(' AND ')
    : '';

  const query = `
    SELECT ${selectedFields}
    FROM ${tableName}
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return { query, params };
}

// 执行查询
async function executeQuery(tableConfig, conditions, fields, limit = 50, outputFormat = 'table') {
  const { query, params } = buildQuery(tableConfig, conditions, fields, limit);

  try {
    const result = await pool.query(query, params);
    const rows = result.rows;

    console.log(`\n📊 查询成功，找到 ${rows.length} 条记录\n`);

    if (outputFormat === 'json') {
      console.log(JSON.stringify(rows, null, 2));
    } else if (outputFormat === 'csv') {
      const headers = fields.map(f => f.label);
      const csvRows = [
        headers.join(','),
        ...rows.map(row => fields.map(f => `"${row[f.name] || ''}"`).join(',')),
      ];
      console.log(csvRows.join('\n'));
    } else {
      // 默认表格输出
      const headers = fields.map(f => f.label);
      const dataRows = rows.map(row => fields.map(f => row[f.name]));
      printTable(headers, dataRows);
    }

    return rows;
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    throw error;
  }
}

// 交互式模式
async function interactiveMode() {
  console.log('\n🔍 数据库查询工具 - 交互式模式\n');

  // 选择表
  console.log('请选择要查询的表：');
  const tableKeys = Object.keys(TABLES);
  tableKeys.forEach((key, index) => {
    console.log(`  ${index + 1}. ${TABLES[key].displayName}`);
  });

  const tableChoice = await question('请输入选项编号 (1-2): ');
  const tableKey = tableKeys[parseInt(tableChoice) - 1];
  if (!tableKey) {
    console.error('❌ 无效的选项');
    rl.close();
    return;
  }

  const tableConfig = TABLES[tableKey];
  console.log(`✅ 已选择: ${tableConfig.displayName}\n`);

  // 输入查询条件
  console.log('请输入查询条件（留空跳过）:');
  const conditions = {};

  for (const condition of tableConfig.conditions) {
    const input = await question(`  ${condition.label}: `);
    if (input.trim()) {
      conditions[condition.name] = input.trim();
    }
  }

  // 选择展示字段
  console.log('\n请选择要展示的字段（输入编号，多个用逗号分隔，留空全选）:');
  tableConfig.fields.forEach((field, index) => {
    console.log(`  ${index + 1}. ${field.label}`);
  });

  const fieldsChoice = await question('请输入选项编号: ');
  let selectedFields;

  if (fieldsChoice.trim()) {
    const indices = fieldsChoice
      .split(',')
      .map(s => parseInt(s.trim()) - 1)
      .filter(i => i >= 0 && i < tableConfig.fields.length);
    selectedFields = indices.map(i => tableConfig.fields[i]);
  } else {
    selectedFields = tableConfig.fields;
  }

  // 输入限制数量
  const limitInput = await question('请输入返回记录数量（默认 50）: ');
  const limit = parseInt(limitInput) || 50;

  // 选择输出格式
  console.log('\n请选择输出格式：');
  console.log('  1. 表格');
  console.log('  2. JSON');
  console.log('  3. CSV');
  const formatChoice = await question('请输入选项编号 (1-3): ');
  const formats = ['table', 'json', 'csv'];
  const outputFormat = formats[parseInt(formatChoice) - 1] || 'table';

  // 执行查询
  await executeQuery(tableConfig, conditions, selectedFields, limit, outputFormat);

  rl.close();
  await pool.end();
}

// 命令行模式
async function commandLineMode(options) {
  const tableKey = options.table;
  if (!tableKey || !TABLES[tableKey]) {
    console.error('❌ 无效的表名，请使用: insurance-d 或 agent-sub-tasks');
    process.exit(1);
  }

  const tableConfig = TABLES[tableKey];
  const conditions = {};

  // 提取查询条件
  tableConfig.conditions.forEach(condition => {
    if (options[condition.name]) {
      conditions[condition.name] = options[condition.name];
    }
  });

  // 选择字段
  let selectedFields;
  if (options.fields) {
    const fieldNames = options.fields.split(',');
    selectedFields = tableConfig.fields.filter(f =>
      fieldNames.includes(f.name)
    );
  } else {
    selectedFields = tableConfig.fields;
  }

  const limit = parseInt(options.limit) || 50;
  const outputFormat = options.format || 'table';

  await executeQuery(tableConfig, conditions, selectedFields, limit, outputFormat);

  await pool.end();
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--table') {
      options.table = args[++i];
    } else if (args[i] === '--executor') {
      options.executor = args[++i];
    } else if (args[i] === '--agent-id') {
      options.agent_id = args[++i];
    } else if (args[i] === '--task-id') {
      options.task_id = args[++i];
    } else if (args[i] === '--command-result-id') {
      options.command_result_id = args[++i];
    } else if (args[i] === '--execution-status') {
      options.execution_status = args[++i];
    } else if (args[i] === '--status') {
      options.status = args[++i];
    } else if (args[i] === '--start-time') {
      options.start_time = args[++i];
    } else if (args[i] === '--end-time') {
      options.end_time = args[++i];
    } else if (args[i] === '--limit') {
      options.limit = args[++i];
    } else if (args[i] === '--fields') {
      options.fields = args[++i];
    } else if (args[i] === '--format') {
      options.format = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

// 打印帮助信息
function printHelp() {
  console.log(`
数据库查询工具

使用方法:
  node scripts/query-db.js                    # 交互式模式
  node scripts/query-db.js --table insurance-d --executor insurance-d  # 命令行模式

命令行参数:
  --table <table>           表名 (insurance-d 或 agent-sub-tasks)
  --executor <value>        执行Agent (insurance-d 表)
  --agent-id <value>        Agent ID (agent-sub-tasks 表)
  --task-id <value>         任务ID (支持模糊匹配)
  --command-result-id <value>  Command Result ID (支持模糊匹配)
  --execution-status <value> 执行状态 (insurance-d 表)
  --status <value>          状态 (agent-sub-tasks 表)
  --start-time <date>       开始时间 (格式: 2026-02-01)
  --end-time <date>         结束时间 (格式: 2026-02-28)
  --limit <number>          返回记录数量 (默认: 50)
  --fields <fields>         字段列表 (逗号分隔，如: id,task_title,executor)
  --format <format>         输出格式 (table/json/csv，默认: table)
  --help, -h                显示帮助信息

示例:
  # 查询 insurance-d 表中 executor 为 insurance-d 的记录
  node scripts/query-db.js --table insurance-d --executor insurance-d

  # 查询 agent-sub-tasks 表中 agent_id 为 insurance-d 的记录，只返回部分字段
  node scripts/query-db.js --table agent-sub-tasks --agent-id insurance-d \\
    --fields id,task_title,status --format table

  # 查询指定时间范围内的记录，导出为 JSON
  node scripts/query-db.js --table insurance-d \\
    --start-time 2026-02-01 --end-time 2026-02-28 --format json
`);
}

// 主函数
async function main() {
  try {
    const args = parseArgs();

    if (args.table) {
      // 命令行模式
      await commandLineMode(args);
    } else {
      // 交互式模式
      await interactiveMode();
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { executeQuery, buildQuery };
