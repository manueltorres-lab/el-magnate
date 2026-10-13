// Google Analytics 4: si hay Measurement ID (web/config.js), carga y mide desde que se abre
// la página, en cualquier pantalla o dispositivo. Sin aviso de cookies: la publicidad queda
// denegada (ad_storage, ad_user_data, ad_personalization) y Google no usa los datos para anuncios.
// La lógica del juego llama a window.MagnateAnalytics.track(evento, params), que no hace
// nada sin ID o si gtag.js no se configuró.
(() => {
  'use strict';
  const ID = ((window.MAGNATE_CONFIG || {}).gaMeasurementId || '').trim();
  // solo estos parámetros llegan a GA: nada de $LBtag, ids, código de duelo ni montos exactos
  const PARAMS = new Set(['es_duelo', 'final_key', 'quiebra', 'capital_rango', 'origen']);
  let loaded = false;

  // la elección del aviso de cookies que había antes ya no se usa: se borra
  try { localStorage.removeItem('elmagnate.cookies'); } catch { /* sin storage */ }

  // origen del tráfico: la URL y el referrer de llegada, sin el código de duelo
  const landing = (() => {
    try {
      const u = new URL(location.href);
      if (u.searchParams.has('duelo')) u.searchParams.set('duelo', '1');
      return { page_location: u.toString(), page_referrer: document.referrer || undefined };
    } catch { return {}; }
  })();

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function load() {
    if (loaded || !ID) return;
    loaded = true;
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    gtag('config', ID, landing);
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);
  }

  /** Capital en rangos: nunca el monto exacto. */
  function capitalRango(n) {
    if (!(n >= 0)) return undefined;
    if (n < 1e6) return '<1M';
    if (n < 15e6) return '1M-15M';
    if (n < 100e6) return '15M-100M';
    return '>100M';
  }

  function track(evento, params) {
    if (!ID || !loaded) return;
    const clean = {};
    for (const [k, v] of Object.entries(params || {})) {
      if (PARAMS.has(k) && v !== undefined && v !== null) clean[k] = v;
    }
    gtag('event', evento, clean);
  }

  load();

  window.MagnateAnalytics = { track, capitalRango };
})();
