/**
 * Playwright mock for Vercel build
 * 让构建能通过，运行时如果真正用到会报错提示
 */

export const chromium = {
  launch: async () => {
    throw new Error('Playwright is not available in this environment. Vercel serverless functions do not support browser automation.');
  }
};

export const firefox = {
  launch: async () => {
    throw new Error('Playwright is not available in this environment.');
  }
};

export const webkit = {
  launch: async () => {
    throw new Error('Playwright is not available in this environment.');
  }
};

export default {
  chromium,
  firefox,
  webkit
};