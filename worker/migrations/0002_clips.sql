-- Clip jobs (blueprint 23.2, F099). One row per requested clip; the credits live on the matching `requests` row.
-- state: queued, running, ready, failed_retriable, failed_terminal.
CREATE TABLE clips(
  key TEXT PRIMARY KEY REFERENCES requests(key),
  wallet_id TEXT NOT NULL,
  shot_id TEXT NOT NULL,
  provider TEXT,
  provider_job TEXT,
  seconds INTEGER NOT NULL,
  talking INTEGER NOT NULL DEFAULT 0,
  voice_over INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_clips_wallet ON clips(wallet_id, state);
CREATE INDEX idx_clips_state ON clips(state, updated_at);
