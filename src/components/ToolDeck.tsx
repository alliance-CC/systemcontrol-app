'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import SecretValue from './SecretValue';
import StatusPill from './StatusPill';
import type { SafeToolRecord } from '@/lib/types';

/**
 * カード送り表示（既定の一覧表示）。
 * 中央に 1 件、その前後を薄く重ねて出し、左右のボタン・矢印キー・スワイプで送る。
 * 機密値は SecretValue 経由で、押されたときだけ復号 API を呼ぶ（平文は初期表示に含めない）。
 */

const SWIPE_THRESHOLD = 60;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

export default function ToolDeck({ records }: { records: SafeToolRecord[] }) {
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);

  const move = useCallback(
    (step: number) => {
      setIndex((current) => (current + step + records.length) % records.length);
    },
    [records.length],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move]);

  if (records.length === 0) return null;

  const current = records[Math.min(index, records.length - 1)];

  function positionOf(i: number): string {
    let delta = i - index;
    if (delta > records.length / 2) delta -= records.length;
    if (delta < -records.length / 2) delta += records.length;
    return Math.abs(delta) <= 1 ? String(delta) : 'hidden';
  }

  return (
    <div className="deck-wrap">
      <div className="deck-stage">
        <button
          type="button"
          className="deck-arrow"
          onClick={() => move(-1)}
          aria-label="前のツール"
          disabled={records.length < 2}
        >
          ‹
        </button>

        <div
          className="deck"
          onPointerDown={(event) => {
            startX.current = event.clientX;
          }}
          onPointerUp={(event) => {
            if (startX.current === null) return;
            const dx = event.clientX - startX.current;
            startX.current = null;
            if (Math.abs(dx) > SWIPE_THRESHOLD) move(dx < 0 ? 1 : -1);
          }}
        >
          {records.map((record, i) => {
            const position = positionOf(i);
            const isCurrent = position === '0';
            return (
              <article
                className="deck-card"
                key={record.id}
                data-pos={position}
                aria-hidden={!isCurrent}
                inert={!isCurrent}
              >
                <div className="deck-card__head">
                  <span className="deck-card__mark" aria-hidden="true">
                    {(record.subcategory || record.system_name || '?').slice(0, 1)}
                  </span>
                  <div className="deck-card__title">
                    <div className="deck-card__system">{record.system_name || '（システム名なし）'}</div>
                    {record.google_account && (
                      <div className="deck-card__account">{record.google_account}</div>
                    )}
                    <div className="row" style={{ marginTop: 6 }}>
                      {record.category && <span className="badge">{record.category}</span>}
                      {record.subcategory && <span className="badge badge--accent">{record.subcategory}</span>}
                    </div>
                  </div>
                  <StatusPill status={record.last_status} />
                </div>

                <div className="deck-card__body">
                  <div className="detail-list">
                    <div className="detail-item">
                      <span className="detail-item__label">ヘルスチェックURL</span>
                      <span className="detail-item__value detail-item__value--mono">
                        {record.health_check_url ? (
                          <a href={record.health_check_url} target="_blank" rel="noreferrer noopener">
                            {record.health_check_url}
                          </a>
                        ) : (
                          <span className="muted">未設定（監視対象外）</span>
                        )}
                      </span>
                    </div>
                    {record.details.map((detail) => (
                      <div className="detail-item" key={detail.key}>
                        <span className="detail-item__label">{detail.label}</span>
                        <span
                          className={`detail-item__value${detail.secret ? '' : ' detail-item__value--mono'}`}
                        >
                          {detail.secret ? (
                            isCurrent ? (
                              <SecretValue
                                recordId={record.id}
                                fieldKey={detail.key}
                                hasValue={detail.hasValue}
                              />
                            ) : (
                              <span className="secret__value">••••••••</span>
                            )
                          ) : (
                            detail.value || <span className="muted">—</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="deck-card__foot">
                  <Link className="button" href={`/system/${record.id}`}>
                    詳細を開く
                  </Link>
                  <Link
                    className="button button--ghost"
                    href={`/support?tool=${encodeURIComponent(record.subcategory)}`}
                  >
                    💬 質問する
                  </Link>
                  <span className="deck-card__when">
                    {record.last_checked_at
                      ? `${record.last_checked_at} に確認`
                      : record.updated_at
                        ? `${record.updated_at} に更新`
                        : ''}
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className="deck-arrow"
          onClick={() => move(1)}
          aria-label="次のツール"
          disabled={records.length < 2}
        >
          ›
        </button>
      </div>

      <div className="deck-rail">
        <div className="deck-dots">
          {records.map((record, i) => (
            <button
              type="button"
              className="deck-dot"
              key={record.id}
              aria-label={`${record.system_name} / ${record.subcategory}`}
              aria-current={i === index ? 'true' : 'false'}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
        <span className="deck-counter" aria-live="polite">
          {index + 1} / {records.length}
          <span className="sr-only">
            件目：{current.system_name} {current.subcategory}
          </span>
        </span>
      </div>
      <p className="deck-hint">← → キー、カードのドラッグ、スマートフォンでは左右スワイプでも送れます。</p>
    </div>
  );
}
