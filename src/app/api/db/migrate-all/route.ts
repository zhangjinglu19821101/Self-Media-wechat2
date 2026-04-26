/**
 * 统一数据库迁移 API
 * 
 * 将 52 个独立迁移 API 合并为一个，按正确依赖顺序执行。
 * 支持从零初始化全新数据库，也支持增量迁移（已存在的表/列会跳过）。
 * 
 * 🔴 Schema 隔离：
 * - 支持 ?schema=dev_schema 参数指定目标 Schema
 * - 默认使用当前 COZE_PROJECT_ENV 对应的 Schema
 * - 迁移会在目标 Schema 下创建所有表
 * 
 * 依赖顺序原则：
 * 1. Schema 创建（dev_schema / public）
 * 2. 核心表创建（accounts / workspaces / workspace_members）
 * 3. 业务表创建（daily_task / agent_tasks / agent_sub_tasks / ...）
 * 4. 字段新增（ALTER TABLE ADD COLUMN）
 * 5. 索引创建
 * 6. 数据迁移 / 修复
 * 7. 默认数据初始化
 */

import { NextResponse } from 'next/server';
import { db as globalDb, getCurrentSchema, createSchemaIfNotExists, cloneSchemaStructure, getRawDatabaseUrl } from '@/lib/db';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/lib/db/schema';

// ==================== 可切换的数据库引用 ====================

// 🔴 迁移模式切换：
// 正常模式下 activeDb = globalDb（使用 search_path = dev_schema, public）
// 迁移模式下 activeDb = migrationDb（使用 search_path = 仅目标 schema）
// 
// 这样迁移步骤中的 CREATE TABLE IF NOT EXISTS 不会因为发现 public 中的同名表而跳过
let activeDb: typeof globalDb = globalDb;

// 注意：不使用 export，避免 Next.js 路由文件导出非路由函数
function _setActiveDb(newDb: typeof globalDb) {
  activeDb = newDb;
}

function _resetActiveDb() {
  activeDb = globalDb;
}

// ==================== 迁移步骤定义 ====================

interface MigrationStep {
  id: string;
  name: string;
  category: 'schema' | 'create' | 'alter' | 'index' | 'data' | 'init';
  execute: (targetSchema: string) => Promise<string>;
}

const MIGRATION_STEPS: MigrationStep[] = [
  // ========== Phase 0: Schema 创建 ==========
  {
    id: 'create-schemas',
    name: '创建 Schema (dev_schema)',
    category: 'schema',
    execute: async (targetSchema: string) => {
      await createSchemaIfNotExists('dev_schema');
      return `Schema 创建完成 (当前: ${targetSchema})`;
    },
  },

  // ========== Phase 1: 核心认证表 ==========
  {
    id: 'create-auth-tables',
    name: '创建认证表 (accounts / workspaces / workspace_members / account_sessions)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          avatar_url TEXT,
          role TEXT NOT NULL DEFAULT 'normal',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'personal',
          owner_account_id TEXT NOT NULL REFERENCES accounts(id),
          llm_key_source TEXT NOT NULL DEFAULT 'platform_credits',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_account_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS workspace_members (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'viewer',
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_unique ON workspace_members(workspace_id, account_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspace_members_account ON workspace_members(account_id)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS account_sessions (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_account ON account_sessions(account_id)`);

      return '认证表创建完成';
    },
  },

  // ========== Phase 2: 核心业务表 ==========
  {
    id: 'create-daily-task',
    name: '创建主任务表 (daily_task)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      // 先尝试重命名旧表
      try {
        const check = await activeDb.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'command_results'`);
        if (Array.isArray(check) && check.length > 0) {
          await activeDb.execute(sql`ALTER TABLE command_results RENAME TO daily_task`);
          await activeDb.execute(sql`ALTER TABLE daily_task RENAME COLUMN command_id TO task_id`);
          await activeDb.execute(sql`ALTER TABLE daily_task RENAME COLUMN command_content TO task_description`);
          await activeDb.execute(sql`ALTER TABLE daily_task RENAME COLUMN command_priority TO task_priority`);
        }
      } catch { /* 忽略，表可能不存在 */ }

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS daily_task (
          id TEXT PRIMARY KEY,
          task_id TEXT,
          task_description TEXT NOT NULL,
          task_title TEXT DEFAULT '',
          task_priority TEXT DEFAULT 'normal',
          task_type TEXT DEFAULT 'daily',
          task_status TEXT DEFAULT 'pending',
          execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
          user_opinion TEXT,
          original_instruction TEXT,
          material_ids JSONB DEFAULT '[]',
          workspace_id TEXT,
          result_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_daily_task_status ON daily_task(task_status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_daily_task_date ON daily_task(execution_date)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_daily_task_workspace ON daily_task(workspace_id)`);

      // 补充可能缺失的列
      const columns = [
        { name: 'task_title', type: 'TEXT DEFAULT \'\'' },
        { name: 'task_priority', type: 'TEXT DEFAULT \'normal\'' },
        { name: 'task_type', type: 'TEXT DEFAULT \'daily\'' },
        { name: 'task_status', type: 'TEXT DEFAULT \'pending\'' },
        { name: 'execution_date', type: 'DATE NOT NULL DEFAULT CURRENT_DATE' },
        { name: 'user_opinion', type: 'TEXT' },
        { name: 'original_instruction', type: 'TEXT' },
        { name: 'material_ids', type: 'JSONB DEFAULT \'[]\'' },
        { name: 'workspace_id', type: 'TEXT' },
        { name: 'result_data', type: 'JSONB' },
        { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
      ];
      for (const col of columns) {
        await activeDb.execute(sql`ALTER TABLE daily_task ADD COLUMN IF NOT EXISTS ${sql.identifier(col.name)} ${sql.raw(col.type)}`).catch(() => {});
      }

      return 'daily_task 表创建/更新完成';
    },
  },

  {
    id: 'create-agent-tasks',
    name: '创建 Agent 任务表 (agent_tasks)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_tasks (
          id TEXT PRIMARY KEY,
          task_id TEXT,
          task_description TEXT NOT NULL,
          task_title TEXT DEFAULT '',
          task_status TEXT DEFAULT 'pending',
          from_agent_id TEXT,
          to_agent_id TEXT,
          command_result_id TEXT,
          user_opinion TEXT,
          original_instruction TEXT,
          material_ids JSONB DEFAULT '[]',
          workspace_id TEXT,
          result_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(task_status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_tasks_workspace ON agent_tasks(workspace_id)`);
      // 补充可能缺失的列
      await activeDb.execute(sql`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS user_opinion TEXT`).catch(() => {});
      await activeDb.execute(sql`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS material_ids JSONB DEFAULT '[]'`).catch(() => {});
      await activeDb.execute(sql`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS original_instruction TEXT`).catch(() => {});
      return 'agent_tasks 表创建/更新完成';
    },
  },

  {
    id: 'create-agent-sub-tasks',
    name: '创建子任务表 (agent_sub_tasks)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_sub_tasks (
          id TEXT PRIMARY KEY,
          command_result_id TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          task_title TEXT NOT NULL,
          task_description TEXT DEFAULT '',
          from_parents_executor TEXT,
          executor TEXT,
          status TEXT DEFAULT 'pending',
          result_data JSONB,
          result_text TEXT,
          user_opinion TEXT,
          original_instruction TEXT,
          material_ids JSONB DEFAULT '[]',
          metadata JSONB DEFAULT '{}',
          workspace_id TEXT,
          structure_name TEXT,
          structure_detail TEXT,
          execution_date DATE,
          article_metadata JSONB DEFAULT '{}'::jsonb,
          related_materials TEXT DEFAULT '',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_status ON agent_sub_tasks(status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_cmd ON agent_sub_tasks(command_result_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_cmd_order ON agent_sub_tasks(command_result_id, order_index)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_workspace ON agent_sub_tasks(workspace_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_article_metadata ON agent_sub_tasks USING GIN (article_metadata)`);

      // 补充可能缺失的列
      const alterColumns = [
        { name: 'user_opinion', type: 'TEXT' },
        { name: 'material_ids', type: 'JSONB DEFAULT \'[]\'' },
        { name: 'original_instruction', type: 'TEXT' },
        { name: 'structure_name', type: 'TEXT' },
        { name: 'structure_detail', type: 'TEXT' },
        { name: 'execution_date', type: 'DATE' },
        { name: 'article_metadata', type: 'JSONB DEFAULT \'{}\'::jsonb' },
        { name: 'related_materials', type: 'TEXT DEFAULT \'\'' },
      ];
      for (const col of alterColumns) {
        await activeDb.execute(sql`ALTER TABLE agent_sub_tasks ADD COLUMN IF NOT EXISTS ${sql.identifier(col.name)} ${sql.raw(col.type)}`).catch(() => {});
      }

      // 唯一约束
      try {
        await activeDb.execute(sql`ALTER TABLE agent_sub_tasks ADD CONSTRAINT uq_sub_tasks_cmd_order UNIQUE (command_result_id, order_index)`);
      } catch { /* 已存在 */ }

      return 'agent_sub_tasks 表创建/更新完成';
    },
  },

  {
    id: 'create-step-history',
    name: '创建执行历史表 (agent_sub_tasks_step_history)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_sub_tasks_step_history (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          step_no INTEGER NOT NULL,
          interact_user TEXT,
          interact_content TEXT,
          interact_type TEXT DEFAULT 'text',
          interact_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          command_result_id TEXT
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_step_history_command_result ON agent_sub_tasks_step_history(command_result_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_step_history_step_no ON agent_sub_tasks_step_history(task_id, step_no)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_step_history_interact_time ON agent_sub_tasks_step_history(interact_time)`);
      return 'step_history 表创建完成';
    },
  },

  {
    id: 'create-mcp-executions',
    name: '创建 MCP 执行记录表 (agent_sub_tasks_mcp_executions)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_sub_tasks_mcp_executions (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          mcp_tool_name TEXT NOT NULL,
          mcp_tool_input JSONB,
          mcp_tool_output JSONB,
          execution_status TEXT DEFAULT 'running',
          started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          command_result_id TEXT
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_mcp_executions_task ON agent_sub_tasks_mcp_executions(task_id)`);
      return 'mcp_executions 表创建完成';
    },
  },

  // ========== Phase 3: 业务功能表 ==========
  {
    id: 'create-material-library',
    name: '创建素材库表 (material_library)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS material_library (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'case',
          status TEXT NOT NULL DEFAULT 'active',
          topic_tags JSONB DEFAULT '[]',
          scene_tags JSONB DEFAULT '[]',
          emotion_tags JSONB DEFAULT '[]',
          source TEXT DEFAULT '',
          vector_id TEXT,
          workspace_id TEXT,
          use_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_type ON material_library(type)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_status ON material_library(status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_workspace ON material_library(workspace_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_topic_tags ON material_library USING GIN (topic_tags)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_scene_tags ON material_library USING GIN (scene_tags)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_emotion_tags ON material_library USING GIN (emotion_tags)`);
      return 'material_library 表创建完成';
    },
  },

  {
    id: 'create-style-template-tables',
    name: '创建风格模板表 (style_templates / platform_accounts / account_style_configs)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS style_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          platform TEXT NOT NULL DEFAULT 'wechat_official',
          is_default BOOLEAN DEFAULT false,
          rule_count INTEGER DEFAULT 0,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_templates_workspace ON style_templates(workspace_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_templates_platform ON style_templates(platform)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS platform_accounts (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          account_name TEXT NOT NULL,
          account_id TEXT,
          avatar_url TEXT,
          platform_config JSONB DEFAULT '{}'::jsonb,
          workspace_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_accounts_workspace ON platform_accounts(workspace_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(platform)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform_config ON platform_accounts USING GIN (platform_config)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS account_style_configs (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
          template_id TEXT NOT NULL REFERENCES style_templates(id) ON DELETE CASCADE,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_account_style_unique ON account_style_configs(account_id, template_id)`);
      return '风格模板表创建完成';
    },
  },

  {
    id: 'create-digital-assets',
    name: '创建数字资产表 (core_anchor_assets / style_assets / feedback_assets)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS core_anchor_assets (
          id TEXT PRIMARY KEY,
          anchor_type TEXT NOT NULL,
          content TEXT NOT NULL,
          source_task_id TEXT,
          template_id TEXT,
          workspace_id TEXT,
          is_archived BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_core_anchor_source_task ON core_anchor_assets(source_task_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_core_anchor_type ON core_anchor_assets(anchor_type)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_core_anchor_workspace ON core_anchor_assets(workspace_id)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS style_assets (
          id TEXT PRIMARY KEY,
          rule_type TEXT NOT NULL,
          rule_content TEXT NOT NULL,
          priority INTEGER DEFAULT 3,
          template_id TEXT,
          workspace_id TEXT,
          source TEXT DEFAULT 'deposition',
          is_active BOOLEAN DEFAULT true,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_assets_template ON style_assets(template_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_assets_workspace ON style_assets(workspace_id)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS feedback_assets (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          original_content TEXT NOT NULL,
          feedback_text TEXT NOT NULL,
          rule_extracted TEXT,
          is_processed BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      return '数字资产表创建完成';
    },
  },

  {
    id: 'create-article-content',
    name: '创建文章内容表 (article_content)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS article_content (
          id TEXT PRIMARY KEY,
          article_id TEXT UNIQUE,
          task_id TEXT,
          sub_task_id TEXT,
          command_result_id TEXT,
          article_title TEXT,
          article_html TEXT,
          article_text TEXT,
          keywords TEXT[] DEFAULT '{}',
          creator_status TEXT DEFAULT 'draft',
          publish_status TEXT DEFAULT 'unpublished',
          publish_time TIMESTAMP WITH TIME ZONE,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_content_task_id ON article_content(task_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_content_sub_task_id ON article_content(sub_task_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_content_creator_status ON article_content(creator_status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_content_keywords ON article_content USING GIN (keywords)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_content_publish_time ON article_content(publish_time)`);
      return 'article_content 表创建完成';
    },
  },

  {
    id: 'create-article-hashes',
    name: '创建文章哈希表 (article_hashes)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS article_hashes (
          id TEXT PRIMARY KEY,
          sha256 TEXT NOT NULL,
          normalized_sha256 TEXT,
          sim_hash TEXT,
          article_title TEXT,
          article_length INTEGER,
          template_id TEXT,
          workspace_id TEXT,
          source_type TEXT DEFAULT 'style_init',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`ALTER TABLE article_hashes ADD COLUMN IF NOT EXISTS normalized_sha256 TEXT`).catch(() => {});
      await activeDb.execute(sql`ALTER TABLE article_hashes ALTER COLUMN normalized_sha256 SET NOT NULL`).catch(() => {});
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_hashes_sha256 ON article_hashes(sha256)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_hashes_normalized_sha256 ON article_hashes(normalized_sha256)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_hashes_workspace ON article_hashes(workspace_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_article_hashes_template ON article_hashes(template_id)`);
      return 'article_hashes 表创建完成';
    },
  },

  {
    id: 'create-user-api-keys',
    name: '创建用户 API Key 表 (user_api_keys)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS user_api_keys (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT 'doubao',
          key_name TEXT NOT NULL,
          encrypted_key TEXT NOT NULL,
          key_preview TEXT NOT NULL,
          is_enabled BOOLEAN DEFAULT true,
          last_verified_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_api_keys_workspace ON user_api_keys(workspace_id)`);
      return 'user_api_keys 表创建完成';
    },
  },

  {
    id: 'create-publish-records',
    name: '创建发布记录表 (publish_records)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS publish_records (
          id TEXT PRIMARY KEY,
          article_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          account_id TEXT,
          publish_type TEXT DEFAULT 'immediate',
          scheduled_at TIMESTAMP WITH TIME ZONE,
          published_at TIMESTAMP WITH TIME ZONE,
          status TEXT DEFAULT 'pending',
          platform_article_id TEXT,
          platform_url TEXT,
          error_message TEXT,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_publish_records_article ON publish_records(article_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_publish_records_workspace ON publish_records(workspace_id)`);
      return 'publish_records 表创建完成';
    },
  },

  {
    id: 'create-xhs-cards',
    name: '创建小红书卡片表 (xhs_cards / xhs_card_groups)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS xhs_cards (
          id TEXT PRIMARY KEY,
          group_id TEXT,
          sub_task_id TEXT,
          command_result_id TEXT,
          card_index INTEGER NOT NULL,
          card_type TEXT NOT NULL DEFAULT 'content',
          title TEXT,
          content TEXT,
          style_config JSONB DEFAULT '{}',
          storage_key TEXT,
          url TEXT,
          status TEXT DEFAULT 'pending',
          workspace_id TEXT,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_xhs_cards_sub_task_id ON xhs_cards(sub_task_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_xhs_cards_command_result_id ON xhs_cards(command_result_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_xhs_cards_card_index ON xhs_cards(card_index)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_xhs_cards_status ON xhs_cards(status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_xhs_cards_workspace_id ON xhs_cards(workspace_id)`);

      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS xhs_card_groups (
          id TEXT PRIMARY KEY,
          sub_task_id TEXT,
          command_result_id TEXT,
          card_count INTEGER DEFAULT 0,
          card_count_mode TEXT DEFAULT '5-card',
          style_preset TEXT DEFAULT 'gradient',
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_xhs_card_groups_sub_task_id ON xhs_card_groups(sub_task_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_xhs_card_groups_command_result_id ON xhs_card_groups(command_result_id)`);
      return 'xhs_cards 表创建完成';
    },
  },

  {
    id: 'create-info-snippets',
    name: '创建信息速记表 (info_snippets)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS info_snippets (
          id TEXT PRIMARY KEY,
          title TEXT,
          raw_content TEXT,
          summary TEXT,
          keywords TEXT DEFAULT '',
          categories JSONB DEFAULT '["quick_note"]'::jsonb,
          category TEXT DEFAULT 'quick_note',
          secondary_categories JSONB DEFAULT '[]'::jsonb,
          applicable_scenes TEXT DEFAULT '',
          snippet_type TEXT NOT NULL DEFAULT 'memory',
          compliance_level TEXT,
          compliance_warnings JSONB,
          source_url TEXT DEFAULT '',
          status TEXT DEFAULT 'active',
          workspace_id TEXT,
          material_id TEXT,
          remind_at TIMESTAMP WITH TIME ZONE,
          reminded BOOLEAN DEFAULT false,
          highlights JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_snippet_status ON info_snippets(status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_snippet_workspace ON info_snippets(workspace_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_snippets_categories_gin ON info_snippets USING GIN (categories)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_snippet_created_at ON info_snippets(created_at)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_snippets_snippet_type ON info_snippets(snippet_type)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_info_snippets_remind_at ON info_snippets(remind_at)`);
      // 补充可能缺失的列
      await activeDb.execute(sql`ALTER TABLE info_snippets ADD COLUMN IF NOT EXISTS raw_content TEXT`).catch(() => {});
      await activeDb.execute(sql`ALTER TABLE info_snippets ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '["quick_note"]'::jsonb`).catch(() => {});
      await activeDb.execute(sql`ALTER TABLE info_snippets ADD COLUMN IF NOT EXISTS snippet_type TEXT NOT NULL DEFAULT 'memory'`).catch(() => {});
      await activeDb.execute(sql`ALTER TABLE info_snippets ADD COLUMN IF NOT EXISTS highlights JSONB`).catch(() => {});
      return 'info_snippets 表创建完成';
    },
  },

  {
    id: 'create-content-templates',
    name: '创建内容模板表 (content_templates)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS content_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          platform TEXT NOT NULL DEFAULT 'xiaohongshu',
          card_count_mode TEXT NOT NULL DEFAULT '5-card',
          style_preset TEXT DEFAULT 'gradient',
          prompt_instruction TEXT DEFAULT '',
          is_active BOOLEAN DEFAULT true,
          use_count INTEGER DEFAULT 0,
          workspace_id TEXT,
          style_template_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_content_templates_workspace ON content_templates(workspace_id)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_content_templates_platform ON content_templates(platform)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(is_active, use_count DESC)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_content_templates_style ON content_templates(style_template_id)`);
      return 'content_templates 表创建完成';
    },
  },

  {
    id: 'create-article-templates',
    name: '创建文章模板表 (article_templates)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS article_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          structure JSONB NOT NULL DEFAULT '[]',
          workspace_id TEXT,
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      return 'article_templates 表创建完成';
    },
  },

  {
    id: 'create-reminders',
    name: '创建提醒表 (reminders)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          snippet_id TEXT NOT NULL,
          remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
          status TEXT DEFAULT 'pending',
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at)`);
      return 'reminders 表创建完成';
    },
  },

  {
    id: 'create-snippet-hashes',
    name: '创建速记哈希表 (snippet_hashes)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS snippet_hashes (
          id TEXT PRIMARY KEY,
          snippet_id TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_snippet_hashes_sha256 ON snippet_hashes(sha256)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_snippet_hashes_snippet ON snippet_hashes(snippet_id)`);
      return 'snippet_hashes 表创建完成';
    },
  },

  {
    id: 'create-split-failures',
    name: '创建拆解失败表 (split_failures)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS split_failures (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          error_message TEXT,
          error_stack TEXT,
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      return 'split_failures 表创建完成';
    },
  },

  {
    id: 'create-industry-case-library',
    name: '创建行业案例库表 (industry_case_library)',
    category: 'create',
    execute: async (_targetSchema: string) => {
      await activeDb.execute(sql`
        CREATE TABLE IF NOT EXISTS industry_case_library (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          industry TEXT NOT NULL,
          case_type TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT DEFAULT '',
          tags JSONB DEFAULT '[]',
          source TEXT DEFAULT '',
          status TEXT DEFAULT 'active',
          workspace_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_industry ON industry_case_library(industry)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_type ON industry_case_library(case_type)`);
      await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_status ON industry_case_library(status)`);
      return 'industry_case_library 表创建完成';
    },
  },

  // ========== Phase 4: Workspace 迁移 ==========
  {
    id: 'migrate-to-workspace',
    name: 'Workspace 迁移 (user_id → workspace_id)',
    category: 'alter',
    execute: async (_targetSchema: string) => {
      const tablesNeedWorkspace = [
        'daily_task', 'agent_tasks', 'agent_sub_tasks', 'material_library',
        'style_templates', 'platform_accounts', 'account_style_configs',
        'core_anchor_assets', 'style_assets', 'feedback_assets',
        'article_content', 'article_hashes', 'user_api_keys', 'publish_records',
        'info_snippets', 'content_templates', 'industry_case_library',
        'xhs_cards', 'xhs_card_groups', 'reminders', 'snippet_hashes',
      ];
      
      for (const table of tablesNeedWorkspace) {
        try {
          // 检查表是否存在
          const tableCheck = await activeDb.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_name = ${table}`);
          if (!Array.isArray(tableCheck) || tableCheck.length === 0) continue;

          // 检查是否有 user_id 列
          const columnCheck = await activeDb.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${table} AND column_name = 'user_id'`);
          
          if (Array.isArray(columnCheck) && columnCheck.length > 0) {
            // 检查是否已有 workspace_id 列
            const wsCheck = await activeDb.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${table} AND column_name = 'workspace_id'`);
            
            if (Array.isArray(wsCheck) && wsCheck.length > 0) {
              // 已有 workspace_id，迁移数据并删除 user_id
              await activeDb.execute(sql`UPDATE ${sql.identifier(table)} SET workspace_id = user_id WHERE workspace_id IS NULL OR workspace_id = ''`).catch(() => {});
            } else {
              // 重命名 user_id → workspace_id
              try {
                await activeDb.execute(sql`ALTER TABLE ${sql.identifier(table)} RENAME COLUMN user_id TO workspace_id`);
              } catch {
                // 重命名失败，添加新列
                await activeDb.execute(sql`ALTER TABLE ${sql.identifier(table)} ADD COLUMN IF NOT EXISTS workspace_id TEXT`);
              }
            }
            // 创建索引
            try {
              await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier(`idx_${table}_workspace_id`)} ON ${sql.identifier(table)}(workspace_id)`);
            } catch { /* 索引已存在 */ }
          } else {
            // 没有 user_id，确保有 workspace_id
            await activeDb.execute(sql`ALTER TABLE ${sql.identifier(table)} ADD COLUMN IF NOT EXISTS workspace_id TEXT`).catch(() => {});
            try {
              await activeDb.execute(sql`CREATE INDEX IF NOT EXISTS ${sql.identifier(`idx_${table}_workspace_id`)} ON ${sql.identifier(table)}(workspace_id)`);
            } catch { /* 索引已存在 */ }
          }
        } catch (e) {
          console.warn(`[migrate] 跳过表 ${table}:`, e instanceof Error ? e.message : String(e));
        }
      }
      return 'Workspace 迁移完成';
    },
  },

  // ========== Phase 5: 默认数据初始化 ==========
  {
    id: 'init-default-templates',
    name: '初始化默认模板数据',
    category: 'init',
    execute: async (_targetSchema: string) => {
      // 检查是否已有模板
      const existing = await activeDb.execute(sql`SELECT COUNT(*) as count FROM style_templates`);
      const count = Number((existing as any)[0]?.count ?? 0);
      if (count > 0) {
        return `已有 ${count} 个模板，跳过初始化`;
      }
      return '模板初始化跳过（需注册用户后由系统自动创建）';
    },
  },
];

// ==================== API 路由 ====================

/**
 * 创建专用迁移连接（search_path 仅指向目标 schema，无 fallback）
 * 
 * 🔴 关键设计：迁移连接的 search_path 只包含目标 schema
 * 这样 CREATE TABLE IF NOT EXISTS 不会因为发现 public 中的同名表而跳过
 * 迁移完成后关闭此连接，不影响正常连接池
 * 
 * 使用 connection.options 通过 PostgreSQL Startup Message 设置 search_path
 * 比 URL options 参数更可靠（兼容性更好）
 */
function createMigrationClient(targetSchema: string) {
  const DATABASE_URL = getRawDatabaseUrl();
  
  const rawClient = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1, // 迁移只需要一个连接
    idle_timeout: 10,
    connection: {
      options: `-c search_path=${targetSchema}`,
    },
  } as postgres.Options<{}>);
  const migrationDb = drizzle(rawClient, { schema });
  
  return { migrationDb, close: () => rawClient.end() };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const category = url.searchParams.get('category'); // 'schema' | 'create' | 'alter' | 'index' | 'data' | 'init'
  const cloneFrom = url.searchParams.get('cloneFrom'); // 从哪个 schema 克隆结构（如 'public')

  const targetSchema = getCurrentSchema();

  // 克隆模式：将已有 schema 的表结构复制到目标 schema
  if (cloneFrom) {
    try {
      await cloneSchemaStructure(cloneFrom, targetSchema);
      return NextResponse.json({
        mode: 'clone',
        sourceSchema: cloneFrom,
        targetSchema,
        message: `表结构已从 ${cloneFrom} 克隆到 ${targetSchema}`,
      });
    } catch (error) {
      return NextResponse.json({
        mode: 'clone',
        error: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }
  }

  const steps = category 
    ? MIGRATION_STEPS.filter(s => s.category === category)
    : MIGRATION_STEPS;

  if (dryRun) {
    return NextResponse.json({
      mode: 'dry-run',
      targetSchema,
      totalSteps: steps.length,
      steps: steps.map(s => ({ id: s.id, name: s.name, category: s.category })),
    });
  }

  const results: Array<{ id: string; name: string; status: string; message: string; duration: number }> = [];
  let failed = 0;

  // 🔴 Phase 0: 使用正常连接创建 Schema（因为 schema 可能还不存在，search_path 可能失败）
  const schemaStep = steps.find(s => s.category === 'schema');
  if (schemaStep) {
    const startTime = Date.now();
    try {
      const message = await schemaStep.execute(targetSchema);
      const duration = Date.now() - startTime;
      results.push({ id: schemaStep.id, name: schemaStep.name, status: 'success', message, duration });
      console.log(`[migrate] ✅ ${schemaStep.name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: schemaStep.id, name: schemaStep.name, status: 'failed', message, duration });
      failed++;
      console.warn(`[migrate] ❌ ${schemaStep.name}: ${message}`);
    }
  }

  // 🔴 Phase 1+: 使用专用迁移连接（search_path 仅指向目标 schema）
  const remainingSteps = steps.filter(s => s.category !== 'schema');
  if (remainingSteps.length > 0) {
    const { migrationDb, close } = createMigrationClient(targetSchema);
    
    // 验证迁移连接的 search_path
    try {
      const spResult = await migrationDb.execute(sql`SHOW search_path`);
      console.log(`[migrate] 迁移连接 search_path:`, JSON.stringify(spResult));
    } catch (e) {
      console.warn('[migrate] 无法验证迁移连接 search_path:', e instanceof Error ? e.message : String(e));
    }
    
    _setActiveDb(migrationDb);
    
    // 🔴 验证 activeDb 引用是否正确切换
    console.log(`[migrate] activeDb 切换完成，开始执行 ${remainingSteps.length} 个步骤`);
    
    // 执行第一个步骤后验证表位置
    let firstStepVerified = false;
    try {
      for (const step of remainingSteps) {
        const startTime = Date.now();
        try {
          const message = await step.execute(targetSchema);
          const duration = Date.now() - startTime;
          results.push({ id: step.id, name: step.name, status: 'success', message, duration });
          console.log(`[migrate] ✅ ${step.name} (${duration}ms)`);
          
          // 首个 create 步骤后验证表位置
          if (!firstStepVerified && step.category === 'create') {
            firstStepVerified = true;
            try {
              const locResult = await activeDb.execute(sql`SELECT table_schema, COUNT(*) as cnt FROM information_schema.tables WHERE table_schema IN ('dev_schema', 'public') AND table_type = 'BASE TABLE' GROUP BY table_schema`);
              console.log(`[migrate] 表位置验证:`, JSON.stringify(locResult));
            } catch (e) {
              console.warn('[migrate] 表位置验证失败:', e instanceof Error ? e.message : String(e));
            }
          }
        } catch (error) {
          const duration = Date.now() - startTime;
          const message = error instanceof Error ? error.message : String(error);
          results.push({ id: step.id, name: step.name, status: 'failed', message, duration });
          failed++;
          console.warn(`[migrate] ❌ ${step.name}: ${message}`);
          // 继续执行后续步骤（不中断）
        }
      }
    } finally {
      _resetActiveDb();
      await close();
    }
  }

  return NextResponse.json({
    targetSchema,
    totalSteps: steps.length,
    success: steps.length - failed,
    failed,
    results,
  });
}

export async function POST(request: Request) {
  // POST 也支持执行，与 GET 相同逻辑
  return GET(request);
}
