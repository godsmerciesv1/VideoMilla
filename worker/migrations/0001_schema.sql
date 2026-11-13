-- VideoMilla D1 schema, part 1 (blueprint Section 23.2 as corrected by Part IX:
-- no wallets.recovery_hash and no codes table; accounts arrive in 0003).
CREATE TABLE wallets(
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  owed INTEGER NOT NULL DEFAULT 0 CHECK (owed >= 0),
  guard INTEGER NOT NULL DEFAULT 1,
  ever_purchased INTEGER NOT NULL DEFAULT 0,
  support_id TEXT UNIQUE,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE devices(
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  secret_hash TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  last_seen INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE requests(
  key TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, device_id TEXT, action TEXT NOT NULL,
  credits INTEGER NOT NULL, status TEXT NOT NULL, settled INTEGER NOT NULL DEFAULT 0,
  project_id TEXT, provider TEXT, est_cost_micro INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER
);
CREATE TABLE ledger(
  id INTEGER PRIMARY KEY AUTOINCREMENT, wallet_id TEXT NOT NULL, delta INTEGER NOT NULL,
  kind TEXT NOT NULL, ref TEXT, created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE purchases(
  ref_hash TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, channel TEXT NOT NULL,
  product_id TEXT, credits INTEGER NOT NULL, order_id TEXT, state TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), voided_at INTEGER
);
CREATE TABLE reports(
  id TEXT PRIMARY KEY, wallet_id TEXT, kind TEXT, ref TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')), handled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE counters(key TEXT PRIMARY KEY, window TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE spend(day TEXT NOT NULL, kind TEXT NOT NULL, micro_usd INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, kind));
CREATE TABLE heartbeats(job TEXT PRIMARY KEY, last_run INTEGER NOT NULL);
CREATE TABLE config(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX idx_ledger_wallet ON ledger(wallet_id);
CREATE INDEX idx_requests_wallet ON requests(wallet_id, status);
CREATE INDEX idx_devices_wallet ON devices(wallet_id);

-- Seed configuration. Every value is JSON. The app reads the client-facing keys through GET /v1/config;
-- models, language_models and clip_routes stay on the server.
INSERT INTO config(key, value) VALUES
('config_version', '1'),
('credit_costs', '{"analysis_free_per_project":3,"analysis":1,"character_sheet":4,"portrait":1,"picture":1,"clip_per_second":2,"studio_voice_per_9s":1,"studio_voice_min":2,"series_new_character":4,"series_reuse_character":0}'),
('packs_play', '[{"product_id":"com.zdmgold.videomilla.credits_25","credits":25},{"product_id":"com.zdmgold.videomilla.credits_90","credits":90},{"product_id":"com.zdmgold.videomilla.credits_160","credits":160},{"product_id":"com.zdmgold.videomilla.credits_350","credits":350},{"product_id":"com.zdmgold.videomilla.credits_750","credits":750}]'),
('packs_polar', '[]'),
('models', '{"text_default":"@cf/google/gemma-4-26b-a4b-it","text_alternates":["@cf/meta/llama-4-scout-17b-16e-instruct","@cf/qwen/qwen3.8-27b"],"text_fallback":"@cf/meta/llama-3.3-70b-instruct-fp8-fast","moderation":"@cf/meta/llama-guard-3-8b","image":"@cf/black-forest-labs/flux-2-klein-4b","image_fallback":"@cf/black-forest-labs/flux-2-klein-9b"}'),
('language_models', '{}'),
('voice_routes', '{"default":{"provider":"google"},"en":{"provider":"workers_ai","model":"@cf/deepgram/aura-2-en"},"es":{"provider":"workers_ai","model":"@cf/deepgram/aura-2-es"}}'),
('clip_routes', '[{"provider":"segmind","model":"p-video-2","cost_per_second_micro":25000,"role":"primary","accepts_audio":true}]'),
('languages_enabled', '["en"]'),
('flags', '{"cartoon_me_enabled":false,"google_signin_enabled":false,"purchases_enabled":false}'),
('min_app_version', '"0.0.0"'),
('caps', '{"video_usd":10,"workers_ai_usd":3.3,"fallback_usd":3}'),
('fair_use', '{"animated_seconds_per_day":150,"clips_in_flight":2,"pictures_per_day":200}');
