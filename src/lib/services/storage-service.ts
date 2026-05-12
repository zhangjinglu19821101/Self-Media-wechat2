/**
 * 存储服务 - 基础占位符
 * 
 * 这个文件是必需的占位符，用于 db-backup-service.ts 的导入
 * 实际的存储服务实现需要在生产环境中提供
 */

export interface StorageService {
  uploadFile(key: string, data: Buffer | string, contentType?: string): Promise<string>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  listFiles(prefix: string): Promise<string[]>;
  getFileUrl(key: string, expiresIn?: number): Promise<string>;
}

// 占位符实现
export const storageService: StorageService = {
  async uploadFile(key: string, data: Buffer | string, contentType?: string): Promise<string> {
    console.warn('Storage service not configured, upload skipped');
    return key;
  },
  
  async downloadFile(key: string): Promise<Buffer> {
    console.warn('Storage service not configured, download skipped');
    return Buffer.alloc(0);
  },
  
  async deleteFile(key: string): Promise<void> {
    console.warn('Storage service not configured, delete skipped');
  },
  
  async listFiles(prefix: string): Promise<string[]> {
    console.warn('Storage service not configured, list skipped');
    return [];
  },
  
  async getFileUrl(key: string, expiresIn?: number): Promise<string> {
    console.warn('Storage service not configured, URL generation skipped');
    return '';
  }
};

export default storageService;
