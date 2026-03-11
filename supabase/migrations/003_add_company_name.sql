-- meetings テーブルに会社名を追加
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '';

-- 利用者情報テーブルに会社名を追加（存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '利用者情報') THEN
    ALTER TABLE "利用者情報" ADD COLUMN IF NOT EXISTS "会社名" TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- 会社名の検索用インデックス
CREATE INDEX IF NOT EXISTS idx_meetings_company_name ON meetings (company_name);
