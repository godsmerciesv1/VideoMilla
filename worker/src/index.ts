import type { Env } from './env';
import type { Auth } from './lib/auth';
import { authenticate } from './lib/auth';
import { HttpError, belowMin, errorResponse, preflight, withCors, json } from './lib/http';
import { cfg, handleConfig } from './routes/config';
import { handleAssist } from './routes/assist';
import { handleClipFile } from './routes/clip_file';
import { handleAck, handleClipStatus } from './routes/clip_status';
import { handleClipSubmit, runClipJob } from './routes/clip_submit';
import { handleImage } from './routes/image';
import { handleReferenceCheck } from './routes/reference_check';
import { handleReport } from './routes/report';
import { handleStructure } from './routes/structure';
import { handleTts } from './routes/tts';
import { handleBalance, handleSession } from './routes/session';

/**
 * The router. It grows with each batch: routes are added here as their files land
 * (the blueprint builds it last; building it incrementally keeps every batch deployable).
 */
async function route(req: Request, env: Env, auth: Auth, path: string): Promise<Response> {
  if (path === '/v1/balance' && req.method === 'GET') return handleBalance(env, auth);
  if (path === '/v1/config' && req.method === 'GET') return handleConfig(env);
  if (path === '/v1/report' && req.method === 'POST') return handleReport(req, env, auth);
  if (path === '/v1/structure' && req.method === 'POST') return handleStructure(req, env, auth);
  if (path === '/v1/assist' && req.method === 'POST') return handleAssist(req, env, auth);
  if (path === '/v1/image' && req.method === 'POST') return handleImage(req, env, auth);
  if (path === '/v1/tts' && req.method === 'POST') return handleTts(req, env, auth);
  if (path === '/v1/clip/submit' && req.method === 'POST') return handleClipSubmit(req, env, auth);
  if (path === '/v1/clip/status' && req.method === 'GET') return handleClipStatus(req, env, auth);
  if (path === '/v1/clip/file' && req.method === 'GET') return handleClipFile(req, env, auth);
  if (path === '/v1/ack' && req.method === 'POST') return handleAck(req, env, auth);
  if (path === '/v1/reference/check' && req.method === 'POST') return handleReferenceCheck(req, env, auth);
  throw new HttpError(404, 'not_found');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return preflight(req, env);
    const path = new URL(req.url).pathname;
    try {
      // Every request passes CORS, authentication and the minimum-version gate, in that order.
      if (path === '/v1/session' && req.method === 'POST') return withCors(req, env, await handleSession(req, env));
      const auth = await authenticate(req, env);
      if (belowMin(req.headers.get('X-App-Version'), await cfg(env.DB, 'min_app_version'))) {
        return withCors(req, env, json({ error: 'update_required' }, 426));
      }
      return withCors(req, env, await route(req, env, auth, path));
    } catch (e) {
      return withCors(req, env, errorResponse(e));
    }
  },
  /** The clip queue consumer: one message per clip. Retries and refunds are decided inside `runClipJob`. */
  async queue(batch: MessageBatch<{ key: string }>, env: Env): Promise<void> {
    for (const m of batch.messages) await runClipJob(env, m.body.key, m);
  },
} satisfies ExportedHandler<Env, { key: string }>;
