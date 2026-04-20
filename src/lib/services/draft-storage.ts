/**
 * 草稿文件存储服务
 * 提供本地文件系统存储功能，用于保存 Agent D 和 insurance-d 的草稿文章
 */

import fs from 'fs/promises';
import path from 'path';
import { isWritingAgent } from '@/lib/agents/agent-registry';

// 草稿存储根目录 - 保险业务使用独立目录（注意大小写：insurance-Business）
const INSURANCE_DRAFT_ROOT_DIR = '/workspace/projects/insurance-Business/draft-article';
const AI_BUSINESS_DRAFT_ROOT_DIR = process.env.DRAFT_ROOT_DIR || path.join(process.cwd(), 'AI-Business', 'draft-article');

// 确保 Agent 子目录存在
const AGENT_DRAFT_DIRS = {
  'D': path.join(AI_BUSINESS_DRAFT_ROOT_DIR, 'agent-d'),
  'insurance-d': path.join(INSURANCE_DRAFT_ROOT_DIR, 'insurance-d'),
  'insurance-xiaohongshu': path.join(INSURANCE_DRAFT_ROOT_DIR, 'insurance-xiaohongshu'),
  'insurance-zhihu': path.join(INSURANCE_DRAFT_ROOT_DIR, 'insurance-zhihu'),
  'insurance-toutiao': path.join(INSURANCE_DRAFT_ROOT_DIR, 'insurance-toutiao'),
  'deai-optimizer': path.join(INSURANCE_DRAFT_ROOT_DIR, 'deai-optimizer'),
};

/**
 * 草稿文件信息
 */
export interface DraftFile {
  fileName: string; // 文件名（包含命名规范信息）
  agentId: string;
  taskId?: string;
  title: string;
  content: string;
  author?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  complianceStatus?: 'pending' | 'passed' | 'failed'; // 合规校验状态（仅 insurance-d）
  metadata?: Record<string, any>;
}

/**
 * 初始化草稿目录
 */
async function ensureDraftDir(agentId: string): Promise<string> {
  const draftDir = AGENT_DRAFT_DIRS[agentId as keyof typeof AGENT_DRAFT_DIRS];

  if (!draftDir) {
    throw new Error(`不支持的 Agent ID: ${agentId}，仅支持: D, insurance-d, insurance-xiaohongshu, insurance-zhihu, insurance-toutiao`);
  }

  try {
    await fs.mkdir(draftDir, { recursive: true });
    return draftDir;
  } catch (error) {
    throw new Error(`创建草稿目录失败: ${error}`);
  }
}

/**
 * 生成文件名
 * 命名规范：【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md
 */
function generateFileName(agentId: string, taskId?: string, title: string): string {
  const taskPart = taskId || 'unknown';
  // 提取文章标题简名（2-4字），移除特殊字符
  const shortTitle = title.replace(/[<>:"/\\|?*，。！？、；：""''（）\s]/g, '').slice(0, 4);
  const safeShortTitle = shortTitle || '无标题';
  // 创作日期格式：YYYYMMDD
  const creationDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return `${taskPart}_${safeShortTitle}_${creationDate}.md`;
}

/**
 * 保存草稿文件
 */
export async function saveDraft(draft: DraftFile): Promise<string> {
  const draftDir = await ensureDraftDir(draft.agentId);
  const fileName = generateFileName(draft.agentId, draft.taskId, draft.title);
  const filePath = path.join(draftDir, fileName);

  // 构建文件内容（Markdown 格式）
  const fileContent = buildDraftContent(draft);

  // 保存文件
  await fs.writeFile(filePath, fileContent, 'utf-8');

  console.log(`✅ 草稿已保存: ${filePath}`);
  return filePath;
}

/**
 * 读取草稿文件
 */
export async function readDraft(agentId: string, fileName: string): Promise<DraftFile | null> {
  const draftDir = await ensureDraftDir(agentId);
  const filePath = path.join(draftDir, fileName);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const draft = parseDraftContent(content);
    if (draft) {
      draft.fileName = fileName;
    }
    return draft;
  } catch (error) {
    console.error(`读取草稿失败: ${error}`);
    return null;
  }
}

/**
 * 列出指定 Agent 的所有草稿
 */
export async function listDrafts(agentId: string): Promise<DraftFile[]> {
  const draftDir = await ensureDraftDir(agentId);

  try {
    const files = await fs.readdir(draftDir);
    const drafts: DraftFile[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const draft = await readDraft(agentId, file);
        if (draft) {
          drafts.push(draft);
        }
      }
    }

    // 按创建时间倒序排序
    drafts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return drafts;
  } catch (error) {
    console.error(`列出草稿失败: ${error}`);
    return [];
  }
}

/**
 * 删除草稿
 */
export async function deleteDraft(agentId: string, fileName: string): Promise<boolean> {
  const draftDir = await ensureDraftDir(agentId);
  const filePath = path.join(draftDir, fileName);

  try {
    await fs.unlink(filePath);
    console.log(`🗑️ 草稿已删除: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`删除草稿失败: ${error}`);
    return false;
  }
}

/**
 * 构建草稿文件内容
 */
function buildDraftContent(draft: DraftFile): string {
  const lines: string[] = [];

  // 首行：任务ID + 完整文章标题 + 创作完成时间 + (合规校验状态，仅 insurance-d)
  const creationTime = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const taskIdPart = draft.taskId || '无任务ID';
  const complianceStatus = draft.complianceStatus || 'pending';
  const complianceStatusText = isWritingAgent(draft.agentId) ? ` ${complianceStatus}` : '';

  lines.push(`${taskIdPart} ${draft.title} ${creationTime}${complianceStatusText}`);
  lines.push('');

  // 文件头（元数据）
  lines.push('---');
  lines.push(`agentId: ${draft.agentId}`);
  if (draft.taskId) {
    lines.push(`taskId: ${draft.taskId}`);
  }
  lines.push(`title: ${draft.title}`);
  if (draft.author) {
    lines.push(`author: ${draft.author}`);
  }
  lines.push(`createdAt: ${draft.createdAt.toISOString()}`);
  lines.push(`updatedAt: ${draft.updatedAt.toISOString()}`);
  lines.push(`status: ${draft.status}`);
  if (isWritingAgent(draft.agentId) && draft.complianceStatus) {
    lines.push(`complianceStatus: ${draft.complianceStatus}`);
  }
  if (draft.metadata) {
    lines.push(`metadata: ${JSON.stringify(draft.metadata)}`);
  }
  lines.push('---');
  lines.push('');

  // 文章正文
  lines.push(draft.content);

  return lines.join('\n');
}

/**
 * 解析草稿文件内容
 */
function parseDraftContent(content: string): DraftFile | null {
  const lines = content.split('\n');

  // 解析 YAML frontmatter
  const frontmatter: Record<string, any> = {};
  let frontmatterStart = 0;
  let frontmatterEnd = -1;

  // 跳过首行信息（任务ID + 标题 + 创作时间），寻找 YAML frontmatter
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      frontmatterStart = i;
      break;
    }
  }

  // 解析 frontmatter
  if (frontmatterStart >= 0 && lines[frontmatterStart] === '---') {
    for (let i = frontmatterStart + 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        frontmatterEnd = i;
        break;
      }

      const match = lines[i].match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        frontmatter[key] = value;
      }
    }
  }

  if (frontmatterEnd === -1) {
    return null; // 没有 frontmatter
  }

  // 提取正文
  const contentBody = lines.slice(frontmatterEnd + 1).join('\n');

  // 构建 DraftFile 对象
  return {
    agentId: frontmatter.agentId,
    taskId: frontmatter.taskId,
    title: frontmatter.title,
    author: frontmatter.author,
    createdAt: new Date(frontmatter.createdAt),
    updatedAt: new Date(frontmatter.updatedAt),
    status: frontmatter.status || 'draft',
    complianceStatus: frontmatter.complianceStatus || 'pending',
    content: contentBody,
    metadata: frontmatter.metadata ? JSON.parse(frontmatter.metadata) : undefined,
  };
}

/**
 * 获取草稿存储目录
 */
export function getDraftDir(agentId: string): string {
  return AGENT_DRAFT_DIRS[agentId as keyof typeof AGENT_DRAFT_DIRS] || '';
}
