// Errores de la API: { error: { code, message } } con mensajes listos para mostrar.

export type ErrorCode =
  | 'bad_request' | 'bad_action' | 'unauthorized' | 'not_found' | 'version_conflict'
  | 'out_of_phase' | 'run_not_active' | 'lbtag_taken' | 'rate_limited' | 'internal' | 'duelo_no_jugado';

const STATUS: Record<ErrorCode, 400 | 401 | 403 | 404 | 409 | 429 | 500> = {
  bad_request: 400, bad_action: 400, unauthorized: 401, not_found: 404, version_conflict: 409,
  out_of_phase: 409, run_not_active: 409, lbtag_taken: 409, rate_limited: 429, internal: 500,
  duelo_no_jugado: 403,
};

const MESSAGES: Record<ErrorCode, string> = {
  bad_request: 'El pedido vino mal armado.',
  bad_action: 'Esa jugada no existe.',
  unauthorized: 'Se te venció la sesión. Recargá la página para seguir.',
  not_found: 'No encontramos esa partida.',
  version_conflict: 'La partida avanzó en otra pestaña o con un doble clic. La actualizamos.',
  out_of_phase: 'Esa jugada no corresponde ahora.',
  run_not_active: 'Esta partida ya terminó.',
  lbtag_taken: 'Ese $LBtag ya lo tiene otra persona. Probá con otro.',
  rate_limited: 'Pará un cachito, vas muy rápido. Probá de nuevo en unos segundos.',
  internal: 'Se nos cayó algo del lado nuestro. Probá de nuevo.',
  duelo_no_jugado: 'Jugá el duelo primero: ver los resultados antes sería ventaja.',
};

export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? MESSAGES[code]);
    this.code = code;
    this.status = STATUS[code];
  }
  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}
