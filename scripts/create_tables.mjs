const PAT = "sbp_f1d1e0139fbbe7638960df7d914ef88ea79b7944";
const REF = "lhaqtmccfskcdxhzjaqy";
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSQL(label, query) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Authorization": `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  console.log(`[${label}]`, text.slice(0, 150));
}

await runSQL("uuid-ossp", `create extension if not exists "uuid-ossp"`);

await runSQL("プロンプト管理", `
  create table if not exists "プロンプト管理" (
    "プロンプトID"   uuid default uuid_generate_v4() primary key,
    "タイトル"       text not null,
    "プロンプト本文" text not null,
    "有効フラグ"     boolean not null default true,
    "作成日時"       timestamptz not null default now(),
    "更新日時"       timestamptz not null default now()
  )
`);

await runSQL("index", `create index if not exists prompt_valid_idx on "プロンプト管理"("有効フラグ")`);

await runSQL("システム設定", `
  create table if not exists "システム設定" (
    "設定キー" text primary key,
    "設定値"   text not null,
    "更新日時" timestamptz not null default now()
  )
`);

await runSQL("default", `
  insert into "システム設定" ("設定キー", "設定値")
  values ('gemini_model', 'gemini-2.5-flash')
  on conflict ("設定キー") do nothing
`);

await runSQL("RLS", `
  alter table "プロンプト管理" disable row level security
`);

await runSQL("RLS2", `
  alter table "システム設定" disable row level security
`);

await runSQL("確認", `
  select table_name from information_schema.tables
  where table_schema='public' order by table_name
`);
