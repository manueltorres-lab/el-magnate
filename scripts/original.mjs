// Carga el juego original (handoff/referencia/El Magnate.dc.html) para compararlo con el motor.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML = new URL('../handoff/referencia/El Magnate.dc.html', import.meta.url);

/** Devuelve el contenido de `<script data-dc-script>`. */
export function extractScript() {
  const html = readFileSync(HTML, 'utf8');
  const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No encontré <script data-dc-script>');
  return m[1];
}

/**
 * Instancia el código original en un contexto aislado, con un `setState` sincrónico
 * y timers falsos que se disparan con `flush()`.
 */
export function loadOriginal() {
  const timers = [];
  const storage = new Map();
  const context = {
    console, Math, JSON, Object, Array, String, Number, URL, URLSearchParams,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    setInterval: () => 0, // solo anima los rodillos: no afecta el estado de juego
    clearInterval: () => {},
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    location: { href: 'https://example.test/', search: '' },
    navigator: {},
  };
  vm.createContext(context);
  const base = `
    class DCLogic {
      constructor(props){ this.props = props || {}; }
      setState(patch, cb){
        const p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
        this.state = Object.assign({}, this.state, p);
        if (cb) cb();
      }
    }
  `;
  const tail = `
    ;({ Component, api: { hashStr, seedAt, rnd,
        getR: () => RSTATE, setR: (v) => { RSTATE = v; },
        SCENARIOS, BIG_SCENARIOS, EVENTS_AUTO, EVENTS_COND, EVENTS_CHOICE, QUIZ, TITLES, RAREZA,
        DESESPERADAS, FINAS, TAG_EFFECT, COMMIT, TAG_PESO, TAG_FINAL, ORDEN_COL, MINI_KINDS,
        RULETA, SLOT_SYMBOLS, QUIZ_PCT, TAG_LABEL, CARD_R, CARD_S } })
  `;
  const exported = vm.runInContext(base + extractScript() + tail, context);
  const flush = () => {
    // dispara los setTimeout en orden de demora, incluidos los que se agenden al correr
    while (timers.length) {
      timers.sort((a, b) => a.ms - b.ms);
      const t = timers.shift();
      t.fn();
    }
  };
  /** Una partida nueva del original (misma instancia del script, estado de RNG global compartido). */
  const newGame = (props = {}) => new exported.Component(props);
  return { newGame, flush, api: exported.api };
}
