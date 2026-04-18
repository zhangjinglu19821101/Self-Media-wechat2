/**
 * 文章内容保存服务
 * 
 * 负责将保险科普文章内容保存到 article_content 表
 * 支持从 agentSubTasksStepHistory 中提取文章初稿
 */

import { db } from '@/lib/db';
import { articleContent, agentSubTasks, agentSubTasksStepHistory, dailyTask } from '@/lib/db/schema';
import { eq, and, desc, like } from 'drizzle-orm';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

/**
 * 文章内容保存服务类
 */
export class ArticleContentService {
  private static instance: ArticleContentService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ArticleContentService {
    if (!ArticleContentService.instance) {
      ArticleContentService.instance = new ArticleContentService();
    }
    return ArticleContentService.instance;
  }

  /**
   * 生成文章唯一ID
   * 格式：ART + 日期(YYYYMMDD) + 序号(3位)
   */
  private async generateArticleId(): Promise<string> {
    const now = getCurrentBeijingTime();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ART${dateStr}`;

    // 查询今日已有的文章数量
    const todayArticles = await db
      .select()
      .from(articleContent)
      .where(like(articleContent.articleId, `${prefix}%`));

    const nextSeq = String(todayArticles.length + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  /**
   * 从 agentSubTasksStepHistory 中提取文章内容
   * @param commandResultId daily_task.id
   */
  private async extractArticleFromHistory(
    commandResultId: string
  ): Promise<{ title: string; content: string; keywords: string[] } | null> {
    try {
      console.log('[ArticleContentService] 查询历史记录, commandResultId:', commandResultId);
      
      // 查询所有相关的历史记录
      const historyRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId))
        .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

      console.log('[ArticleContentService] 找到历史记录数量:', historyRecords.length);

      if (historyRecords.length === 0) {
        console.log('[ArticleContentService] 没有找到历史记录');
        return null;
      }

      // 遍历历史记录，查找文章内容
      for (let i = 0; i < historyRecords.length; i++) {
        const record = historyRecords[i];
        const content = record.interactContent as any;
        
        console.log(`[ArticleContentService] 检查记录 ${i + 1}/${historyRecords.length}:`, {
          stepNo: record.stepNo,
          interactNum: record.interactNum,
          interactType: record.interactType,
        });
        
        // 🔴🔴🔴 【优先】从 structuredResult 中提取完整文章内容（insurance-d 现在返回的格式）
        if (content?.responseContent?.structuredResult) {
          const structuredResult = content.responseContent.structuredResult;
          console.log('[ArticleContentService] 找到 responseContent.structuredResult');
          
          // 优先从 executionSummary.resultContent 提取
          let resultContent = structuredResult.executionSummary?.resultContent || structuredResult.resultContent;
          
          if (resultContent && typeof resultContent === 'string' && resultContent.length > 100) {
            // 提取标题 - 支持多种格式
            let title = '未命名文章';
            
            // 格式1: 【文章标题】标题
            const titleMatch0 = resultContent.match(/【文章标题】([^\n#【】]+)/);
            if (titleMatch0) {
              title = titleMatch0[1].trim();
              console.log('[ArticleContentService] 从【文章标题】提取标题:', title);
            }
            // 格式2: ### 标题 或 # 标题
            else {
              const titleMatch1 = resultContent.match(/^#{1,3}\s*([^\n【】]+)/);
              if (titleMatch1) {
                title = titleMatch1[1].trim();
                console.log('[ArticleContentService] 从Markdown标题提取标题:', title);
              }
            }
            
            console.log('[ArticleContentService] 成功从 structuredResult 提取文章内容, 标题:', title);
            return {
              title: title,
              content: resultContent,
              keywords: [],
            };
          }
        }
        
        // 尝试从 responseContent.resultSummary 中提取（insurance-d 实际输出的格式）
        if (content?.responseContent?.resultSummary) {
          const result = content.responseContent.resultSummary;
          console.log('[ArticleContentService] 找到 responseContent.resultSummary');
          
          if (typeof result === 'string' && (result.includes('#') || result.length > 100)) {
            // 提取标题 - 支持多种格式
            let title = '未命名文章';
            
            // 格式1: 【文章标题】标题
            const titleMatch0 = result.match(/【文章标题】([^\n#【】]+)/);
            if (titleMatch0) {
              title = titleMatch0[1].trim();
              console.log('[ArticleContentService] 从【文章标题】提取标题:', title);
            }
            // 格式2: ### 标题 或 # 标题
            else {
              const titleMatch1 = result.match(/^#{1,3}\s*([^\n【】]+)/);
              if (titleMatch1) {
                title = titleMatch1[1].trim();
                console.log('[ArticleContentService] 从Markdown标题提取标题:', title);
              }
            }
            
            console.log('[ArticleContentService] 成功提取文章内容, 标题:', title);
            return {
              title: title,
              content: result,
              keywords: [],
            };
          }
        }

        // 尝试从 question.result 中提取
        if (content?.question?.result) {
          const result = content.question.result;
          console.log('[ArticleContentService] 找到 question.result');
          
          if (typeof result === 'string' && (result.includes('#') || result.length > 100)) {
            // 提取标题 - 支持多种格式
            let title = '未命名文章';
            
            // 格式1: ### 标题 或 # 标题
            const titleMatch1 = result.match(/^#{1,3}\s*([^\n]+)/);
            if (titleMatch1) {
              title = titleMatch1[1].trim();
              // 如果标题被《》包裹，也提取出来
              const bracketMatch = title.match(/^《?([^》]+)》?$/);
              if (bracketMatch) {
                title = bracketMatch[1].trim();
              }
            } 
            // 格式2: 直接取前50个字符作为标题
            else if (result.length > 0) {
              title = result.substring(0, Math.min(50, result.length)).trim();
              if (title.length === 50) title += '...';
            }
            
            console.log('[ArticleContentService] 成功提取文章内容, 标题:', title);
            return {
              title: title,
              content: result,
              keywords: [],
            };
          }
        }
        
        // 尝试从 question.structuredResult.resultContent 中提取
        if (content?.question?.structuredResult?.resultContent) {
          const resultContent = content.question.structuredResult.resultContent;
          console.log('[ArticleContentService] 找到 structuredResult.resultContent');
          
          // 提取标题 - 支持多种格式
          let title = '未命名文章';
          
          // 格式1: ### 标题 或 # 标题
          const titleMatch1 = resultContent.match(/^#{1,3}\s*([^\n]+)/);
          if (titleMatch1) {
            title = titleMatch1[1].trim();
            // 如果标题被《》包裹，也提取出来
            const bracketMatch = title.match(/^《?([^》]+)》?$/);
            if (bracketMatch) {
              title = bracketMatch[1].trim();
            }
          } 
          // 格式2: 直接取前50个字符作为标题
          else if (resultContent.length > 0) {
            title = resultContent.substring(0, Math.min(50, resultContent.length)).trim();
            if (title.length === 50) title += '...';
          }
          
          console.log('[ArticleContentService] 成功提取文章内容, 标题:', title);
          return {
            title: title,
            content: resultContent,
            keywords: [],
          };
        }
        
        // 🔴 从 responseContent.result 中提取（写作 Agent 统一信封格式）
        if (content?.responseContent?.result) {
          const resultVal = content.responseContent.result;
          console.log('[ArticleContentService] 找到 responseContent.result, type:', typeof resultVal);
          
          try {
            const resultObj = typeof resultVal === 'string' ? JSON.parse(resultVal) : resultVal;
            
            // 新信封格式：result.content（ArticleOutputEnvelope）
            if (resultObj && typeof resultObj === 'object') {
              // isCompleted=false 时 result 是 { error: "..." }，跳过
              if (resultObj.error) {
                console.log('[ArticleContentService] responseContent.result 含 error 字段，跳过');
              }
              // 大纲模式优先：platformData.outlineText
              else if (resultObj.platformData && typeof resultObj.platformData === 'object' && typeof resultObj.platformData.outlineText === 'string' && resultObj.platformData.outlineText.trim().length > 0) {
                const title = resultObj.articleTitle || '未命名文章';
                console.log('[ArticleContentService] 从信封格式 platformData.outlineText 提取大纲, 标题:', title);
                return {
                  title: title,
                  content: resultObj.platformData.outlineText,
                  keywords: []
                };
              }
              // 信封格式 content
              else if (typeof resultObj.content === 'string' && resultObj.content.trim().length > 0) {
                const title = resultObj.articleTitle || '未命名文章';
                console.log('[ArticleContentService] 从信封格式 result.content 提取文章, 标题:', title);
                return {
                  title: title,
                  content: resultObj.content,
                  keywords: []
                };
              }
              // 旧格式兼容：result.articleContent + result.articleTitle
              else if (resultObj.articleContent) {
                console.log('[ArticleContentService] 从旧格式 result.articleContent 提取文章, 标题:', resultObj.articleTitle);
                return {
                  title: resultObj.articleTitle || '未命名文章',
                  content: resultObj.articleContent,
                  keywords: []
                };
              }
            }
          } catch (parseError) {
            // result 是纯字符串（旧格式 insurance-d：HTML文章直接放在 result 中）
            if (typeof resultVal === 'string' && resultVal.trim().length > 100) {
              let title = '未命名文章';
              const titleMatch = resultVal.match(/^#{1,3}\s*([^\n]+)/);
              if (titleMatch) title = titleMatch[1].trim();
              console.log('[ArticleContentService] 从 result 字符串提取文章, 标题:', title);
              return { title, content: resultVal, keywords: [] };
            }
          }
        }
        
        // 兼容旧格式
        if (content?.executionResult) {
          const result = typeof content.executionResult === 'string' 
            ? JSON.parse(content.executionResult) 
            : content.executionResult;
          
          if (result.title && result.content) {
            console.log('[ArticleContentService] 从 executionResult 提取文章内容');
            return {
              title: result.title,
              content: result.content,
              keywords: result.keywords || []
            };
          }
        }
      }

      console.log('[ArticleContentService] 历史记录中没有找到文章内容');
      return null;
    } catch (error) {
      console.error('[ArticleContentService] 提取文章内容失败:', error);
      return null;
    }
  }

  /**
   * 从 article_content 表获取文章内容
   * @param commandResultId daily_task.id
   */
  public async getArticleContent(
    commandResultId: string
  ): Promise<{ content: string; title: string } | null> {
    try {
      console.log('[ArticleContentService] 查询文章内容, commandResultId:', commandResultId);
      
      // 1. 首先尝试从 article_content 表获取
      const articles = await db
        .select()
        .from(articleContent)
        .where(eq(articleContent.taskId, commandResultId))
        .orderBy(desc(articleContent.createTime))
        .limit(1);

      if (articles.length > 0) {
        const article = articles[0];
        console.log('[ArticleContentService] ✅ 从 article_content 表成功获取文章内容:', {
          articleId: article.articleId,
          title: article.articleTitle,
          contentLength: article.articleContent.length
        });

        return {
          title: article.articleTitle,
          content: article.articleContent
        };
      }

      console.log('[ArticleContentService] ⚠️  article_content 表中未找到文章内容，尝试从 agent_sub_tasks.resultData 中获取');

      // 2. 备用方案：从历史记录中提取（新增方案）
      console.log('[ArticleContentService] 🆕 尝试从历史记录中提取文章内容...');
      const articleFromHistory = await this.extractArticleFromHistory(commandResultId);
      
      if (articleFromHistory) {
        console.log('[ArticleContentService] ✅ 从历史记录中成功提取文章内容:', {
          title: articleFromHistory.title,
          contentLength: articleFromHistory.content.length
        });
        
        // 同时保存到 article_content 表，便于下次直接获取
        try {
          const subTasks = await db
            .select()
            .from(agentSubTasks)
            .where(eq(agentSubTasks.commandResultId, commandResultId))
            .orderBy(agentSubTasks.orderIndex)
            .limit(1);
          
          if (subTasks.length > 0) {
            await this.saveArticleContentDirectly(subTasks[0], articleFromHistory.content);
            console.log('[ArticleContentService] ✅ 历史文章已保存到 article_content 表');
          }
        } catch (saveError) {
          console.warn('[ArticleContentService] ⚠️  保存历史文章到 article_content 表失败:', saveError);
        }
        
        return {
          title: articleFromHistory.title,
          content: articleFromHistory.content
        };
      }

      // 3. 备用方案：从 agent_sub_tasks.resultData 中获取
      const subTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, commandResultId))
        .orderBy(agentSubTasks.orderIndex);

      for (const subTask of subTasks) {
        if (subTask.resultData) {
          try {
            // 智能解析：兼容对象和字符串两种格式
            let resultData: Record<string, any>;
            if (typeof subTask.resultData === 'object' && subTask.resultData !== null) {
              resultData = subTask.resultData as Record<string, any>;
            } else if (typeof subTask.resultData === 'string') {
              try {
                resultData = JSON.parse(subTask.resultData);
              } catch (e) {
                console.warn('[ArticleContentService] resultData JSON 解析失败，降级为字符串处理');
                resultData = { content: subTask.resultData };
              }
            } else {
              resultData = {};
            }
            console.log('[ArticleContentService] 🔍 检查子任务 resultData:', {
              orderIndex: subTask.orderIndex,
              hasResultData: !!subTask.resultData,
              resultDataType: typeof subTask.resultData,
              keys: Object.keys(resultData as object)
            });

            // 尝试从 resultData 中提取文章内容
            let content = '';
            let title = '未命名文章';

            // 🔴 优先级1：信封格式 executorOutput.result.content（统一 ArticleOutputEnvelope）
            if (resultData.executorOutput?.result && typeof resultData.executorOutput.result === 'object') {
              const envelope = resultData.executorOutput.result;
              // 大纲模式优先：platformData.outlineText
              if (envelope.platformData && typeof envelope.platformData === 'object' && typeof envelope.platformData.outlineText === 'string' && envelope.platformData.outlineText.trim().length > 0) {
                content = envelope.platformData.outlineText;
                title = envelope.articleTitle || resultData.articleTitle || title;
              }
              // 信封格式 content
              else if (typeof envelope.content === 'string' && envelope.content.trim().length > 0) {
                content = envelope.content;
                title = envelope.articleTitle || resultData.articleTitle || title;
              }
            }
            // 🔴 优先级2：顶层 result.content（信封格式无 executorOutput 包装）
            else if (resultData.result && typeof resultData.result === 'object') {
              const result = resultData.result;
              // 大纲模式优先：platformData.outlineText
              if (result.platformData && typeof result.platformData === 'object' && typeof result.platformData.outlineText === 'string' && result.platformData.outlineText.trim().length > 0) {
                content = result.platformData.outlineText;
                title = result.articleTitle || resultData.articleTitle || title;
              }
              // 信封格式 content
              else if (typeof result.content === 'string' && result.content.trim().length > 0) {
                content = result.content;
                title = result.articleTitle || resultData.articleTitle || title;
              }
              // 旧格式兼容：result 是对象但没有 content（小红书旧格式）
              else if (typeof result.fullText === 'string' && result.fullText.trim().length > 100) {
                content = result.fullText;
                title = result.articleTitle || resultData.articleTitle || title;
              }
            }
            // 3. executorOutput.output（Agent T 等非写作 Agent）
            else if (resultData.executorOutput?.output && typeof resultData.executorOutput.output === 'string' && resultData.executorOutput.output.length > 100) {
              content = resultData.executorOutput.output;
            } 
            // 4. executorOutput.result（旧格式字符串）
            else if (resultData.executorOutput?.result && typeof resultData.executorOutput.result === 'string' && resultData.executorOutput.result.length > 100) {
              content = resultData.executorOutput.result;
            }
            // 5. output（统一字段）
            else if (typeof resultData.output === 'string' && resultData.output.length > 100) {
              content = resultData.output;
            }
            // 6. outputContent（旧格式）
            else if (typeof resultData.outputContent === 'string' && resultData.outputContent.length > 100) {
              content = resultData.outputContent;
            }
            // 7. content
            else if (typeof resultData.content === 'string' && resultData.content.length > 100) {
              content = resultData.content;
            }
            // 8. articleContent
            else if (typeof resultData.articleContent === 'string' && resultData.articleContent.length > 100) {
              content = resultData.articleContent;
            }
            // 9. result（旧格式字符串）
            else if (typeof resultData.result === 'string' && resultData.result.length > 100) {
              content = resultData.result;
            }
            // 10. structuredResult.resultContent
            else if (resultData.structuredResult?.resultContent && typeof resultData.structuredResult.resultContent === 'string' && resultData.structuredResult.resultContent.length > 100) {
              content = resultData.structuredResult.resultContent;
            }

            if (content && content.length > 0) {
              // 尝试提取标题
              if (resultData.title) {
                title = resultData.title;
              } else {
                // 从内容中提取标题
                const titleMatch = content.match(/^#{1,3}\s*([^\n]+)/);
                if (titleMatch) {
                  title = titleMatch[1].trim();
                } else {
                  title = content.substring(0, Math.min(50, content.length)).trim();
                  if (title.length === 50) title += '...';
                }
              }

              console.log('[ArticleContentService] ✅ 从 agent_sub_tasks.resultData 中成功获取文章内容:', {
                orderIndex: subTask.orderIndex,
                title: title,
                contentLength: content.length
              });

              return { title, content };
            }
          } catch (e) {
            console.warn('[ArticleContentService] ⚠️  解析子任务 resultData 失败:', {
              error: e,
              message: e instanceof Error ? e.message : String(e),
              stack: e instanceof Error ? e.stack : 'no stack trace available',
              subTaskId: subTask.id,
              orderIndex: subTask.orderIndex,
              resultDataType: typeof subTask.resultData
            });
          }
        }
      }

      console.log('[ArticleContentService] ❌ 所有方案都未找到文章内容');
      return null;
    } catch (error) {
      console.error('[ArticleContentService] ❌ 获取文章内容失败 - 完整异常信息:', {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'no stack trace available',
        commandResultId: commandResultId
      });
      return null;
    }
  }

  /**
   * 保存文章内容到 article_content 表
   * @param subTask agent_sub_tasks 记录
   */
  public async saveArticleContent(
    subTask: typeof agentSubTasks.$inferSelect
  ): Promise<typeof articleContent.$inferSelect | null> {
    try {
      console.log('[ArticleContentService] ========== 开始保存文章内容 ==========');
      console.log('[ArticleContentService] 子任务信息:', {
        id: subTask.id,
        taskTitle: subTask.taskTitle,
        orderIndex: subTask.orderIndex,
        fromParentsExecutor: subTask.fromParentsExecutor,
        commandResultId: subTask.commandResultId,
      });

      // 1. 检查是否是保险相关的执行Agent（写作Agent + insurance-c）
      const _isInsuranceAgent = isWritingAgent(subTask.fromParentsExecutor) ||
                              subTask.fromParentsExecutor === 'insurance-c';
      
      if (!_isInsuranceAgent) {
        console.log('[ArticleContentService] 不是保险相关Agent，跳过保存');
        return null;
      }

      // 2. 从历史记录中提取文章内容
      const articleData = await this.extractArticleFromHistory(subTask.commandResultId);

      if (!articleData) {
        console.log('[ArticleContentService] 没有提取到文章内容');
        return null;
      }

      console.log('[ArticleContentService] 成功提取文章内容:', {
        title: articleData.title,
        contentLength: articleData.content.length,
        keywords: articleData.keywords,
      });

      // 4. 检查是否已经存在该文章
      const existingArticle = await db
        .select()
        .from(articleContent)
        .where(eq(articleContent.taskId, subTask.commandResultId))
        .limit(1);

      if (existingArticle.length > 0) {
        console.log('[ArticleContentService] 文章已存在，更新内容');
        const [updatedArticle] = await db
          .update(articleContent)
          .set({
            articleTitle: articleData.title,
            articleContent: articleData.content,
            coreKeywords: articleData.keywords,
            updateTime: getCurrentBeijingTime(),
          })
          .where(eq(articleContent.articleId, existingArticle[0].articleId))
          .returning();

        console.log('[ArticleContentService] ========== 文章更新完成 ==========');
        return updatedArticle;
      }

      // 5. 生成文章ID
      const articleId = await this.generateArticleId();
      console.log('[ArticleContentService] 生成文章ID:', articleId);

      // 6. 保存新文章
      const [newArticle] = await db
        .insert(articleContent)
        .values({
          articleId: articleId,
          taskId: subTask.commandResultId,
          creatorAgent: subTask.fromParentsExecutor,
          articleTitle: articleData.title,
          articleContent: articleData.content,
          coreKeywords: articleData.keywords,
          contentStatus: 'draft',
          createTime: getCurrentBeijingTime(),
          updateTime: getCurrentBeijingTime(),
        })
        .returning();

      console.log('[ArticleContentService] ========== 文章保存完成 ==========');
      return newArticle;
    } catch (error) {
      console.error('[ArticleContentService] 保存文章内容失败:', error);
      return null;
    }
  }

  /**
   * 直接保存文章内容（不需要从历史记录提取）
   * @param subTask agent_sub_tasks 记录
   * @param fullArticleContent 完整的文章内容
   */
  public async saveArticleContentDirectly(
    subTask: typeof agentSubTasks.$inferSelect,
    fullArticleContent: string
  ): Promise<typeof articleContent.$inferSelect | null> {
    try {
      console.log('[ArticleContentService] ========== 直接保存文章内容 ==========');
      console.log('[ArticleContentService] 子任务信息:', {
        id: subTask.id,
        taskTitle: subTask.taskTitle,
        orderIndex: subTask.orderIndex,
        fromParentsExecutor: subTask.fromParentsExecutor,
        commandResultId: subTask.commandResultId,
        contentLength: fullArticleContent.length,
      });

      // 1. 检查是否是保险相关的执行Agent（写作Agent + insurance-c）
      const _isInsuranceAgent = isWritingAgent(subTask.fromParentsExecutor) ||
                              subTask.fromParentsExecutor === 'insurance-c';
      
      if (!_isInsuranceAgent) {
        console.log('[ArticleContentService] 不是保险相关Agent，跳过保存');
        return null;
      }

      // 2. 提取标题 - 支持多种格式
      let title = '未命名文章';
      
      // 格式1: 【文章标题】标题
      const titleMatch0 = fullArticleContent.match(/【文章标题】([^\n#【】]+)/);
      if (titleMatch0) {
        title = titleMatch0[1].trim();
        console.log('[ArticleContentService] 从【文章标题】提取标题:', title);
      }
      // 格式2: ### 标题 或 # 标题
      else {
        const titleMatch1 = fullArticleContent.match(/^#{1,3}\s*([^\n【】]+)/);
        if (titleMatch1) {
          title = titleMatch1[1].trim();
          console.log('[ArticleContentService] 从Markdown标题提取标题:', title);
        }
      }
      
      // 格式3: 直接取前50个字符作为标题
      if (title === '未命名文章' && fullArticleContent.length > 0) {
        title = fullArticleContent.substring(0, Math.min(50, fullArticleContent.length)).trim();
        if (title.length === 50) title += '...';
      }

      console.log('[ArticleContentService] 成功提取文章内容, 标题:', title);

      // 3. 检查是否已经存在该文章
      // 🔥 多平台发布修复：使用 taskId + subTaskId 组合查询，避免多平台文章覆盖
      const existingArticle = subTask.id
        ? await db
            .select()
            .from(articleContent)
            .where(and(
              eq(articleContent.taskId, subTask.commandResultId),
              eq(articleContent.subTaskId, subTask.id)
            ))
            .limit(1)
        : await db
            .select()
            .from(articleContent)
            .where(eq(articleContent.taskId, subTask.commandResultId))
            .limit(1);

      if (existingArticle.length > 0) {
        console.log('[ArticleContentService] 文章已存在，更新内容');
        const [updatedArticle] = await db
          .update(articleContent)
          .set({
            articleTitle: title,
            articleContent: fullArticleContent,
            updateTime: getCurrentBeijingTime(),
          })
          .where(eq(articleContent.articleId, existingArticle[0].articleId))
          .returning();

        console.log('[ArticleContentService] ========== 文章更新完成 ==========');
        return updatedArticle;
      }

      // 4. 生成文章ID
      const articleId = await this.generateArticleId();
      console.log('[ArticleContentService] 生成文章ID:', articleId);

      // 5. 保存新文章
      const [newArticle] = await db
        .insert(articleContent)
        .values({
          articleId: articleId,
          taskId: subTask.commandResultId,
          subTaskId: subTask.id, // 🔥 多平台发布：关联子任务ID，区分不同平台版本
          creatorAgent: subTask.fromParentsExecutor,
          articleTitle: title,
          articleContent: fullArticleContent,
          coreKeywords: [],
          contentStatus: 'draft',
          createTime: getCurrentBeijingTime(),
          updateTime: getCurrentBeijingTime(),
        })
        .returning();

      console.log('[ArticleContentService] ========== 文章保存完成 ==========');
      return newArticle;
    } catch (error) {
      console.error('[ArticleContentService] 保存文章内容失败:', error);
      return null;
    }
  }
}
