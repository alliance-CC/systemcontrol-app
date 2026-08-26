'use client';

import { useEffect, useState, type FormEvent } from 'react';
import SimpleMarkdown from './SimpleMarkdown';
import type { Citation, DevRequestDraft, SupportAnswer } from '@/lib/support/types';

/**
 * 現場サポートモード。
 * 現場のスタッフが「ツールの使い方」を日本語で質問し、社内資料（knowledge/ と GitHub）を根拠に回答を受け取る。
 * 解決しない場合はその場で開発者への依頼文を作成できる。
 */

type Turn = {
  question: string;
  answer?: SupportAnswer;
  error?: string;
  pending: boolean;
};

type SourceStatus = {
  id: string;
  label: string;
  type: 'local' | 'github';
  location: string;
  docCount: number;
  description?: string;
  owner?: string;
  error?: string;
};

const SAMPLE_QUESTIONS = [
  'このツールのログイン方法を教えて',
  'パスワードはどこで確認できますか',
  'エラーが出たときは誰に連絡すればいい？',
  '新しいメンバーを追加する手順は？',
];

function Citations({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="citations">
      参照した資料:
      <ul>
        {citations.map((citation) => (
          <li key={`${citation.sourceLabel}-${citation.path}-${citation.heading}`}>
            {citation.url ? (
              <a href={citation.url} target="_blank" rel="noreferrer noopener">
                {citation.sourceLabel} / {citation.path}
              </a>
            ) : (
              `${citation.sourceLabel} / ${citation.path}`
            )}
            {citation.heading ? ` > ${citation.heading}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SupportConsole({ initialTool, requester }: { initialTool: string; requester: string }) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [showRequest, setShowRequest] = useState(false);
  const [tool, setTool] = useState(initialTool);
  const [problem, setProblem] = useState('');
  const [steps, setSteps] = useState('');
  const [urgency, setUrgency] = useState<'低' | '中' | '高'>('中');
  const [draft, setDraft] = useState<DevRequestDraft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadSources();
  }, []);

  async function loadSources() {
    try {
      const response = await fetch('/api/support/sources');
      if (!response.ok) return;
      const data = (await response.json()) as { sources: SourceStatus[]; aiEnabled: boolean };
      setSources(data.sources);
      setAiEnabled(data.aiEnabled);
    } catch {
      // 資料一覧が取れなくても質問自体はできる
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      await fetch('/api/support/sync', { method: 'POST' });
      await loadSources();
    } finally {
      setSyncing(false);
    }
  }

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion('');
    setTurns((current) => [...current, { question: trimmed, pending: true }]);

    try {
      const response = await fetch('/api/support/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = (await response.json()) as SupportAnswer & { error?: string };
      setTurns((current) =>
        current.map((turn, index) =>
          index === current.length - 1
            ? response.ok
              ? { ...turn, pending: false, answer: data }
              : { ...turn, pending: false, error: data.error ?? '回答を取得できませんでした。' }
            : turn,
        ),
      );
      if (response.ok && data.needsDeveloper) {
        setShowRequest(true);
        setProblem((current) => current || trimmed);
      }
    } catch {
      setTurns((current) =>
        current.map((turn, index) =>
          index === current.length - 1 ? { ...turn, pending: false, error: '通信に失敗しました。' } : turn,
        ),
      );
    }
  }

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    setDraftBusy(true);
    setDraftError('');
    setDraft(null);
    setCopied(false);
    try {
      const response = await fetch('/api/support/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem, tool, steps, urgency, requester }),
      });
      const data = (await response.json()) as DevRequestDraft & { error?: string };
      if (!response.ok) {
        setDraftError(data.error ?? '依頼文を作成できませんでした。');
        return;
      }
      setDraft(data);
    } catch {
      setDraftError('通信に失敗しました。');
    } finally {
      setDraftBusy(false);
    }
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="support-layout">
      <div>
        {!aiEnabled && (
          <div className="alert alert--info">
            AI 回答は未設定です（ANTHROPIC_API_KEY）。いまは関連する資料の該当箇所を検索して表示します。
            依頼文の作成はテンプレートで動作します。
          </div>
        )}

        <div className="suggestions">
          {SAMPLE_QUESTIONS.map((sample) => (
            <button type="button" className="suggestion" key={sample} onClick={() => void ask(sample)}>
              {sample}
            </button>
          ))}
        </div>

        <div className="chat">
          {turns.length === 0 && (
            <div className="card">
              <p style={{ margin: 0 }}>
                わからないことを、そのままの言葉で書いてください。
                <br />
                例：「請求書ツールにログインできない」「Figma の共有リンクの出し方がわからない」
              </p>
            </div>
          )}

          {turns.map((turn, index) => (
            <div key={`${turn.question}-${index}`}>
              <div className="bubble bubble--user">
                <div className="bubble__role">現場からの質問</div>
                {turn.question}
              </div>
              <div className="bubble bubble--ai" style={{ marginTop: 8 }}>
                <div className="bubble__role">サポート</div>
                {turn.pending && <span className="muted">資料を確認しています…</span>}
                {turn.error && <span className="source-item__error">{turn.error}</span>}
                {turn.answer && (
                  <>
                    <SimpleMarkdown text={turn.answer.answer} />
                    <Citations citations={turn.answer.citations} />
                    {turn.answer.needsDeveloper && (
                      <div className="actions">
                        <button
                          type="button"
                          className="button--ghost button--small"
                          onClick={() => {
                            setShowRequest(true);
                            setProblem(turn.question);
                          }}
                        >
                          開発者への依頼文を作る
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <form
          className="search-bar"
          style={{ marginTop: 16 }}
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="困っていることを書いてください"
            aria-label="質問"
          />
          <button type="submit" disabled={!question.trim()}>
            質問する
          </button>
        </form>

        <h2>開発者へ依頼する</h2>
        <p className="muted">
          資料で解決しないときは、ここから依頼文を作れます。プログラムの言葉に直す作業はこちらで行います。
        </p>

        {!showRequest ? (
          <button type="button" className="button--ghost" onClick={() => setShowRequest(true)}>
            依頼文を作成する
          </button>
        ) : (
          <form className="card" onSubmit={createDraft}>
            {draftError && <div className="alert">{draftError}</div>}
            <div className="field">
              <label htmlFor="req-problem">困っていること *</label>
              <textarea
                id="req-problem"
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                placeholder="例: 請求書ツールで「保存」を押すと画面が真っ白になる"
                required
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="req-tool">対象ツール</label>
                <input
                  id="req-tool"
                  type="text"
                  value={tool}
                  onChange={(event) => setTool(event.target.value)}
                  placeholder="例: 請求書ツール"
                />
              </div>
              <div className="field">
                <label htmlFor="req-urgency">緊急度</label>
                <select
                  id="req-urgency"
                  value={urgency}
                  onChange={(event) => setUrgency(event.target.value as '低' | '中' | '高')}
                >
                  <option value="低">低（急がない）</option>
                  <option value="中">中（今週中に直したい）</option>
                  <option value="高">高（業務が止まっている）</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="req-steps">どんな操作をしましたか</label>
              <textarea
                id="req-steps"
                value={steps}
                onChange={(event) => setSteps(event.target.value)}
                placeholder="例: 1. ログイン 2. 請求書一覧を開く 3. 保存ボタンを押す"
              />
            </div>
            <div className="actions">
              <button type="submit" disabled={draftBusy || !problem.trim()}>
                {draftBusy ? '作成中…' : '依頼文を作る'}
              </button>
              <button type="button" className="button--ghost" onClick={() => setShowRequest(false)}>
                閉じる
              </button>
            </div>
          </form>
        )}

        {draft && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>{draft.title}</h3>
            <pre className="draft">{draft.body}</pre>
            <div className="actions">
              <button type="button" onClick={copyDraft}>
                {copied ? 'コピーしました' : '依頼文をコピー'}
              </button>
              {draft.issueUrl && (
                <a className="button button--ghost" href={draft.issueUrl} target="_blank" rel="noreferrer noopener">
                  GitHub Issue として起票する
                </a>
              )}
            </div>
            {draft.fallback && (
              <p className="muted">
                （AI 未設定のためテンプレートで作成しました。内容を確認して調整してください。）
              </p>
            )}
          </div>
        )}
      </div>

      <aside className="card">
        <h3 style={{ marginTop: 0 }}>いま参照できる資料</h3>
        <p className="muted">
          knowledge/ フォルダと、sources.json に登録した GitHub リポジトリの Markdown を読んでいます。
        </p>
        {sources.length === 0 && <p className="muted">資料が登録されていません。</p>}
        {sources.map((source) => (
          <div className="source-item" key={source.id}>
            <div className="source-item__label">
              {source.type === 'github' ? '🐙' : '📁'} {source.label}
              <span className="muted"> / {source.docCount} 件</span>
            </div>
            <div className="source-item__meta">{source.location}</div>
            {source.owner && <div className="source-item__meta">担当: {source.owner}</div>}
            {source.error && <div className="source-item__error">読み込みエラー: {source.error}</div>}
          </div>
        ))}
        <div className="actions">
          <button type="button" className="button--ghost button--small" onClick={sync} disabled={syncing}>
            {syncing ? '再読み込み中…' : '資料を再読み込み'}
          </button>
        </div>
      </aside>
    </div>
  );
}
