/**
 * 解决关键字检测器
 */

/**
 * 检测消息内容是否包含解决关键字
 * @param content 消息内容
 * @returns 是否为解决消息
 */
export function detectResolution(content: string): boolean {
  const resolutionKeywords = [
    'OK',
    'ok',
    '没问题',
    '可以开始',
    '收到了',
    '已解决',
    '完成',
    'done',
    '好的',
    '知道了',
    '明白',
    '了解',
    '行',
    '可以',
  ];
  
  return resolutionKeywords.some(keyword => 
    content.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * 检测消息内容是否包含问题关键字
 * @param content 消息内容
 * @returns 是否有问题
 */
export function detectProblem(content: string): boolean {
  const problemKeywords = [
    '有问题',
    '无法执行',
    '缺少',
    '不知道',
    '不确定',
    '不清楚',
    '需要',
    '不会',
    '不能',
    '疑问',
    '困难',
    '卡住',
    '阻塞',
  ];
  
  return problemKeywords.some(keyword => 
    content.includes(keyword)
  );
}
