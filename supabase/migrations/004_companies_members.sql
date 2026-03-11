-- ============================================================
-- companies / members テーブル作成 + 既存データ移行
-- ============================================================

-- 1. companies テーブル
CREATE TABLE IF NOT EXISTS companies (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. members テーブル
CREATE TABLE IF NOT EXISTS members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- 3. meetings に company_id, member_id カラム追加
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS member_id  UUID REFERENCES members(id);

-- 4. 既存データ移行: 会社名がある会議 → companies へ
INSERT INTO companies (name)
SELECT DISTINCT company_name
FROM meetings
WHERE company_name IS NOT NULL AND company_name != ''
ON CONFLICT (name) DO NOTHING;

-- 会社名なしの会議用のデフォルト会社
INSERT INTO companies (name) VALUES ('個人 / 未設定')
ON CONFLICT (name) DO NOTHING;

-- 5. 既存データ移行: メンバー → members へ
-- 会社名ありの会議
INSERT INTO members (company_id, name)
SELECT DISTINCT c.id, m.user_name
FROM meetings m
JOIN companies c ON c.name = m.company_name
WHERE m.user_name IS NOT NULL AND m.user_name != ''
ON CONFLICT (company_id, name) DO NOTHING;

-- 会社名なしの会議
INSERT INTO members (company_id, name)
SELECT DISTINCT c.id, m.user_name
FROM meetings m
CROSS JOIN companies c
WHERE c.name = '個人 / 未設定'
  AND (m.company_name IS NULL OR m.company_name = '')
  AND m.user_name IS NOT NULL AND m.user_name != ''
ON CONFLICT (company_id, name) DO NOTHING;

-- 6. meetings の company_id, member_id を埋める
-- 会社名ありの会議
UPDATE meetings SET
  company_id = c.id,
  member_id  = mb.id
FROM companies c, members mb
WHERE c.name = meetings.company_name
  AND mb.company_id = c.id
  AND mb.name = meetings.user_name
  AND meetings.company_id IS NULL;

-- 会社名なしの会議
UPDATE meetings SET
  company_id = c.id,
  member_id  = mb.id
FROM companies c, members mb
WHERE c.name = '個人 / 未設定'
  AND mb.company_id = c.id
  AND mb.name = meetings.user_name
  AND meetings.company_id IS NULL
  AND (meetings.company_name IS NULL OR meetings.company_name = '');

-- 7. インデックス
CREATE INDEX IF NOT EXISTS idx_members_company_id  ON members(company_id);
CREATE INDEX IF NOT EXISTS idx_meetings_company_id ON meetings(company_id);
CREATE INDEX IF NOT EXISTS idx_meetings_member_id  ON meetings(member_id);
