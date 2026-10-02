-- API Key 관리 테이블
CREATE TABLE dgflow_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  user_id UUID REFERENCES dgflow_users(id),
  role TEXT NOT NULL DEFAULT 'readonly' CHECK (role IN ('readonly', 'admin')),
  expires_at TIMESTAMPTZ,
  rate_limit INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE dgflow_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys_authenticated" ON dgflow_api_keys FOR ALL USING (auth.uid() IS NOT NULL);

-- Rate limiting tracking
CREATE TABLE dgflow_api_rate_limits (
  key_id UUID REFERENCES dgflow_api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (key_id, window_start)
);
ALTER TABLE dgflow_api_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_service" ON dgflow_api_rate_limits FOR ALL USING (auth.uid() IS NOT NULL);
