/**
 * 风格分析器主入口
 */

export { StyleAnalyzer } from './analyzer';
export { StyleLearner } from './learner';
export type {
  StyleFeatures,
  StyleTemplate,
  StyleAnalysisRequest,
  StyleAnalysisResult,
} from './types';

import { StyleAnalyzer } from './analyzer';
import { StyleLearner } from './learner';

/**
 * 风格分析器全局实例
 */
export const styleAnalyzer = new StyleAnalyzer();

/**
 * 风格学习器全局实例
 */
export const styleLearner = new StyleLearner();
