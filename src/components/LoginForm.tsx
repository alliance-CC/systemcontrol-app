'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'ログインに失敗しました。');
        return;
      }
      // 安全なパスのみへ遷移する（オープンリダイレクト対策）
      router.replace(next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="alert" role="alert">
          <span className="alert__icon" aria-hidden="true">
            ⚠️
          </span>
          <span className="alert__body">{error}</span>
        </div>
      )}
      <div className="field">
        <label htmlFor="login_id">ログインID</label>
        <input
          id="login_id"
          type="text"
          autoComplete="username"
          value={loginId}
          onChange={(event) => setLoginId(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <button type="submit" className="button--block" disabled={busy} style={{ marginTop: 4 }}>
        {busy ? 'ログイン中…' : 'ログイン'}
      </button>
    </form>
  );
}
