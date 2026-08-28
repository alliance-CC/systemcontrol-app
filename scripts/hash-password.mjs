#!/usr/bin/env node
/**
 * users タブに入れる password_hash を作る補助スクリプト（SETUP.md 手順 3-5）。
 *
 *   node scripts/hash-password.mjs
 *   node scripts/hash-password.mjs 'パスワード'   # 引数でも渡せる（履歴に残る点に注意）
 *
 * 出力されたハッシュを、スプレッドシートの users タブに
 *   login_id / password_hash / role / created_at
 * の順で 1 行追加してください。平文のパスワードはシートに入れないこと。
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import bcrypt from 'bcryptjs';

const ROUNDS = 12;

async function main() {
  let password = argv[2];

  if (!password) {
    const rl = createInterface({ input: stdin, output: stdout });
    password = await rl.question('パスワードを入力: ');
    rl.close();
  }

  if (!password || password.length < 8) {
    console.error('パスワードは 8 文字以上にしてください。');
    exit(1);
  }

  const hash = await bcrypt.hash(password, ROUNDS);
  console.log('');
  console.log('password_hash:');
  console.log(hash);
  console.log('');
  console.log('users タブへの追加例:');
  console.log(`  login_id: <ログインID>`);
  console.log(`  password_hash: ${hash}`);
  console.log(`  role: admin`);
  console.log(`  created_at: ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error(error.message);
  exit(1);
});
