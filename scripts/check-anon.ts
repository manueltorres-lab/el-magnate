// Chequeo de seguridad contra un proyecto de Supabase REAL (dev o prod), solo con la clave
// pública. Todo tiene que fallar: si algo se puede leer o escribir, sale con código 1.
// Uso: SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> node scripts/check-anon.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY');
  process.exit(2);
}
const TABLES = ['players', 'runs', 'run_actions', 'unlocks', 'rareza', 'rate_limits', 'ranking_candidates'];
const FUNCS = ['rate_hit', 'abandon_stale_runs', 'recompute_rareza'];

const problems: string[] = [];
const ok = (label: string) => console.log('  ✔ bloqueado:', label);

// deno-lint-ignore no-explicit-any
type Loose = any; // los tipos de supabase-js no aceptan schemas dinámicos

async function tryAll(who: string, client: Loose) {
  console.log(`\nCon ${who}:`);
  for (const schema of ['public', 'game']) {
    const c: Loose = schema === 'public' ? client : client.schema(schema);
    for (const t of TABLES) {
      const sel = await c.from(t).select('*').limit(1);
      // 'sin error y con filas' = filtración. 'sin error y vacío' también es sospechoso: la tabla es visible.
      if (!sel.error) problems.push(`${who}: select ${schema}.${t} funcionó (${sel.data?.length ?? 0} filas)`);
      else ok(`select ${schema}.${t}`);
      const ins = await c.from(t).insert({});
      if (!ins.error) problems.push(`${who}: insert en ${schema}.${t} funcionó`);
      else ok(`insert ${schema}.${t}`);
    }
    for (const f of FUNCS) {
      const r = await c.rpc(f, f === 'rate_hit' ? { p_key: 'x', p_window_seconds: 1, p_max: 1 } : {});
      if (!r.error) problems.push(`${who}: rpc ${schema}.${f} funcionó`);
      else ok(`rpc ${schema}.${f}`);
    }
  }
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
await tryAll('la anon key', createClient(url, anon, opts));

// también como usuario anónimo logueado (rol authenticated)
const user = createClient(url, anon, opts);
const { error } = await user.auth.signInAnonymously();
if (error) console.log('\n(no se pudo crear un usuario anónimo para probar el rol authenticated:', error.message + ')');
else await tryAll('un usuario anónimo logueado', user);

// la API sin token no responde nada útil
const r = await fetch(url.replace(/\/$/, '') + '/functions/v1/api/me');
if (r.ok) problems.push('GET /functions/v1/api/me sin token respondió ' + r.status);
else console.log(`\n  ✔ la API sin token responde ${r.status}`);

if (problems.length) {
  console.error('\n✖ PROBLEMAS DE SEGURIDAD:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
console.log('\n✔ Con la clave pública no se puede leer ni escribir nada.');
