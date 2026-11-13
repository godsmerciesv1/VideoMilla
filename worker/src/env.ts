/** Everything the Worker is bound to. Secrets are set with `wrangler secret put` and are never in the repository. */
export interface Env {
  AI: Ai;
  DB: D1Database;
  /** Temporary clips (R2 is primary). */
  CLIPS: R2Bucket;
  /** Free fallback for temporary clips if R2 fails. */
  CLIPS_KV: KVNamespace;
  CLIP_JOBS: Queue<{ key: string }>;

  GOOGLE_SA_JSON: string;
  GEMINI_API_KEY: string;
  SEGMIND_API_KEY: string;
  PRUNA_API_KEY: string;
  POLAR_ACCESS_TOKEN: string;
  POLAR_WEBHOOK_SECRET: string;
  BREVO_API_KEY: string;
  GOOGLE_OAUTH_CLIENT_IDS: string;
  /** Mixed into every stored hash so a leaked database cannot be checked against guesses. */
  PEPPER: string;

  WEB_ORIGIN: string;
  APP_ORIGIN: string;
  SITE_ORIGIN: string;
  /** Set to "1" in development to allow http://localhost origins. */
  ALLOW_LOCALHOST?: string;
}
