'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { getFieldSchema } from '@/config/fieldSchemas';
import type { MasterData } from '@/lib/types';

/**
 * 登録・編集フォーム。小項目に応じて追加項目を動的生成する（要件定義書 §7）。
 * 機密項目の現在値は画面に出さない。編集時に空欄なら現在の値を保持する。
 */

export type RecordFormInitial = {
  id?: string;
  system_name: string;
  google_account: string;
  category: string;
  subcategory: string;
  health_check_url: string;
  /** 非機密項目のみ初期値として渡される */
  details: Record<string, string>;
  /** 値が登録済みの機密項目キー */
  secretKeysWithValue: string[];
};

const EMPTY: RecordFormInitial = {
  system_name: '',
  google_account: '',
  category: '',
  subcategory: '',
  health_check_url: '',
  details: {},
  secretKeysWithValue: [],
};

function Datalist({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((option) => (
        <option value={option} key={option} />
      ))}
    </datalist>
  );
}

export default function RecordForm({
  master,
  systemNames = [],
  initial = EMPTY,
  mode,
}: {
  master: MasterData;
  /** 既存のシステム名（入力補完用） */
  systemNames?: string[];
  initial?: RecordFormInitial;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const [systemName, setSystemName] = useState(initial.system_name);
  const [googleAccount, setGoogleAccount] = useState(initial.google_account);
  const [category, setCategory] = useState(initial.category);
  const [subcategory, setSubcategory] = useState(initial.subcategory);
  const [healthUrl, setHealthUrl] = useState(initial.health_check_url);
  const [details, setDetails] = useState<Record<string, string>>(initial.details);
  const [clearKeys, setClearKeys] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const schema = useMemo(() => getFieldSchema(subcategory), [subcategory]);
  const hasStoredSecret = (key: string) => initial.secretKeysWithValue.includes(key);

  function setDetail(key: string, value: string) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function toggleClear(key: string, checked: boolean) {
    setClearKeys((current) => (checked ? [...current, key] : current.filter((k) => k !== key)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors([]);

    // スキーマ外のキーは送らない（許可キー以外は拒否される）
    const payload: Record<string, unknown> = {
      system_name: systemName,
      google_account: googleAccount,
      category,
      subcategory,
      health_check_url: healthUrl,
      details: Object.fromEntries(
        schema.map((field) => [field.key, details[field.key] ?? '']).filter(([, value]) => value !== ''),
      ),
      clear_secret_keys: clearKeys,
    };

    const endpoint = mode === 'create' ? '/api/records' : `/api/records/${initial.id}`;
    try {
      const response = await fetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { id?: string; error?: string; errors?: string[] };
      if (!response.ok) {
        setErrors(data.errors ?? [data.error ?? '保存に失敗しました。']);
        return;
      }
      router.push(`/system/${data.id ?? initial.id}`);
      router.refresh();
    } catch {
      setErrors(['通信に失敗しました。']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      {errors.length > 0 && (
        <div className="alert">
          入力内容を確認してください。
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label htmlFor="system_name">システム名 *</label>
          <input
            id="system_name"
            list="system-names"
            value={systemName}
            onChange={(event) => setSystemName(event.target.value)}
            placeholder="例: 社内ポータル"
            required
          />
          <Datalist id="system-names" options={systemNames} />
        </div>
        <div className="field">
          <label htmlFor="google_account">Google アカウント</label>
          <input
            id="google_account"
            list="google-accounts"
            value={googleAccount}
            onChange={(event) => setGoogleAccount(event.target.value)}
            placeholder="例: tool-admin@example.com"
          />
          <Datalist id="google-accounts" options={master.googleAccounts} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="category">大項目 *</label>
          <input
            id="category"
            list="categories"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="例: ツール / API"
            required
          />
          <Datalist id="categories" options={master.categories} />
        </div>
        <div className="field">
          <label htmlFor="subcategory">小項目（ツール名） *</label>
          <input
            id="subcategory"
            list="subcategories"
            value={subcategory}
            onChange={(event) => setSubcategory(event.target.value)}
            placeholder="例: AWS / Figma"
            required
          />
          <Datalist id="subcategories" options={master.subcategories} />
          <p className="field__hint">
            選ぶと、そのツール用の入力項目が下に表示されます（未定義のツールは汎用項目）。
          </p>
        </div>
      </div>

      <div className="field">
        <label htmlFor="health_check_url">ヘルスチェックURL</label>
        <input
          id="health_check_url"
          type="url"
          value={healthUrl}
          onChange={(event) => setHealthUrl(event.target.value)}
          placeholder="https://example.com/health"
        />
        <p className="field__hint">
          未設定の場合は監視対象外（⚪）になります。社内 IP / localhost は登録できません。
        </p>
      </div>

      <h3>追加項目{subcategory ? `（${subcategory}）` : ''}</h3>
      {schema.map((field) => (
        <div className="field" key={field.key}>
          <label htmlFor={`detail-${field.key}`}>
            {field.label}
            {field.required ? ' *' : ''}
            {field.secret ? '（暗号化して保存）' : ''}
          </label>
          {field.multiline ? (
            <textarea
              id={`detail-${field.key}`}
              value={details[field.key] ?? ''}
              onChange={(event) => setDetail(field.key, event.target.value)}
            />
          ) : (
            <input
              id={`detail-${field.key}`}
              type={field.secret ? 'password' : 'text'}
              autoComplete={field.secret ? 'new-password' : 'off'}
              value={details[field.key] ?? ''}
              onChange={(event) => setDetail(field.key, event.target.value)}
              placeholder={field.placeholder ?? ''}
            />
          )}
          {mode === 'edit' && field.secret && hasStoredSecret(field.key) && (
            <p className="field__hint">
              現在の値は登録済みです。空欄のままなら変更されません。
              <label style={{ display: 'inline-flex', gap: 6, marginLeft: 10, fontWeight: 400 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={clearKeys.includes(field.key)}
                  onChange={(event) => toggleClear(field.key, event.target.checked)}
                />
                値を削除する
              </label>
            </p>
          )}
        </div>
      ))}

      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? '保存中…' : mode === 'create' ? '登録する' : '更新する'}
        </button>
        <button type="button" className="button--ghost" onClick={() => router.back()} disabled={busy}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
