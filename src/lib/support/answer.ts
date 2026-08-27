import Anthropic from '@anthropic-ai/sdk';
import { env, isAiEnabled } from '../env';
import { listRecords } from '../records';
import { STATUS_ICON, STATUS_LABEL } from '../types';
import { retrieve, type ScoredChunk } from './retrieve';
import type { Citation, SupportAnswer } from './types';

/**
 * 現場サポートモードの回答生成。
 * 1. 質問に近い資料を knowledge/ と GitHub から探す
 * 2. 資料と「登録ツールの現在の稼働状況」を材料に、専門用語を避けた手順で回答する
 * 3. 資料で解決できない場合は開発者への依頼を勧める
 *
 * ANTHROPIC_API_KEY が未設定でも、資料の該当箇所を提示するフォールバックで動く。
 */

const MAX_CONTEXT_CHUNKS = 6;

const SYSTEM_PROMPT = `あなたは社内ツールのサポート担当です。質問するのはプログラムがわからない現場のスタッフです。

回答のルール:
- 必ず日本語で、やさしい言葉で答える。専門用語を使うときは必ず一言で補足する。
- 操作手順は「1.」「2.」の番号付きで、画面上のどこを押すかまで具体的に書く。
- 与えられた【資料】に書かれていることだけを根拠にする。推測で手順を作らない。
- 資料に書かれていない場合は「資料には見つかりませんでした」と正直に伝え、開発者へ依頼することを勧める。
- 危険な操作（削除・本番設定の変更・パスワードの共有）を求められたら、実行手順ではなく管理者に確認するよう促す。
- パスワードや API キーそのものは絶対に答えに書かない。「ツール管理システムの詳細ページで確認できます」と案内する。
- 回答は最大 400 字程度。長くなるときは要点を先に書く。

出力形式（この形式を厳守）:
<answer>
（ここに回答本文。Markdown 可）
</answer>
<meta>{"needsDeveloper": true または false, "suggestedTitle": "開発者へ依頼する場合の件名（30字以内）"}</meta>

needsDeveloper は「資料だけでは解決できない」「不具合の可能性がある」「設定変更が必要」のいずれかに当てはまるとき true にする。`;

function toCitation(scored: ScoredChunk): Citation {
  const { chunk } = scored;
  return {
    sourceLabel: chunk.sourceLabel,
    path: chunk.path,
    heading: chunk.headings.at(-1) ?? chunk.title,
    url: chunk.url,
  };
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.sourceLabel}/${citation.path}#${citation.heading}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 登録ツールの稼働状況（機密値は一切含めない） */
async function statusContext(query: string): Promise<string> {
  try {
    const records = await listRecords();
    const normalized = query.toLowerCase();
    // 空文字は includes() が常に true になるため、値のある項目だけで判定する
    const mentions = (value: string) => {
      const target = value.trim().toLowerCase();
      return target.length > 0 && normalized.includes(target);
    };
    const related = records.filter(
      (record) => mentions(record.subcategory) || mentions(record.system_name),
    );
    const target = (related.length > 0 ? related : records).slice(0, 12);
    if (target.length === 0) return '';
    const lines = target.map(
      (record) =>
        `- ${record.system_name} / ${record.subcategory}: ${STATUS_ICON[record.last_status]} ${STATUS_LABEL[record.last_status]}` +
        (record.last_checked_at ? `（最終確認 ${record.last_checked_at}）` : ''),
    );
    return `【登録ツールの現在の状況】\n${lines.join('\n')}`;
  } catch {
    // スプレッドシートに繋がらなくてもサポート回答自体は返す
    return '';
  }
}

function buildDocsContext(results: ScoredChunk[]): string {
  return results
    .map((result, index) => {
      const { chunk } = result;
      const location = [chunk.sourceLabel, chunk.path, ...chunk.headings].filter(Boolean).join(' > ');
      return `[資料${index + 1}] ${location}\n${chunk.content}`;
    })
    .join('\n\n---\n\n');
}

function parseModelOutput(text: string): { answer: string; needsDeveloper: boolean; suggestedTitle?: string } {
  const answerMatch = text.match(/<answer>([\s\S]*?)<\/answer>/);
  const metaMatch = text.match(/<meta>([\s\S]*?)<\/meta>/);
  const answer = (answerMatch?.[1] ?? text).trim();

  let needsDeveloper = false;
  let suggestedTitle: string | undefined;
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1].trim()) as { needsDeveloper?: boolean; suggestedTitle?: string };
      needsDeveloper = meta.needsDeveloper === true;
      suggestedTitle = meta.suggestedTitle?.trim() || undefined;
    } catch {
      needsDeveloper = /見つかりませんでした|開発者/.test(answer);
    }
  }
  return { answer, needsDeveloper, suggestedTitle };
}

/** AI 未設定時：見つかった資料の該当箇所をそのまま提示する */
function fallbackAnswer(query: string, results: ScoredChunk[]): SupportAnswer {
  if (results.length === 0) {
    return {
      answer:
        '関連する資料が見つかりませんでした。\n\n' +
        'このまま「開発者へ依頼する」に進むと、困っている内容を開発者に伝わる形の依頼文にまとめます。',
      citations: [],
      fallback: true,
      needsDeveloper: true,
      suggestedTitle: query.slice(0, 30),
    };
  }

  const body = results
    .slice(0, 3)
    .map((result, index) => {
      const { chunk } = result;
      const where = [chunk.sourceLabel, chunk.path, ...chunk.headings].filter(Boolean).join(' > ');
      return `**${index + 1}. ${where}**\n\n${chunk.content.slice(0, 500)}`;
    })
    .join('\n\n');

  return {
    answer:
      'AI 回答は未設定のため、関連しそうな資料の該当箇所をそのまま表示します。\n\n' +
      `${body}\n\n解決しない場合は「開発者へ依頼する」から依頼文を作成してください。`,
    citations: dedupeCitations(results.map(toCitation)),
    fallback: true,
    needsDeveloper: false,
    suggestedTitle: query.slice(0, 30),
  };
}

export async function answerQuestion(question: string): Promise<SupportAnswer> {
  const results = await retrieve(question, MAX_CONTEXT_CHUNKS);

  if (!isAiEnabled()) return fallbackAnswer(question, results);

  const client = new Anthropic({ apiKey: env.support.anthropicApiKey });
  const docs = buildDocsContext(results);
  const status = await statusContext(question);

  const userContent = [
    `【現場からの質問】\n${question}`,
    docs ? `【資料】\n${docs}` : '【資料】\n該当する資料は見つかりませんでした。',
    status,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: env.support.anthropicModel,
      max_tokens: 1_200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const parsed = parseModelOutput(text);
    return {
      answer: parsed.answer,
      citations: dedupeCitations(results.map(toCitation)),
      fallback: false,
      needsDeveloper: parsed.needsDeveloper || results.length === 0,
      suggestedTitle: parsed.suggestedTitle ?? question.slice(0, 30),
    };
  } catch {
    // API 障害時も現場を止めないよう、資料提示にフォールバックする
    return fallbackAnswer(question, results);
  }
}
