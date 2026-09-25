// Bots de estrategia. Juegan solo con lo que devuelve toView (lo mismo que ve un jugador),
// salvo en El Sillón, donde se simula "saber" la respuesta con probabilidad QUIZ_KNOWS.
import { QUIZ } from '../engine/data.ts';
import { validActions } from '../engine/actions.ts';
import type { Action, Risk } from '../engine/types.ts';
import type { GameView, OptionView } from '../engine/view.ts';

export type BotName = 'conservador' | 'medio' | 'mixto' | 'azar' | 'agresivo' | 'manotazo';
export const BOTS: BotName[] = ['conservador', 'medio', 'mixto', 'azar', 'agresivo', 'manotazo'];

/** probabilidad de que el bot sepa la respuesta de El Sillón (si no, contesta al azar) */
export const QUIZ_KNOWS = 0.6;

const RANK: Record<Risk, number> = { baja: 0, media: 1, alta: 2 };

function byRisk(opts: OptionView[], want: Risk): number {
  // la opción con el riesgo pedido; si no hay, la más cercana (a igual distancia, la más alta)
  let best = 0, bestD = Infinity;
  opts.forEach((o, i) => {
    const d = Math.abs(RANK[o.risk] - RANK[want]) - RANK[o.risk] * 0.01;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

export type Bot = (v: GameView, rand: () => number) => Action;

export function makeBot(name: BotName): Bot {
  let decisions = 0;
  return (v, rand) => {
    const acts = validActions(v);
    const any = () => acts[Math.floor(rand() * acts.length)];
    switch (v.phase) {
      case 'toast':
        return { type: 'continue' };
      case 'choose': {
        const opts = v.current!.options;
        const n = decisions++;
        let option: number;
        if (name === 'azar') option = Math.floor(rand() * opts.length);
        else if (name === 'conservador') option = byRisk(opts, 'baja');
        else if (name === 'medio') option = byRisk(opts, 'media');
        else if (name === 'agresivo') option = byRisk(opts, 'alta');
        else if (name === 'mixto') option = byRisk(opts, n % 3 === 2 ? 'alta' : 'media');
        else {
          const extra = opts.findIndex((o) => o.extra);
          option = extra >= 0 ? extra : byRisk(opts, 'alta');
        }
        return { type: 'pick', option };
      }
      case 'eventChoice': {
        // la opción "de riesgo" de cada evento es siempre la primera
        if (name === 'azar' || name === 'mixto') return any();
        return { type: 'eventPick', option: name === 'conservador' ? 1 : 0 };
      }
      case 'quiz': {
        const q = v.quiz!;
        if (q.picked != null) return acts[0];
        if (rand() < QUIZ_KNOWS) {
          const known = QUIZ.find((x) => x.q === q.q);
          if (known) return { type: 'quizAnswer', option: known.ok };
        }
        return { type: 'quizAnswer', option: Math.floor(rand() * q.opts.length) };
      }
      case 'mini': {
        const m = v.mini!;
        if (m.phase === 'stake') {
          if (name === 'conservador') return { type: 'miniSkip' };
          if (name === 'azar') return any();
          const frac = name === 'agresivo' || name === 'manotazo' ? 0.25 : 0.12;
          return { type: 'miniStake', frac };
        }
        if (m.done) return { type: 'miniFinish' };
        if (m.kind === 'doble') {
          const bold = name === 'agresivo' || name === 'manotazo' || (name === 'azar' && rand() < 0.5);
          return { type: bold || m.step < 1 ? 'dobleDouble' : 'dobleCashout' };
        }
        if (m.kind === 'sobres') return { type: 'sobreOpen', index: Math.floor(rand() * 3) };
        if (m.kind === 'blackjack') return { type: (m.playerVal ?? 0) < 17 ? 'bjHit' : 'bjStand' };
        return acts[0];
      }
    }
    return any();
  };
}
