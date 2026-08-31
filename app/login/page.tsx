'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // 1. 클라이언트에서 Supabase 로그인
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.session) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    // 2. 서버에 세션 전달하여 SSR 쿠키 설정
    await fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    });

    // 3. 쿠키 설정 후 전체 페이지 이동
    window.location.href = '/dashboard';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">DG-Flow</CardTitle>
          <CardDescription>동일유리 주문관리 시스템</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="email@dongil.co.kr"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 테스트 계정 안내 */}
      <Card className="w-full max-w-md mt-4 opacity-70">
        <CardContent className="py-3">
          <p className="text-xs font-medium text-gray-500 mb-2">테스트 계정 (비밀번호: dgflow2026!)</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
            <span>관리자:</span><span className="font-mono">admin@dgflow.kr</span>
            <span>공사관리부:</span><span className="font-mono">construction@dgflow.kr</span>
            <span>경영지원팀:</span><span className="font-mono">support@dgflow.kr</span>
            <span>생산관리팀:</span><span className="font-mono">production@dgflow.kr</span>
            <span>시스템관리자:</span><span className="font-mono">sysadmin@dgflow.kr</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
