-- ============================================================
-- 法務コンシェルジュ専用テーブル
-- 既存テーブルには一切触れない
-- ============================================================

-- legal_firms
CREATE TABLE IF NOT EXISTS legal_firms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- legal_users
CREATE TABLE IF NOT EXISTS legal_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id    uuid REFERENCES legal_firms(id) ON DELETE CASCADE,
  name       text NOT NULL,
  role       text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- legal_hearings
CREATE TABLE IF NOT EXISTS legal_hearings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      uuid REFERENCES legal_firms(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES legal_users(id) ON DELETE SET NULL,
  case_name    text,
  transcript   text,
  summary      text,
  legal_points text,
  risk_level   text,
  strategy     text,
  tasks        jsonb,
  next_date    text,
  audio_url    text,
  created_at   timestamptz DEFAULT now()
);

-- legal_prompts
CREATE TABLE IF NOT EXISTS legal_prompts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id    uuid REFERENCES legal_firms(id) ON DELETE CASCADE,
  key        text NOT NULL,
  content    text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- RLS無効（anon keyで全操作可能に）
ALTER TABLE legal_firms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_hearings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_prompts   ENABLE ROW LEVEL SECURITY;

-- anon用ポリシー（全許可）
DO $$ BEGIN
  -- legal_firms
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_firms' AND policyname='legal_firms_all') THEN
    CREATE POLICY legal_firms_all ON legal_firms FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- legal_users
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_users' AND policyname='legal_users_all') THEN
    CREATE POLICY legal_users_all ON legal_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- legal_hearings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_hearings' AND policyname='legal_hearings_all') THEN
    CREATE POLICY legal_hearings_all ON legal_hearings FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- legal_prompts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_prompts' AND policyname='legal_prompts_all') THEN
    CREATE POLICY legal_prompts_all ON legal_prompts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
