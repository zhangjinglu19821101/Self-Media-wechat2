/**
 * 通用能力测试页面
 * 
 * 测试内容：
 * - Agent 能力边界判定（通用版本）
 * - 不同 Agent 的配置读取
 * - 规则匹配测试
 */

'use client';

import { useState } from 'react';

interface TestResult {
  agentId: string;
  taskTitle: string;
  result: {
    isNeedMcp: boolean;
    capabilityType?: string;
    problem?: string;
    confidence: number;
    reasoning: string;
    matchedRule?: string;
  } | null;
  error?: string;
  duration: number;
}

const TEST_CASES = [
  { agentId: 'insurance-d', taskTitle: '撰写一篇关于分红险的科普文章', description: '需要创作保险科普内容' },
  { agentId: 'insurance-d', taskTitle: '搜索最新的惠民保政策', description: '需要查询最新政策信息' },
  { agentId: 'insurance-d', taskTitle: '发布文章到微信公众号', description: '需要公众号发布能力' },
  { agentId: 'insurance-c', taskTitle: '分析上周运营数据', description: '数据分析复盘' },
  { agentId: 'insurance-c', taskTitle: '搜索竞品推广案例', description: '需要搜索素材' },
  { agentId: 'agent-d', taskTitle: '解读最新的大模型技术', description: '技术分析文章' },
  { agentId: 'unknown-agent', taskTitle: '这是一个测试任务', description: '测试未知Agent' },
];

export default function UniversalCapabilityTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function runTest(testCase: typeof TEST_CASES[0]) {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/test/universal-capability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: testCase.agentId,
          taskTitle: testCase.taskTitle,
          taskDescription: testCase.description,
        }),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      return {
        agentId: testCase.agentId,
        taskTitle: testCase.taskTitle,
        result: data.success ? data.data : null,
        error: data.success ? undefined : data.error,
        duration,
      };
    } catch (error) {
      return {
        agentId: testCase.agentId,
        taskTitle: testCase.taskTitle,
        result: null,
        error: error instanceof Error ? error.message : '测试失败',
        duration: Date.now() - startTime,
      };
    }
  }

  async function runAllTests() {
    setLoading(true);
    setResults([]);

    const testResults: TestResult[] = [];
    for (const testCase of TEST_CASES) {
      const result = await runTest(testCase);
      testResults.push(result);
      setResults([...testResults]);
    }

    setLoading(false);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">通用能力边界判定测试</h1>
      <p className="text-gray-600 mb-6">
        测试不同 Agent 的能力边界判定，验证通用化改造效果
      </p>

      <button
        onClick={runAllTests}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 mb-8"
      >
        {loading ? '测试中...' : '运行全部测试'}
      </button>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">测试结果</h2>
          
          <div className="grid gap-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  result.error
                    ? 'border-red-200 bg-red-50'
                    : result.result?.isNeedMcp
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-semibold">{result.agentId}</span>
                    <span className="text-gray-500 mx-2">|</span>
                    <span>{result.taskTitle}</span>
                  </div>
                  <span className="text-sm text-gray-500">{result.duration}ms</span>
                </div>

                {result.error ? (
                  <div className="text-red-600 text-sm">错误: {result.error}</div>
                ) : result.result ? (
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">判定结果:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          result.result.isNeedMcp
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {result.result.isNeedMcp ? '需要MCP' : '直接完成'}
                      </span>
                      <span className="text-gray-500">
                        (置信度: {(result.result.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                    
                    {result.result.capabilityType && (
                      <div>
                        <span className="text-gray-600">能力类型:</span>{' '}
                        {result.result.capabilityType}
                      </div>
                    )}
                    
                    {result.result.problem && (
                      <div>
                        <span className="text-gray-600">问题描述:</span>{' '}
                        {result.result.problem}
                      </div>
                    )}
                    
                    {result.result.matchedRule && (
                      <div>
                        <span className="text-gray-600">匹配规则:</span>{' '}
                        <code className="bg-gray-100 px-1 rounded text-xs">
                          {result.result.matchedRule}
                        </code>
                      </div>
                    )}
                    
                    <div className="text-gray-500 italic">
                      {result.result.reasoning}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">统计</h3>
            <div className="text-sm text-gray-600">
              总计: {results.length} | 
              成功: {results.filter(r => !r.error).length} | 
              失败: {results.filter(r => r.error).length} | 
              需要MCP: {results.filter(r => r.result?.isNeedMcp).length} | 
              直接完成: {results.filter(r => r.result && !r.result.isNeedMcp).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
