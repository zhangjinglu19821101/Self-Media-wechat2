'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ListTodo, ArrowRight } from 'lucide-react';

export default function OriginalHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          
          {/* 标题 */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900">Agent 执行系统</h1>
            <p className="text-slate-500">智能任务执行与管理平台</p>
          </div>
          
          {/* 功能入口 */}
          <div className="space-y-3 pt-4">
            <Link href="/creation-guide" className="block">
              <Button className="w-full h-14 text-lg" size="lg">
                <Sparkles className="w-5 h-5 mr-2" />
                创作引导
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            
            <Link href="/task-timeline" className="block">
              <Button variant="outline" className="w-full h-14 text-lg" size="lg">
                <ListTodo className="w-5 h-5 mr-2" />
                任务管理
              </Button>
            </Link>
          </div>
          
          {/* 快捷链接 */}
          <div className="flex justify-center gap-4 pt-4 text-sm text-slate-400">
            <Link href="/materials" className="hover:text-indigo-600">素材库</Link>
            <Link href="/wechat-config" className="hover:text-indigo-600">发布配置</Link>
            <Link href="/agents" className="hover:text-indigo-600">Agent管理</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
