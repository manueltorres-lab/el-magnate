// Seguridad de la base (§2 bis): con los roles de la clave pública (anon / authenticated)
// no se puede leer, escribir ni ejecutar nada del schema `game`.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { closeDb, db } from './helpers.ts';

after(closeDb);

const TABLES = ['players', 'runs', 'run_actions', 'unlocks', 'rareza', 'rate_limits'];

test('anon y authenticated no pueden tocar ninguna tabla ni función', async () => {
  const s = db();
  const [{ id }] = await s`insert into auth.users (id) values (gen_random_uuid()) returning id`;
  for (const role of ['anon', 'authenticated']) {
    const attempts: [string, string][] = [];
    for (const t of TABLES) {
      attempts.push([`select ${t}`, `select * from game.${t} limit 1`]);
      attempts.push([`delete ${t}`, `delete from game.${t}`]);
    }
    attempts.push(['insert players', `insert into game.players (id) values ('${id}')`]);
    attempts.push(['update runs', `update game.runs set state = '{}'`]);
    attempts.push(['rate_hit', `select game.rate_hit('x', 1, 1)`]);
    attempts.push(['abandon', `select game.abandon_stale_runs()`]);
    attempts.push(['ranking', `select * from game.ranking_candidates`]);
    for (const [label, q] of attempts) {
      await assert.rejects(
        s.begin(async (tx) => { await tx.unsafe(`set local role ${role}`); await tx.unsafe(q); }),
        (e: { code?: string }) => e.code === '42501', // insufficient_privilege
        `${role} pudo: ${label}`,
      );
    }
  }
});

test('RLS activado en todas las tablas y sin policies', async () => {
  const s = db();
  const rows = await s`
    select c.relname, c.relrowsecurity,
      (select count(*)::int from pg_policies p where p.schemaname = 'game' and p.tablename = c.relname) as policies
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'game' and c.relkind = 'r' order by 1`;
  assert.deepEqual(rows.map((r) => r.relname).sort(), [...TABLES].sort());
  for (const r of rows) {
    assert.equal(r.relrowsecurity, true, r.relname + ' sin RLS');
    assert.equal(r.policies, 0, r.relname + ' tiene policies');
  }
});

test('ningún privilegio de anon/authenticated sobre el schema game', async () => {
  const s = db();
  const grants = await s`
    select grantee, table_name, privilege_type from information_schema.role_table_grants
    where table_schema = 'game' and grantee in ('anon', 'authenticated', 'PUBLIC')`;
  assert.deepEqual(grants, []);
  const [u] = await s`select has_schema_privilege('anon', 'game', 'USAGE') as anon, has_schema_privilege('authenticated', 'game', 'USAGE') as auth`;
  assert.deepEqual({ ...u }, { anon: false, auth: false });
});
