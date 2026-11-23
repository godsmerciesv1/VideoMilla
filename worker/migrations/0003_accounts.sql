-- Accounts, login tokens, email quota and referrals (blueprint Section 52.2, F280), plus the config they and
-- the clip pipeline read. Applied after 0001 and 0002.
CREATE TABLE accounts(
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL UNIQUE REFERENCES wallets(id),
  email TEXT UNIQUE,
  email_verified_at INTEGER,
  google_sub TEXT UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  adult_attested_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE auth_tokens(
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  referral_code TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX idx_auth_tokens_email ON auth_tokens(email, created_at);
CREATE TABLE email_quota(provider TEXT NOT NULL, window TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(provider, window));
CREATE TABLE referrals(
  id TEXT PRIMARY KEY,
  referrer_account TEXT NOT NULL,
  referred_account TEXT NOT NULL UNIQUE,
  purchase_ref TEXT,
  pack_credits INTEGER,
  referred_bonus INTEGER NOT NULL DEFAULT 0,
  referrer_bonus INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  settles_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_account, state);
CREATE INDEX idx_referrals_purchase ON referrals(purchase_ref);

INSERT OR REPLACE INTO config(key, value) VALUES
('auth', '{"code_ttl_s":900,"max_code_attempts":5,"emails_per_address_hour":5,"emails_per_address_day":20,"requests_per_ip_hour":20,"verifies_per_ip_15m":10,"max_devices":10}'),
('referral', '{"min_pack_credits":90,"percent":10,"hold_days":14,"max_referrals_30d":20,"max_bonus_30d":500}'),
('clip_retention_hours', '48'),
('clip_global_concurrency', '30'),
('caps_policy', '{"enabled":true,"share_video":0.3,"share_workers_ai":0.1,"window_days":7,"credit_net_usd":0.0225,"ceiling_video_usd":null,"ceiling_workers_ai_usd":null}'),
('polar_api_base', '"https://api.polar.sh/v1"');
