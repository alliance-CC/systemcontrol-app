import { getRegistry } from './knowledge';
import type { KnowledgeChunk } from './types';

/**
 * 質問文に近い資料を探す簡易検索。
 * 日本語は形態素解析なしで扱えるよう、CJK は 2 文字組（バイグラム）、英数字は単語で照合する。
 */

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase();
}

/** 検索語（英数字の単語 + CJK バイグラム）を作る */
export function extractTerms(text: string): string[] {
  const normalized = normalize(text);
  const terms = new Set<string>();

  for (const word of normalized.match(/[a-z0-9][a-z0-9_.+-]{1,}/g) ?? []) {
    terms.add(word);
  }

  let run = '';
  for (const char of normalized) {
    if (CJK.test(char)) {
      run += char;
      continue;
    }
    pushBigrams(run, terms);
    run = '';
  }
  pushBigrams(run, terms);

  return [...terms];
}

function pushBigrams(run: string, terms: Set<string>): void {
  if (run.length === 0) return;
  if (run.length === 1) {
    terms.add(run);
    return;
  }
  for (let i = 0; i < run.length - 1; i++) terms.add(run.slice(i, i + 2));
}

/** ほぼ全文書に出る語（助詞由来のバイグラム等）は重みを下げる */
function idf(documentFrequency: number, total: number): number {
  if (documentFrequency === 0) return 0;
  return Math.log((total + 1) / (documentFrequency + 0.5));
}

export type ScoredChunk = { chunk: KnowledgeChunk; score: number };

export async function retrieve(query: string, limit = 6): Promise<ScoredChunk[]> {
  const { chunks } = await getRegistry();
  if (chunks.length === 0) return [];

  const terms = extractTerms(query);
  if (terms.length === 0) return [];

  const normalizedChunks = chunks.map((chunk) => ({
    chunk,
    body: normalize(chunk.content),
    heading: normalize([chunk.title, ...chunk.headings, chunk.path].join(' ')),
  }));

  const documentFrequency = new Map<string, number>();
  for (const term of terms) {
    const count = normalizedChunks.filter((entry) => entry.body.includes(term)).length;
    documentFrequency.set(term, count);
  }

  const scored = normalizedChunks.map(({ chunk, body, heading }) => {
    let score = 0;
    for (const term of terms) {
      const weight = idf(documentFrequency.get(term) ?? 0, normalizedChunks.length);
      if (weight <= 0) continue;
      const occurrences = body.split(term).length - 1;
      if (occurrences > 0) score += Math.min(occurrences, 3) * weight;
      // 見出し・ファイル名の一致は強めに効かせる
      if (heading.includes(term)) score += weight * 2;
    }
    return { chunk, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
