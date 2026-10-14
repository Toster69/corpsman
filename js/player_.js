/* Плеер визуальной новеллы: стартовый экран, заставка, «Ранее в…», сцены, финал.
   Читает эпизод из data/episodes/*.json. */
(function () {
  const A = () => window.App;
  const PERSIST = ['negative', 'rain', 'vhs', 'film', 'mirror'];
  const POS = { farleft: 13, left: 26, center: 50, right: 74, farright: 87 };
  // Авто-раскладка: персонажи расходятся по сцене в зависимости от их количества,
  // порядок слева направо берётся из указанных позиций (left / center / right…)
  const SLOTS = { 1: [50], 2: [30, 70], 3: [20, 50, 80], 4: [14, 38, 62, 86], 5: [12, 31, 50, 69, 88] };
  function layout(stage) {
    const { char } = A();
    const ids = Object.keys(stage).filter((id) => { const c = char(id); return c && !isNarrator(c); });
    const raw = (id) => POS[stage[id]] ?? (parseFloat(stage[id]) || 50);
    const nv = A().S.config.novel || {}; const auto = nv.autoLayout !== false;
    const out = {};
    if (!auto || !SLOTS[ids.length]) { ids.forEach((id) => { out[id] = raw(id); }); return out; }
    ids.slice().sort((a, b) => raw(a) - raw(b)).forEach((id, i) => { out[id] = SLOTS[ids.length][i]; });
    return out;
  }
  let P = null; // текущее состояние плеера

  // ---------- Настройки ----------
  const SET_KEY = 'corpsman:settings';
  function settings() { try { return Object.assign({ sound: true, dice: true, intro: true, speed: 1, fx: 'all' }, JSON.parse(A().store.get(SET_KEY) || '{}')); } catch (e) { return { sound: true, dice: true, intro: true, speed: 1 }; } }
  function saveSettings(s) { A().store.set(SET_KEY, JSON.stringify(s)); }

  // ---------- Звук ----------
  const Sound = {
    ctx: null, music: null, cur: '', vol: 0.55,
    unlock() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) {} },
    on() { return P && P.set.sound; },
    // Трек можно указать путём к файлу или id из config.json → tracks.
    // Если файла нет, играет запасной трек ("fallback"), а сам трек не открывается в кассете.
    resolve(ref) {
      const tracks = (A().S.config.tracks || []);
      const norm = (x) => String(x || '').replace(/^\.?\//, '');
      const t = tracks.find((x) => x.id === ref) || tracks.find((x) => norm(x.src) === norm(ref));
      return { src: t ? t.src : ref, track: t || null };
    },
    setMusic(ref) {
      ref = ref && ref !== 'none' ? ref : '';
      if (ref === this.cur) return;
      this.cur = ref;
      const old = this.music; this.music = null;
      if (old) this.fade(old, 0, 900, () => { old.pause(); });
      if (!ref) return;
      let { src, track } = this.resolve(ref);
      const tried = new Set();
      const a = new Audio(); a.loop = true; a.volume = 0; this.music = a;
      const start = () => {
        tried.add(src); a.src = src;
        if (this.on() && this.music === a) a.play().then(() => this.fade(a, this.vol, 1400)).catch(() => {});
      };
      a.addEventListener('error', () => {
        const fb = track && track.fallback && this.resolve(track.fallback);
        if (fb && !tried.has(fb.src)) { src = fb.src; track = fb.track; start(); }
      });
      a.addEventListener('canplay', () => {
        if (window.Music) { const t = Music.unlockBySrc(src); if (t && P) trackToast(t); }
      }, { once: true });
      start();
    },
    fade(a, to, ms, done) {
      const from = a.volume, t0 = performance.now();
      const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); try { a.volume = from + (to - from) * k; } catch (e) {} if (k < 1) requestAnimationFrame(step); else if (done) done(); };
      step();
    },
    mute(m) { if (!this.music) return; if (m) this.music.pause(); else this.music.play().then(() => this.fade(this.music, this.vol, 600)).catch(() => {}); },
    sfx(src, vol = 0.8) { if (!src || !this.on()) return; try { const a = new Audio(src); a.volume = vol; a.play().catch(() => {}); } catch (e) {} },
    staticBurst(ms = 320) {
      if (!this.on() || !this.ctx) return;
      const custom = A().S.config.sounds && A().S.config.sounds.static;
      if (custom) return this.sfx(custom, 0.5);
      try {
        const c = this.ctx, len = Math.floor(c.sampleRate * ms / 1000), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = c.createBufferSource(); src.buffer = buf;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
        const g = c.createGain(); g.gain.value = 0.06;
        src.connect(bp).connect(g).connect(c.destination); src.start();
      } catch (e) {}
    },
    stopAll() { if (this.music) { const m = this.music; this.fade(m, 0, 500, () => m.pause()); } this.music = null; this.cur = ''; }
  };

  // ---------- Помощники ----------
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const isRoll = (l) => !!(l && l.roll);
  const isCheck = (l) => !!(l && l.check);
  const isNarrator = (c) => !!c && (c.id === 'narrator' || c.narrator === true);
  const lineStr = (l) => l.say || l.think || l.n || '';

  function stateAt(ep, si, li) {
    const sc = ep.scenes[si];
    const st = { bg: sc.bg, stage: Object.assign({}, sc.stage || {}), expr: {}, fx: {}, music: sc.music };
    for (let i = 0; i <= li && i < sc.lines.length; i++) {
      const l = sc.lines[i];
      if (l.bg) st.bg = l.bg;
      if (l.show) Object.assign(st.stage, l.show);
      if (l.hide) l.hide.forEach((c) => delete st.stage[c]);
      if (l.e) { if (typeof l.e === 'string') { if (l.c) st.expr[l.c] = l.e; } else Object.assign(st.expr, l.e); }
      if (l.fx) { if (l.fx === 'none') st.fx = {}; else if (PERSIST.includes(l.fx)) st.fx[l.fx] = true; }
      if (l.music !== undefined) st.music = l.music;
    }
    if (st.music === undefined) {
      for (let s = si - 1; s >= 0 && st.music === undefined; s--) { const x = ep.scenes[s]; for (let i = x.lines.length - 1; i >= 0; i--) if (x.lines[i].music !== undefined) { st.music = x.lines[i].music; break; } if (st.music === undefined && x.music !== undefined) st.music = x.music; }
    }
    return st;
  }
  function nextPos(ep, si, li, dir) {
    for (;;) {
      li += dir;
      if (li >= ep.scenes[si].lines.length) { si++; li = 0; if (si >= ep.scenes.length) return null; }
      if (li < 0) { si--; if (si < 0) return null; li = ep.scenes[si].lines.length - 1; }
      const l = ep.scenes[si].lines[li];
      if (!isRoll(l) && !(dir < 0 && isCheck(l))) return [si, li];
    }
  }
  function settle(ep, si, li) {
    if (!ep.scenes[si]) { si = 0; li = 0; }
    li = Math.max(0, Math.min(li || 0, ep.scenes[si].lines.length - 1));
    if (isRoll(ep.scenes[si].lines[li]) || isCheck(ep.scenes[si].lines[li])) { const n = nextPos(ep, si, li, 1); if (n) return n; }
    return [si, li];
  }


  // ---------- Открытие ----------
  function trackToast(t) {
    const st = $('stage'); if (!st) return;
    const d = document.createElement('div'); d.className = 'toast track'; d.style.cssText = A().torn('tr' + t.id, 3, 6, 'tblr');
    d.innerHTML = `${A().ransom('Новый трек', { seed: 'trk' })}<b>♪ ${A().esc(t.title)}</b><small>теперь в плеере на сайте</small>`;
    st.appendChild(d); later(() => d.remove(), 3800);
  }

  function open(ep, sceneId, lineIdx) {
    close();
    if (window.Music) Music.pause();
    // Бонусная сцена: отдельный мини-эпизод из ep.bonus.scene
    if (sceneId === 'bonus' && ep.bonus && ep.bonus.scene) ep = Object.assign({}, ep, { scenes: [Object.assign({ id: 'bonus', title: ep.bonus.title || 'Бонус' }, ep.bonus.scene, { id: 'bonus' })], isBonus: true, teaser: null });
    const { esc, S } = A();
    const set = settings();
    P = { ep, si: 0, li: 0, typing: null, auto: false, autoT: null, panel: null, overlay: null, timers: new Set(), log: [], set, lastBg: null, lastScene: -1, rain: null, busy: false };
    document.body.classList.add('playing');
    const root = document.createElement('div');
    root.className = 'player'; root.id = 'player';
    root.innerHTML = `
      <div class="p-bar">
        <a href="#ep-${ep.id}" class="pb" title="Выйти (Esc)" aria-label="Выйти">✕</a>
        <span class="p-title"><b>${esc(A().epNo(ep))}</b> ${esc(ep.title)} <span id="p-sc"></span><i class="saved" id="saved">● Сохранено</i></span>
        <button class="pb" id="b-back" title="Назад (←)" aria-label="Назад">◀</button>
        <button class="pb" id="b-auto" title="Автопрокрутка">Авто</button>
        <button class="pb" id="b-sound" title="Звук">${set.sound ? 'Звук' : 'Без звука'}</button>
        <button class="pb" id="b-log">Лог</button>
        <button class="pb" id="b-scenes">Сцены</button>
        <button class="pb" id="b-clues">Дело</button>
        <button class="pb" id="b-set" aria-label="Настройки">⚙</button>
      </div>
      <div class="p-wrap"><div class="tv"><div class="stage" id="stage" tabindex="0" aria-live="polite">
        <div class="bg" id="bg1"></div><div class="bg" id="bg2" style="opacity:0"></div>
        <div class="layer ht-layer"></div>
        <div class="sprites" id="sprites"></div>
        <canvas class="layer rain" id="rain" hidden></canvas>
        <div class="layer vhs-layer"><span class="osd">PLAY ▶</span></div>
        <div class="layer film-layer"></div>
        <div class="layer mirror-layer"></div>
        <div class="bug">${esc(S.config.channel || '').replace(' ', '<br>')}</div>
        <div class="box" id="box">
          <div class="box-bg"></div>
          <div class="tail" id="tail" hidden></div>
          <div class="plate" id="plate" hidden></div>
          <div class="txt" id="txt"></div>
          <div class="meta"><span id="tc"></span><span class="next" id="nexti"></span></div>
          <div class="qm" id="qm">
            <button data-q="back" title="Предыдущая реплика (← или колесо вверх)">◀ Назад</button>
            <button data-q="next" title="Следующая реплика (→, пробел или колесо вниз)">Вперёд ▶</button>
            <button data-q="skip" title="Быстрая перемотка (удерживайте Ctrl)">Перемотка ▸▸</button>
            <button data-q="auto" title="Автопрокрутка">Авто</button>
            <button data-q="hide" title="Скрыть текст (H)">Скрыть</button>
            <button data-q="log" title="История реплик (L)">Лог</button>
          </div>
        </div>
        <div class="layer static" id="static"></div>
        <div class="layer crt"></div>
        <div class="layer glass" style="background-image:url('${esc(S.config.tvGlass || 'assets/brand/tv-glass.webp')}')"></div>
      </div><span class="tv-led" aria-hidden="true"></span><span class="tv-brand" aria-hidden="true">CORPSMAN</span></div></div>`;
    document.body.appendChild(root);
    const stage = $('stage');
    applyNovel(stage);
    $('static').style.backgroundImage = `url('${Art.noise(128, 255)}')`;
    root.querySelector('.film-layer').style.backgroundImage = `url('${Art.noise(160, 40)}')`;

    stage.addEventListener('click', (e) => {
      Sound.unlock();
      if (stage.classList.contains('ui-hidden')) return toggleHide(false);
      if (e.target.closest('a,button,.ov,.side')) return;
      if (P.panel) return closePanel();
      if (P.skip) return setSkip(false);
      next();
    });
    stage.addEventListener('wheel', (e) => {
      if (P.overlay || P.panel || e.target.closest('.side')) return;
      e.preventDefault();
      const now = Date.now(); if (now - (P.wheelT || 0) < 220) return; P.wheelT = now;
      if (stage.classList.contains('ui-hidden')) toggleHide(false);
      if (e.deltaY < 0) back(); else next();
    }, { passive: false });
    $('qm').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation(); Sound.unlock();
      const q = b.dataset.q;
      if (q === 'back') { setSkip(false); back(); }
      if (q === 'next') { setSkip(false); next(); }
      if (q === 'skip') setSkip(!P.skip);
      if (q === 'auto') $('b-auto').click();
      if (q === 'hide') toggleHide(true);
      if (q === 'log') panel('log');
    });
    document.addEventListener('keyup', P.keyup = (e) => { if (e.key === 'Control' && P && P.skipHeld) { P.skipHeld = false; setSkip(false); } });
    stage.addEventListener('keydown', (e) => {
      if (P.overlay) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); P.overlay.dispatchEvent(new CustomEvent('skip')); } return; }
      if (stage.classList.contains('ui-hidden') && !['Control', 'Shift', 'Alt'].includes(e.key)) { e.preventDefault(); return toggleHide(false); }
      if (e.key === 'Control' && !e.repeat) { P.skipHeld = true; return setSkip(true); }
      if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') { e.preventDefault(); return toggleHide(true); }
      if (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') { e.preventDefault(); return panel('log'); }
      if (e.key === 'PageUp') { e.preventDefault(); back(); }
      if (e.key === 'PageDown') { e.preventDefault(); next(); }
      if (['ArrowRight', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); Sound.unlock(); setSkip(false); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      if (e.key === 'Escape') { if (P.panel) closePanel(); else location.hash = 'ep-' + ep.id; }
    });
    $('b-back').onclick = back;
    $('b-auto').onclick = () => { P.auto = !P.auto; $('b-auto').classList.toggle('on', P.auto); $('qm').querySelector('[data-q=auto]').classList.toggle('on', P.auto); if (P.auto && !P.typing && !P.overlay) next(); else clearTimeout(P.autoT); };
    $('b-sound').onclick = () => { Sound.unlock(); P.set.sound = !P.set.sound; saveSettings(P.set); $('b-sound').textContent = P.set.sound ? 'Звук' : 'Без звука'; Sound.mute(!P.set.sound); };
    $('b-log').onclick = () => panel('log');
    $('b-scenes').onclick = () => panel('scenes');
    $('b-clues').onclick = () => panel('clues');
    $('b-set').onclick = () => panel('settings');
    stage.focus();

    if (!sceneId) startScreen();
    else { const si = Math.max(0, ep.scenes.findIndex((s) => s.id === sceneId)); const [a, b] = settle(ep, si, Number.isFinite(lineIdx) ? lineIdx : 0); go(a, b, true); }
  }

  // Перемотка и скрытие текста
  function setSkip(on) {
    if (!P) return;
    P.skip = !!on;
    const b = $('qm') && $('qm').querySelector('[data-q=skip]'); if (b) b.classList.toggle('on', P.skip);
    $('stage') && $('stage').classList.toggle('skipping', P.skip);
    clearTimeout(P.skipT);
    if (P.skip) skipStep();
  }
  function skipStep() {
    if (!P || !P.skip) return;
    if (P.overlay || P.busy) return setSkip(false);
    if (P.typing) P.finishType();
    const n = nextPos(P.ep, P.si, P.li, 1);
    if (n && P.set.dice) { const l = P.ep.scenes[n[0]].lines[n[1]]; if (isCheck(l) && Case.status(P.ep, l.check.clue) !== 'found' && !(P.rolled || {})[l.check.clue]) { setSkip(false); return go(n[0], n[1], true); } }
    if (!n) { setSkip(false); return ending(); }
    go(n[0], n[1], true);
    P.skipT = later(skipStep, 110);
  }
  function toggleHide(on) {
    const st = $('stage'); if (!st) return;
    st.classList.toggle('ui-hidden', on);
    if (on) setSkip(false);
  }

  // Размеры из config.json → "novel"
  function applyNovel(stage) {
    const n = A().S.config.novel || {};
    const map = { spriteHeight: '--sh', spriteBottom: '--sb', boxHeight: '--bh', textSize: '--ts', nameSize: '--ns', textWeight: '--tw', mobileSpriteHeight: '--msh', mobileSpriteBottom: '--msb', mobileTextSize: '--mts' };
    Object.entries(map).forEach(([k, v]) => { if (n[k] !== undefined && n[k] !== '') stage.style.setProperty(v, n[k]); });
    if (n.textFont) stage.style.setProperty('--f-vn', `'${n.textFont}', var(--f-ui)`);
    if (n.narrationFont) stage.style.setProperty('--f-narr', `'${n.narrationFont}', var(--f-ui)`);
  }

  function close() {
    if (!P) return;
    clearInterval(P.typing); clearTimeout(P.autoT); cancelAnimationFrame(P.rain);
    P.timers.forEach((t) => clearTimeout(t));
    Sound.stopAll();
    if (P.keyup) document.removeEventListener('keyup', P.keyup);
    const el = $('player'); if (el) el.remove();
    document.body.classList.remove('playing');
    P = null;
  }
  const later = (fn, ms) => { const t = setTimeout(() => { P && P.timers.delete(t); fn(); }, ms); P.timers.add(t); return t; };

  // ---------- Оверлеи ----------
  function overlay(html, cls = '') {
    const el = document.createElement('div');
    el.className = 'ov ' + cls; el.innerHTML = html;
    $('stage').appendChild(el); P.overlay = el;
    return el;
  }
  function closeOverlay() { if (P && P.overlay) { P.overlay.remove(); P.overlay = null; $('stage') && $('stage').focus(); } }
  function waitOverlay(el, ms) {
    return new Promise((res) => {
      let done = false; const fin = () => { if (done) return; done = true; res(); };
      el.addEventListener('skip', fin);
      el.addEventListener('click', (e) => { if (!e.target.closest('a')) { Sound.unlock(); fin(); } });
      if (ms) later(fin, ms);
    });
  }
  function staticBurst(ms = 320) {
    return; // помехи («статика») отключены полностью
    const s = $('static'); if (!s) return;
    s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
    Sound.staticBurst(ms);
  }

  // Стартовый экран
  function startScreen() {
    const { esc, ransom, S, store } = A();
    const ep = P.ep;
    let prog = null; try { prog = JSON.parse(store.get('progress:' + ep.id) || 'null'); } catch (e) {}
    const sc = prog && ep.scenes.find((s) => s.id === prog.s);
    const first = A().loc(ep.scenes[0] && ep.scenes[0].bg);
    const logo = S.config.logo || 'assets/brand/logo.webp';
    const el = overlay(`
      <div class="start" style="background-image:url('${esc(ep.cover || A().bgSrc(first))}')">
        <div class="layer ht-layer"></div>
        <img class="start-logo" src="${esc(logo)}" alt="" onerror="this.remove()">
        <div class="start-in">
          <div class="eyebrow">Эпизод ${esc(A().epNo(ep))}${ep.badge ? ` <span class="badge">${esc(ep.badge)}</span>` : ''}</div>
          <div class="start-title">${ransom(ep.title)}</div>
          <div class="menu" role="menu">
            ${sc ? `<button class="mi" data-go="resume" role="menuitem"><span>▶</span> Продолжить <small>сохранение: ${esc(sc.title)}</small></button>` : ''}
            <button class="mi" data-go="start" role="menuitem"><span>▶</span> Новая игра</button>
          </div>
          <p class="hint">Клик или пробел — дальше · колесо мыши — назад/вперёд · H — скрыть текст</p>
        </div>
      </div>`, 'ov-start');
    el.querySelectorAll('[data-go]').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation(); Sound.unlock(); closeOverlay();
      if (b.dataset.go === 'resume') { const [a, c] = settle(ep, ep.scenes.indexOf(sc), prog.l); go(a, c, true); }
      else { await prologue(); if (P) go(0, 0, true); }
    });
    el.querySelector('[data-go]').focus();
  }

  async function prologue() {
    P.busy = true;
    await loading();
    if (!P) return;
    await warningScreen();
    if (!P) return;
    if (P.set.intro) await introVideo();
    if (!P) return;
    await previously();
    if (!P) return;
    await titleCard();
    if (P) P.busy = false;
  }

  // «Загрузка картриджа»
  function loading() {
    const el = overlay(`<div class="loading"><div class="ld-txt">ЗАГРУЗКА<span class="ld-dots"></span></div><div class="ld-bar"><i></i></div><div class="ld-slot">СЛОТ ${A().epNo(P.ep)} · ${A().esc(P.ep.title)}</div></div>`, 'ov-load');
    return waitOverlay(el, 1500).then(() => { if (P) closeOverlay(); });
  }
  // Предупреждение перед игрой (config.warning)
  function warningScreen() {
    const { S, esc } = A();
    const w = P.ep.warning !== undefined ? P.ep.warning : S.config.warning;
    if (!w || !w.image) return Promise.resolve();
    staticBurst();
    const el = overlay(`<div class="warn"><img src="${esc(w.image)}" alt="${esc(w.alt || 'Предупреждение')}" onerror="this.closest('.ov').dispatchEvent(new CustomEvent('skip'))"><span class="warn-hint">клик — продолжить</span></div>`, 'ov-warn');
    return waitOverlay(el, (w.seconds || 7) * 1000).then(() => { if (P) { closeOverlay(); staticBurst(); } });
  }

  // Заставка: YouTube или MP4 из config.intro (или ep.intro)
  function introVideo() {
    const { S, esc } = A();
    const cfg = P.ep.introVideo !== undefined ? P.ep.introVideo : S.config.introVideo;
    if (!cfg || (!cfg.youtube && !cfg.video)) return Promise.resolve();
    let media;
    if (cfg.video) media = `<video src="${esc(cfg.video)}" autoplay playsinline ${P.set.sound ? '' : 'muted'}></video>`;
    else media = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(cfg.youtube)}?autoplay=1&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&iv_load_policy=3${P.set.sound ? '' : '&mute=1'}" allow="autoplay; encrypted-media" title="Заставка"></iframe>`;
    const el = overlay(`<div class="intro">${media}<button class="skip">Пропустить ▸▸</button></div>`, 'ov-intro');
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; window.removeEventListener('message', onMsg); staticBurst(); closeOverlay(); res(); };
      el.addEventListener('skip', fin);
      el.querySelector('.skip').onclick = (e) => { e.stopPropagation(); fin(); };
      const v = el.querySelector('video');
      if (v) { v.onended = fin; v.onerror = fin; }
      const f = el.querySelector('iframe');
      function onMsg(e) {
        if (!/youtube/.test(e.origin)) return;
        let d; try { d = JSON.parse(e.data); } catch (x) { return; }
        if ((d.event === 'onStateChange' && d.info === 0) || (d.event === 'infoDelivery' && d.info && d.info.playerState === 0)) fin();
      }
      if (f) {
        window.addEventListener('message', onMsg);
        f.onload = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*'); } catch (x) {} };
        later(fin, ((cfg.seconds || 20) + 4) * 1000);
      }
    });
  }

  // «Ранее в…»: строки с "recap": true из прошлого эпизода или ep.previously
  function recapItems() {
    const { epList } = A();
    const ep = P.ep;
    if (Array.isArray(ep.previously)) return ep.previously.map((x) => ({ c: x.c, text: x.text, bg: x.bg, e: x.e }));
    const list = epList(); const i = list.indexOf(ep); const prev = list[i - 1];
    if (!prev) return [];
    const items = [];
    prev.scenes.forEach((sc, si) => sc.lines.forEach((l, li) => {
      if (!l.recap) return;
      const st = stateAt(prev, si, li);
      items.push({ c: l.c, text: lineStr(l), bg: st.bg, e: l.c ? st.expr[l.c] : null, music: st.music });
    }));
    return items;
  }
  async function previously() {
    const items = recapItems();
    if (!items.length) return;
    const { ransom, S, loc, char, esc, spriteSrc } = A();
    const el = overlay(`<div class="recap vhs"><div class="recap-bg" id="rc-bg"></div><div class="layer ht-layer"></div>
      <div class="recap-head">${ransom(S.config.recapTitle || 'Ранее в Corpsman')}</div>
      <div class="recap-spr" id="rc-spr"></div><div class="recap-cap" id="rc-cap"></div>
      <span class="osd">◀◀ REW</span><button class="skip">Пропустить ▸▸</button></div>`, 'ov-recap');
    let skipped = false;
    el.addEventListener('skip', () => { skipped = true; });
    el.querySelector('.skip').onclick = (e) => { e.stopPropagation(); skipped = true; };
    let tap = null; el.addEventListener('click', () => { if (tap) tap(); });
    staticBurst();
    // Музыка заставки: config.music.recap, иначе музыка первого момента, иначе «мистика»
    Sound.setMusic((S.config.music && S.config.music.recap) || items[0].music || 'mystery');
    await wait(1600);
    for (const it of items) {
      if (skipped || !P) break;
      const c = it.c && char(it.c);
      $('rc-bg').style.backgroundImage = `url('${A().bgSrc(loc(it.bg))}')`;
      $('rc-spr').innerHTML = c ? `<img class="${A().spriteCls(c, it.e || 'default')}" src="${esc(spriteSrc(c, it.e || 'default'))}" alt="">` : '';
      const rimg = $('rc-spr').querySelector('img');
      if (rimg) {
        const mark = () => $('rc-spr').classList.toggle('ph', (rimg.getAttribute('src') || '').startsWith('data:'));
        rimg.onerror = () => { rimg.onerror = null; rimg.src = Art.sprite(c, it.e || 'default'); mark(); };
        mark();
      }
      $('rc-cap').innerHTML = `${c ? `<b style="color:${esc(c.color)}">${esc(c.short || c.name)}</b> ` : ''}${esc(it.text)}`;
      el.querySelector('.recap').classList.remove('cut'); void el.offsetWidth; el.querySelector('.recap').classList.add('cut');
      await new Promise((r) => { tap = r; later(r, 3000); });
    }
    if (P) { staticBurst(); closeOverlay(); }
  }

  function titleCard() {
    const { ransom, S, esc } = A();
    const logo = S.config.logo || 'assets/brand/logo.webp';
    staticBurst();
    const el = overlay(`<div class="tcard"><img class="tc-logo" src="${esc(logo)}" alt="" onerror="this.remove()"><div class="eyebrow">Эпизод ${esc(A().epNo(P.ep))}</div><div class="tc-title">${ransom(P.ep.title)}</div></div>`, 'ov-title');
    return waitOverlay(el, 3600).then(() => { if (P) { closeOverlay(); staticBurst(); } });
  }

  // ---------- Показ строки ----------
  function go(si, li, fresh) { P.si = si; P.li = li; show(fresh); }

  // Переходы фонов: fade, cut, wipe, halftone, slide, zoom, static, flash
  function setBg(id, tr) {
    const { bgSrc, loc } = A();
    const l = loc(id); const src = bgSrc(l);
    if (src === P.lastBg) return; P.lastBg = src;
    const b1 = $('bg1'), b2 = $('bg2');
    const cur = P.bgCur || b1, nxt = cur === b1 ? b2 : b1;
    const first = !P.bgCur; P.bgCur = nxt;
    if (first || document.documentElement.classList.contains('fx-off')) tr = 'cut';
    if (tr === 'static') { staticBurst(340); tr = 'cut'; }
    if (tr === 'flash') { oneShot('flash'); tr = 'cut'; }
    const run = (url) => {
      if (P.bgCur !== nxt) return;
      nxt.className = 'bg'; nxt.style.backgroundImage = `url('${url}')`;
      nxt.style.zIndex = 1; cur.style.zIndex = 0; nxt.style.opacity = '1';
      if (tr && tr !== 'cut') { void nxt.offsetWidth; nxt.classList.add('tr-' + tr); }
      later(() => { if (P.bgCur === nxt) { cur.style.opacity = '0'; nxt.classList.remove('tr-' + tr); } }, tr === 'cut' ? 0 : 950);
    };
    if (l && l.bg) {
      const im = new Image(); let done = false;
      const go = (url) => { if (!done) { done = true; run(url); } };
      im.onload = () => go(src); im.onerror = () => go(Art.background(l)); im.src = src;
      later(() => go(src), 700); // не ждём медленную загрузку дольше 0,7 с
    } else run(src);
  }

  // Спрайты: выход из-за края, уход, смена эмоции с наплывом, «подскок» говорящего
  function renderSprites(st, speaker, fresh) {
    const { char, spriteSrc, blinkSrc } = A();
    const box = $('sprites'); const keep = new Set(); const lay = layout(st.stage);
    Object.entries(st.stage).forEach(([cid, pos], idx) => {
      const c = char(cid); if (!c || isNarrator(c)) return; keep.add(cid);
      const e = st.expr[cid] || 'default';
      const x = lay[cid] ?? 50;
      let w = box.querySelector(`[data-c="${cid}"]:not(.exit)`);
      const isNew = !w;
      if (isNew) {
        w = document.createElement('div'); w.className = 'spr'; w.dataset.c = cid;
        w.innerHTML = `<div class="spr-in"><img class="cur" alt="${A().esc(c.name)}" style="animation-delay:-${(idx * 1.3).toFixed(1)}s"></div>`;
        w.style.setProperty('--from', (x < 50 ? -1 : 1) * 14 + 'cqw');
        if (fresh) w.classList.add('enter');
        box.appendChild(w);
        if (fresh) { void w.offsetWidth; requestAnimationFrame(() => w.classList.remove('enter')); }
      }
      const img = w.querySelector('img.cur');
      const src = spriteSrc(c, e);
      if (img.dataset.src !== src) {
        if (!isNew && img.dataset.src && fresh) {
          const ghost = img.cloneNode(); ghost.className = img.className.replace('cur', '') + ' ghost'; ghost.removeAttribute('data-src');
          img.parentNode.appendChild(ghost); later(() => ghost.remove(), 320);
          const inr = w.querySelector('.spr-in'); inr.classList.remove('bump'); void inr.offsetWidth; inr.classList.add('bump');
        }
        img.dataset.src = src; img.src = src;
        const cls = A().spriteCls(c, e); img.classList.toggle('own', cls === 'own'); img.classList.toggle('sticker', cls === 'sticker');
        img.onerror = () => { img.onerror = null; img.classList.remove('own'); img.classList.add('sticker'); img.src = Art.sprite(c, e); img.dataset.blink = Art.sprite(c, e, { blink: true }); w.style.setProperty('--sk', (c.spriteScale || 1) * 0.66); w.style.setProperty('--y', (c.spriteY || 0) + 60); };
        img.dataset.blink = blinkSrc(c, e) || '';
        scheduleBlink(img);
      }
      w.style.left = x + '%';
      // Заглушки нарисованы по пояс — показываем их меньше и выше, чем настоящие спрайты в полный рост
      const ph = (img.getAttribute('src') || '').startsWith('data:');
      w.style.setProperty('--sk', (c.spriteScale || 1) * (ph ? 0.66 : 1));
      w.style.setProperty('--y', (c.spriteY || 0) + (ph ? 60 : 0));
      const wasSpeak = w.classList.contains('speak');
      w.classList.toggle('speak', cid === speaker);
      if (fresh && cid === speaker && !wasSpeak && !isNew) { const inr = w.querySelector('.spr-in'); inr.classList.remove('hop'); void inr.offsetWidth; inr.classList.add('hop'); }
      w.classList.toggle('dim', !!speaker && cid !== speaker && !isNarrator(char(speaker)));
      w.classList.toggle('glitchy', e === 'glitch');
      w.classList.toggle('immune', !!c.immune || cid === 'stranger');
    });
    box.querySelectorAll('.spr:not(.exit)').forEach((w) => {
      if (keep.has(w.dataset.c)) return;
      if (!fresh) { w.remove(); return; }
      const x = parseFloat(w.style.left) || 50;
      w.style.setProperty('--from', (x < 50 ? -1 : 1) * 14 + 'cqw');
      w.classList.add('exit'); later(() => w.remove(), 520);
    });
  }
  function scheduleBlink(img) {
    clearTimeout(img._bt);
    if (!P) return;
    img._bt = later(() => {
      if (!img.isConnected || !img.dataset.blink) return scheduleBlink(img);
      const open = img.dataset.src; img.src = img.dataset.blink;
      later(() => { if (img.isConnected && img.src === img.dataset.blink) img.src = open; scheduleBlink(img); }, 130);
    }, 2400 + Math.random() * 3800);
  }

  function rain(on) {
    // Анимированный дождь отключён: он тормозил на слабых компьютерах
    const cv = $('rain'); cv.hidden = true; cancelAnimationFrame(P.rain); return;
    const g = cv.getContext('2d'); cv.width = cv.clientWidth; cv.height = cv.clientHeight;
    const drops = Array.from({ length: 170 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, v: 7 + Math.random() * 9 }));
    const tick = () => {
      g.clearRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(239,236,226,.4)'; g.lineWidth = 1.2;
      drops.forEach((d) => { g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - 2, d.y + 13); g.stroke(); d.y += d.v; d.x -= 0.7; if (d.y > cv.height) { d.y = -14; d.x = Math.random() * cv.width; } });
      if (P) P.rain = requestAnimationFrame(tick);
    };
    tick();
  }
  function oneShot(fx) {
    if (!fx || PERSIST.includes(fx) || fx === 'none') return;
    const st = $('stage');
    st.classList.remove('fx-' + fx); void st.offsetWidth; st.classList.add('fx-' + fx);
    later(() => st && st.classList.remove('fx-' + fx), 1700);
  }

  function show(fresh) {
    if (!P) return;
    const { ep } = P; const { ransom, S } = A();
    const sc = ep.scenes[P.si]; const ln = sc.lines[P.li];
    const stage = $('stage');
    if (isCheck(ln)) return checkLine(ln.check, fresh);
    const st = stateAt(ep, P.si, P.li);
    const nv = S.config.novel || {};
    $('p-sc').textContent = '· ' + sc.title;
    const sceneChanged = P.lastScene !== P.si; P.lastScene = P.si;
    if (P.intro) P.intro.cancel();
    const lvl = sceneChanged && fresh && nv.sceneIntro !== false;
    const tr = !fresh || lvl ? 'cut' : (ln.bgT || (sceneChanged ? (sc.transition || nv.sceneTransition || 'halftone') : (nv.bgTransition || 'fade')));
    setBg(st.bg, tr);
    PERSIST.forEach((f) => stage.classList.toggle('fx-' + f, !!st.fx[f]));
    rain(!!st.fx.rain);
    Sound.setMusic(st.music);

    stage.querySelectorAll('.sc-card, .lvl').forEach((x) => x.remove());
    // Начало сцены: сначала только фон и название, потом выходят персонажи и текст
    if (sceneChanged && fresh && nv.sceneIntro !== false) {
      renderSprites({ stage: {}, expr: {} }, null, true);
      const box = $('box'); box.classList.add('away');
      const L = A().loc(st.bg); const ms = nv.sceneTitleMs || 2400;
      const t = document.createElement('div'); t.className = 'lvl';
      t.innerHTML = `<div class="lvl-in" style="--ms:${ms}ms">
        <div class="lvl-no">ГЛАВА <b>${String(P.si + 1).padStart(2, '0')}</b><span>/ ${String(ep.scenes.length).padStart(2, '0')}</span></div>
        <div class="lvl-title">${ransom(sc.title)}</div>
        ${L ? `<div class="lvl-loc">${A().esc(L.name)}</div>` : ''}
        <div class="lvl-bar"><i></i></div>
        <div class="lvl-hint">● Сохранено · клик — продолжить</div></div>`;
      stage.appendChild(t);
      let over = false;
      const fin = () => {
        if (over) return; over = true; P.intro = null;
        t.classList.add('out'); later(() => t.remove(), 600);
        box.classList.remove('away');
        showLine(st, sc, ln, true);
      };
      P.intro = { fin, cancel: () => { over = true; P.intro = null; t.remove(); $('box').classList.remove('away'); } };
      later(fin, ms);
      return;
    }
    showLine(st, sc, ln, fresh);
  }

  function showLine(st, sc, ln, fresh) {
    const { ep } = P; const { char, ransom, esc, ytLink, store, S } = A();
    const stage = $('stage');
    renderSprites(st, ln.c, fresh);
    if (fresh) oneShot(ln.fx);
    if (fresh && ln.sfx) Sound.sfx(ln.sfx);

    // окно диалога: реплика — комиксовый пузырь, мысль — облачко, рассказчик — жёлтая плашка
    const c0 = char(ln.c); const c = isNarrator(c0) ? null : c0;
    const kind = c && ln.think ? 'think' : c && ln.say ? 'say' : 'narr';
    const box = $('box'); box.className = 'box k-' + kind;
    box.style.setProperty('--c', c ? (c.color || '#efece2') : '#f2d230');
    const plate = $('plate');
    if (c) { plate.hidden = false; plate.innerHTML = ransom(c.short || c.name, { seed: c.id }) + (kind === 'think' ? '<i>мысли</i>' : ''); }
    else plate.hidden = true;
    const tail = $('tail'); const pos = c && st.stage[c.id];
    if (pos !== undefined) {
      const x = layout(st.stage)[c.id] ?? 50;
      tail.hidden = false; tail.style.left = Math.max(6, Math.min(94, (x - 2.5) / 95 * 100)) + '%';
    } else tail.hidden = true;

    const tx = $('txt');
    tx.className = 'txt ' + kind;
    type(tx, lineStr(ln), !fresh);

    $('tc').innerHTML = ln.t && ep.video ? `<a href="${ytLink(ep, ln.t)}" target="_blank" rel="noopener" title="Открыть этот момент в записи">▶ ${esc(ln.t)}</a>` : '';

    if (ln.clue && fresh && !Case.checkedClues(ep).includes(ln.clue)) {
      const k = (ep.clues || []).find((x) => x.id === ln.clue);
      if (k) {
        Case.mark(ep, k.id, 'found');
        const t = document.createElement('div'); t.className = 'toast'; t.style.cssText = A().torn('t' + k.id, 3, 6, 'tblr');
        t.innerHTML = `${ransom('Улика', { seed: 'clue' })}<b>${esc(k.name)}</b>`;
        stage.appendChild(t); later(() => t.remove(), 3600);
        Sound.sfx(S.config.sounds && S.config.sounds.clue, 0.7);
      }
    }
    if (fresh) P.log.push({ c, ln });
    try { history.replaceState(null, '', `#play-${ep.id}-${sc.id}-${P.li}`); } catch (e) {}
    if (!ep.isBonus) store.set('progress:' + ep.id, JSON.stringify({ s: sc.id, l: P.li }));
    if (fresh && P.li === 0) { const sv = $('saved'); if (sv) { sv.classList.remove('on'); void sv.offsetWidth; sv.classList.add('on'); } }
  }

  function type(el, text, instant) {
    clearInterval(P.typing); clearTimeout(P.autoT);
    el.textContent = ''; let i = 0; $('nexti').style.visibility = 'hidden';
    const done = () => { clearInterval(P.typing); P.typing = null; el.textContent = text; $('nexti').style.visibility = 'visible'; if (P.auto && !P.skip) P.autoT = later(next, 1500 + text.length * 28); };
    P.finishType = done;
    if (instant || P.skip || document.documentElement.classList.contains('fx-off')) return done();
    P.typing = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) done(); }, 22);
    P.finishType = done;
  }

  // ---------- Проверка зрителя: бросок за улику ----------
  function advance() { if (!P) return; const n = nextPos(P.ep, P.si, P.li, 1); if (!n) return ending(); go(n[0], n[1], true); }
  function clueToast(k, kind) {
    const { ransom, esc } = A(); const t = document.createElement('div'); t.className = 'toast' + (kind === 'partial' ? ' partial' : '');
    t.style.cssText = A().torn('t' + k.id, 3, 6, 'tblr');
    t.innerHTML = `${ransom(kind === 'partial' ? 'Обрывок' : 'Улика', { seed: 'clue' + kind })}<b>${esc(k.name)}</b>`;
    $('stage').appendChild(t); later(() => t.remove(), 3600);
  }
  function rollDie(n) { return 1 + Math.floor(Math.random() * n); }
  function checkLine(ch, fresh) {
    const { esc, ransom, S } = A(); const ep = P.ep;
    const k = (ep.clues || []).find((x) => x.id === ch.clue) || { id: ch.clue, name: ch.clue, text: '' };
    const st = Case.status(ep, k.id);
    P.rolled = P.rolled || {};
    // уже найдено, уже бросали в этом прохождении или едем назад — проходим мимо
    if (!fresh || st === 'found' || P.rolled[k.id]) { if (fresh) later(advance, 0); return; }
    if (!P.set.dice) { Case.mark(ep, k.id, 'auto'); clueToast(k, 'found'); P.rolled[k.id] = 1; later(advance, 0); return; }
    setSkip(false); if (P.auto) { P.auto = false; $('b-auto').classList.remove('on'); $('qm').querySelector('[data-q=auto]').classList.remove('on'); }
    const sides = parseInt(String(ch.die).replace(/\D/g, ''), 10) || 6;
    const dc = +ch.dc || sides;
    const el = overlay(`<div class="chk" style="${A().torn('chk' + k.id, 2, 4, 'tblr')}">
        <div class="eyebrow">Проверка · ${esc(ch.stat || '')}</div>
        <div class="chk-goal">${esc(ch.goal || 'Найти улику')}</div>
        <div class="chk-row">
          <div class="die" id="die"><span id="die-n">${esc(ch.die)}</span></div>
          <div class="chk-info"><b>Сложность ${dc}</b><small>Выбросьте ${dc} или больше. Максимум на кубике — бросок «взрывается» и прибавляется ещё один.</small></div>
        </div>
        <div class="chk-res" id="chk-res"></div>
        <div class="chk-btns" id="chk-btns"><button class="btn hot" data-a="roll">Бросить ${esc(ch.die)}</button></div>
        <div class="chk-tok">Жетоны неудачи: <b id="tok">${Case.tokens()}</b></div>
      </div>`, 'ov-check');
    el.style.cursor = 'auto';
    const btns = el.querySelector('#chk-btns'), res = el.querySelector('#chk-res'), dieN = el.querySelector('#die-n'), die = el.querySelector('#die');
    let total = 0; const parts = [];
    const finish = (kind) => {
      P.rolled[k.id] = 1; Case.mark(ep, k.id, kind);
      if (kind === 'found') { res.innerHTML = `<div class="ok">Успех! Улика в деле: <b>${esc(k.name)}</b></div><p>${esc(k.text)}</p>`; Sound.sfx(S.config.sounds && S.config.sounds.clue, 0.7); }
      else { res.innerHTML = `<div class="bad">Улика ускользнула. +1 жетон неудачи</div><p>${esc(k.partial || 'В деле остался только обрывок: что-то важное мелькнуло и пропало.')}</p>`; }
      el.querySelector('#tok').textContent = Case.tokens();
      btns.innerHTML = `<button class="btn hot" data-a="go">Дальше ▶</button>`;
    };
    btns.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); Sound.unlock();
      const a = b.dataset.a;
      if (a === 'go') { closeOverlay(); return advance(); }
      if (a === 'roll') {
        btns.innerHTML = ''; Sound.sfx(S.config.sounds && S.config.sounds.roll, 0.7);
        let r;
        do {
          die.classList.remove('spin'); void die.offsetWidth; die.classList.add('spin');
          for (let i = 0; i < 8; i++) { dieN.textContent = rollDie(sides); await wait(55); }
          r = rollDie(sides); parts.push(r); total += r; dieN.textContent = r;
          if (r === sides) { res.innerHTML = `<div class="boom">Взрыв! ${parts.join(' + ')} — бросаем ещё</div>`; await wait(700); }
        } while (r === sides && P);
        dieN.textContent = total;
        const need = dc - total;
        if (need <= 0) return finish('found');
        const tk = Case.tokens();
        res.innerHTML = `<div class="bad">${parts.length > 1 ? parts.join(' + ') + ' = ' : 'Выпало '}${total}. Не хватает ${need}.</div>`;
        btns.innerHTML = (tk >= need ? `<button class="btn hot" data-a="spend">Потратить ${need} ${need === 1 ? 'жетон' : need < 5 ? 'жетона' : 'жетонов'}</button>` : '') + `<button class="btn ink" data-a="fail">Принять провал (+1 жетон)</button>`;
        btns.dataset.need = need;
      }
      if (a === 'spend') { const need = +btns.dataset.need; Case.addTokens(-need); total += need; dieN.textContent = total; finish('found'); }
      if (a === 'fail') { Case.addTokens(1); finish('partial'); }
    });
    el.querySelector('[data-a=roll]').focus();
  }

  function next() {
    if (!P || P.overlay || P.busy) return;
    clearTimeout(P.autoT);
    if (P.intro) return P.intro.fin();
    if (P.typing) return P.finishType();
    const n = nextPos(P.ep, P.si, P.li, 1);
    if (!n) return ending();
    go(n[0], n[1], true);
  }
  function back() {
    if (!P || P.overlay) return;
    clearTimeout(P.autoT);
    const n = nextPos(P.ep, P.si, P.li, -1);
    if (n) go(n[0], n[1], false);
  }

  // ---------- Финал ----------
  async function ending() {
    const { ep } = P; const { ransom, esc, char, S, epList, ytLink, store, spriteSrc } = A();
    if (ep.isBonus) {
      setSkip(false); staticBurst();
      overlay(`<div class="ending"><div class="end-in in"><div class="end-title">${ransom('Конец бонуса')}<small>${esc(ep.bonus.title || '')}</small></div><div class="btns" style="justify-content:center"><a class="btn hot" href="#bonus-${ep.id}">К бонусу</a><a class="btn ink" href="#ep-${ep.id}">К эпизоду</a></div></div></div>`, 'ov-end');
      return;
    }
    store.set('progress:' + ep.id, 'null'); store.set('done:' + ep.id, '1');
    P.auto = false; $('b-auto').classList.remove('on'); setSkip(false); toggleHide(false);
    Sound.setMusic(ep.endMusic || (S.config.music && S.config.music.ending) || '');
    staticBurst();

    // данные
    const met = new Set(); let rolls = 0, ok = 0;
    ep.scenes.forEach((sc) => { Object.keys(sc.stage || {}).forEach((x) => met.add(x)); sc.lines.forEach((l) => { if (l.c) met.add(l.c); if (l.show) Object.keys(l.show).forEach((x) => met.add(x)); if (l.roll) { rolls++; if (l.roll.success) ok++; } }); });
    met.delete('narrator');
    const players = (ep.players || []).map(char).filter(Boolean);
    const npcs = [...met].map(char).filter((c) => c && !players.includes(c));
    const list = epList(); const nx = list[list.indexOf(ep) + 1];

    const steps = [];
    steps.push(`<div class="end-title">${ransom('Конец эпизода')}<small>${esc(ep.title)}</small></div>`);
    steps.push(`<div class="credits"><div class="end-h">${ransom('В ролях')}</div>
      <div class="cr-row">${players.map((c) => `<div class="cr" style="--c:${esc(c.color)}"><img class="${A().spriteCls(c, 'default')}" src="${esc(spriteSrc(c, 'default'))}" alt=""><b>${esc(c.name)}</b><small>${esc(c.player || '')}</small></div>`).join('')}</div>
      ${npcs.length ? `<p class="cr-npc">${npcs.map((c) => esc(c.name)).join(' · ')}<br><small>Все остальные роли: ${esc(S.config.gm)}</small></p>` : ''}
      <p class="cr-gm">Ведущий — <b>${esc(S.config.gm)}</b> · ${esc(S.config.channel)}</p>
      ${S.config.about && S.config.about.music ? `<p class="cr-npc"><small>Музыка — ${esc(S.config.about.music.name)}</small></p>` : ''}</div>`);
    steps.push(`<div class="summary"><div class="end-h">${ransom('Итоги')}</div>
      <div class="sum-grid">
        <div><div class="eyebrow">Дело ${Case.progress(ep).found}/${Case.progress(ep).total}</div>${caseList(ep)}</div>
        <div><div class="eyebrow">Встречены</div>${npcs.map((c) => `<p style="color:${esc(c.color)}">· ${esc(c.name)}</p>`).join('') || '<p class="muted">—</p>'}
          <p class="muted mono">Жетоны неудачи: ${Case.tokens()}</p></div>
      </div>${bonusNote(ep)}</div>`);
    if (ep.teaser && (ep.teaser.lines || []).length) steps.push('TEASER');
    steps.push(`<div class="links">${ransom(nx ? 'Продолжение' : 'Продолжение следует')}<div class="btns">
      ${nx ? `<a class="btn hot" href="#play-${nx.id}">Эпизод ${esc(A().epNo(nx))}: ${esc(nx.title)}</a>` : ''}
      ${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Полная запись</a>` : ''}
      <a class="btn ink" href="#ep-${ep.id}">К эпизоду</a><a class="btn ink" href="#">На главную</a></div></div>`);

    const el = overlay(`<div class="ending"><div class="end-in" id="end-in"></div><button class="skip" id="end-next">Дальше ▸</button></div>`, 'ov-end');
    for (let i = 0; i < steps.length && P; i++) {
      const box = $('end-in');
      $('end-next').hidden = i === steps.length - 1;
      if (steps[i] === 'TEASER') { await teaser(box); continue; }
      box.innerHTML = steps[i]; box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
      if (i === steps.length - 1) break;
      await new Promise((res) => { const f = (e) => { if (e && e.target && e.target.closest && e.target.closest('a')) return; el.removeEventListener('click', f); el.removeEventListener('skip', f); res(); }; el.addEventListener('click', f); el.addEventListener('skip', f); });
      staticBurst(200);
    }
  }
  async function teaser(box) {
    const { ransom, esc, char, loc, bgSrc } = A();
    const t = P.ep.teaser;
    box.innerHTML = `<div class="teaser" ${t.bg ? `style="background-image:url('${bgSrc(loc(t.bg))}')"` : ''}><div class="end-h">${ransom(t.title || 'В следующем эпизоде')}</div><div class="tz-line" id="tz"></div></div>`;
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
    const el = P.overlay;
    for (const l of t.lines) {
      if (!P) return;
      const c = l.c && char(l.c);
      const z = $('tz'); z.classList.remove('gl'); void z.offsetWidth; z.classList.add('gl');
      z.innerHTML = `${c ? `<b style="color:${esc(c.color)}">${esc(c.short || c.name)}</b>` : ''}<span>${esc(l.text)}</span>`;
      await new Promise((res) => { const f = () => { el.removeEventListener('click', f); el.removeEventListener('skip', f); res(); }; el.addEventListener('click', f); el.addEventListener('skip', f); later(f, 3400); });
      staticBurst(160);
    }
  }

  function caseList(ep) {
    const { esc } = A(); const ids = Case.checkedClues(ep);
    if (!ids.length) return '<p class="muted">—</p>';
    return ids.map((id) => { const k = (ep.clues || []).find((x) => x.id === id) || { name: id }; const s = Case.status(ep, id);
      return s === 'found' ? `<p class="cl-found">● ${esc(k.name)}</p>` : s === 'auto' ? `<p class="cl-auto">○ ${esc(k.name)} <small>без кубиков</small></p>` : s === 'partial' ? `<p class="cl-part">◐ ${esc(k.name)} <small>обрывок</small></p>` : `<p class="cl-none">? ? ?</p>`; }).join('');
  }
  function bonusNote(ep) {
    const { esc } = A(); if (!ep.bonus) return '';
    if (Case.bonusOpen(ep)) return `<p class="bonus-note open">Дело раскрыто! Открыт бонус: <a href="#bonus-${ep.id}">${esc(ep.bonus.title || 'Бонус')} →</a></p>`;
    const p = Case.progress(ep);
    return `<p class="bonus-note">${p.auto ? 'Бонус открывается только тем, кто ищет улики сам: включите в ⚙ «Бросать кубики самому» и пройдите эпизод снова.' : `Найдите все улики (${p.found}/${p.total}), чтобы открыть бонус. Перепройдите эпизод — найденное сохранится.`}</p>`;
  }

  // ---------- Панели ----------
  function closePanel() { if (P.panel) { P.panel.remove(); P.panel = null; } }
  function panel(kind) {
    if (!P) return;
    const same = P.panel && P.panel.dataset.k === kind; closePanel(); if (same) return;
    const { esc, lineText } = A(); const ep = P.ep;
    const el = document.createElement('div'); el.className = 'side'; el.dataset.k = kind;
    el.onclick = (e) => e.stopPropagation();
    if (kind === 'log') el.innerHTML = `<h3>История</h3>${P.log.slice().reverse().map((x) => `<div class="log-item">${x.c && !x.ln.n ? `<b style="color:${esc(x.c.color)}">${esc(x.c.short || x.c.name)}</b>` : ''}<p>${esc(lineText(x.ln))}</p></div>`).join('') || '<p class="muted">Пока пусто.</p>'}`;
    if (kind === 'scenes') {
      el.innerHTML = `<h3>Сцены</h3>${ep.scenes.map((s, i) => `<button class="jump ${i === P.si ? 'on' : ''}" data-i="${i}"><span class="mono">${String(i + 1).padStart(2, '0')}</span> ${esc(s.title)}</button>`).join('')}`;
      el.querySelectorAll('.jump').forEach((b) => b.onclick = () => { closePanel(); const [a, c] = settle(ep, +b.dataset.i, 0); go(a, c, true); });
    }
    if (kind === 'clues') {
      const ids = Case.checkedClues(ep); const p = Case.progress(ep);
      el.innerHTML = `<h3>Дело ${p.found}/${p.total}</h3><p class="muted">Жетоны неудачи: ${Case.tokens()}</p>` + (ids.map((id) => { const k = (ep.clues || []).find((x) => x.id === id) || { name: id, text: '' }; const st = Case.status(ep, id);
        if (st === 'found' || st === 'auto') return `<div class="log-item"><b>${esc(k.name)}</b>${st === 'auto' ? ' <small class="muted">без кубиков</small>' : ''}<p>${esc(k.text)}</p></div>`;
        if (st === 'partial') return `<div class="log-item"><b>${esc(k.name)}</b> <small class="muted">обрывок</small><p>${esc(k.partial || '')}</p></div>`;
        return `<div class="log-item"><b>? ? ?</b><p class="muted">Ещё не найдено.</p></div>`; }).join('') || '<p class="muted">В этом эпизоде нет улик.</p>') + (ep.bonus ? `<p class="muted" style="margin-top:14px">${Case.bonusOpen(ep) ? `Бонус открыт: <a href="#bonus-${ep.id}">${esc(ep.bonus.title || 'Бонус')}</a>` : 'Соберите все улики, чтобы открыть бонус.'}</p>` : '');
    }
    if (kind === 'settings') {
      const s = P.set;
      el.innerHTML = `<h3>Настройки</h3>
        <label class="tg"><input type="checkbox" id="st-sound" ${s.sound ? 'checked' : ''}> Звук и музыка</label>
        <label class="tg"><input type="checkbox" id="st-dice" ${s.dice ? 'checked' : ''}> Бросать кубики самому <small class="muted">выкл. — улики выдаются сами, но бонус не откроется</small></label>
        <label class="tg"><input type="checkbox" id="st-intro" ${s.intro ? 'checked' : ''}> Заставка перед эпизодом</label>
        <label class="tg tg-sel">Эффекты <select id="st-fx">
          <option value="all" ${(s.fx || 'all') === 'all' ? 'selected' : ''}>Все</option>
          <option value="soft" ${s.fx === 'soft' ? 'selected' : ''}>Мягкие — без вспышек и тряски</option>
          <option value="off" ${s.fx === 'off' ? 'selected' : ''}>Выключить анимацию</option>
        </select></label>
        <p class="muted">Настройки сохраняются в этом браузере.</p>
        <button class="btn ink" type="button" id="st-reset">Сбросить прогресс</button>
        <small class="muted" style="display:block;margin-top:6px">Удалит сохранения, найденные улики, жетоны, открытые треки и бонусы — сайт откроется как в первый раз.</small>`;
      el.querySelector('#st-sound').onchange = (e) => { s.sound = e.target.checked; saveSettings(s); $('b-sound').textContent = s.sound ? 'Звук' : 'Без звука'; Sound.unlock(); Sound.mute(!s.sound); };
      el.querySelector('#st-dice').onchange = (e) => { s.dice = e.target.checked; saveSettings(s); };
      el.querySelector('#st-intro').onchange = (e) => { s.intro = e.target.checked; saveSettings(s); };
      el.querySelector('#st-fx').onchange = (e) => { s.fx = e.target.value; saveSettings(s); if (window.App && App.applyFx) App.applyFx(); };
      el.querySelector('#st-reset').onclick = () => {
        if (!confirm('Сбросить весь прогресс? Сохранения, улики, жетоны, треки и бонусы будут удалены.')) return;
        try {
          const keys = []; for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
          keys.filter((k) => /^(corpsman:|case:|bonus:|progress:|done:)/.test(k)).forEach((k) => localStorage.removeItem(k));
        } catch (e) {}
        location.hash = '#'; location.reload();
      };
    }
    $('stage').appendChild(el); P.panel = el;
  }

  window.Player = { open, close };
})();
