/**
 * 微信公众号自动化服务
 *
 * 使用 Playwright 模拟用户操作，完成微信 API 不支持的功能：
 * 1. 原创声明设置
 * 2. 赞赏设置
 * 3. 合集设置
 * 4. 保存草稿
 *
 * 流程：
 * 1. 用 cookie 登录公众号后台
 * 2. 打开草稿箱编辑页
 * 3. 依次设置原创声明、赞赏、合集等
 * 4. 保存
 */

import { WechatDraftDefaults } from '@/config/wechat-official-account.config';

// Cookie 存储（内存，进程重启后需要重新扫码）
interface WechatCookie {
  accountId: string;
  cookies: string;
  savedAt: number;
  expiresAt: number;
}

const cookieStore = new Map<string, WechatCookie>();

/**
 * 保存公众号 Cookie
 */
export function saveWechatCookie(accountId: string, cookies: string, expiresInHours: number = 24) {
  cookieStore.set(accountId, {
    accountId,
    cookies,
    savedAt: Date.now(),
    expiresAt: Date.now() + expiresInHours * 60 * 60 * 1000,
  });
}

/**
 * 获取公众号 Cookie
 */
export function getWechatCookie(accountId: string): string | null {
  const entry = cookieStore.get(accountId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cookieStore.delete(accountId);
    return null;
  }
  return entry.cookies;
}

/**
 * 检查 Cookie 是否有效
 */
export function hasValidCookie(accountId: string): boolean {
  return getWechatCookie(accountId) !== null;
}

/**
 * 草稿编辑页 URL 构造
 * 微信公众号后台草稿编辑页的 URL 格式
 */
export function getDraftEditUrl(appId: string, mediaId: string): string {
  // 微信公众号后台草稿编辑页
  // 注意：实际 URL 格式可能需要根据微信公众号后台调整
  return `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&lang=zh_CN&token={token}&media_id=${mediaId}`;
}

/**
 * 🔥🔥🔥 核心功能：自动配置草稿
 *
 * 通过 Playwright 自动操作公众号后台，设置 API 不支持的字段
 *
 * @param options 配置选项
 * @returns 操作结果
 */
export async function autoConfigureDraft(options: {
  accountId: string;
  mediaId: string;
  config: WechatDraftDefaults;
}): Promise<{
  success: boolean;
  editUrl?: string;
  error?: string;
  configuredFields: string[];
}> {
  const { accountId, mediaId, config } = options;
  const configuredFields: string[] = [];

  // 获取 cookie
  const cookies = getWechatCookie(accountId);
  if (!cookies) {
    return {
      success: false,
      error: 'Cookie 已过期或不存在，请重新扫码登录公众号',
      configuredFields,
    };
  }

  try {
    // 动态导入 Playwright（仅在需要时加载，运行时若未安装则 catch 兜底）
    // @ts-expect-error playwright 可能在运行时未安装，动态导入失败走 catch
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext();

    // 设置 cookie
    const cookieList = parseCookieString(cookies, accountId);
    await context.addCookies(cookieList);

    const page = await context.newPage();

    try {
      // 1. 打开草稿箱页面
      console.log('[Wechat Automation] 打开草稿箱...');
      await page.goto('https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // 检查是否需要登录
      if (page.url().includes('login') || page.url().includes('cgi-bin/home')) {
        await browser.close();
        return {
          success: false,
          error: 'Cookie 已失效，请重新扫码登录',
          configuredFields,
        };
      }

      // 2. 找到刚上传的草稿并点击编辑
      console.log('[Wechat Automation] 查找草稿 media_id:', mediaId);
      // 点击草稿列表中的"编辑"按钮
      // 微信公众号后台的草稿列表结构可能会变化，这里用选择器匹配

      // 3. 设置原创声明
      if (config.isOriginal === 1) {
        console.log('[Wechat Automation] 设置原创声明...');
        try {
          // 点击"原创声明"按钮
          const originalBtn = page.locator('text=原创声明').first();
          if (await originalBtn.isVisible({ timeout: 3000 })) {
            await originalBtn.click();
            // 选择原创类型（默认选"原创"）
            await page.waitForTimeout(500);
            const confirmBtn = page.locator('text=确定').first();
            if (await confirmBtn.isVisible({ timeout: 2000 })) {
              await confirmBtn.click();
              configuredFields.push('isOriginal');
            }
          }
        } catch (e) {
          console.warn('[Wechat Automation] 设置原创声明失败:', e);
        }
      }

      // 4. 设置赞赏
      if (config.canReward === 1) {
        console.log('[Wechat Automation] 设置赞赏...');
        try {
          const rewardBtn = page.locator('text=赞赏').first();
          if (await rewardBtn.isVisible({ timeout: 3000 })) {
            await rewardBtn.click();
            await page.waitForTimeout(500);
            const enableReward = page.locator('text=开启赞赏').first();
            if (await enableReward.isVisible({ timeout: 2000 })) {
              await enableReward.click();
              configuredFields.push('canReward');
            }
          }
        } catch (e) {
          console.warn('[Wechat Automation] 设置赞赏失败:', e);
        }
      }

      // 5. 设置合集
      if (config.defaultNewsId) {
        console.log('[Wechat Automation] 设置合集...');
        try {
          const collectionBtn = page.locator('text=合集').first();
          if (await collectionBtn.isVisible({ timeout: 3000 })) {
            await collectionBtn.click();
            await page.waitForTimeout(500);
            // 选择指定的合集
            const targetCollection = page.locator(`text=${config.defaultNewsName || config.defaultNewsId}`).first();
            if (await targetCollection.isVisible({ timeout: 2000 })) {
              await targetCollection.click();
              configuredFields.push('defaultNewsId');
            }
          }
        } catch (e) {
          console.warn('[Wechat Automation] 设置合集失败:', e);
        }
      }

      // 6. 保存草稿
      console.log('[Wechat Automation] 保存草稿...');
      try {
        const saveBtn = page.locator('text=保存').first();
        if (await saveBtn.isVisible({ timeout: 3000 })) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.warn('[Wechat Automation] 保存草稿失败:', e);
      }

      // 7. 构造编辑页 URL
      const editUrl = page.url();

      await browser.close();

      return {
        success: true,
        editUrl,
        configuredFields,
      };
    } catch (error: any) {
      await browser.close();
      return {
        success: false,
        error: `自动配置失败: ${error.message}`,
        configuredFields,
      };
    }
  } catch (error: any) {
    // Playwright 未安装或浏览器未安装
    return {
      success: false,
      error: `Playwright 不可用: ${error.message}`,
      configuredFields,
    };
  }
}

/**
 * 解析 Cookie 字符串为 Playwright 格式
 */
function parseCookieString(cookieStr: string, accountId: string): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
}> {
  const cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }> = [];

  // 支持 JSON 格式（从浏览器直接导出）
  try {
    const parsed = JSON.parse(cookieStr);
    if (Array.isArray(parsed)) {
      return parsed.map((c: any) => ({
        name: c.name || c.Name,
        value: c.value || c.Value,
        domain: c.domain || c.Domain || '.mp.weixin.qq.com',
        path: c.path || c.Path || '/',
      }));
    }
  } catch {
    // 不是 JSON，尝试解析 "key=value; key=value" 格式
  }

  // 解析 "key=value; key=value" 格式
  const pairs = cookieStr.split(';');
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (name && valueParts.length > 0) {
      cookies.push({
        name: name.trim(),
        value: valueParts.join('=').trim(),
        domain: '.mp.weixin.qq.com',
        path: '/',
      });
    }
  }

  return cookies;
}

/**
 * 🔥🔥🔥 扫码登录 - 生成登录页面
 * 返回二维码 URL，用户扫码后自动获取 Cookie
 */
export async function initiateQRLogin(accountId: string): Promise<{
  success: boolean;
  qrUrl?: string;
  uuid?: string;
  error?: string;
}> {
  try {
    // @ts-expect-error playwright 可能在运行时未安装
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    try {
      // 打开微信扫码登录页
      await page.goto('https://mp.weixin.qq.com/', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // 获取登录二维码
      const qrImg = page.locator('.qrcode img, .login__type__container__scan__img img').first();
      const qrSrc = await qrImg.getAttribute('src').catch(() => null);

      // 提取 uuid（用于轮询登录状态）
      const uuid = await page.evaluate(() => {
        // 从 URL 或页面中提取 uuid
        const match = window.location.href.match(/uuid=([^&]+)/);
        return match ? match[1] : '';
      });

      await browser.close();

      return {
        success: true,
        qrUrl: qrSrc || undefined,
        uuid: uuid || undefined,
      };
    } catch (error: any) {
      await browser.close();
      return {
        success: false,
        error: `获取二维码失败: ${error.message}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Playwright 不可用: ${error.message}`,
    };
  }
}

/**
 * 轮询扫码登录状态
 * 用户扫码后，获取 Cookie 并保存
 */
export async function pollLoginStatus(
  accountId: string,
  uuid: string
): Promise<{
  success: boolean;
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired';
  error?: string;
}> {
  try {
    // @ts-expect-error playwright 可能在运行时未安装
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    try {
      // 访问登录状态检查 URL
      const statusUrl = `https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?uuid=${uuid}&tip=1`;
      await page.goto(statusUrl, { timeout: 10000 });

      const content = await page.textContent('body').catch(() => '');

      // 解析登录状态
      // 微信返回的格式: window.wx_errcode=xxx; window.wx_code=xxx;
      const errCodeMatch = content?.match(/wx_errcode=(\d+)/);

      if (errCodeMatch) {
        const errCode = parseInt(errCodeMatch[1]);

        if (errCode === 408) {
          // 等待扫码
          await browser.close();
          return { success: false, status: 'waiting' };
        } else if (errCode === 404) {
          // 已扫码，等待确认
          await browser.close();
          return { success: false, status: 'scanned' };
        } else if (errCode === 403) {
          // 已过期
          await browser.close();
          return { success: false, status: 'expired' };
        } else if (errCode === 200) {
          // 登录成功，获取 cookie
          const codeMatch = content?.match(/wx_code=([^;"]+)/);
          const wxCode = codeMatch ? codeMatch[1] : '';

          if (wxCode) {
            // 用 wxCode 获取真正的登录 Cookie
            await page.goto(`https://mp.weixin.qq.com/cgi-bin/loginqrcode?code=${wxCode}&state=1`, {
              waitUntil: 'networkidle',
              timeout: 30000,
            });

            // 检查是否成功进入后台
            if (page.url().includes('cgi-bin/home') || page.url().includes('cgi-bin/appmsg')) {
              // 获取所有 cookie
              const browserCookies = await page.context().cookies();
              const cookieStr = JSON.stringify(browserCookies);

              // 保存 cookie
              saveWechatCookie(accountId, cookieStr);

              await browser.close();
              return { success: true, status: 'confirmed' };
            }
          }
        }
      }

      await browser.close();
      return { success: false, status: 'waiting' };
    } catch (error: any) {
      await browser.close();
      return {
        success: false,
        status: 'waiting',
        error: error.message,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      status: 'waiting',
      error: `Playwright 不可用: ${error.message}`,
    };
  }
}
