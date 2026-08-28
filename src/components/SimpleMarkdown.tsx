import { Fragment, type ReactNode } from 'react';

/**
 * 依存ライブラリなしの最小 Markdown 表示。
 * dangerouslySetInnerHTML を使わないため、AI の出力をそのまま描画しても HTML injection にならない。
 * 対応：見出し / 箇条書き / 番号付き / **太字** / `コード`
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let ordered = false;

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const items = listItems.map((item, index) => <li key={`${key}-li-${index}`}>{inline(item, `${key}-${index}`)}</li>);
    blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    listItems = [];
  };

  lines.forEach((line, index) => {
    const key = `md-${index}`;
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (heading) {
      flushList(`${key}-list`);
      blocks.push(<h3 key={key}>{inline(heading[2], key)}</h3>);
      return;
    }
    if (bullet) {
      if (ordered) flushList(`${key}-list`);
      ordered = false;
      listItems.push(bullet[1]);
      return;
    }
    if (numbered) {
      if (!ordered) flushList(`${key}-list`);
      ordered = true;
      listItems.push(numbered[1]);
      return;
    }
    flushList(`${key}-list`);
    if (line.trim() === '') return;
    blocks.push(<p key={key}>{inline(line, key)}</p>);
  });

  flushList('md-tail');
  return <Fragment>{blocks}</Fragment>;
}
