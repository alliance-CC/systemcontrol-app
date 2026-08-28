'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteButton({ recordId, systemName }: { recordId: string; systemName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (!window.confirm(`「${systemName}」のこのレコードを削除します。元に戻せません。よろしいですか？`)) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/records/${recordId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? '削除に失敗しました。');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="button--danger" onClick={remove} disabled={busy}>
        {busy ? '削除中…' : '削除する'}
      </button>
      {error && <span className="source-item__error">{error}</span>}
    </>
  );
}
