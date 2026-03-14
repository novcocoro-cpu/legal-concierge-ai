# 弁護士ヒアリング 法務コンシェルジュ — CLAUDE.md

## 技術スタック
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (DB), Gemini 2.5 Flash (AI分析)

## 重要なルール
- `GEMINI_API_KEY` はサーバーサイドのみ（`NEXT_PUBLIC_` 不可）
- Supabase クエリには必ず `.eq('user_id', userId)` を付ける
- TODO チェック状態は localStorage で管理（`mtg_todos_done`）
- ユーザーIDは localStorage `mtg_uid`、名前は `mtg_name`

## デザイン
- CSS変数でカラー管理（`globals.css` の `:root` を参照）
- モバイルファースト、最大幅 480px、BottomNav 固定 60px

## ディレクトリ
- `app/api/` — API Routes（transcribe, meetings）
- `components/` — layout / record / result / history / todos
- `hooks/` — useUserId, useAudioRecorder, useMeetings
- `lib/` — supabase, gemini, utils
- `types/` — 型定義
