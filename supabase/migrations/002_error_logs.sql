-- エラーログテーブル
-- Supabase SQL Editor で実行してください

CREATE TABLE IF NOT EXISTS error_logs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT        NOT NULL,
  process_type  TEXT        NOT NULL,
  device_info   TEXT,
  browser_info  TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 日時の降順インデックス（一覧表示の高速化）
CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at
  ON error_logs (occurred_at DESC);

-- エラー内容の全文検索インデックス
CREATE INDEX IF NOT EXISTS idx_error_logs_error_message
  ON error_logs USING gin(to_tsvector('simple', error_message));
