// Google Analytics 4 con Consent Mode v2, solo si hay Measurement ID (web/config.js) y la
// persona aceptó. Si rechaza o todavía no eligió, no se carga nada de Google.
// La lógica del juego llama a window.MagnateAnalytics.track(evento, params), que no hace
// nada sin ID, sin consentimiento o si gtag.js no cargó.
(() => {
  'use strict';
  const ID = ((window.MAGNATE_CONFIG || {}).gaMeasurementId || '').trim();
  const KEY = 'elmagnate.cookies'; // 'si' | 'no'
  // solo estos parámetros llegan a GA: nada de $LBtag, ids, código de duelo ni montos exactos
  const PARAMS = new Set(['es_duelo', 'final_key', 'quiebra', 'capital_rango', 'origen']);

  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch { /* sin storage: vale para esta visita */ } };
  let choice = read();
  let loaded = false;

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
    gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });
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
    if (!ID || choice !== 'si' || !loaded) return;
    const clean = {};
    for (const [k, v] of Object.entries(params || {})) {
      if (PARAMS.has(k) && v !== undefined && v !== null) clean[k] = v;
    }
    gtag('event', evento, clean);
  }

  // ---------- aviso de cookies ----------
  function banner() {
    const box = document.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Aviso de cookies');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:55;max-width:560px;margin:0 auto;'
      + 'display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:12px 14px;border-radius:14px;'
      + 'border:1px solid rgba(244,233,254,.16);background:#100a18;color:rgba(244,233,254,.82);'
      + "font-family:'Plus Jakarta Sans',sans-serif;font-size:13.5px;line-height:1.4;box-shadow:0 12px 32px rgba(0,0,0,.5);";
    const txt = document.createElement('span');
    txt.style.cssText = 'flex:1 1 220px;min-width:0;';
    txt.textContent = 'Usamos cookies para saber cuánta gente juega y de dónde llega. ¿Va?';
    const btn = (label, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'flex:none;padding:9px 14px;border-radius:10px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;'
        + (primary ? 'border:none;background:#73ffa1;color:#0d3320;'
                   : 'border:1px solid rgba(244,233,254,.2);background:transparent;color:rgba(244,233,254,.75);');
      return b;
    };
    const si = btn('Dale', true), no = btn('No, gracias', false);
    // mientras está el aviso, la página suma espacio abajo para no tapar botones del juego
    const pad = document.body.style.paddingBottom;
    const close = (v) => {
      choice = v;
      save(v);
      box.remove();
      document.body.style.paddingBottom = pad;
      if (v === 'si') load();
    };
    si.addEventListener('click', () => close('si'));
    no.addEventListener('click', () => close('no'));
    box.append(txt, no, si);
    document.body.appendChild(box);
    document.body.style.paddingBottom = (box.offsetHeight + 24) + 'px';
  }

  if (ID) {
    if (choice === 'si') load();
    else if (choice !== 'no') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
      else banner();
    }
  }

  window.MagnateAnalytics = { track, capitalRango };
})();
