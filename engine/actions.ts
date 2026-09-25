// Acciones válidas a partir de lo que ve el jugador. La usan los bots, los tests y
// sirve de referencia para el front: si no está en esta lista, el server responde 409.
import type { Action } from './types.ts';
import type { GameView } from './view.ts';

export function validActions(v: GameView): Action[] {
  switch (v.phase) {
    case 'result':
      return [];
    case 'toast':
      return [{ type: 'continue' }];
    case 'choose':
      return v.current!.options.map((_, option) => ({ type: 'pick', option }));
    case 'eventChoice':
      return v.evChoice!.options.map((_, option) => ({ type: 'eventPick', option }));
    case 'quiz': {
      const q = v.quiz!;
      if (q.picked == null) return q.opts.map((_, option) => ({ type: 'quizAnswer', option }));
      return [q.over || q.won ? { type: 'quizClose' } : { type: 'quizNext' }];
    }
    case 'mini': {
      const m = v.mini!;
      if (m.phase === 'stake') {
        return [...m.stakeOptions.map((o) => ({ type: 'miniStake', frac: o.frac }) as Action), { type: 'miniSkip' }];
      }
      if (m.done) return [{ type: 'miniFinish' }];
      switch (m.kind) {
        case 'slots': return [{ type: 'slotsSpin' }];
        case 'ruleta': return [{ type: 'ruletaSpin' }];
        case 'doble': return [{ type: 'dobleDouble' }, { type: 'dobleCashout' }];
        case 'sobres': return [0, 1, 2].map((index) => ({ type: 'sobreOpen', index }));
        case 'blackjack': return m.stood ? [] : [{ type: 'bjHit' }, { type: 'bjStand' }];
      }
    }
  }
  return [];
}
