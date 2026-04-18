'use client';

import { useEffect, useRef, useState } from 'react';

interface TemplatePreviewProps {
  htmlContent: string;
  title?: string;
  className?: string;
}

/**
 * 样式预览组件
 * 使用 iframe sandbox 安全渲染 HTML
 * iframe 高度自适应内容
 */
export function TemplatePreview({ 
  htmlContent, 
  title = '样式预览',
  className = ''
}: TemplatePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(600);

  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
              <style>
                * {
                  box-sizing: border-box;
                }
                html, body { 
                  margin: 0; 
                  padding: 16px; 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
                  background: #fff;
                  min-height: 100%;
                  -webkit-font-smoothing: antialiased;
                }
                img {
                  max-width: 100%;
                  height: auto;
                }
                section {
                  display: block;
                }
              </style>
            </head>
            <body>${htmlContent}</body>
          </html>
        `);
        doc.close();
        
        // 监听内容变化，调整 iframe 高度
        setTimeout(() => {
          try {
            const body = doc.body;
            const html = doc.documentElement;
            const contentHeight = Math.max(
              body.scrollHeight,
              body.offsetHeight,
              html.clientHeight,
              html.scrollHeight,
              html.offsetHeight
            );
            setIframeHeight(Math.max(contentHeight + 32, 400));
          } catch (e) {
            // 跨域时无法获取高度
          }
        }, 100);
      }
    }
  }, [htmlContent]);

  if (!htmlContent) {
    return null;
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      className={`w-full border-0 bg-white ${className}`}
      style={{ height: `${iframeHeight}px`, minHeight: '400px' }}
      title={title}
    />
  );
}
