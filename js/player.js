/* Плеер визуальной новеллы: стартовый экран, заставка, «Ранее в…», сцены, финал.
   Читает эпизод из data/episodes/*.json. */
(function () {
  const A = () => window.App;
  const PERSIST = ['negative', 'rain', 'vhs', 'film', 'mirror'];
  const POS = { farleft: 13, left: 26, center: 50, right: 74, farright: 87 };
  let P = null; // текущее состояние плеера

  // ---------- Настройки ----------
  const SET_KEY = 'corpsman:settings';
  function settings() { try { return Object.assign({ sound: true, rolls: true, intro: true, speed: 1 }, JSON.parse(A().store.get(SET_KEY) || '{}')); } catch (e) { return { sound: true, rolls: true, intro: true, speed: 1 }; } }
  function saveSettings(s) { A().store.set(SET_KEY, JSON.stringify(s)); }

  // ---------- Звук ----------
  const Sound = {
    ctx: null, music: null, cur: '', vol: 0.55,
    unlock() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) {} },
    on() { return P && P.set.sound; },
    setMusic(src) {
      src = src && src !== 'none' ? src : '';
      if (src === this.cur) return;
      this.cur = src;
      const old = this.music; this.music = null;
      if (old) this.fade(old, 0, 900, () => { old.pause(); });
      if (!src) return;
      const a = new Audio(src); a.loop = true; a.volume = 0; this.music = a;
      if (this.on()) a.play().then(() => this.fade(a, this.vol, 1400)).catch(() => {});
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
      if (!isRoll(ep.scenes[si].lines[li])) return [si, li];
    }
  }
  function settle(ep, si, li) {
    if (!ep.scenes[si]) { si = 0; li = 0; }
    li = Math.max(0, Math.min(li || 0, ep.scenes[si].lines.length - 1));
    if (isRoll(ep.scenes[si].lines[li])) { const n = nextPos(ep, si, li, 1); if (n) return n; }
    return [si, li];
  }
  function rollsBefore(sc, li) { const out = []; for (let i = li - 1; i >= 0 && isRoll(sc.lines[i]); i--) out.unshift(sc.lines[i].roll); return out; }

  // ---------- Открытие ----------
  function open(ep, sceneId, lineIdx) {
    close();
    const { esc, S } = A();
    const set = settings();
    P = { ep, si: 0, li: 0, typing: null, auto: false, autoT: null, panel: null, overlay: null, timers: new Set(), log: [], set, lastBg: null, lastScene: -1, rain: null, busy: false };
    document.body.classList.add('playing');
    const root = document.createElement('div');
    root.className = 'player'; root.id = 'player';
    root.innerHTML = `
      <div class="p-bar">
        <a href="#ep-${ep.id}" class="pb" title="Выйти (Esc)" aria-label="Выйти">✕</a>
        <span class="p-title"><b>${esc(String(ep.number).padStart(2, '0'))}</b> ${esc(ep.title)} <span id="p-sc"></span></span>
        <button class="pb" id="b-back" title="Назад (←)" aria-label="Назад">◀</button>
        <button class="pb" id="b-auto" title="Автопрокрутка">Авто</button>
        <button class="pb" id="b-sound" title="Звук">${set.sound ? 'Звук' : 'Без звука'}</button>
        <button class="pb" id="b-log">Лог</button>
        <button class="pb" id="b-scenes">Сцены</button>
        <button class="pb" id="b-clues">Улики</button>
        <button class="pb" id="b-set" aria-label="Настройки">⚙</button>
      </div>
      <div class="p-wrap"><div class="stage" id="stage" tabindex="0" aria-live="polite">
        <div class="bg" id="bg1"></div><div class="bg" id="bg2" style="opacity:0"></div>
        <div class="layer ht-layer"></div>
        <div class="sprites" id="sprites"></div>
        <canvas class="layer rain" id="rain" hidden></canvas>
        <div class="layer vhs-layer"><span class="osd">PLAY ▶</span></div>
        <div class="layer film-layer"></div>
        <div class="layer mirror-layer"></div>
        <div class="bug">${esc(S.config.channel || '').replace(' ', '<br>')}</div>
        <div class="box" id="box">
          <div class="box-bg" style="${A().torn('box' + ep.id, 3, 1.6, 't')}"></div>
          <div class="plate" id="plate" hidden></div>
          <div class="txt" id="txt"></div>
          <div class="meta"><span class="chip-roll" id="chip" hidden></span><span id="tc"></span><span class="next" id="nexti"></span></div>
        </div>
        <div class="layer static" id="static"></div>
      </div></div>`;
    document.body.appendChild(root);
    const stage = $('stage');
    $('static').style.backgroundImage = `url('${Art.noise(128, 255)}')`;
    root.querySelector('.film-layer').style.backgroundImage = `url('${Art.noise(160, 40)}')`;

    stage.addEventListener('click', (e) => {
      Sound.unlock();
      if (e.target.closest('a,button,.ov,.side')) return;
      if (P.panel) return closePanel();
      next();
    });
    stage.addEventListener('keydown', (e) => {
      if (P.overlay) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); P.overlay.dispatchEvent(new CustomEvent('skip')); } return; }
      if (['ArrowRight', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); Sound.unlock(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
      if (e.key === 'Escape') { if (P.panel) closePanel(); else location.hash = 'ep-' + ep.id; }
    });
    $('b-back').onclick = back;
    $('b-auto').onclick = () => { P.auto = !P.auto; $('b-auto').classList.toggle('on', P.auto); if (P.auto && !P.typing && !P.overlay) next(); else clearTimeout(P.autoT); };
    $('b-sound').onclick = () => { Sound.unlock(); P.set.sound = !P.set.sound; saveSettings(P.set); $('b-sound').textContent = P.set.sound ? 'Звук' : 'Без звука'; Sound.mute(!P.set.sound); };
    $('b-log').onclick = () => panel('log');
    $('b-scenes').onclick = () => panel('scenes');
    $('b-clues').onclick = () => panel('clues');
    $('b-set').onclick = () => panel('settings');
    stage.focus();

    if (!sceneId) startScreen();
    else { const si = Math.max(0, ep.scenes.findIndex((s) => s.id === sceneId)); const [a, b] = settle(ep, si, Number.isFinite(lineIdx) ? lineIdx : 0); go(a, b, true); }
  }

  function close() {
    if (!P) return;
    clearInterval(P.typing); clearTimeout(P.autoT); cancelAnimationFrame(P.rain);
    P.timers.forEach((t) => clearTimeout(t));
    Sound.stopAll();
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
          <div class="eyebrow">Эпизод ${esc(ep.number)}</div>
          <div class="start-title">${ransom(ep.title)}</div>
          <div class="btns">
            ${sc ? `<button class="btn hot" data-go="resume">Продолжить: ${esc(sc.title)}</button><button class="btn ink" data-go="start">С начала</button>` : `<button class="btn hot" data-go="start">Начать</button>`}
          </div>
          <p class="hint">Клик или пробел — дальше · ← назад · звук включится после первого клика</p>
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
    if (P.set.intro) await introVideo();
    if (!P) return;
    await previously();
    if (!P) return;
    await titleCard();
    if (P) P.busy = false;
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
      items.push({ c: l.c, text: lineStr(l), bg: st.bg, e: l.c ? st.expr[l.c] : null });
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
    await wait(1600);
    for (const it of items) {
      if (skipped || !P) break;
      const c = it.c && char(it.c);
      $('rc-bg').style.backgroundImage = `url('${A().bgSrc(loc(it.bg))}')`;
      $('rc-spr').innerHTML = c ? `<img class="sticker" src="${esc(spriteSrc(c, it.e || 'default'))}" alt="">` : '';
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
    const el = overlay(`<div class="tcard"><img class="tc-logo" src="${esc(logo)}" alt="" onerror="this.remove()"><div class="eyebrow">Эпизод ${esc(P.ep.number)}</div><div class="tc-title">${ransom(P.ep.title)}</div></div>`, 'ov-title');
    return waitOverlay(el, 3600).then(() => { if (P) { closeOverlay(); staticBurst(); } });
  }

  // ---------- Показ строки ----------
  function go(si, li, fresh) { P.si = si; P.li = li; show(fresh); }

  function setBg(id) {
    const { bgSrc, loc } = A();
    const l = loc(id); const src = bgSrc(l);
    if (src === P.lastBg) return; P.lastBg = src;
    const a = $('bg1'), b = $('bg2'); const top = a.style.opacity === '0' ? a : b, bottom = top === a ? b : a;
    top.style.backgroundImage = `url('${src}')`; top.style.opacity = '1'; bottom.style.opacity = '0';
    if (l && l.bg) { const im = new Image(); im.onerror = () => { top.style.backgroundImage = `url('${Art.background(l)}')`; }; im.src = src; }
  }

  function renderSprites(st, speaker) {
    const { char, spriteSrc, blinkSrc } = A();
    const box = $('sprites'); const keep = new Set();
    Object.entries(st.stage).forEach(([cid, pos], idx) => {
      const c = char(cid); if (!c) return; keep.add(cid);
      const e = st.expr[cid] || 'default';
      let w = box.querySelector(`[data-c="${cid}"]`);
      if (!w) {
        w = document.createElement('div'); w.className = 'spr gone'; w.dataset.c = cid;
        w.innerHTML = `<img class="sticker" alt="${A().esc(c.name)}" style="animation-delay:-${(idx * 1.3).toFixed(1)}s">`;
        box.appendChild(w); requestAnimationFrame(() => w.classList.remove('gone'));
      }
      const img = w.querySelector('img');
      const src = spriteSrc(c, e);
      if (img.dataset.src !== src) {
        img.dataset.src = src; img.src = src;
        img.onerror = () => { img.onerror = null; img.dataset.custom = ''; img.src = Art.sprite(c, e); img.dataset.blink = Art.sprite(c, e, { blink: true }); };
        img.dataset.blink = blinkSrc(c, e) || '';
        scheduleBlink(img);
      }
      w.style.left = (POS[pos] ?? (parseFloat(pos) || 50)) + '%';
      w.classList.toggle('speak', cid === speaker);
      w.classList.toggle('dim', !!speaker && cid !== speaker && speaker !== 'narrator');
      w.classList.toggle('glitchy', e === 'glitch');
      w.classList.toggle('mirror', cid === 'narrator');
      w.classList.toggle('immune', !!c.immune || cid === 'stranger');
    });
    box.querySelectorAll('.spr').forEach((w) => { if (!keep.has(w.dataset.c)) { w.classList.add('gone'); later(() => w.remove(), 450); } });
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
    const cv = $('rain'); cv.hidden = !on; cancelAnimationFrame(P.rain); if (!on) return;
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
    const { ep } = P; const { char, ransom, esc, ytLink, store, S } = A();
    const sc = ep.scenes[P.si]; const ln = sc.lines[P.li];
    const stage = $('stage');
    const st = stateAt(ep, P.si, P.li);
    $('p-sc').textContent = '· ' + sc.title;
    const sceneChanged = P.lastScene !== P.si; P.lastScene = P.si;
    if (sceneChanged && fresh) staticBurst(260);
    setBg(st.bg);
    PERSIST.forEach((f) => stage.classList.toggle('fx-' + f, !!st.fx[f]));
    rain(!!st.fx.rain);
    renderSprites(st, ln.c);
    if (fresh) oneShot(ln.fx);
    Sound.setMusic(st.music);
    if (fresh && ln.sfx) Sound.sfx(ln.sfx);

    stage.querySelectorAll('.sc-card').forEach((x) => x.remove());
    if (sceneChanged && fresh) {
      const t = document.createElement('div'); t.className = 'sc-card';
      t.innerHTML = `<small>Сцена ${String(P.si + 1).padStart(2, '0')}</small>${ransom(sc.title)}`;
      stage.appendChild(t); later(() => t.remove(), 2900);
    }

    // плашка имени
    const c = char(ln.c); const plate = $('plate');
    if (c && (ln.say || ln.think)) {
      plate.hidden = false; plate.style.setProperty('--c', c.color || '#efece2');
      plate.innerHTML = ransom(c.short || c.name, { seed: c.id }) + (ln.think ? '<i>мысли</i>' : '');
    } else plate.hidden = true;

    const tx = $('txt');
    tx.className = 'txt ' + (ln.think ? 'think' : ln.say ? 'say' : 'narr');
    if (c && ln.think) tx.style.setProperty('--c', c.color); else tx.style.removeProperty('--c');
    type(tx, ln.think ? `«${ln.think}»` : lineStr(ln));

    // тихая пометка броска
    const chip = $('chip'); const rolls = rollsBefore(sc, P.li);
    if (P.set.rolls && rolls.length) {
      chip.hidden = false;
      chip.innerHTML = rolls.map((r) => `<span class="${r.success ? 'ok' : 'bad'}">${esc(r.stat)} ${esc(r.die)} · сл. ${esc(r.dc)}${r.result != null ? ' · ' + esc(r.result) : ''} · ${r.success ? 'успех' : 'провал'}</span>`).join('');
      if (fresh) Sound.sfx(S.config.sounds && S.config.sounds.roll, 0.6);
    } else chip.hidden = true;

    $('tc').innerHTML = ln.t && ep.video ? `<a href="${ytLink(ep, ln.t)}" target="_blank" rel="noopener" title="Открыть этот момент в записи">▶ ${esc(ln.t)}</a>` : esc(ln.t || '');

    if (ln.clue && fresh) {
      const k = (ep.clues || []).find((x) => x.id === ln.clue);
      if (k) {
        const t = document.createElement('div'); t.className = 'toast'; t.style.cssText = A().torn('t' + k.id, 3, 6, 'tblr');
        t.innerHTML = `${ransom('Улика', { seed: 'clue' })}<b>${esc(k.name)}</b>`;
        stage.appendChild(t); later(() => t.remove(), 3600);
        Sound.sfx(S.config.sounds && S.config.sounds.clue, 0.7);
      }
    }
    if (fresh) P.log.push({ c, ln });
    try { history.replaceState(null, '', `#play-${ep.id}-${sc.id}-${P.li}`); } catch (e) {}
    store.set('progress:' + ep.id, JSON.stringify({ s: sc.id, l: P.li }));
  }

  function type(el, text) {
    clearInterval(P.typing); clearTimeout(P.autoT);
    el.textContent = ''; let i = 0; $('nexti').style.visibility = 'hidden';
    const done = () => { clearInterval(P.typing); P.typing = null; el.textContent = text; $('nexti').style.visibility = 'visible'; if (P.auto) P.autoT = later(next, 1500 + text.length * 28); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done();
    P.typing = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) done(); }, 22);
    P.finishType = done;
  }

  function next() {
    if (!P || P.overlay || P.busy) return;
    clearTimeout(P.autoT);
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
    store.set('progress:' + ep.id, 'null');
    P.auto = false; $('b-auto').classList.remove('on');
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
      <div class="cr-row">${players.map((c) => `<div class="cr" style="--c:${esc(c.color)}"><img class="sticker" src="${esc(spriteSrc(c, 'default'))}" alt=""><b>${esc(c.name)}</b><small>${esc(c.player || '')}</small></div>`).join('')}</div>
      ${npcs.length ? `<p class="cr-npc">${npcs.map((c) => esc(c.name)).join(' · ')}<br><small>Все остальные роли: ${esc(S.config.gm)}</small></p>` : ''}
      <p class="cr-gm">Ведущий — <b>${esc(S.config.gm)}</b> · ${esc(S.config.channel)}</p></div>`);
    steps.push(`<div class="summary"><div class="end-h">${ransom('Итоги')}</div>
      <div class="sum-grid">
        <div><div class="eyebrow">Улики</div>${(ep.clues || []).map((k) => `<p>· ${esc(k.name)}</p>`).join('') || '<p class="muted">—</p>'}</div>
        <div><div class="eyebrow">Встречены</div>${npcs.map((c) => `<p style="color:${esc(c.color)}">· ${esc(c.name)}</p>`).join('') || '<p class="muted">—</p>'}
          ${rolls ? `<p class="muted mono">Бросков ${rolls} · успехов ${ok} · провалов ${rolls - ok}</p>` : ''}</div>
      </div></div>`);
    if (ep.teaser && (ep.teaser.lines || []).length) steps.push('TEASER');
    steps.push(`<div class="links">${ransom(nx ? 'Продолжение' : 'Продолжение следует')}<div class="btns">
      ${nx ? `<a class="btn hot" href="#play-${nx.id}">Эпизод ${esc(nx.number)}: ${esc(nx.title)}</a>` : ''}
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
      const seen = new Set(); ep.scenes.forEach((s, i) => s.lines.forEach((l, j) => { if (l.clue && (i < P.si || (i === P.si && j <= P.li))) seen.add(l.clue); }));
      const list = (ep.clues || []).filter((k) => seen.has(k.id));
      el.innerHTML = `<h3>Улики</h3>${list.map((k) => `<div class="log-item"><b>${esc(k.name)}</b><p>${esc(k.text)}</p></div>`).join('') || '<p class="muted">Пока ничего не найдено.</p>'}`;
    }
    if (kind === 'settings') {
      const s = P.set;
      el.innerHTML = `<h3>Настройки</h3>
        <label class="tg"><input type="checkbox" id="st-sound" ${s.sound ? 'checked' : ''}> Звук и музыка</label>
        <label class="tg"><input type="checkbox" id="st-rolls" ${s.rolls ? 'checked' : ''}> Показывать броски кубиков</label>
        <label class="tg"><input type="checkbox" id="st-intro" ${s.intro ? 'checked' : ''}> Заставка перед эпизодом</label>
        <p class="muted">Настройки сохраняются в этом браузере.</p>`;
      el.querySelector('#st-sound').onchange = (e) => { s.sound = e.target.checked; saveSettings(s); $('b-sound').textContent = s.sound ? 'Звук' : 'Без звука'; Sound.unlock(); Sound.mute(!s.sound); };
      el.querySelector('#st-rolls').onchange = (e) => { s.rolls = e.target.checked; saveSettings(s); show(false); };
      el.querySelector('#st-intro').onchange = (e) => { s.intro = e.target.checked; saveSettings(s); };
    }
    $('stage').appendChild(el); P.panel = el;
  }

  window.Player = { open, close };
})();
