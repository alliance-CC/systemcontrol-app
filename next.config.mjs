/** @type {import('next').NextConfig} */
const nextConfig = {
  // 現場サポートモードは knowledge/ 配下の Markdown を実行時に読む。
  // Vercel などのサーバーレス環境でもファイルが同梱されるようトレースに含める。
  outputFileTracingIncludes: {
    '/**': ['./knowledge/**/*'],
  },
  // ヘルスチェック URL への外部通信以外は行わない。
  poweredByHeader: false,
};

export default nextConfig;
