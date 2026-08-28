import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLogRow, summarizeLogs, type SupportLogEntry } from '../src/lib/support/log';

function entry(partial: Partial<SupportLogEntry> & { question: string }): SupportLogEntry {
  return {
    askedAt: '2026-08-28 01:00:00',
    loginId: 'genba',
    hit: true,
    citations: 2,
    needsDeveloper: false,
    ...partial,
  };
}

test('parseLogRow：シートの 1 行を読み取る', () => {
  const parsed = parseLogRow({
    asked_at: '2026-08-28 01:23:45',
    login_id: 'genba',
    question: 'ログインできない',
    hit: 'yes',
    citations: '3',
    needs_developer: 'no',
  });

  assert.deepEqual(parsed, {
    askedAt: '2026-08-28 01:23:45',
    loginId: 'genba',
    question: 'ログインできない',
    hit: true,
    citations: 3,
    needsDeveloper: false,
  });
});

test('parseLogRow：質問が空の行（空行）は捨てる', () => {
  assert.equal(parseLogRow({ asked_at: '2026-08-28 01:23:45', question: '   ' }), null);
});

test('parseLogRow：hit が空でも落ちず、false として扱う', () => {
  const parsed = parseLogRow({ question: 'パスワードはどこ', hit: '', citations: '' });
  assert.equal(parsed?.hit, false);
  assert.equal(parsed?.citations, 0);
});

test('summarizeLogs：資料に当たらなかった質問を未解決として多い順に並べる', () => {
  const summary = summarizeLogs([
    entry({ question: '請求書ツールの締め日は？', hit: false, citations: 0, askedAt: '2026-08-01 10:00:00' }),
    entry({ question: '請求書ツールの締め日は?', hit: false, citations: 0, askedAt: '2026-08-03 10:00:00' }),
    entry({ question: '経費申請のやり方', hit: false, citations: 0 }),
    entry({ question: 'ログインできない' }),
  ]);

  assert.equal(summary.total, 4);
  assert.equal(summary.unresolved.length, 2);
  assert.equal(summary.unresolved[0].count, 2, '表記ゆれ（？と?）は同じ質問としてまとめる');
  assert.equal(summary.unresolved[0].lastAskedAt, '2026-08-03 10:00:00', '最終質問日時は新しい方');
  assert.equal(summary.resolved.length, 1);
  assert.equal(summary.resolved[0].question, 'ログインできない');
});

test('summarizeLogs：資料に当たっても依頼を勧めたものは未解決に入れる', () => {
  const summary = summarizeLogs([
    entry({ question: '保存すると画面が真っ白になる', hit: true, citations: 1, needsDeveloper: true }),
  ]);

  assert.equal(summary.unresolved.length, 1);
  assert.equal(summary.resolved.length, 0);
});

test('summarizeLogs：最近の質問は新しい順に、件数を絞って返す', () => {
  const summary = summarizeLogs(
    [
      entry({ question: '1 番目', askedAt: '2026-08-01 10:00:00' }),
      entry({ question: '2 番目', askedAt: '2026-08-02 10:00:00' }),
      entry({ question: '3 番目', askedAt: '2026-08-03 10:00:00' }),
    ],
    2,
  );

  assert.deepEqual(
    summary.recent.map((item) => item.question),
    ['3 番目', '2 番目'],
  );
});
