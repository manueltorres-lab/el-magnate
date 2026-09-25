// Edge Function `api`: https://<proyecto>.supabase.co/functions/v1/api/...
// Secrets: SERVER_SECRET, ALLOWED_ORIGINS, GAME_CONFIG (opcional).
// Los inyecta Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL.
import { createApp } from '../_shared/app.ts';
import { supabaseAuthenticator } from '../_shared/auth.ts';
import { parseGameConfig } from '../_shared/config.ts';
import { importSecret } from '../_shared/engine/index.ts';
import { connect, pgStore } from '../_shared/store.ts';

function need(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error('Falta la variable de entorno ' + name);
  return v;
}

const app = createApp({
  store: pgStore(connect(need('SUPABASE_DB_URL'))),
  authenticate: supabaseAuthenticator(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY')),
  secret: await importSecret(need('SERVER_SECRET')),
  config: parseGameConfig(Deno.env.get('GAME_CONFIG')),
  allowedOrigins: (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
});

Deno.serve(app.fetch);
