import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { S3Storage } from 'coze-coding-dev-sdk';
import { promises as fs } from 'fs';
import path from 'path';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

const PACKAGES = [
  {
    id: 'full',
    name: '完整项目（包含依赖）',
    description: '包含所有源代码、node_modules、Git 历史记录',
    file: '/workspace/projects-backup.tar.gz',
    size: '152MB',
  },
  {
    id: 'source',
    name: '源代码（不包含依赖）',
    description: '包含所有源代码和 Git 历史记录，不包含 node_modules',
    file: '/workspace/projects-source-only.tar.gz',
    size: '2.3MB',
  },
  {
    id: 'minimal',
    name: '纯净代码（不含 .git）',
    description: '仅包含当前版本的源代码，不含 Git 历史和 .git 目录',
    file: '/workspace/agent-collaboration-system.tar.gz',
    size: '596KB',
  },
];

// GET: 列出所有可用的下载包
export async function GET() {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const packagesWithUrls = await Promise.all(
      PACKAGES.map(async (pkg) => {
        const fileContent = await fs.readFile(pkg.file);
        const fileName = path.basename(pkg.file);

        // 上传文件
        const key = await storage.uploadFile({
          fileContent: Buffer.from(fileContent),
          fileName: `agent-collaboration-system/${fileName}`,
          contentType: 'application/gzip',
        });

        // 生成签名 URL（7天有效期）
        const downloadUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 7 * 24 * 60 * 60, // 7 天
        });

        return {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          size: pkg.size,
          downloadUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      packages: packagesWithUrls,
    });
  } catch (error: any) {
    console.error('Failed to list packages:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
