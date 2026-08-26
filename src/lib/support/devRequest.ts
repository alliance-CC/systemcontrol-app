import Anthropic from '@anthropic-ai/sdk';
import { env, isAiEnabled } from '../env';
import { retrieve } from './retrieve';
import type { DevRequestDraft, DevRequestInput } from './types';

/**
 * 現場の困りごとを「開発者が読んですぐ動ける依頼文」に整形する。
 * AI 未設定でもテンプレートで最低限の体裁が整った依頼文を作る。
 */

const SYSTEM_PROMPT = `あなたは現場スタッフの言葉を、開発者が読んですぐ着手できる依頼文に整える担当です。

ルール:
- 日本語。開発者が読む前提だが、現場の言葉づかいは尊重して意味を変えない。
- 現場が書いていない事実を作らない。不明な点は「未確認」と書き、確認したいことは「開発者への確認事項」に列挙する。
- パスワードや API キーが本文に含まれていたら、値は伏せて「（機密のため伏字。ツール管理システムを参照）」と書く。
- 件名は 30 字以内で、何が困っているか一目で分かるようにする。

出力形式（この形式を厳守）:
<title>件名</title>
<body>
## 困っていること

## 現在の状況

## 再現手順

## 期待する動作

## 影響範囲・緊急度

## 開発者への確認事項

## 参考資料
</body>`;

function template(input: DevRequestInput, references: string[]): DevRequestDraft {
  // 困りごとの文中に既にツール名が入っているときは、件名で重複させない
  const tool = input.tool?.trim();
  const prefix = tool && !input.problem.includes(tool) ? `${tool}: ` : '';
  const title = `【${input.urgency}】${prefix}${input.problem.slice(0, 30)}`;
  const body = [
    '## 困っていること',
    '',
    input.problem.trim() || '（未記入）',
    '',
    '## 現在の状況',
    '',
    `- 対象ツール: ${input.tool?.trim() || '未確認'}`,
    `- 依頼者: ${input.requester || '未記入'}`,
    `- 起票日時: ${new Date().toISOString()}`,
    '',
    '## 再現手順',
    '',
    input.steps?.trim() || '（未記入。現場での操作手順を追記してください）',
    '',
    '## 期待する動作',
    '',
    '（現場が期待していた動きを記入）',
    '',
    '## 影響範囲・緊急度',
    '',
    `- 緊急度: ${input.urgency}`,
    '- 影響範囲: 未確認',
    '',
    '## 開発者への確認事項',
    '',
    '- （必要に応じて追記）',
    '',
    '## 参考資料',
    '',
    references.length > 0 ? references.map((r) => `- ${r}`).join('\n') : '- 該当資料なし',
  ].join('\n');

  return { title, body, fallback: true };
}

function issueUrl(title: string, body: string): string | undefined {
  const repo = env.support.devRequestRepo;
  if (!repo) return undefined;
  const params = new URLSearchParams({ title, body });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

export async function draftDevRequest(input: DevRequestInput): Promise<DevRequestDraft> {
  const query = [input.tool, input.problem, input.steps].filter(Boolean).join(' ');
  const results = await retrieve(query, 4);
  // 関連度が低い資料まで参考として並べると、開発者の読み違いを招くので上位付近のみ残す
  const topScore = results[0]?.score ?? 0;
  const references = results
    .filter((result) => result.score >= topScore * 0.5)
    .map((result) => {
      const { chunk } = result;
      const where = [chunk.sourceLabel, chunk.path, ...chunk.headings].filter(Boolean).join(' > ');
      return chunk.url ? `${where}（${chunk.url}）` : where;
    });

  if (!isAiEnabled()) {
    const draft = template(input, references);
    return { ...draft, issueUrl: issueUrl(draft.title, draft.body) };
  }

  const client = new Anthropic({ apiKey: env.support.anthropicApiKey });
  const userContent = [
    `【現場が書いた困りごと】\n${input.problem}`,
    input.tool ? `【対象ツール】\n${input.tool}` : '',
    input.steps ? `【操作した手順】\n${input.steps}` : '',
    `【緊急度】\n${input.urgency}`,
    `【依頼者】\n${input.requester}`,
    references.length > 0 ? `【関連しそうな社内資料】\n${references.map((r) => `- ${r}`).join('\n')}` : '',
    `【宛先】\n${env.support.devRequestContact}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await client.messages.create({
      model: env.support.anthropicModel,
      max_tokens: 1_500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const title = text.match(/<title>([\s\S]*?)<\/title>/)?.[1].trim();
    const body = text.match(/<body>([\s\S]*?)<\/body>/)?.[1].trim();
    if (!title || !body) throw new Error('依頼文の生成結果を解釈できませんでした。');

    return { title, body, issueUrl: issueUrl(title, body), fallback: false };
  } catch {
    const draft = template(input, references);
    return { ...draft, issueUrl: issueUrl(draft.title, draft.body) };
  }
}
