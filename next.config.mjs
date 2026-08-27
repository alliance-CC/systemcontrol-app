/** @type {import('next').NextConfig} */
const nextConfig = {
  // 現場サポートモードは knowledge/ 配下の Markdown を実行時に読む。
  // Vercel などのサーバーレス環境でもファイルが同梱されるようトレースに含める。
  outputFileTracingIncludes: {
    '/**': ['./knowledge/**/*'],
  },
  poweredByHeader: false,

  // 認証情報を扱う画面のため、基本的な防御ヘッダーを付ける（クリックジャッキング・情報漏れ対策）
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // 詳細ページに復号済みの値が出るため、ブラウザ・中間キャッシュに残さない
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

export default nextConfig;
