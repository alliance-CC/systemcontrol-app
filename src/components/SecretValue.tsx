'use client';

import { useState } from 'react';

/**
 * 「クリックして表示」。初期表示ではサーバーから平文を受け取らず、
 * 押されたときだけ復号 API を呼ぶ（要件定義書 §4）。
 */

export default function SecretValue({ recordId, fieldKey }: { recordId: string; fieldKey: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/records/${recordId}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: fieldKey }),
      });
      const data = (await response.json()) as { value?: string; error?: string };
      if (!response.ok || data.value === undefined) {
        setError(data.error ?? '表示できませんでした。');
        return;
      }
      setValue(data.value);
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  if (value !== null) {
    return (
      <span>
        {value}{' '}
        <button type="button" className="button--ghost button--small" onClick={() => setValue(null)}>
          隠す
        </button>
      </span>
    );
  }

  return (
    <span>
      <button type="button" className="button--ghost button--small" onClick={reveal} disabled={busy}>
        {busy ? '取得中…' : '••••••  クリックして表示'}
      </button>
      {error && <span className="source-item__error"> {error}</span>}
    </span>
  );
}
