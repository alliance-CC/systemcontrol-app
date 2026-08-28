'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/**
 * ヘッダーの通知ボタン。停止・エラー中のツールをここにまとめる（一覧上には出さない）。
 * 中身はサーバー側で down のものだけに絞って渡す（機密値は含めない）。
 */

export type NotificationItem = {
  id: string;
  systemName: string;
  toolName: string;
  checkedAt: string;
};

export default function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const count = items.length;

  return (
    <div className="notify" ref={wrap}>
      <button
        type="button"
        className={`notify__button${count > 0 ? ' notify__button--alert' : ''}`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `通知 ${count} 件（停止・エラー）` : '通知（未対応なし）'}
        title={count > 0 ? `${count} 件のツールが停止・エラー` : '停止・エラーのツールはありません'}
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 && <span className="notify__count">{count}</span>}
      </button>

      {open && (
        <div className="notify__panel" role="dialog" aria-label="通知">
          <div className="notify__head">
            <strong>通知</strong>
            <span className="muted">{count > 0 ? `停止・エラー ${count} 件` : '未対応はありません'}</span>
          </div>

          {count === 0 ? (
            <p className="notify__empty">
              いまは停止・エラーのツールはありません。
              <br />
              状態が変わるとここに出ます。
            </p>
          ) : (
            <>
              <ul className="notify__list">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link className="notify__item" href={`/system/${item.id}`} onClick={() => setOpen(false)}>
                      <span className="notify__item-dot" aria-hidden="true">
                        🔴
                      </span>
                      <span className="notify__item-body">
                        <span className="notify__item-title">
                          {item.systemName} / {item.toolName}
                        </span>
                        <span className="notify__item-meta">
                          {item.checkedAt ? `${item.checkedAt} に確認` : '確認時刻なし'}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className="notify__all" href="/?status=down" onClick={() => setOpen(false)}>
                停止・エラーだけを表示する
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
