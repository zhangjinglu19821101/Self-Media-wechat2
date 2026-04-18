'use client';

/**
 * API Key 管理页面（BYOK）
 * 
 * 功能：
 * 1. 查看当前 API Key 列表（脱敏展示）
 * 2. 添加新的豆包 API Key
 * 3. 验证 Key 有效性
 * 4. 禁用/删除 Key
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api/client';

interface ApiKeyInfo {
  id: string;
  provider: string;
  keySuffix: string;
  maskedKey: string;
  status: string;
  displayName: string;
  lastVerifiedAt: string | null;
  lastVerifyError: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '活跃', color: 'text-green-600 bg-green-50' },
  disabled: { label: '已禁用', color: 'text-gray-500 bg-gray-50' },
  invalid: { label: '无效', color: 'text-red-600 bg-red-50' },
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [verifying, setVerifying] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 检查是否从 API Key 缺失跳转过来
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('apiKeyMissingReturnUrl');
      if (saved) {
        setReturnUrl(saved);
        sessionStorage.removeItem('apiKeyMissingReturnUrl');
      }
    } catch { /* ignore */ }
  }, []);

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<{ keys: ApiKeyInfo[] }>('/api/user-api-keys');
      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleAdd = async () => {
    if (!newKey.trim()) {
      setError('请输入 API Key');
      return;
    }

    try {
      setAdding(true);
      setError('');
      await apiPost('/api/user-api-keys', {
        provider: 'doubao',
        apiKey: newKey.trim(),
        displayName: displayName.trim() || '豆包 API Key',
      });
      setNewKey('');
      setDisplayName('');
      setSuccess(returnUrl 
        ? 'API Key 添加成功！点击"返回继续操作"回到之前的页面。' 
        : 'API Key 添加成功');
      await loadKeys();
      // 如果有返回路径，不自动清除成功提示
      if (!returnUrl) {
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.message || '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      setVerifying(id);
      setError('');
      const result = await apiPost<{ valid: boolean; error?: string }>('/api/user-api-keys/verify', { id });
      if (result.valid) {
        setSuccess('Key 验证通过');
      } else {
        setError(`Key 验证失败: ${result.error || '未知错误'}`);
      }
      await loadKeys();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '验证失败');
    } finally {
      setVerifying(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      setError('');
      await apiPut(`/api/user-api-keys/${id}`, { status: newStatus });
      setSuccess(`Key 已${newStatus === 'active' ? '启用' : '禁用'}`);
      await loadKeys();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此 API Key？删除后系统将使用平台默认 Key。')) return;

    try {
      setError('');
      await apiDelete(`/api/user-api-keys/${id}`);
      setSuccess('Key 已删除');
      await loadKeys();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 标题 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">API Key 管理</h1>
              <p className="mt-2 text-sm text-gray-600">
                配置您自己的豆包 API Key，系统将优先使用您的 Key 调用 LLM，费用由您承担。
                未配置时将无法使用 AI 功能。
              </p>
            </div>
            {returnUrl && (
              <button
                onClick={() => window.location.href = returnUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
              >
                ← 返回继续操作
              </button>
            )}
          </div>
          {/* 跳转提示 */}
          {returnUrl && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
              <span className="font-medium">⚠️</span>
              <span>您正在使用 AI 功能时被跳转到此页面。请配置 API Key 后点击"返回继续操作"。</span>
            </div>
          )}
        </div>

        {/* 提示信息 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* 添加 Key 区域 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">添加 API Key</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
                豆包（火山引擎）— 当前仅支持豆包
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder="请输入您的豆包 API Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-400">
                Key 将被 AES-256-GCM 加密存储，仅显示后 4 位
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                显示名称
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="例如：主账号 Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newKey.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adding ? '添加中...' : '添加 Key'}
            </button>
          </div>
        </div>

        {/* Key 列表 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">已配置的 Key</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">加载中...</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-sm mb-2">暂未配置 API Key</div>
              <div className="text-gray-400 text-xs">添加后将优先使用您的 Key，未添加时使用平台默认 Key</div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {keys.map(key => {
                const statusInfo = STATUS_MAP[key.status] || STATUS_MAP.disabled;
                return (
                  <div key={key.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 text-sm">
                              {key.displayName || key.provider}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            Key: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{key.maskedKey}</code>
                            <span className="ml-3">Provider: {key.provider}</span>
                          </div>
                          {key.lastVerifiedAt && (
                            <div className="mt-1 text-xs text-gray-400">
                              最后验证: {new Date(key.lastVerifiedAt).toLocaleString()}
                              {key.lastVerifyError && (
                                <span className="ml-2 text-red-500">({key.lastVerifyError})</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerify(key.id)}
                          disabled={verifying === key.id}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                        >
                          {verifying === key.id ? '验证中...' : '验证'}
                        </button>
                        {key.status === 'active' ? (
                          <button
                            onClick={() => handleToggleStatus(key.id, key.status)}
                            className="px-3 py-1.5 text-xs font-medium text-yellow-600 bg-yellow-50 rounded-lg hover:bg-yellow-100"
                          >
                            禁用
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(key.id, key.status)}
                            className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                          >
                            启用
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 说明 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">如何获取豆包 API Key？</h3>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>访问火山引擎控制台 (console.volcengine.com)</li>
            <li>注册/登录账号，开通「豆包大模型」服务</li>
            <li>在 API Key 管理页面创建新的 API Key</li>
            <li>复制 Key 粘贴到上方输入框</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
