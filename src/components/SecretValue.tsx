'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 「クリックして表示」。初期表示ではサーバーから平文を受け取らず、
 * 押されたときだけ復号 API を呼ぶ（要件定義書 §4）。
 * 画面に出しっぱなしにしないよう、表示から 60 秒で自動的に隠す。
 */

const AUTO_HIDE_MS = 60_000;

export default function SecretValue({
  recordId,
  fieldKey,
  hasValue = true,
}: {
  recordId: string;
  fieldKey: string;
  hasValue?: boolean;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setValue(null);
    setCopied(false);
  }

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
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, AUTO_HIDE_MS);
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (value === null) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setError('コピーできませんでした。手動で選択してください。');
    }
  }

  if (!hasValue) {
    return <span className="muted">未登録</span>;
  }

  if (value !== null) {
    return (
      <span className="secret">
        <span className="secret__value">{value}</span>
        <button type="button" className="button--ghost button--small" onClick={copy}>
          {copied ? '✓ コピーしました' : 'コピー'}
        </button>
        <button type="button" className="button--quiet button--small" onClick={hide}>
          隠す
        </button>
        <span className="subtle">60 秒で自動的に隠れます</span>
      </span>
    );
  }

  return (
    <span className="secret">
      <span className="secret__value" aria-hidden="true">
        ••••••••
      </span>
      <button type="button" className="button--ghost button--small" onClick={reveal} disabled={busy}>
        {busy ? '取得中…' : '🔓 クリックして表示'}
      </button>
      {error && <span className="source-item__error">{error}</span>}
    </span>
  );
}
