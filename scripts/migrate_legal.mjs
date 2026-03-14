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
  console.log(`[${label}]`, text.slice(0, 200));
}

// legal_firms
await runSQL("legal_firms", `
  CREATE TABLE IF NOT EXISTS legal_firms (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    created_at timestamptz DEFAULT now()
  );
`);

// legal_users
await runSQL("legal_users", `
  CREATE TABLE IF NOT EXISTS legal_users (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id    uuid REFERENCES legal_firms(id) ON DELETE CASCADE,
    name       text NOT NULL,
    role       text NOT NULL DEFAULT 'user',
    created_at timestamptz DEFAULT now()
  );
`);

// legal_hearings
await runSQL("legal_hearings", `
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
`);

// legal_prompts
await runSQL("legal_prompts", `
  CREATE TABLE IF NOT EXISTS legal_prompts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id    uuid REFERENCES legal_firms(id) ON DELETE CASCADE,
    key        text NOT NULL,
    content    text NOT NULL DEFAULT '',
    updated_at timestamptz DEFAULT now()
  );
`);

// RLS policies
await runSQL("RLS", `
  ALTER TABLE legal_firms     ENABLE ROW LEVEL SECURITY;
  ALTER TABLE legal_users     ENABLE ROW LEVEL SECURITY;
  ALTER TABLE legal_hearings  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE legal_prompts   ENABLE ROW LEVEL SECURITY;
`);

await runSQL("policy_firms", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_firms' AND policyname='legal_firms_all') THEN
      CREATE POLICY legal_firms_all ON legal_firms FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$;
`);
await runSQL("policy_users", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_users' AND policyname='legal_users_all') THEN
      CREATE POLICY legal_users_all ON legal_users FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$;
`);
await runSQL("policy_hearings", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_hearings' AND policyname='legal_hearings_all') THEN
      CREATE POLICY legal_hearings_all ON legal_hearings FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$;
`);
await runSQL("policy_prompts", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='legal_prompts' AND policyname='legal_prompts_all') THEN
      CREATE POLICY legal_prompts_all ON legal_prompts FOR ALL USING (true) WITH CHECK (true);
    END IF;
  END $$;
`);

console.log("\n✅ All legal tables created successfully");
