// El Magnate: el front conectado al servidor. Reemplaza al <script data-dc-script> original:
// el template, los estilos y los textos son los mismos, pero acá no hay reglas del juego.
// Cada botón manda una acción ("elegí la opción 2") y se muestra lo que devuelve el server.
// Las cuentas de la pantalla (renderVals) son las del original, leyendo el `view` del server.
(() => {
  'use strict';
  const CFG = window.MAGNATE_CONFIG;
  const { TAG_LABEL, TITLES, RAREZA, ORDEN_COL, SLOT_SYMBOLS, RULETA, CALMA_BAJA, CALMA_ALTA } = window.MAGNATE_DATA;

  // el runtime del template pide React a unpkg: le damos las copias locales
  window.__resources = Object.assign(window.__resources || {}, {
    'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'vendor/react.production.min.js',
    'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'vendor/react-dom.production.min.js',
  });

  // ---------- presentación (igual que el original) ----------
  const SHOW_HOST = [
    'Bienvenido al sillón. Tres preguntas, y si fallás una, te vas con lo puesto.',
    'Segunda. El público ya se calló solo, mirá.',
    'Última. Acá se define si salís del estudio como el que sabía.',
  ];
  const SHOW_OK = ['El público estalla.', 'Aplauso cerrado en el estudio.', 'Se levantan de la silla.'];
  // Fase 4: estos rankings pasan a salir de GET /api/ranking
  const RANKING_HIST = [
    {tag:'elmudo.99', cap:1184000000}, {tag:'sofi.pereyra', cap:926000000}, {tag:'tincho', cap:871500000},
    {tag:'rocio.ok', cap:748000000}, {tag:'juanma.f', cap:639000000}, {tag:'eltano', cap:582000000},
    {tag:'la.colo', cap:510500000}, {tag:'nacho.dv', cap:447000000}, {tag:'m.ferrero', cap:396000000},
    {tag:'caro.b', cap:341500000}, {tag:'agus.tini', cap:298000000}, {tag:'flor.ok', cap:261000000},
    {tag:'vale.mm', cap:224000000},
  ];
  const RANKING_PLATA = [
    {tag:'tincho', cap:418000000}, {tag:'sofi.pereyra', cap:294000000}, {tag:'eltano', cap:162000000},
    {tag:'nacho.dv', cap:110500000}, {tag:'caro.b', cap:88000000}, {tag:'flor.ok', cap:74200000},
    {tag:'juanma', cap:61500000}, {tag:'m.ferrero', cap:49800000}, {tag:'seba.r', cap:44100000},
    {tag:'lu.gimenez', cap:38600000}, {tag:'agus.tini', cap:35200000}, {tag:'vale.mm', cap:31000000},
  ];
  const STAKE_LABELS = ['Poco', 'Medio', 'Fuerte'];
  const START_CAPITAL = 500000;
  const RULETA_COLOR = (m) => m === 0 ? '#4a1c28' : (m < 1 ? '#3a2b52' : (m >= 3 ? '#3fd47c' : '#2f7d52'));
  const fmt = (n) => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('es-AR');
  const cleanCode = (v) => { const c = String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12); return /^MGN-[A-Z0-9]{5}$/.test(c) ? c : null; };
  const smoothPath = (pts) => {
    if (pts.length < 2) return {line:'', area:''};
    let d = 'M' + pts[0].x.toFixed(2) + ',' + pts[0].y.toFixed(2);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
      const c1x = p1.x + (p2.x-p0.x)/6, c1y = p1.y + (p2.y-p0.y)/6;
      const c2x = p2.x - (p3.x-p1.x)/6, c2y = p2.y - (p3.y-p1.y)/6;
      d += 'C' + c1x.toFixed(2)+','+c1y.toFixed(2)+' '+c2x.toFixed(2)+','+c2y.toFixed(2)+' '+p2.x.toFixed(2)+','+p2.y.toFixed(2);
    }
    const last = pts[pts.length-1];
    return {line:d, area: d + 'L' + last.x.toFixed(2) + ',62L' + pts[0].x.toFixed(2) + ',62Z'};
  };

  // lo que se muestra antes de la primera partida (el template calcula todo aunque no se vea)
  const EMPTY_VIEW = {
    screen:'game', phase:'choose', round:0, rounds:12, capital:START_CAPITAL, startingCapital:START_CAPITAL,
    rep:50, calma:50, caps:[START_CAPITAL], history:[], income:0, yieldGain:0, yieldRate:0.06, streak:0,
    paciencia:0, paciencMax:0, pacienciaBonus:1, bonusPac:1, cuna:false, challenge:'', duelo:false,
    bigThreshold:15000000, positions:[], current:null, toast:null, evChoice:null, quiz:null, mini:null, final:null,
  };

  const store = {
    get: (s, k) => { try { return window[s].getItem(k); } catch { return null; } },
    set: (s, k, v) => { try { v == null ? window[s].removeItem(k) : window[s].setItem(k, v); } catch { /* sin storage */ } },
  };

  // ---------- sesión anónima (con Turnstile si el proyecto lo pide) ----------
  let sb = null;
  const supa = () => sb || (sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'elmagnate.sesion' },
  }));

  let turnstileLoad = null;
  function captchaToken() {
    if (!CFG.turnstileSiteKey) return Promise.resolve(undefined);
    turnstileLoad = turnstileLoad || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => { turnstileLoad = null; reject(new Error('turnstile')); };
      document.head.appendChild(s);
    });
    return turnstileLoad.then((ts) => new Promise((resolve, reject) => {
      // aparece solo si Cloudflare necesita que la persona toque algo
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:70;';
      document.body.appendChild(box);
      const done = (fn, v) => { setTimeout(() => box.remove(), 0); fn(v); };
      ts.render(box, {
        sitekey: CFG.turnstileSiteKey, appearance: 'interaction-only', theme: 'dark', language: 'es',
        callback: (t) => done(resolve, t),
        'error-callback': () => done(reject, new Error('captcha')),
        'expired-callback': () => done(reject, new Error('captcha')),
      });
    }));
  }

  let signingIn = null;
  async function accessToken() {
    const { data } = await supa().auth.getSession();
    if (data.session) return data.session.access_token;
    signingIn = signingIn || (async () => {
      try {
        const token = await captchaToken();
        const { data: d, error } = await supa().auth.signInAnonymously({ options: { captchaToken: token } });
        if (error || !d.session) throw new Error(error ? error.message : 'sin sesión');
        return d.session.access_token;
      } finally { signingIn = null; }
    })();
    try { return await signingIn; }
    catch { throw new ApiError('session', 'No pudimos abrirte una sesión. Revisá la conexión y probá de nuevo.', 0); }
  }

  // ---------- API ----------
  class ApiError extends Error {
    constructor(code, message, status) { super(message); this.code = code; this.status = status; }
  }
  async function api(method, path, body, retried) {
    const token = await accessToken();
    let res;
    try {
      res = await fetch(CFG.supabaseUrl + '/functions/v1/api' + path, {
        method,
        headers: Object.assign({ authorization: 'Bearer ' + token }, body ? { 'content-type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('network', 'Se cortó la conexión. Tu partida está a salvo.', 0);
    }
    const json = await res.json().catch(() => null);
    if (res.ok) return json;
    // sesión vencida o borrada: una sesión nueva y un reintento
    if (res.status === 401 && !retried) {
      await supa().auth.signOut().catch(() => {});
      return api(method, path, body, true);
    }
    const e = json && json.error;
    throw new ApiError(e && e.code || 'internal', e && e.message || 'Se nos cayó algo del lado nuestro. Probá de nuevo.', res.status);
  }

  // ---------- la lógica de la pantalla ----------
  window.MagnateLogic = (Base) => class extends Base {
    state = {
      screen:'start', name: store.get('sessionStorage', 'elmagnate.nombre') || '',
      runId:null, version:0, view:null, starting:false, net:null,
      anim:null, wheelAngle:0,
      tab:'carta', rankTab:'semanal', lbtag:'', tagSaved:false, unlocked:[], storyOpen:false,
      copied:false, dueloCopied:false, duelo:null,
    };
    busy = false;

    componentDidMount() {
      let local = [];
      try {
        const u = JSON.parse(store.get('localStorage', 'elmagnate.finales') || '[]');
        if (Array.isArray(u)) local = u.filter((k) => TITLES[k]);
      } catch { /* nada guardado */ }
      const localTag = store.get('localStorage', 'elmagnate.lbtag') || '';
      // la colección de antes (localStorage) se muestra, pero no cuenta para el ranking
      this.setState({ unlocked: local, lbtag: localTag });
      try {
        const d = cleanCode(new URLSearchParams(location.search).get('duelo'));
        if (d) this.setState({ duelo: d });
      } catch { /* sin query */ }
      this.booted = this.boot(localTag);
    }

    componentWillUnmount() { this.stopAnim(); }

    async boot(localTag) {
      try {
        const me = await api('GET', '/me');
        this.setState((s) => ({
          unlocked: [...new Set([...s.unlocked, ...me.unlocked])],
          lbtag: me.lbtag || localTag, tagSaved: !!me.lbtag,
        }));
        const runId = store.get('sessionStorage', 'elmagnate.run');
        if (runId) {
          const r = await api('GET', '/runs/' + runId).catch(() => null);
          if (r && r.status !== 'abandoned') this.applyRun(r);
          else store.set('sessionStorage', 'elmagnate.run', null);
        }
      } catch { /* sin red al cargar: se reintenta al empezar */ }
    }

    // ---------- partida ----------
    applyRun(r) {
      const finished = r.status === 'finished' || r.view.screen === 'result';
      const patch = { runId: r.runId || this.state.runId, version: r.version, view: r.view, screen: finished ? 'result' : 'game', net: null };
      if (finished && r.view.final) patch.unlocked = [...new Set([...this.state.unlocked, r.view.final.titleKey])];
      if (!r.view.mini) patch.wheelAngle = 0;
      this.setState(patch);
    }

    showError(e, retry) {
      this.setState({ net: { msg: e.message, retry: retry || null } });
    }

    start = async () => {
      if (this.busy) return;
      this.busy = true;
      this.setState({ starting: true, net: null });
      try {
        const r = await api('POST', '/runs', this.state.duelo ? { duelo: this.state.duelo } : {});
        store.set('sessionStorage', 'elmagnate.run', r.runId);
        this.setState({ tab:'carta', storyOpen:false, copied:false, wheelAngle:0 });
        this.applyRun(r);
      } catch (e) {
        this.showError(e, this.start);
      } finally {
        this.busy = false;
        this.setState({ starting: false });
      }
    };

    restart = () => this.setState({ screen:'start', net:null });

    /** Manda una acción y devuelve la respuesta sin aplicarla (las animaciones la aplican al final). */
    async send(action) {
      const { runId, version } = this.state;
      try {
        return await api('POST', '/runs/' + runId + '/actions', { version, action });
      } catch (e) {
        if (['version_conflict', 'out_of_phase', 'run_not_active'].includes(e.code)) {
          // doble clic, otra pestaña o una respuesta perdida: nos ponemos al día con el server
          const r = await api('GET', '/runs/' + runId).catch(() => null);
          if (r && r.status !== 'abandoned') { this.applyRun(r); return null; }
          if (r) { this.setState({ screen:'start' }); return null; }
        }
        this.showError(e, e.code === 'network' || e.code === 'internal' || e.code === 'rate_limited' || e.code === 'session'
          ? () => this.act(action) : null);
        return null;
      }
    }

    act = async (action) => {
      if (this.busy || this.state.anim) return;
      this.busy = true;
      this.setState({ net: null });
      try {
        const r = await this.send(action);
        if (r) this.applyRun(r);
      } finally { this.busy = false; }
    };

    stopAnim() {
      if (this._tick) clearInterval(this._tick);
      this._tick = null;
      (this._timers || []).forEach(clearTimeout);
      this._timers = [];
    }

    // tragamonedas: los rodillos giran al tocar y frenan en lo que devolvió el server
    spin = async () => {
      if (this.busy || this.state.anim) return;
      this.busy = true;
      this.setState({ net: null, anim: { kind:'slots', tick:0, locked:0, reels:null } });
      const t0 = Date.now();
      this._tick = setInterval(() => {
        const a = this.state.anim;
        if (a) this.setState({ anim: { ...a, tick: a.tick + 1 } });
      }, 90);
      const r = await this.send({ type: 'slotsSpin' });
      if (!r || !r.view.mini || !r.view.mini.reels) {
        this.stopAnim(); this.setState({ anim: null }); this.busy = false; return;
      }
      const reels = r.view.mini.reels;
      const since = Date.now() - t0;
      this._timers = [640, 1000, 1360].map((t, i) => setTimeout(() => {
        const a = this.state.anim;
        if (a) this.setState({ anim: { ...a, reels, locked: i + 1 } });
      }, Math.max(0, t - since)));
      this._timers.push(setTimeout(() => {
        this.stopAnim();
        this.setState({ anim: null });
        this.applyRun(r);
        this.busy = false;
      }, Math.max(260, 1620 - since)));
    };

    // ruleta: arranca al tocar, y la rueda frena en el sector que eligió el server
    girarRuleta = async () => {
      if (this.busy || this.state.anim) return;
      this.busy = true;
      const base = this.state.wheelAngle || 0;
      this.setState({ net: null, anim: { kind:'ruleta', angle: base } });
      const r = await this.send({ type: 'ruletaSpin' });
      if (!r || !r.view.mini || r.view.mini.sector == null) {
        this.setState({ anim: null }); this.busy = false; return;
      }
      const i = r.view.mini.sector, seg = 360 / RULETA.length;
      const angle = base + (360 - (base % 360)) + 360*4 + (360 - i*seg - seg/2);
      this.setState({ anim: { kind:'ruleta', angle } });
      this._timers = [setTimeout(() => {
        this.setState({ anim: null, wheelAngle: angle });
        this.applyRun(r);
        this.busy = false;
      }, 2650)];
    };

    // ---------- $LBtag, compartir, duelo ----------
    saveTag = async () => {
      const t = this.state.lbtag.trim().replace(/^\$+/, '');
      if (!t || this.busy) return;
      this.busy = true;
      try {
        const r = await api('PUT', '/me/lbtag', { lbtag: t });
        store.set('localStorage', 'elmagnate.lbtag', r.lbtag);
        this.setState({ lbtag: r.lbtag, tagSaved: true, net: null });
      } catch (e) {
        this.showError(e, e.code === 'network' ? this.saveTag : null);
      } finally { this.busy = false; }
    };

    dueloUrl() {
      const code = this.view().challenge;
      try {
        const u = new URL(location.href);
        u.search = '?duelo=' + code;
        u.hash = '';
        return u.toString();
      } catch { return 'lb.finanzas/magnate?duelo=' + code; }
    }

    copyDuelo = () => {
      try { navigator.clipboard.writeText(this.dueloUrl()); } catch { /* sin portapapeles */ }
      this.setState({ dueloCopied: true });
      setTimeout(() => this.setState({ dueloCopied: false }), 2200);
    };

    copyShare = () => {
      try { navigator.clipboard.writeText(this.shareText()); } catch { /* sin portapapeles */ }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2200);
    };

    shareText() {
      const f = this.view().final;
      if (!f) return '';
      return 'Me salió "' + f.title + '" ' + f.icon + '\nSolo el ' + String(f.rareza).replace('.', ',')
        + '% de los jugadores termina acá.\n¿Vos qué tan lejos llegás?\n\nEl Magnate · el simulador de LB Finanzas';
    }

    view() { return this.state.view || EMPTY_VIEW; }

    // ---------- lo que ve el template (misma forma que el original) ----------
    renderVals() {
      const s = this.state, v = this.view(), R = v.rounds;
      const GREEN = '#73ffa1', RED = '#ff8a9b', DIM = 'rgba(244,233,254,.7)';
      const age = 18 + v.round*2;
      const act = (action) => () => this.act(action);

      const dots = [];
      for (let i = 0; i < R; i++) {
        const bg = i < v.round ? GREEN : (i === v.round ? '#fbfafd' : 'rgba(244,233,254,.16)');
        dots.push({style:'flex:1;height:4px;border-radius:99px;background:'+bg+';'});
      }

      let caps = [...v.caps, v.capital];
      if (caps.length < 2) caps = [v.capital, v.capital];
      const mx = Math.max(...caps), mn = Math.min(...caps);
      const span = Math.max(1, mx - mn);
      const spark = smoothPath(caps.map((c, i) => ({ x: (i/(caps.length-1))*100, y: 54 - ((c-mn)/span)*44 })));

      const meters = [
        {label:'REPUTACIÓN', value:String(v.rep), hasExtra:(v.rep >= 60 || v.rep <= 40),
          hint: v.rep >= 60 ? 'Suma +'+((v.rep-50)/2.5).toFixed(0)+'% a cada ganancia que hagas' : (v.rep <= 40 ? 'Te resta '+Math.abs(((v.rep-50)/2.5)).toFixed(0)+'% de cada ganancia que hagas' : 'Todavía no mueve la aguja'),
          extra: (v.rep >= 60 || v.rep <= 40) ? 'Con esta reputación entrás a las grandes ligas al llegar a ' + fmt(v.bigThreshold) + ' de capital.' : '',
          hintColor: v.rep >= 60 ? GREEN : (v.rep <= 40 ? RED : 'rgba(244,233,254,.62)'),
          barStyle:'display:block;height:100%;width:'+v.rep+'%;background:#8555ff;border-radius:99px;'},
        {label:'CABEZA', value:String(v.calma), hasExtra:false,
          hint: v.calma < CALMA_BAJA ? (v.calma < 25 ? 'Quemado: pérdidas 30% más duras y aparecen jugadas desesperadas' : 'Al límite: ya aparecen jugadas desesperadas') : (v.calma > CALMA_ALTA ? 'Cabeza fría: cortás pérdidas, rendís +2% y ves jugadas finas' : 'Todavía no mueve la aguja'),
          extra: '',
          hintColor: v.calma < CALMA_BAJA ? RED : (v.calma > CALMA_ALTA ? GREEN : 'rgba(244,233,254,.62)'),
          barStyle:'display:block;height:100%;width:'+v.calma+'%;background:'+(v.calma<30?RED:GREEN)+';border-radius:99px;'},
      ];

      const pico = Math.max(v.capital, ...(v.caps.length ? v.caps : [v.capital]));
      const caida = pico > 0 ? 1 - v.capital/pico : 0;
      const nivelAlerta = (v.capital < 400000 || caida >= 0.7) ? 2 : (caida >= 0.45 ? 1 : 0);
      const alerta = {
        show: nivelAlerta > 0 && s.screen === 'game',
        title: nivelAlerta === 2 ? 'Estás al borde de fundirte' : 'Venís en caída',
        body: nivelAlerta === 2
          ? 'Con este capital, una jugada de riesgo alto te deja afuera. Si tocás el piso, la partida se termina acá.'
          : 'Perdiste ' + Math.round(caida*100) + '% desde tu mejor momento. Todavía se puede dar vuelta.',
        panelStyle: 'border:1px solid ' + (nivelAlerta===2 ? 'rgba(255,138,155,.55)' : 'rgba(255,196,120,.42)')
          + ';border-radius:16px;background:' + (nivelAlerta===2 ? 'rgba(255,138,155,.12)' : 'rgba(255,196,120,.09)')
          + ';padding:15px 17px;' + (nivelAlerta===2 ? 'animation:mgAlert 1.8s ease-in-out infinite;' : ''),
        titleColor: nivelAlerta===2 ? '#ff8a9b' : '#ffc478',
        icon: nivelAlerta===2 ? '🚨' : '⚠️',
      };
      const positions = v.positions.map((p) => ({ text: (TAG_LABEL[p.tag] || p.tag) + ' ×' + p.n }));

      const recent = [...v.history].slice(-4).reverse().map((h) => ({
        icon:h.icon, label:h.label, delta:fmt(h.delta), color: h.delta>=0 ? GREEN : RED}));

      const sc = v.current || {icon:'', eyebrow:'', text:'', detail:'', options:[]};
      const options = sc.options.map((o, i) => ({
        label:o.label, desc:o.desc, icon:o.icon,
        isBaja:o.risk==='baja', isMedia:o.risk==='media', isAlta:o.risk==='alta',
        isExtra: !!o.extra,
        extraLabel: o.extra==='ahogado' ? 'MANOTAZO DE AHOGADO · TU CABEZA ESTÁ QUEMADA' : 'JUGADA FINA · SOLO CON LA CABEZA CLARA',
        extraStyle: 'font-family:\'Plus Jakarta Sans\',sans-serif;font-variant-numeric:tabular-nums;font-size:10px;font-weight:700;letter-spacing:.1em;padding:4px 9px;border-radius:6px;'
          + (o.extra==='ahogado' ? 'background:rgba(255,138,155,.2);color:#ff8a9b;border:1px solid rgba(255,138,155,.45);'
                                 : 'background:rgba(115,255,161,.16);color:#73ffa1;border:1px solid rgba(115,255,161,.45);'),
        borderStyle: o.extra==='ahogado' ? 'rgba(255,138,155,.5)' : (o.extra==='fina' ? 'rgba(115,255,161,.5)' : 'rgba(244,233,254,.14)'),
        stakeLabel: (o.spend ? 'Gastás ' : 'Comprometés ') + fmt(o.stake),
        puedeFundir: o.puedeFundir,
        pick: act({ type:'pick', option:i }),
      }));

      const ev = v.evChoice || {icon:'', eyebrow:'', text:'', detail:'', options:[]};
      const evOptions = ev.options.map((o, i) => ({
        label:o.label, desc:o.desc, icon:o.icon, pick: act({ type:'eventPick', option:i })}));

      const t = v.toast;
      const toastMeters = [];
      if (t) {
        if (t.rep) toastMeters.push({text:(t.rep>0?'+':'')+t.rep+' reputación', color: t.rep>0?GREEN:RED});
        if (t.calma) toastMeters.push({text:(t.calma>0?'+':'')+t.calma+' cabeza', color: t.calma>0?GREEN:RED});
      }
      const toast = t ? {
        label:t.label, amount:t.amount, note:t.note, color: t.pos ? GREEN : RED,
        meters:toastMeters, hasMeters: toastMeters.length>0,
        hasEvent: !!t.evFired, evIcon: t.evFired ? t.evFired.icon : '',
        evText: t.evFired ? t.evFired.text : '', evAmount: t.evDelta!=null ? fmt(t.evDelta) : '',
        evColor: (t.evDelta||0) >= 0 ? GREEN : RED,
        vieneShow: t.vieneShow,
        ctaLabel: t.vieneShow ? 'Entrar al estudio' : 'Continuar',
      } : {label:'', amount:'', note:'', color:DIM, meters:[], hasMeters:false, hasEvent:false, evIcon:'', evText:'', evAmount:'', evColor:GREEN, vieneShow:false, ctaLabel:'Continuar'};

      const mg = v.mini;
      const an = s.anim;
      const kind = mg ? mg.kind : 'slots';
      const done = !!(mg && mg.done);
      const BTN_MAIN = 'flex:1 1 140px;padding:17px 16px;border-radius:14px;border:1px solid rgba(203,180,255,.5);background:rgba(133,85,255,.26);color:#fbfafd;font-size:16.5px;font-weight:700;cursor:pointer;';
      const BTN_ALT = 'flex:1 1 140px;padding:17px 16px;border-radius:14px;border:1px solid rgba(115,255,161,.45);background:rgba(115,255,161,.12);color:#73ffa1;font-size:16.5px;font-weight:700;cursor:pointer;';
      const META = {
        slots:{icon:'🎰', chip:'LA TIMBA', title:'Tragamonedas rápido', stakeLabel:'POZO EN JUEGO'},
        doble:{icon:'🎲', chip:'DOBLE O NADA', title:'Doble o nada', stakeLabel:'APUESTA INICIAL'},
        sobres:{icon:'✉️', chip:'TRES SOBRES', title:'Elegí un sobre', stakeLabel:'EN JUEGO'},
        ruleta:{icon:'🎡', chip:'LA RULETA', title:'La ruleta', stakeLabel:'POZO EN JUEGO'},
        blackjack:{icon:'🃏', chip:'MESA DE BLACKJACK', title:'Blackjack', stakeLabel:'APOSTADO'},
      }[kind];

      const stakeStage = !!(mg && mg.phase === 'stake');
      const BTN_GHOST = 'flex:1 1 100%;padding:15px 16px;border-radius:14px;border:1px solid rgba(244,233,254,.18);background:rgba(0,0,0,.2);color:rgba(244,233,254,.75);font-size:15.5px;font-weight:600;cursor:pointer;';

      let miniNote = '';
      if (kind==='slots') miniNote = done ? (mg.delta>0 ? 'Salió algo. Guardá el momento.' : 'No hubo suerte esta vez.')
        : 'Tres iguales pagan 6×, dos iguales devuelven 0,8×, y si no sale nada se va el pozo.';
      if (kind==='doble') miniNote = done ? (mg.bust ? 'Se fue todo. Así es el doble o nada.' : 'Te retiraste a tiempo. Sabio.')
        : 'Cada vez que doblás, la mitad de las veces se duplica y la otra mitad se va todo. Podés retirarte cuando quieras (máximo 4 veces).';
      if (kind==='sobres') miniNote = done ? 'Ya está, lo que había había.'
        : 'Uno paga 1,8×, uno te devuelve casi todo y uno se lleva el pozo entero.';
      if (kind==='ruleta') miniNote = done ? (mg.delta>0 ? 'Salió redonda.' : 'La ruleta no perdona.')
        : 'Ocho sectores: uno paga ×3, otros pagan ×2, ×1,5 o ×0,5, y tres se llevan el pozo.';
      if (kind==='blackjack') miniNote = done ? (mg.resultado || '')
        : 'Llegar a 21 sin pasarte. La banca pide carta hasta 17. Es la timba con mejores chances del juego.';
      if (stakeStage) miniNote += ' Vos decidís cuánto ponés — o no jugás y seguís de largo.';

      const actions = [];
      if (stakeStage) {
        mg.stakeOptions.forEach((o, i) => {
          actions.push({label: STAKE_LABELS[i] + ' · ' + fmt(o.amount), run: act({ type:'miniStake', frac:o.frac }), style:BTN_MAIN});
        });
        actions.push({label:'No juego, sigo de largo', run: act({ type:'miniSkip' }), style:BTN_GHOST});
      }
      const spinning = !!an;
      if (!done && !stakeStage && !spinning && kind==='slots') actions.push({label:'Girar', run:this.spin, style:BTN_MAIN});
      if (!done && !stakeStage && !spinning && kind==='ruleta') actions.push({label:'Girar la ruleta', run:this.girarRuleta, style:BTN_MAIN});
      if (!done && !stakeStage && kind==='blackjack' && mg && !mg.stood) {
        actions.push({label:'Pedir carta', run: act({ type:'bjHit' }), style:BTN_MAIN});
        actions.push({label:'Plantarme en ' + mg.playerVal, run: act({ type:'bjStand' }), style:BTN_ALT});
      }
      if (!done && !stakeStage && kind==='doble') {
        actions.push({label:'Doblar', run: act({ type:'dobleDouble' }), style:BTN_MAIN});
        actions.push({label:'Retirar ' + fmt(mg ? mg.pot : 0), run: act({ type:'dobleCashout' }), style:BTN_ALT});
      }

      const seg = 360/RULETA.length;
      const wheelStops = RULETA.map((r, i) => RULETA_COLOR(r.mult)+' '+(i*seg)+'deg '+((i+1)*seg)+'deg').join(',');
      const angle = an && an.kind === 'ruleta' ? an.angle : s.wheelAngle;
      const cardColor = (c) => (c.s==='♥'||c.s==='♦' ? '#c02742' : '#1a1125');
      const mini = {
        isSlots: kind==='slots' && !stakeStage, isDoble: kind==='doble' && !stakeStage,
        isSobres: kind==='sobres' && !stakeStage, isRuleta: kind==='ruleta' && !stakeStage,
        isBJ: kind==='blackjack' && !stakeStage,
        bjPlayerVal: mg && mg.playerVal != null ? String(mg.playerVal) : '—',
        bjDealerVal: mg && mg.dealerVal != null ? (mg.dealerHidden ? String(mg.dealerVal) + ' + ?' : String(mg.dealerVal)) : '—',
        bjPlayer: (mg ? mg.player : []).map((c) => ({
          text: c.r + c.s,
          style:'display:grid;place-items:center;min-width:44px;height:62px;padding:0 8px;border-radius:9px;background:#f4f1fa;color:'
            + cardColor(c)
            + ';font-family:\'Plus Jakarta Sans\',sans-serif;font-variant-numeric:tabular-nums;font-weight:800;font-size:17px;animation:mgPop .3s ease;',
        })),
        bjDealer: (mg ? mg.dealer : []).map((c) => {
          const oculta = !!c.hidden;
          return {
            text: oculta ? '?' : c.r + c.s,
            style:'display:grid;place-items:center;min-width:44px;height:62px;padding:0 8px;border-radius:9px;background:'
              + (oculta ? 'rgba(133,85,255,.3)' : '#f4f1fa') + ';color:'
              + (oculta ? '#cbb4ff' : cardColor(c))
              + ';font-family:\'Plus Jakarta Sans\',sans-serif;font-variant-numeric:tabular-nums;font-weight:800;font-size:17px;'
              + (oculta ? 'border:1px dashed rgba(203,180,255,.55);' : 'animation:mgPop .3s ease;'),
          };
        }),
        spinning,
        wheelStyle: 'position:absolute;inset:0;border-radius:50%;border:3px solid rgba(244,233,254,.2);'
          + 'background:conic-gradient(' + wheelStops + ');'
          + 'transition:transform 2.6s cubic-bezier(.16,.84,.26,1);'
          + 'transform:rotate(' + angle + 'deg);',
        wheelText: done && mg.sector != null ? RULETA[mg.sector].label : (spinning ? '···' : '🎡'),
        wheelTextColor: done && mg.sector != null && RULETA[mg.sector].mult > 1 ? GREEN
          : (done && mg.sector != null && RULETA[mg.sector].mult === 0 ? RED : '#fbfafd'),
        ruletaLegend: [['×3','#3fd47c'],['×2 · ×1,5','#2f7d52'],['×0,5','#3a2b52'],['Nada','#4a1c28']].map(([tx, c]) => ({
          text:tx, style:'display:inline-flex;align-items:center;gap:6px;font-family:\'Plus Jakarta Sans\',sans-serif;font-variant-numeric:tabular-nums;font-size:11.5px;color:rgba(244,233,254,.62);',
          dot:'width:9px;height:9px;border-radius:3px;background:'+c+';display:inline-block;',
        })),
        chipIcon: META.icon, chipText: META.chip, title: META.title, note: miniNote,
        stakeLabel: stakeStage ? 'TU CAPITAL' : META.stakeLabel,
        stakeValue: fmt(stakeStage ? v.capital : (mg ? mg.stake : 0)),
        done, showActions: actions.length>0, actions,
        deltaLabel: fmt(mg ? mg.delta : 0), color: mg && mg.delta>=0 ? GREEN : RED,
        potLabel: fmt(mg ? mg.pot : 0),
        steps: [0,1,2,3].map((i) => ({
          style:'width:26px;height:4px;border-radius:99px;background:' + (mg && i < mg.step ? GREEN : 'rgba(244,233,254,.16)') + ';',
        })),
        reels: (an && an.kind === 'slots' ? (an.reels || ['❔','❔','❔']) : (mg && mg.reels ? mg.reels : ['❔','❔','❔'])).map((sym, i) => {
          const girando = !!(an && an.kind === 'slots') && an.locked <= i;
          const shown = girando ? SLOT_SYMBOLS[((an.tick + i*2) % SLOT_SYMBOLS.length)] : sym;
          return {
            symbol: shown,
            style:'display:grid;place-items:center;width:clamp(58px,18vw,76px);height:clamp(58px,18vw,76px);border-radius:14px;border:1px solid '
              + (girando ? 'rgba(203,180,255,.45)' : 'rgba(244,233,254,.16)')
              + ';background:rgba(0,0,0,.32);font-size:clamp(28px,8vw,34px);'
              + (girando ? 'animation:mgReel .18s linear infinite;' : (done ? 'animation:mgPop .35s ease;' : '')),
          };
        }),
        sobres: (mg && mg.outcomes ? mg.outcomes : [0,0,0]).map((val, i) => {
          const isChosen = mg && mg.chosen === i;
          const border = done ? (isChosen ? (val>=0 ? 'rgba(115,255,161,.7)' : 'rgba(255,138,155,.7)') : 'rgba(244,233,254,.1)') : 'rgba(244,233,254,.16)';
          return {
            face: done ? (val < 0 ? '💸' : (val > mg.stake ? '🤑' : '🙂')) : '✉️',
            label: done ? fmt(val) : '',
            color: val>=0 ? GREEN : RED,
            pick: done ? () => {} : act({ type:'sobreOpen', index:i }),
            style:'display:block;text-align:center;padding:18px 8px;border-radius:14px;border:1px solid '+border
              +';background:rgba(0,0,0,'+(done && !isChosen ? '.16' : '.32')+');color:#fbfafd;cursor:'+(done?'default':'pointer')
              +';opacity:'+(done && !isChosen ? '.5' : '1')+';transition:border-color .14s,opacity .2s;'
              + (done && isChosen ? 'animation:mgPop .35s ease;' : ''),
          };
        }),
      };

      const q = v.quiz;
      const qAnswered = !!(q && q.picked != null);
      const qOk = !!(qAnswered && q.picked === q.ok);
      const quiz = {
        question: q ? q.q : '',
        answered: qAnswered,
        hostLine: q ? SHOW_HOST[q.idx] : '',
        stepLabel: q ? 'PREGUNTA ' + (q.idx + 1) + ' DE ' + q.total : '',
        potLabel: q ? fmt(q.won ? q.pot + Math.round(q.base * 0.05) : q.pot) : '',
        potVisible: !!(q && q.pot > 0),
        potCaption: q && q.over ? 'Perdiste' : (q && q.won ? 'Te llevás' : 'Pozo en juego'),
        potColor: q && q.over ? RED : '#ffd666',
        ladder: (q ? q.ladder : []).map((monto, i) => {
          const hecho = q.idx > i || (q.idx === i && qAnswered && qOk);
          const here = q.idx === i && !hecho;
          return {
            label: 'P' + (i+1), amount: fmt(monto),
            style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 13px;border-radius:10px;border:1px solid '
              + (hecho ? 'rgba(115,255,161,.5)' : (here ? 'rgba(255,214,102,.6)' : 'rgba(244,233,254,.1)'))
              + ';background:' + (hecho ? 'rgba(115,255,161,.12)' : (here ? 'rgba(255,214,102,.13)' : 'rgba(0,0,0,.22)'))
              + ';color:' + (hecho ? '#73ffa1' : (here ? '#ffd666' : 'rgba(244,233,254,.42)'))
              + ";font-family:'Plus Jakarta Sans',sans-serif;font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:700;",
          };
        }),
        resultTitle: qAnswered ? (qOk ? (q.won ? '¡Se llevó las tres!' : 'Correcta') : 'Incorrecta') : '',
        resultNote: qAnswered
          ? (qOk
              ? (q.won
                  ? 'Tres al hilo. Te llevás ' + fmt(q.pot + Math.round(q.base*0.05)) + ' con el premio del estudio incluido, +6 de reputación.'
                  : SHOW_OK[q.idx] + ' Acumulás ' + fmt(q.pot) + ', pero todavía no es tuyo.')
              : (q.pot > 0
                  ? 'Se terminó acá. Perdés los ' + fmt(q.pot) + ' que venías acumulando y te vas con un 7% menos de capital.'
                  : 'Te fuiste en la primera. Te vas del estudio con un 7% menos de capital.'))
          : '',
        why: qAnswered ? (q.why || '') : '',
        resultColor: qOk ? GREEN : RED,
        nextLabel: qAnswered ? (qOk && !q.won ? 'Siguiente pregunta' : 'Salir del estudio') : '',
        onNext: act({ type: qAnswered && qOk && !q.won ? 'quizNext' : 'quizClose' }),
        opts: (q ? q.opts : []).map((tx, i) => {
          const esOk = qAnswered && i === q.ok, elegida = q && q.picked === i;
          const borde = !qAnswered ? 'rgba(244,233,254,.14)'
            : (esOk ? 'rgba(115,255,161,.65)' : (elegida ? 'rgba(255,138,155,.6)' : 'rgba(244,233,254,.08)'));
          return {
            text: tx,
            letter: ['A','B','C','D'][i],
            mark: qAnswered ? (esOk ? '✓' : (elegida ? '✕' : '')) : '',
            markColor: esOk ? GREEN : RED,
            style:'display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;text-align:left;width:100%;background:'
              + (qAnswered && esOk ? 'rgba(115,255,161,.1)' : 'rgba(10,6,16,.72)') + ';border:1px solid ' + borde
              + ";border-radius:13px;padding:15px 16px;color:#fbfafd;font-family:'Plus Jakarta Sans',sans-serif;font-size:15.5px;font-weight:600;line-height:1.35;cursor:"
              + (qAnswered ? 'default' : 'pointer') + ';opacity:' + (qAnswered && !esOk && !elegida ? '.5' : '1') + ';transition:border-color .14s;',
            letterStyle: 'display:grid;place-items:center;width:26px;height:26px;border-radius:50%;border:1px solid '
              + (qAnswered && esOk ? 'rgba(115,255,161,.55)' : 'rgba(244,233,254,.2)')
              + ';font-size:12px;font-weight:700;color:' + (qAnswered && esOk ? '#73ffa1' : 'rgba(244,233,254,.55)') + ';',
            pick: qAnswered ? () => {} : act({ type:'quizAnswer', option:i }),
          };
        }),
      };
      const view = {
        isToast: v.phase === 'toast',
        isQuiz: v.phase === 'quiz',
        isMini: v.phase === 'mini',
        isChoice: v.phase === 'eventChoice',
        isScenario: v.phase === 'choose',
      };

      const f = v.final;
      const tKey = f ? f.titleKey : null;
      const rareza = f ? f.rareza : 0;
      const deltas = v.history.map((h) => h.delta);
      const best = deltas.length ? Math.max(...deltas) : 0;
      const worst = deltas.length ? Math.min(...deltas) : 0;
      const finalStats = [
        {value:String(v.history.length), label:'DECISIONES', color:'#fbfafd'},
        {value:String(f ? f.jugadasRiesgo : 0), label:'JUGADAS DE RIESGO', color:'#fbfafd'},
        {value:fmt(best), label:'MEJOR JUGADA', color:GREEN},
        {value:fmt(worst), label:'PEOR JUGADA', color:RED},
      ];
      const fullPath = v.history.map((h) => ({
        age:String(18 + h.round*2), icon:h.icon, label:h.label,
        delta:fmt(h.delta), color: h.delta>=0 ? GREEN : RED}));
      const ranking = (base) => {
        const mios = s.tagSaved && s.lbtag.trim() && s.screen==='result'
          ? [{tag:s.lbtag.trim(), cap:v.capital, mine:true}] : [];
        return [...base, ...mios].sort((a, b) => b.cap - a.cap).slice(0, 13).map((r, i) => ({
          pos: String(i+1).padStart(2, '0'), tag: '$' + r.tag, amount: fmt(r.cap),
          rowStyle:'display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;padding:12px 16px;border-top:1px solid rgba(244,233,254,.08);'
            + (r.mine ? 'background:rgba(115,255,161,.09);' : ''),
          tagColor: r.mine ? '#73ffa1' : 'rgba(244,233,254,.82)',
          tagWeight: r.mine ? '700' : '500',
        }));
      };
      const shareText = this.shareText();

      return {
        isStart: s.screen==='start', isGame: s.screen==='game', isResult: s.screen==='result',
        playerName: s.name,
        onName: (e) => { store.set('sessionStorage', 'elmagnate.nombre', e.target.value); this.setState({name:e.target.value}); },
        onStart: this.start, onRestart: this.restart, onContinue: act({ type:'continue' }),
        onFinishMini: act({ type:'miniFinish' }),
        startLabel: s.starting ? 'Preparando la partida…' : 'Empezar la partida',
        net: { show: !!s.net, msg: s.net ? s.net.msg : '', hasRetry: !!(s.net && s.net.retry),
          retry: () => { const r = s.net && s.net.retry; this.setState({ net:null }); if (r) r(); } },
        startCapLabel: fmt(START_CAPITAL),
        capitalLabel: fmt(v.capital), ageLabel: age + ' años', roundLabel: (v.round+1) + '/' + R,
        incomeLabel: fmt(v.income).replace('$', ''),
        yieldLabel: fmt(v.yieldGain).replace('$', '') + ' · ' + (v.yieldRate*100).toFixed(1).replace('.', ',') + '%', hasYield: v.yieldGain > 0,
        streakLabel: 'RACHA ×' + (v.streak >= 2 ? '1,6' : '1'), hasStreak: v.streak >= 2,
        pacLabel: 'PACIENCIA ' + v.paciencia + (v.paciencia >= 4 ? ' · ×' + v.pacienciaBonus.toFixed(2).replace('.', ',') + ' al cierre' : ''),
        hasPac: v.paciencia >= 2,
        pacStyle: 'display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:99px;border:1px solid '
          + (v.paciencia >= 4 ? 'rgba(115,255,161,.45)' : 'rgba(244,233,254,.16)')
          + ';background:' + (v.paciencia >= 4 ? 'rgba(115,255,161,.12)' : 'rgba(0,0,0,.25)')
          + ';font-family:\'Plus Jakarta Sans\',sans-serif;font-variant-numeric:tabular-nums;font-size:10px;font-weight:700;letter-spacing:.1em;color:'
          + (v.paciencia >= 4 ? '#73ffa1' : 'rgba(244,233,254,.6)') + ';',
        bonusPacShow: v.bonusPac > 1,
        bonusPacLabel: '×' + String(v.bonusPac).replace('.', ','),
        bonusPacNote: 'Aguantaste ' + v.paciencMax + ' rondas seguidas sin perder plata. Eso multiplicó tu capital final.',
        quiz,
        rankSemanal: s.rankTab!=='historico', rankHistorico: s.rankTab==='historico',
        rankTabs: [['semanal','Semanal'],['historico','Histórico']].map(([id, label]) => ({
          label, style:'flex:1 1 auto;padding:10px 14px;border-radius:10px;border:1px solid '
            + (s.rankTab===id ? 'rgba(115,255,161,.5)' : 'rgba(244,233,254,.14)')
            + ';background:' + (s.rankTab===id ? 'rgba(115,255,161,.12)' : 'transparent')
            + ';color:' + (s.rankTab===id ? '#73ffa1' : 'rgba(244,233,254,.6)')
            + ';font-family:\'Plus Jakarta Sans\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;',
          go: () => this.setState({rankTab:id}),
        })),
        rankingHist: ranking(RANKING_HIST),
        rankingPlata: ranking(RANKING_PLATA),
        dots, spark, meters, positions, hasPositions: positions.length>0,
        alerta, cunaBanner: !!v.cuna,
        recent, hasMoves: recent.length>0,
        sc, options, ev, evOptions, toast, mini, view,
        tab:s.tab, tabCarta:s.tab==='carta', tabRanking:s.tab==='ranking', tabColeccion:s.tab==='coleccion',
        tabs: [['carta','Tu carta'],['ranking','Ranking'],['coleccion','Colección']].map(([id, label]) => ({
          label, style:'flex:1 1 auto;padding:11px 16px;border-radius:11px;border:1px solid '
            + (s.tab===id ? 'rgba(115,255,161,.5)' : 'rgba(244,233,254,.14)')
            + ';background:' + (s.tab===id ? 'rgba(115,255,161,.13)' : 'transparent')
            + ';color:' + (s.tab===id ? '#73ffa1' : 'rgba(244,233,254,.6)')
            + ';font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:700;cursor:pointer;',
          go: () => this.setState({tab:id}),
        })),
        rarezaPct: String(rareza).replace('.', ','),
        rarezaBar: 'display:block;height:100%;width:' + Math.max(2, Math.min(100, rareza*2.2)) + '%;background:#73ffa1;border-radius:99px;',
        rarezaNote: rareza <= 1 ? 'Uno de los finales más raros del juego.'
          : (rareza <= 5 ? 'Un final poco común.' : 'Un final de los frecuentes. Hay 18 más.'),
        lbtag: s.lbtag, tagSaved: s.tagSaved, tagPending: !s.tagSaved, hasTag: !!(s.tagSaved && s.lbtag.trim()),
        tagLabel: s.lbtag.trim() ? '$' + s.lbtag.trim() : '',
        onTag: (e) => this.setState({lbtag: e.target.value.replace(/[^a-zA-Z0-9._]/g, '').slice(0, 20)}),
        onSaveTag: this.saveTag,
        onEditTag: () => this.setState({tagSaved:false}),
        shareCopy: shareText,
        redes: (() => {
          const txt = encodeURIComponent(shareText);
          const url = encodeURIComponent('https://lbfinanzas.com/descargar-app');
          return [
            {label:'WhatsApp', icon:'💬', href:'https://wa.me/?text=' + txt, note:''},
            {label:'X', icon:'𝕏', href:'https://twitter.com/intent/tweet?text=' + txt, note:''},
            {label:'Telegram', icon:'✈️', href:'https://t.me/share/url?url=' + url + '&text=' + txt, note:''},
            {label:'Instagram', icon:'📸', href:'', note:'Bajá la carta y subila a tu historia', story:true},
          ].map((r) => ({...r,
            isLink: !r.story,
            style:'flex:1 1 126px;display:flex;align-items:center;justify-content:center;gap:7px;padding:13px 12px;border-radius:12px;border:1px solid rgba(244,233,254,.16);background:rgba(0,0,0,.26);color:#fbfafd;font-family:\'Plus Jakarta Sans\',sans-serif;font-size:14px;font-weight:700;text-decoration:none;cursor:pointer;',
            go: r.story ? (() => this.setState({storyOpen:true})) : (() => {}),
          }));
        })(),
        onCopy: this.copyShare, copied: s.copied,
        copyLabel: s.copied ? '¡Copiado!' : 'Copiar el texto',
        challenge: v.challenge,
        challengeLink: this.dueloUrl(),
        dueloCopyLabel: s.dueloCopied ? '¡Copiado!' : 'Copiar link',
        onCopyDuelo: this.copyDuelo,
        // el aviso de duelo sale en la pantalla de inicio: viene del link (?duelo=)
        esDuelo: !!s.duelo, dueloCode: s.duelo || '',
        onStory: () => this.setState({storyOpen:true}),
        onCloseStory: () => this.setState({storyOpen:false}),
        stopStory: (e) => { if (e && e.stopPropagation) e.stopPropagation(); },
        storyOpen: s.storyOpen,
        coleccion: ORDEN_COL.map((k) => {
          const got = s.unlocked.includes(k), tt = TITLES[k];
          return {
            icon: got ? tt.icon : '🔒',
            title: got ? tt.title : 'Sin descubrir',
            pct: String(RAREZA[k]).replace('.', ',') + '%',
            style: 'display:flex;flex-direction:column;gap:5px;padding:13px 12px;border-radius:13px;border:1px solid '
              + (got ? (k===tKey ? 'rgba(115,255,161,.55)' : 'rgba(244,233,254,.16)') : 'rgba(244,233,254,.08)')
              + ';background:' + (got ? (k===tKey ? 'rgba(115,255,161,.1)' : 'rgba(0,0,0,.24)') : 'rgba(0,0,0,.12)') + ';',
            titleColor: got ? '#fbfafd' : 'rgba(244,233,254,.55)',
            iconStyle: 'font-size:22px;' + (got ? '' : 'filter:grayscale(1);opacity:.45;'),
          };
        }),
        colCount: s.unlocked.length + '/' + ORDEN_COL.length,
        title: f ? { title: f.title, icon: f.icon, blurb: f.blurb } : { title:'', icon:'', blurb:'' },
        finalStats, fullPath,
        path: v.history.map((h) => ({icon:h.icon})),
        cardName: (s.name.trim() || 'JUGADOR ANÓNIMO').toUpperCase(),
        endLabel: f && f.quiebra ? 'QUIEBRA EN LA RONDA ' + (v.round+1) : (18 + (R-1)*2) + ' AÑOS',
      };
    }
  };
})();
