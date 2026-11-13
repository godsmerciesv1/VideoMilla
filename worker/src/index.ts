import type { Env } from './env';
import type { Auth } from './lib/auth';
import { authenticate } from './lib/auth';
import { HttpError, belowMin, errorResponse, preflight, withCors, json } from './lib/http';
import { cfg, handleConfig } from './routes/config';
import { handleBalance, handleSession } from './routes/session';

/**
 * The router. It grows with each batch: routes are added here as their files land
 * (the blueprint builds it last; building it incrementally keeps every batch deployable).
 */
async function route(req: Request, env: Env, auth: Auth, path: string): Promise<Response> {
  if (path === '/v1/balance' && req.method === 'GET') return handleBalance(env, auth);
  if (path === '/v1/config' && req.method === 'GET') return handleConfig(env);
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
} satisfies ExportedHandler<Env>;
