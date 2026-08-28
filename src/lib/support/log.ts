import { env } from '../env';
import { appendRow, readTable } from '../sheets';

/**
 * 現場サポートの質問ログ（要件定義書 §13）。
 * 目的は「答えられなかった質問」を集めて、次に書くべき資料を決めること。
 *
 * - 記録するのは 日時・ログインID・質問文・資料に当たったか・依頼を勧めたか だけ。
 *   回答本文は保存しない（肥大化と持ち出しリスクを避けるため）。
 * - 質問文には現場が機密を書いてしまう可能性があるため、閲覧は admin のみ（画面側で制御）。
 * - タブが無い・書き込みに失敗しても回答は返す（記録は best-effort）。
 */

export const SUPPORT_LOG_COLUMNS = [
  'asked_at',
  'login_id',
  'question',
  'hit',
  'citations',
  'needs_developer',
] as const;

export type SupportLogEntry = {
  askedAt: string;
  loginId: string;
  question: string;
  /** 資料が 1 件以上ヒットしたか */
  hit: boolean;
  citations: number;
  needsDeveloper: boolean;
};

const MAX_QUESTION_CHARS = 500;

function tab(): string {
  return env.tabs.supportLogs;
}

function timestamp(now = new Date()): string {
  // スプレッドシートで読みやすい形（ローカル時刻ではなく UTC 基準の固定書式）
  return now.toISOString().replace('T', ' ').slice(0, 19);
}

/** 1 件記録する。失敗しても例外は投げない */
export async function appendQuestionLog(entry: SupportLogEntry): Promise<boolean> {
  try {
    await appendRow(tab(), [
      entry.askedAt || timestamp(),
      entry.loginId,
      entry.question.slice(0, MAX_QUESTION_CHARS),
      entry.hit ? 'yes' : 'no',
      String(entry.citations),
      entry.needsDeveloper ? 'yes' : 'no',
    ]);
    return true;
  } catch {
    // タブ未作成・レート制限など。記録できなくても現場の回答は止めない
    return false;
  }
}

export function parseLogRow(row: Record<string, string>): SupportLogEntry | null {
  const question = (row.question ?? '').trim();
  if (!question) return null;
  return {
    askedAt: (row.asked_at ?? '').trim(),
    loginId: (row.login_id ?? '').trim(),
    question,
    hit: (row.hit ?? '').trim().toLowerCase() === 'yes',
    citations: Number.parseInt(row.citations ?? '0', 10) || 0,
    needsDeveloper: (row.needs_developer ?? '').trim().toLowerCase() === 'yes',
  };
}

export type QuestionGroup = {
  question: string;
  count: number;
  lastAskedAt: string;
};

export type LogSummary = {
  total: number;
  /** 資料に当たらなかった質問（＝書くべき資料の候補）。多い順 */
  unresolved: QuestionGroup[];
  /** 資料に当たった質問。多い順 */
  resolved: QuestionGroup[];
  recent: SupportLogEntry[];
};

/** 同じ質問としてまとめるためのキー（表記ゆれを軽く吸収する） */
function groupKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[。、．，!！?？「」『』()（）]/g, '');
}

function group(entries: SupportLogEntry[]): QuestionGroup[] {
  const map = new Map<string, QuestionGroup>();
  for (const entry of entries) {
    const key = groupKey(entry.question);
    const current = map.get(key);
    if (current) {
      current.count += 1;
      if (entry.askedAt > current.lastAskedAt) current.lastAskedAt = entry.askedAt;
    } else {
      map.set(key, { question: entry.question, count: 1, lastAskedAt: entry.askedAt });
    }
  }
  return [...map.values()].sort((a, b) =>
    b.count === a.count ? b.lastAskedAt.localeCompare(a.lastAskedAt) : b.count - a.count,
  );
}

export function summarizeLogs(entries: SupportLogEntry[], recentLimit = 30): LogSummary {
  // 資料に当たらなかった、または開発者への依頼を勧めた質問を「未解決」として扱う
  const unresolved = entries.filter((entry) => !entry.hit || entry.needsDeveloper);
  const resolved = entries.filter((entry) => entry.hit && !entry.needsDeveloper);

  return {
    total: entries.length,
    unresolved: group(unresolved),
    resolved: group(resolved),
    recent: [...entries].reverse().slice(0, recentLimit),
  };
}

/** シートから読み出して集計する。タブが無ければ null（画面側で案内を出す） */
export async function loadLogSummary(recentLimit = 30): Promise<LogSummary | null> {
  try {
    const { rows } = await readTable(tab());
    const entries = rows
      .map(parseLogRow)
      .filter((entry): entry is SupportLogEntry => entry !== null);
    return summarizeLogs(entries, recentLimit);
  } catch {
    return null;
  }
}
