/**
 * 任务拆解组件统一类型定义
 */

// SubTask 类型定义（与 page.tsx 保持一致）
export interface SubTask {
  id: string;
  title: string;
  description: string;
  executor: string;
  orderIndex: number;
  creationGuideConfig?: { inheritFromGlobal: boolean };
  userOpinion?: string | null;
  materialIds?: string[];
  structureName?: string | null;
  structureDetail?: string | null;
  accountId?: string;
  platform?: string;
  platformLabel?: string;
}

// 通用回调类型
export type UpdateSubTaskCallback = (
  taskId: string,
  field: keyof SubTask,
  value: SubTask[keyof SubTask]
) => void;
