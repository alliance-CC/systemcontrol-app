import { requireUser } from '@/lib/session';
import SupportConsole from '@/components/SupportConsole';

/**
 * 現場サポートモード（docs/FIELD_SUPPORT.md）。
 * プログラムがわからない現場スタッフ向けの質問窓口。
 */

export const dynamic = 'force-dynamic';

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const user = await requireUser();
  const { tool } = await searchParams;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>現場サポートモード</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            ツールの使い方でわからないことを、そのままの言葉で聞いてください。社内の資料をもとに答えます。
            解決しないときは、開発者への依頼文をこの場で作成できます。
          </p>
        </div>
        {tool && (
          <div className="page-head__actions">
            <span className="badge badge--accent">対象ツール: {tool}</span>
          </div>
        )}
      </div>
      <SupportConsole initialTool={tool ?? ''} requester={user.login_id} />
    </>
  );
}
