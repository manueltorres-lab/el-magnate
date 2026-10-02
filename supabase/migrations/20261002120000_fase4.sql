-- Fase 4: rareza con datos reales, tareas programadas y un índice para el ranking semanal.

-- Recalcula la rareza de cada final con las partidas reales terminadas y sin flag.
-- Mientras no haya muestra suficiente quedan los valores simulados (sample = 0).
-- Devuelve cuántas partidas usó, o 0 si no tocó nada.
create function game.recompute_rareza(p_min_sample int default 2000)
returns int
language plpgsql
set search_path = ''
as $$
declare
  total int;
begin
  select count(*) into total from game.runs where status = 'finished' and not flagged;
  if total < p_min_sample then
    return 0;
  end if;
  update game.rareza z set
    -- nunca 0%: un final que nadie sacó todavía se muestra como el más raro posible
    pct = greatest(0.1, round(100.0 * (
      select count(*) from game.runs r
      where r.status = 'finished' and not r.flagged and r.final_key = z.final_key
    ) / total, 1)),
    sample = total,
    updated_at = now();
  return total;
end;
$$;
revoke all on function game.recompute_rareza(int) from public, anon, authenticated;

-- ranking semanal: partidas terminadas desde el lunes
create index runs_semana on game.runs (finished_at)
  where status = 'finished' and ranked and not flagged;

-- Tareas programadas con pg_cron (en Supabase existe; en la base local de los tests, no).
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- cron.schedule con nombre reemplaza la tarea si ya existía
    perform cron.schedule('magnate-rareza', '17 6 * * *', 'select game.recompute_rareza()');
    perform cron.schedule('magnate-abandonadas', '7 * * * *', 'select game.abandon_stale_runs()');
  end if;
end
$cron$;
