/**
 * 时间解析器
 * 将中文时间表达式转换为具体日期
 */

export type TimeUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute';

export interface TimeExpression {
  original: string;
  parsed: Date | null;
  description: string;
}

/**
 * 时间解析器类
 */
export class TimeParser {
  /**
   * 解析时间表达式
   * @param expression 时间表达式，如"本周内"、"本周五"、"下周一"
   * @param referenceDate 参考日期，默认为当前日期
   * @returns 解析结果
   */
  static parse(expression: string, referenceDate: Date = new Date()): TimeExpression {
    const trimmed = expression.trim().replace(/[完成|截止|前|后|内|之内]*/g, '');
    const description = `解析 "${expression}" 为具体日期`;

    // 1. 本周内
    if (/本周内?/.test(trimmed)) {
      return {
        original: expression,
        parsed: this.getThisWeekEnd(referenceDate),
        description: `${description} → 本周日 (${this.getThisWeekEnd(referenceDate).toLocaleDateString('zh-CN')})`,
      };
    }

    // 2. 下周内
    if (/下周内?/.test(trimmed)) {
      return {
        original: expression,
        parsed: this.getNextWeekEnd(referenceDate),
        description: `${description} → 下周日 (${this.getNextWeekEnd(referenceDate).toLocaleDateString('zh-CN')})`,
      };
    }

    // 3. 本周X（X为一、二、三、四、五、六、日）
    const dayMatch = trimmed.match(/本周([一二三四五六日天])/);
    if (dayMatch) {
      const day = this.mapDayOfWeek(dayMatch[1]);
      const date = this.getThisWeekDay(referenceDate, day);
      return {
        original: expression,
        parsed: date,
        description: `${description} → 本周${this.getDayName(day)} (${date.toLocaleDateString('zh-CN')})`,
      };
    }

    // 4. 下周X
    const nextDayMatch = trimmed.match(/下周([一二三四五六日天])/);
    if (nextDayMatch) {
      const day = this.mapDayOfWeek(nextDayMatch[1]);
      const date = this.getNextWeekDay(referenceDate, day);
      return {
        original: expression,
        parsed: date,
        description: `${description} → 下周${this.getDayName(day)} (${date.toLocaleDateString('zh-CN')})`,
      };
    }

    // 5. X天/周/月后
    const afterMatch = trimmed.match(/(\d+)\s*(天|周|月|年)后/);
    if (afterMatch) {
      const count = parseInt(afterMatch[1]);
      const unit = afterMatch[2];
      const date = this.addTime(referenceDate, count, this.mapTimeUnit(unit));
      return {
        original: expression,
        parsed: date,
        description: `${description} → ${count}${unit}后 (${date.toLocaleDateString('zh-CN')})`,
      };
    }

    // 6. 今天、明天、后天
    if (trimmed === '今天') {
      return {
        original: expression,
        parsed: new Date(referenceDate),
        description: `${description} → 今天 (${referenceDate.toLocaleDateString('zh-CN')})`,
      };
    }
    if (trimmed === '明天') {
      const date = new Date(referenceDate);
      date.setDate(date.getDate() + 1);
      return {
        original: expression,
        parsed: date,
        description: `${description} → 明天 (${date.toLocaleDateString('zh-CN')})`,
      };
    }
    if (trimmed === '后天') {
      const date = new Date(referenceDate);
      date.setDate(date.getDate() + 2);
      return {
        original: expression,
        parsed: date,
        description: `${description} → 后天 (${date.toLocaleDateString('zh-CN')})`,
      };
    }

    // 7. 无法解析
    return {
      original: expression,
      parsed: null,
      description: `无法解析 "${expression}" 为具体日期`,
    };
  }

  /**
   * 从文本中提取并转换所有时间表达式
   * @param text 文本内容
   * @param referenceDate 参考日期
   * @returns 转换后的文本
   */
  static parseAll(text: string, referenceDate: Date = new Date()): string {
    let result = text;

    // 定义所有可能的时间表达式模式
    const patterns = [
      // 本周内
      /本周内完成/g,
      /本周内/g,
      // 本周X
      /本周([一二三四五六日天])/g,
      // 下周内
      /下周内完成/g,
      /下周内/g,
      // 下周X
      /下周([一二三四五六日天])/g,
      // X天后
      /(\d+)天后/g,
      // 今天/明天/后天
      /(今天|明天|后天)/g,
    ];

    patterns.forEach((pattern, index) => {
      result = result.replace(pattern, (match: string) => {
        const parsed = this.parse(match, referenceDate);
        if (parsed.parsed) {
          return parsed.parsed.toLocaleDateString('zh-CN');
        }
        return match;
      });
    });

    return result;
  }

  /**
   * 获取本周日的日期
   */
  private static getThisWeekEnd(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay(); // 0-6, 0 is Sunday
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    result.setDate(result.getDate() + daysUntilSunday);
    return result;
  }

  /**
   * 获取下周日的日期
   */
  private static getNextWeekEnd(date: Date): Date {
    const thisWeekEnd = this.getThisWeekEnd(date);
    const result = new Date(thisWeekEnd);
    result.setDate(result.getDate() + 7);
    return result;
  }

  /**
   * 获取本周某天的日期
   * @param date 参考日期
   * @param dayOfWeek 星期几（0-6，0是星期日）
   */
  private static getThisWeekDay(date: Date, dayOfWeek: number): Date {
    const result = new Date(date);
    const currentDayOfWeek = result.getDay();
    const daysUntilTarget = dayOfWeek - currentDayOfWeek;
    result.setDate(result.getDate() + daysUntilTarget);
    return result;
  }

  /**
   * 获取下周某天的日期
   */
  private static getNextWeekDay(date: Date, dayOfWeek: number): Date {
    const thisWeekDay = this.getThisWeekDay(date, dayOfWeek);
    const result = new Date(thisWeekDay);
    result.setDate(result.getDate() + 7);
    return result;
  }

  /**
   * 映射中文星期几到数字
   */
  private static mapDayOfWeek(day: string): number {
    const map: Record<string, number> = {
      '一': 1,
      '二': 2,
      '三': 3,
      '四': 4,
      '五': 5,
      '六': 6,
      '日': 0,
      '天': 0,
    };
    return map[day] || 0;
  }

  /**
   * 获取星期几的名称
   */
  private static getDayName(day: number): string {
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    return names[day] || '';
  }

  /**
   * 映射中文时间单位
   */
  private static mapTimeUnit(unit: string): TimeUnit {
    const map: Record<string, TimeUnit> = {
      '天': 'day',
      '周': 'week',
      '月': 'month',
      '年': 'year',
    };
    return map[unit] || 'day';
  }

  /**
   * 增加时间
   */
  private static addTime(date: Date, amount: number, unit: TimeUnit): Date {
    const result = new Date(date);

    switch (unit) {
      case 'year':
        result.setFullYear(result.getFullYear() + amount);
        break;
      case 'month':
        result.setMonth(result.getMonth() + amount);
        break;
      case 'week':
        result.setDate(result.getDate() + amount * 7);
        break;
      case 'day':
        result.setDate(result.getDate() + amount);
        break;
      case 'hour':
        result.setHours(result.getHours() + amount);
        break;
      case 'minute':
        result.setMinutes(result.getMinutes() + amount);
        break;
    }

    return result;
  }
}

/**
 * 快捷函数：解析时间表达式
 */
export function parseTime(expression: string, referenceDate?: Date): TimeExpression {
  return TimeParser.parse(expression, referenceDate);
}

/**
 * 快捷函数：解析文本中的所有时间表达式
 */
export function parseAllTimes(text: string, referenceDate?: Date): string {
  return TimeParser.parseAll(text, referenceDate);
}
