// Identidad: el JWT de Supabase Auth (usuario anónimo o no). El player_id es SIEMPRE el
// user.id que devuelve Auth para ese token; nunca uno que venga en el body.
import { createClient } from '@supabase/supabase-js';

/** Devuelve el id del usuario dueño del token, o null si el token no es válido. */
export type Authenticator = (token: string) => Promise<string | null>;

export function supabaseAuthenticator(url: string, serviceRoleKey: string): Authenticator {
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return async (token) => {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  };
}

export function bearer(header: string | undefined | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m ? m[1] : null;
}
