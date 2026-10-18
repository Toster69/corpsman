/* Corpsman · Санитары — база знаний.
   Все тексты лежат в data/*.json. Этот файл трогать не нужно, чтобы добавлять эпизоды. */
(function () {
  const $app = document.getElementById('app');
  const S = { config: null, chars: [], locs: [], eps: {} };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const char = (id) => S.chars.find((c) => c.id === id);
  const loc = (id) => S.locs.find((l) => l.id === id);
  const secs = (t) => (t ? String(t).split(':').map(Number).reduce((a, b) => a * 60 + b, 0) : 0);
  const ytLink = (ep, t) => (ep && ep.video ? `https://www.youtube.com/watch?v=${ep.video}${t ? '&t=' + secs(t) + 's' : ''}` : '');
  const epList = () => (S.config.episodes || []).map((id) => S.eps[id]).filter(Boolean);
  const lineText = (ln) => ln.say || ln.think || ln.n || (ln.roll ? `${ln.roll.stat} ${ln.roll.die}, сложность ${ln.roll.dc}` : '');
  const pad2 = (n) => String(n ?? '').padStart(2, '0');
  // Номер эпизода для показа: код из JSON (A0, A1-1…) или номер с нулём
  const epNo = (ep) => (ep && ep.code) || pad2(ep && ep.number);

  // ---------- Картинки ----------
  function spriteSrc(c, e) { if (!c) return ''; const sp = c.sprites || {}; return sp[e] || sp.default || Art.sprite(c, e); }
  function blinkSrc(c, e) {
    if (!c) return '';
    const sp = c.sprites || {};
    if (sp[e + '_blink']) return sp[e + '_blink'];
    if ((!e || e === 'default') && sp.blink) return sp.blink;
    if (sp[e] || sp.default) return ''; // своя картинка без кадра моргания — не моргаем
    return Art.sprite(c, e, { blink: true });
  }
  function bgSrc(l) { return l && l.bg ? l.bg : Art.background(l || { id: 'x', preset: 'plain' }); }
  window.__imgFallback = function (img, cid, e) { img.onerror = null; const c = char(cid); if (c) img.src = Art.sprite(c, e); };
  window.__bgFallback = function (el, lid) { const l = loc(lid); if (l) el.style.backgroundImage = `url('${Art.background(l)}')`; };
  // Свои спрайты обычно уже с белой обводкой — тогда CSS-обводку не добавляем
  function spriteCls(c, e) {
    if (!c) return 'sticker';
    const sp = c.sprites || {}; const own = !!(sp[e] || sp.default);
    const mode = (S.config.novel || {}).outline || 'auto';
    if (c.outline === true || mode === 'always') return 'sticker';
    if (c.outline === false || mode === 'never') return 'own';
    return own ? 'own' : 'sticker';
  }
  function cutout(c, e, cls = '') {
    return `<img class="${spriteCls(c, e)} ${cls}" alt="${esc(c.name)}" src="${esc(spriteSrc(c, e))}" onerror="__imgFallback(this,'${c.id}','${e || 'default'}')">`;
  }
  // Обложка эпизода: "cover" в файле эпизода — путь к картинке или id локации; иначе фон первой сцены
  function coverStyle(ep) {
    const c = ep.cover;
    if (c && /[\/.]/.test(c)) return `style="background-image:url('${esc(c)}')"`;
    const first = ep.scenes[0];
    return bgStyle(loc(c || (first && first.bg)));
  }
  function bgStyle(l, extra = '') {
    const src = bgSrc(l);
    if (l && l.bg) { const im = new Image(); im.onerror = () => document.querySelectorAll(`[data-bg="${l.id}"]`).forEach((el) => __bgFallback(el, l.id)); im.src = src; }
    return `style="background-image:url('${src}');${extra}" data-bg="${l ? l.id : ''}"`;
  }

  // ---------- Вырезанные буквы ----------
  const R_FONTS = ["'Oswald', sans-serif", "'Rubik Mono One', sans-serif", "'PT Serif', serif", "'Russo One', sans-serif", "'Unbounded', sans-serif", "'Rubik', sans-serif"];
  const R_INK = ['#e8452c', '#57c84d', '#f2d230', '#7d4fcf', '#3e66d6', '#22b8cf', '#ef7f7a'];
  function ransom(text, opt = {}) {
    const r = Art.rng(Art.hash(text + (opt.seed || '')));
    const words = String(text).split(/\s+/).filter(Boolean);
    const html = words.map((w) => '<span class="rw">' + [...w].map((ch, i) => {
      const k = r();
      let bg, fg;
      if (k < 0.42) { bg = 'var(--paper)'; fg = 'var(--k)'; }
      else if (k < 0.74) { bg = 'var(--k)'; fg = 'var(--paper)'; }
      else if (k < 0.86) { bg = '#d9d6cc'; fg = 'var(--k)'; }
      else { bg = R_INK[Math.floor(r() * R_INK.length)]; fg = 'var(--k)'; }
      if (opt.mono) { bg = i % 2 ? 'var(--paper)' : 'var(--k)'; fg = i % 2 ? 'var(--k)' : 'var(--paper)'; }
      const f = R_FONTS[Math.floor(r() * R_FONTS.length)];
      const rot = ((r() - 0.5) * 9).toFixed(1);
      const sz = (0.86 + r() * 0.3).toFixed(2);
      const up = r() > 0.35;
      const dy = ((r() - 0.5) * 0.12).toFixed(2);
      return `<span class="rl" style="--rot:${rot}deg;--dy:${dy}em;font-family:${f};font-size:${sz}em;background:${bg};color:${fg};--d:${i * 45}ms">${esc(up ? ch.toUpperCase() : ch.toLowerCase())}</span>`;
    }).join('') + '</span>').join('<span class="rsp"> </span>');
    return `<span class="ransom ${opt.cls || ''}" role="text" aria-label="${esc(text)}"><span aria-hidden="true">${html}</span></span>`;
  }

  // ---------- Рваный край ----------
  function torn(seed, amp = 1.6, step = 2.5, sides = 'tb') {
    const r = Art.rng(Art.hash(seed));
    const pts = [];
    const j = () => (r() * amp).toFixed(2);
    if (sides.includes('t')) for (let x = 0; x <= 100; x += step) pts.push(`${Math.min(x, 100)}% ${j()}%`); else pts.push('0% 0%', '100% 0%');
    if (sides.includes('r')) for (let y = step; y < 100; y += step) pts.push(`${(100 - r() * amp).toFixed(2)}% ${y}%`);
    if (sides.includes('b')) for (let x = 100; x >= 0; x -= step) pts.push(`${Math.max(x, 0)}% ${(100 - r() * amp).toFixed(2)}%`); else pts.push('100% 100%', '0% 100%');
    if (sides.includes('l')) for (let y = 100 - step; y > 0; y -= step) pts.push(`${(r() * amp).toFixed(2)}% ${y}%`);
    return `clip-path:polygon(${pts.join(',')})`;
  }

  // ---------- Фоновая музыка сайта (на страницах базы знаний, не в новелле) ----------
  const SiteMusic = {
    a: null, unlocked: false, failed: false, onPage: false,
    src() { return !this.failed && S.config && S.config.siteMusic ? (S.config.siteMusic.src || S.config.siteMusic) : ''; },
    vol() { return (S.config.siteMusic && S.config.siteMusic.volume) || 0.35; },
    wanted() { return store.get('corpsman:siteMusic') !== 'off'; },
    el() {
      if (this.a || !this.src()) return this.a;
      this.a = new Audio(this.src()); this.a.loop = true; this.a.volume = 0;
      this.a.onerror = () => { this.failed = true; this.a = null; const b = document.getElementById('music-btn'); if (b) b.remove(); };
      return this.a;
    },
    fade(to, ms, done) {
      const a = this.a; if (!a) return; const from = a.volume, t0 = performance.now();
      cancelAnimationFrame(this.raf);
      const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = from + (to - from) * k; if (k < 1) this.raf = requestAnimationFrame(step); else if (done) done(); };
      step();
    },
    play() { const a = this.el(); if (!a || !this.unlocked || !this.wanted() || !this.onPage) return; a.play().then(() => this.fade(this.vol(), 1500)).catch(() => {}); this.paint(); },
    pause() { if (this.a && !this.a.paused) this.fade(0, 600, () => this.a && this.a.pause()); this.paint(); },
    toggle() { store.set('corpsman:siteMusic', this.wanted() ? 'off' : 'on'); this.unlocked = true; this.wanted() ? this.play() : this.pause(); this.paint(); },
    page(on) { this.onPage = on; on ? this.play() : this.pause(); },
    paint() {
      const b = document.getElementById('music-btn'); if (!b) return;
      const playing = this.a && !this.a.paused && this.wanted();
      b.setAttribute('aria-pressed', this.wanted()); b.classList.toggle('on', !!playing); b.classList.toggle('wait', this.wanted() && !playing);
      b.querySelector('b').textContent = this.wanted() ? 'Музыка' : 'Без музыки';
    }
  };
  // браузеры разрешают звук только после первого действия пользователя
  const unlockMusic = (e) => { if (SiteMusic.unlocked || (e.target.closest && e.target.closest('#music-btn'))) return; SiteMusic.unlocked = true; SiteMusic.play(); };
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, unlockMusic, { capture: true }));

  // ---------- Данные ----------
  async function loadJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Не удалось загрузить ' + path);
    return r.json();
  }
  async function load() {
    S.config = await loadJSON('data/config.json');
    S.chars = await loadJSON('data/characters.json');
    S.locs = await loadJSON('data/locations.json');
    for (const id of S.config.episodes || []) {
      try { S.eps[id] = await loadJSON(`data/episodes/${id}.json`); } catch (e) { console.warn(e); }
    }
  }

  function allLines() {
    const out = [];
    epList().forEach((ep) => ep.scenes.forEach((sc) => sc.lines.forEach((ln, li) => out.push({ ep, sc, ln, li }))));
    return out;
  }
  function appearances(cid) {
    const res = [];
    epList().forEach((ep) => {
      const scenes = ep.scenes.filter((sc) => (sc.stage && sc.stage[cid]) || sc.lines.some((l) => l.c === cid || (l.show && l.show[cid])));
      if (scenes.length) res.push({ ep, scenes });
    });
    return res;
  }

  // ---------- Каркас ----------
  function shell(active, inner) {
    const tabs = [['episodes', 'Эпизоды'], ['characters', 'Персонажи'], ['locations', 'Локации'], ['clues', 'Улики'], ['world', 'Мир'], ['search', 'Поиск'], ['music', 'Музыка'], ['channel', 'Канал']];
    const logo = S.config.logo || 'assets/brand/logo.webp';
    $app.innerHTML = `
      <header class="top"><div class="top-in">
        <a class="brand" href="#" aria-label="${esc(S.config.title)} — на главную"><img src="${esc(logo)}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(S.config.title)}'))"></a>
        <nav class="nav">${tabs.map(([h, t]) => `<a href="#${h}" class="${active === h ? 'on' : ''}">${t}</a>`).join('')}</nav>
        ${SiteMusic.src() ? `<button class="music-btn" id="music-btn" type="button" aria-pressed="${SiteMusic.wanted()}" title="Музыка на сайте"><span class="eq"><i></i><i></i><i></i></span><b>${SiteMusic.wanted() ? 'Музыка' : 'Без музыки'}</b></button>` : ''}
      </div></header>
      <main class="wrap">${inner}</main>
      <footer class="foot"><div class="foot-in">
        <span>${esc(S.config.title)} · ${esc(S.config.system)}${S.config.about && S.config.about.music ? ` · Музыка: <a href="${esc(S.config.about.music.url)}" target="_blank" rel="noopener">${esc(S.config.about.music.name)}</a>` : ''}</span>
        <span>Пересказ игр канала <a href="#channel">${esc(S.config.channel)}</a> · ведущий ${esc(S.config.gm)}</span>
        <span class="foot-copy">${esc(S.config.copyright || '© 2014–2026 Тостер Годя · «Санитары» / Corpsman.')} Тексты и рисунки — <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.ru" target="_blank" rel="noopener">CC BY-NC-ND 4.0</a>, код — все права защищены, музыка принадлежит её авторам.</span>
      </div></footer>`;
    window.scrollTo(0, 0);
    const mb = document.getElementById('music-btn');
    if (mb) { mb.onclick = (e) => { e.stopPropagation(); SiteMusic.toggle(); }; SiteMusic.paint(); }
  }
  const head = (eyebrow, title, lead) => `<header class="page-head"><div class="eyebrow">${esc(eyebrow)}</div><h1>${ransom(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</header>`;


  // ---------- Эпизоды: два вида ----------
  // «По порядку событий» — все эпизоды в порядке config.episodes, первый крупно, остальные компактно;
  //   перед первым эпизодом стоит плашка «Начало» с линией, а где история переключается на другую линию — «Тем временем».
  // «По линиям» — каждая линия своей колонкой (на телефоне — друг под другом).
  // Выбор зрителя запоминается; вид по умолчанию — config.episodesView: "chrono" или "lines".
  const LANE_COLORS = ['#f2d230', '#22b8cf', '#e8457a', '#7cc46a'];
  function lineList() {
    const lines = (S.config.lines && S.config.lines.length ? S.config.lines : [{ id: 'A', name: 'Линия A' }])
      .map((l, i) => Object.assign({}, l, { color: l.color || LANE_COLORS[i % 4], eps: [] }));
    epList().forEach((e) => {
      const id = e.line || lines[0].id;
      let l = lines.find((x) => x.id === id);
      if (!l) { l = { id, name: 'Линия ' + id, color: LANE_COLORS[lines.length % 4], eps: [] }; lines.push(l); }
      l.eps.push(e);
    });
    return lines;
  }
  const lineOf = (ep, lines) => lines.find((l) => l.id === (ep.line || lines[0].id)) || lines[0];
  function epView() { const v = store.get('corpsman:epView') || S.config.episodesView; return v === 'lines' ? 'lines' : 'chrono'; }
  // Эпизод другой линии, после которого начинается эта история ("after" указывает на чужую линию)
  function startsAfter(ep, lines) {
    const p = ep.after && S.eps[ep.after];
    return p && lineOf(p, lines) !== lineOf(ep, lines) ? p : null;
  }

  function epItem(ep, lines, size) {
    const ln = lineOf(ep, lines);
    return `<article class="ec ec-${size}" data-ep="${esc(ep.id)}" style="--lc:${esc(ln.color)};${torn('ec' + ep.id, 1, 3, 'tb')}">
      <a class="ec-pic ht" href="#play-${ep.id}" ${coverStyle(ep)} aria-label="Играть: ${esc(ep.title)}"><span class="ec-no">${ransom(epNo(ep), { seed: 'n' + ep.id })}</span></a>
      <div class="ec-body">
        <div class="ec-meta"><span class="ec-line">Линия ${esc(ln.id)}</span><span class="ec-code">Эпизод ${esc(epNo(ep))}</span>${ep.badge ? `<span class="badge">${esc(ep.badge)}</span>` : ''}</div>
        <h3>${esc(ep.title)}</h3>
        ${ep.tagline ? `<p class="tagline">${esc(ep.tagline)}</p>` : ''}
        <p class="ec-sum">${esc(ep.summary)}</p>
        ${saveSlot(ep)}${caseBadge(ep)}
        <div class="btns">
          <a class="btn hot" href="#play-${ep.id}">▶ Играть</a>
          <a class="btn" href="#ep-${ep.id}">Сцены</a>
          ${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Запись</a>` : ''}
        </div>
      </div>
    </article>`;
  }
  function laneHead(ln) {
    return `<header class="lane-h"><span class="lane-id">${ransom(ln.id, { seed: 'l' + ln.id })}</span><div><b>${esc(ln.name || 'Линия ' + ln.id)}</b>${ln.sub ? `<small>${esc(ln.sub)}</small>` : ''}</div></header>`;
  }
  function chronoView(lines) {
    let prev = null;
    return `<div class="ev-chrono">${epList().map((e, i) => {
      const ln = lineOf(e, lines);
      const sep = !prev || lineOf(prev, lines) !== ln
        ? `<div class="ev-sep${prev ? '' : ' first'}" style="--lc:${esc(ln.color)}"><span class="ev-sep-t">${prev ? 'Тем временем' : 'Начало'}</span><span class="ev-sep-n">Линия ${esc(ln.id)} · ${esc(ln.name)}${ln.sub ? ` <small>${esc(ln.sub)}</small>` : ''}</span></div>` : '';
      prev = e;
      return sep + epItem(e, lines, i === 0 ? 'big' : 'small');
    }).join('')}</div>`;
  }
  function linesView(lines) {
    return `<div class="ev-lines" style="--lanes:${lines.length}">${lines.map((ln) => {
      const p = ln.eps[0] && startsAfter(ln.eps[0], lines);
      return `<section class="ev-lane" style="--lc:${esc(ln.color)}">
        ${laneHead(ln)}
        ${p ? `<p class="ev-note">Идёт параллельно с линией ${esc(lineOf(p, lines).id)}. Начинается после эпизода <a href="#ep-${p.id}">${esc(epNo(p))} «${esc(p.title)}»</a>.</p>` : ''}
        ${ln.eps.length ? ln.eps.map((e, i) => epItem(e, lines, i === 0 ? 'big' : 'small')).join('')
          : `<div class="ec-soon"><b>Скоро</b><p>${esc(ln.soon || 'Эпизоды этой линии ещё в пути.')}</p></div>`}
      </section>`;
    }).join('')}</div>`;
  }
  function epTree() {
    if (!epList().length) return '<p class="muted">Пока нет эпизодов.</p>';
    const lines = lineList(); const v = epView();
    const hint = v === 'lines'
      ? 'Каждая история отдельно — от первого эпизода до последнего.'
      : 'Обе истории идут в одно время и в одном городе. Здесь эпизоды стоят в порядке событий.';
    const b = (id, t) => `<button type="button" data-epview="${id}" aria-pressed="${v === id}">${t}</button>`;
    return `<div class="ev-wrap" id="eps" data-view="${v}">
      <div class="ev-bar"><div class="ev-switch" role="group" aria-label="Как показать эпизоды">${b('chrono', 'По порядку событий')}${b('lines', 'По линиям')}</div><p class="ev-hint">${hint}</p></div>
      ${v === 'lines' ? linesView(lines) : chronoView(lines)}
    </div>`;
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-epview]'); if (!btn) return;
    store.set('corpsman:epView', btn.dataset.epview);
    const box = document.getElementById('eps'); if (box) box.outerHTML = epTree();
    const nb = document.querySelector(`[data-epview="${btn.dataset.epview}"]`); if (nb) nb.focus({ preventScroll: true });
  });

  function epCard(ep) {
    return `<article class="ep" style="${torn('ep' + ep.id, 1.2, 3, 'tb')}">
      <a class="ep-pic ht" href="#play-${ep.id}" ${coverStyle(ep)} aria-label="Читать: ${esc(ep.title)}">
        <span class="ep-no">${ransom(epNo(ep), { seed: 'n' })}</span>
      </a>
      <div class="ep-body">
        <div class="eyebrow">Эпизод ${epNo(ep)}${ep.badge ? ` <span class="badge">${esc(ep.badge)}</span>` : ''}</div>
        <h3>${esc(ep.title)}</h3>
        ${ep.tagline ? `<p class="tagline">${esc(ep.tagline)}</p>` : ''}
        <p>${esc(ep.summary)}</p>
        ${saveSlot(ep)}${caseBadge(ep)}
        <div class="btns">
          <a class="btn hot" href="#play-${ep.id}">▶ Играть</a>
          <a class="btn" href="#ep-${ep.id}">Сцены</a>
          ${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Запись</a>` : ''}
        </div>
      </div>
    </article>`;
  }

  function saveSlot(ep) {
    let p = null; try { p = JSON.parse(store.get('progress:' + ep.id) || 'null'); } catch (e) {}
    const sc = p && ep.scenes.find((x) => x.id === p.s);
    if (!sc) return '';
    const i = ep.scenes.indexOf(sc);
    return `<div class="save"><span>● Сохранение</span> Сцена ${pad2(i + 1)} · ${esc(sc.title)}<i style="--p:${Math.round((i + 1) / ep.scenes.length * 100)}%"></i></div>`;
  }

  function caseBadge(ep) {
    if (!window.Case) return '';
    const p = Case.progress(ep); if (!p.total) return '';
    return `<div class="case-badge"><span>Дело ${p.found}/${p.total}</span>${'<i class="on"></i>'.repeat(p.found)}${'<i></i>'.repeat(p.total - p.found)}${ep.bonus ? (Case.bonusOpen(ep) ? ` <a href="#bonus-${ep.id}">бонус открыт →</a>` : ' <em>бонус закрыт</em>') : ''}</div>`;
  }

  function bonusPage(id) {
    const ep = S.eps[id]; if (!ep || !ep.bonus) return notFound();
    const b = ep.bonus; const p = Case.progress(ep);
    if (!Case.bonusOpen(ep)) {
      return shell('episodes', `${head('Бонус · эпизод ' + epNo(ep), 'Закрыто', p.auto ? 'Бонус открывается только тем, кто ищет улики сам. Включите в настройках новеллы (⚙) «Бросать кубики самому» и пройдите эпизод снова.' : `Найдите все улики эпизода, чтобы открыть этот материал. Сейчас в деле ${p.found} из ${p.total}.`)}
        <div class="btns"><a class="btn hot" href="#play-${ep.id}">▶ Играть эпизод ${epNo(ep)}</a></div>`);
    }
    shell('episodes', `${head('Бонус · эпизод ' + epNo(ep), b.title || 'Бонус', b.text || '')}
      ${b.scene ? `<div class="btns"><a class="btn hot" href="#play-${ep.id}-bonus">▶ Секретная сцена</a></div>` : ''}
      ${(b.images || []).length ? `<div class="gallery">${b.images.map((im) => { const src = typeof im === 'string' ? im : im.src; const cap = typeof im === 'string' ? '' : im.caption || ''; return `<figure><a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${esc(cap)}" loading="lazy"></a>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`; }).join('')}</div>` : ''}
      ${b.note ? `<div class="callout" style="margin-top:28px">${esc(b.note)}</div>` : ''}`);
  }

  function charGrid() {
    return `<div class="cast">${S.chars.filter((c) => !(c.id === 'narrator' || c.narrator === true)).map((c, i) => `
      <a class="who" href="#char-${c.id}" style="--c:${esc(c.color)}">
        <span class="who-shape" style="${torn('w' + c.id, 6, 8, 'tblr')};transform:rotate(${(i % 2 ? 3 : -4)}deg)"></span>
        <span class="who-pic">${cutout(c, 'default')}</span>
        <span class="who-tag"><b>${esc(c.short || c.name)}</b><small>${esc(c.role)}</small></span>
      </a>`).join('')}</div>`;
  }

  // ---------- Страницы ----------
  // Куда ведёт «Играть»: эпизод с сохранением, иначе первый непройденный, иначе первый
  function nextToPlay() {
    const list = epList();
    const saved = list.find((e) => { try { return !!JSON.parse(store.get('progress:' + e.id) || 'null'); } catch (x) { return false; } });
    return saved || list.find((e) => !store.get('done:' + e.id)) || list[0];
  }

  function home() {
    const ep = nextToPlay();
    const banner = S.config.banner || 'assets/brand/banner.webp';
    shell('', `
      <section class="hero">
        <div class="hero-img" style="background-image:url('${esc(banner)}');${torn('hero', 2.2, 2, 'b')}" role="img" aria-label="${esc(S.config.title)}"></div>
        <div class="hero-row">
          <div class="clip home-start" style="${torn('clip', 2.5, 4, 'tblr')}">
            <div class="eyebrow">${esc(S.config.system)}</div>
            <p class="pitch">${esc(S.config.retell || 'Визуальная новелла по играм канала {channel}: сессии можно не только посмотреть, но и пройти самому.').replace('{channel}', `<a href="#channel">${esc(S.config.channel)}</a>`)}</p>
            <div class="btns">
              ${ep ? playButton(ep) : ''}
              <a class="btn ink" href="#characters">Кто есть кто</a>
            </div>
          </div>
          ${newsHome()}
        </div>
      </section>
      <h2>${ransom('Эпизоды')}</h2>
      ${epTree()}
      <h2>${ransom('Персонажи')}</h2>
      ${charGrid()}
      ${aboutHome()}`);
  }

  // Главная кнопка: продолжить с сохранения, иначе следующий непройденный эпизод, иначе начать с первого
  function playButton(ep) {
    let p = null; try { p = JSON.parse(store.get('progress:' + ep.id) || 'null'); } catch (e) {}
    const sc = p && ep.scenes.find((x) => x.id === p.s);
    const anyDone = epList().some((e) => store.get('done:' + e.id));
    const label = sc ? `Продолжить: ${epNo(ep)} · сцена ${pad2(ep.scenes.indexOf(sc) + 1)}`
      : anyDone ? `Следующий эпизод: ${epNo(ep)}` : `Начать с эпизода ${epNo(ep)}`;
    return `<a class="btn hot" href="#play-${ep.id}" title="${sc ? esc(`«${ep.title}» — ${sc.title}`) : ''}">▶ ${esc(label)}</a>`;
  }

  // «О проекте» внизу главной: слева лор, автор и музыка, справа история проекта
  function aboutHome() {
    const a = S.config.about || {};
    return `<section class="about" id="about">
      <h2>${ransom(a.title || 'О проекте')}</h2>
      <div class="about-grid">
        <div class="about-txt">
          <div class="eyebrow">${esc(S.config.system)}</div>
          ${S.config.intro ? `<p class="read">${esc(S.config.intro)}</p>` : ''}
          ${a.lead ? `<p class="read">${esc(a.lead)}</p>` : ''}
          ${a.text ? `<p class="read muted-read">${esc(a.text)}</p>` : ''}
          ${a.music ? `<p class="music-credit">Музыка в играх — ${extLink(a.music.url, a.music.name)}${a.music.quote ? `<small>«${esc(a.music.quote)}»</small>` : ''}</p>` : ''}
        </div>
        ${timelineBlock()}
      </div>
    </section>`;
  }

  // Внешние ссылки открываются в новой вкладке, ссылки внутри сайта (#…) — в этой же
  function extLink(url, t) { return url ? `<a href="${esc(url)}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ''}>${esc(t)}</a>` : esc(t); }

  // История проекта: "about.timeline" в config.json
  function timelineBlock() {
    const a = S.config.about || {};
    if (!(a.timeline || []).length) return '';
    return `<div class="tl-wrap"><div class="eyebrow">История проекта</div><ol class="timeline">${a.timeline.map((t, i) => `<li style="${torn('tl' + i, 2.4, 5, 'tblr')};--i:${i}">
          <span class="tl-when">${esc(t.when || '')}</span>
          <span class="tl-what">${esc(t.what || '')}</span>
          <b>${extLink(t.url, t.title)}</b>
          ${t.text ? `<small>${esc(t.text)}</small>` : ''}
        </li>`).join('')}</ol></div>`;
  }

  // Новости сайта: "news" в config.json — [{ "date", "title", "text", "link" }], самые свежие сверху.
  // На главной — первые "newsShow" (по умолчанию 3) коротким списком рядом с кнопкой «Играть», все новости — на странице #news.
  function newsItem(x) {
    const inner = `<time>${esc(x.date || '')}</time><p><b>${esc(x.title || '')}</b>${x.text ? `<span>${esc(x.text)}</span>` : ''}</p>`;
    return `<li>${x.link ? `<a href="${esc(x.link)}"${/^https?:/.test(x.link) ? ' target="_blank" rel="noopener"' : ''}>${inner}<i aria-hidden="true">→</i></a>` : `<div>${inner}</div>`}</li>`;
  }
  function newsHome() {
    const list = S.config.news || []; if (!list.length) return '';
    const n = S.config.newsShow || 3;
    const row = (x) => {
      const inner = `<time>${esc(x.date || '')}</time><b>${esc(x.title || '')}</b>`;
      return `<li>${x.link ? `<a href="${esc(x.link)}"${/^https?:/.test(x.link) ? ' target="_blank" rel="noopener"' : ''}>${inner}<i aria-hidden="true">→</i></a>` : `<div>${inner}</div>`}</li>`;
    };
    return `<aside class="news-box" style="${torn('news', 2.5, 4, 'tblr')}" aria-label="Новости сайта">
      <div class="eyebrow">${esc(S.config.newsTitle || 'Что нового')}</div>
      <ul class="news-rows">${list.slice(0, n).map(row).join('')}</ul>
      <a class="news-all" href="#news">Все новости${list.length > n ? ` (${list.length})` : ''} →</a>
    </aside>`;
  }
  function newsPage() {
    const list = S.config.news || [];
    shell('news', `${head('Обновления сайта', S.config.newsTitle || 'Что нового', 'Что появилось на сайте и что изменилось — самые свежие новости сверху.')}
      <section class="news news-page">${list.length ? `<ul class="news-list">${list.map(newsItem).join('')}</ul>` : '<p class="muted">Пока новостей нет.</p>'}</section>`);
  }


  function episodes() { shell('episodes', `${head('Архив', 'Эпизоды', S.config.treeLead || '')}${epTree()}`); }

  function episodePage(id) {
    const ep = S.eps[id]; if (!ep) return notFound();
    const rolls = [];
    ep.scenes.forEach((sc) => sc.lines.forEach((l) => l.roll && rolls.push({ sc, l })));
    shell('episodes', `
      ${head('Эпизод ' + epNo(ep) + (ep.badge ? ' · ' + ep.badge : ''), ep.title, ep.tagline ? ep.tagline + ' ' + ep.summary : ep.summary)}
      <div class="btns"><a class="btn hot" href="#play-${ep.id}">Читать</a>${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Полная запись</a>` : ''}</div>
      ${caseBadge(ep)}
      <h2 class="h2s">Сцены</h2>
      <ol class="scenes">${ep.scenes.map((sc, i) => { const l = loc(sc.bg); return `<li>
        <a class="sc-pic ht" href="#play-${ep.id}-${sc.id}" ${bgStyle(l)}><span>${pad2(i + 1)}</span></a>
        <div class="sc-txt"><b>${esc(sc.title)}</b><small>${esc((l || {}).name || '')}${ep.video && sc.t ? ' · ' + esc(sc.t) : ''}</small></div>
        ${ep.video && sc.t ? `<a class="tc" href="${ytLink(ep, sc.t)}" target="_blank" rel="noopener" title="Открыть момент в записи">▶ ${esc(sc.t)}</a>` : ''}
      </li>`; }).join('')}</ol>
      ${(ep.clues || []).length ? `<h2 class="h2s">Дело</h2>${caseNotes(ep)}` : ''}
      ${rolls.length ? `<details class="rolls-wrap"><summary>Журнал бросков (${rolls.length})</summary><div class="table-x"><table class="rolls"><thead><tr><th>Время</th><th>Кто</th><th>Проверка</th><th>Итог</th><th>Зачем</th></tr></thead><tbody>
        ${rolls.map(({ l }) => { const r = l.roll, c = char(r.who); return `<tr><td class="mono">${ep.video && l.t ? `<a href="${ytLink(ep, l.t)}" target="_blank" rel="noopener">${esc(l.t)}</a>` : '—'}</td><td>${esc(c ? c.short || c.name : r.who)}</td><td class="mono">${esc(r.stat)} ${esc(r.die)} · сл. ${esc(r.dc)}${r.result != null ? ' · ' + r.result : ''}</td><td>${r.success ? 'успех' : 'провал'}${r.tokens ? ` <span class="muted">· ${esc(r.tokens)}</span>` : ''}</td><td class="muted">${esc(r.note || '')}</td></tr>`; }).join('')}
      </tbody></table></div></details>` : ''}`);
  }

  // Улики показываются только когда зритель их нашёл (в новелле); остальные — «? ? ?»
  function clueStatus(ep, k) {
    const st = window.Case ? Case.status(ep, k.id) : 'found';
    return st || '';
  }
  function caseNotes(ep, linkFor) {
    return `<div class="notes">${(ep.clues || []).map((k, i) => {
      const st = clueStatus(ep, k);
      if (st === 'found' || st === 'auto') return note(k, i, linkFor ? linkFor(k) : '');
      if (st === 'partial') return note({ id: k.id, name: k.name, text: k.partial || 'Остался только обрывок.' }, i, '<small class="note-tag">обрывок · можно перебросить при новом прохождении</small>');
      return `<div class="note note-locked" style="${torn('k' + k.id, 2, 5, 'tblr')}"><b>? ? ?</b><p>Улика ещё не найдена. Пройдите эпизод, чтобы открыть её.</p></div>`;
    }).join('')}</div>`;
  }

  function note(k, i, extra = '') {
    return `<div class="note" style="${torn('k' + k.id, 2, 5, 'tblr')}"><b>${esc(k.name)}</b><p>${esc(k.text)}</p>${extra}</div>`;
  }

  function charPage(id) {
    const c = char(id); if (!c) return notFound();
    const app = appearances(id);
    const quotes = allLines().filter((x) => x.ln.c === id && x.ln.say).slice(0, 6);
    shell('characters', `
      <div class="dossier" style="--c:${esc(c.color)}">
        <div class="d-pic"><span class="who-shape" style="${torn('d' + c.id, 5, 7, 'tblr')}"></span>${cutout(c, 'default')}</div>
        <div class="d-txt">
          <div class="eyebrow">${esc(c.role)}</div>
          <h1>${ransom(c.name)}</h1>
          <dl class="kv">
            <dt>Игрок</dt><dd>${c.playerUrl ? `<a href="${esc(c.playerUrl)}" target="_blank" rel="noopener">${esc(c.player || '—')}</a>` : esc(c.player || '—')}</dd>
            <dt>Возраст</dt><dd>${esc(c.age || '—')}</dd>
            ${Object.keys(c.stats || {}).length ? `<dt>Кубики</dt><dd class="mono">${Object.entries(c.stats).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(' · ')}</dd>` : ''}
            ${(c.tags || []).length ? `<dt>Метки</dt><dd>${c.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}</dd>` : ''}
          </dl>
          <p class="read">${esc(c.description)}</p>
          ${quotes.length ? `<h2 class="h2s">Реплики</h2>${quotes.map((q) => `<blockquote class="quote">«${esc(q.ln.say)}»<a href="#play-${q.ep.id}-${q.sc.id}-${q.li}">${esc(q.sc.title)}${q.ln.t ? ' · ' + esc(q.ln.t) : ''} →</a></blockquote>`).join('')}` : ''}
          <h2 class="h2s">Появления</h2>
          ${app.length ? app.map((a) => `<p><b>${esc(a.ep.title)}</b><br>${a.scenes.map((sc) => `<a href="#play-${a.ep.id}-${sc.id}">${esc(sc.title)}</a>`).join(' · ')}</p>`).join('') : '<p class="muted">Пока только в разговорах.</p>'}
        </div>
      </div>`);
  }

  function locations() {
    shell('locations', `${head('Карта', 'Локации')}<div class="locs">${S.locs.map((l) => `
      <a class="loc" href="#loc-${l.id}"><span class="loc-pic ht" ${bgStyle(l)}></span><span class="loc-txt"><b>${esc(l.name)}</b><small>${esc(l.description)}</small></span></a>`).join('')}</div>`);
  }
  function locPage(id) {
    const l = loc(id); if (!l) return notFound();
    const scenes = [];
    epList().forEach((ep) => ep.scenes.forEach((sc) => { if (sc.bg === id || sc.lines.some((x) => x.bg === id)) scenes.push({ ep, sc }); }));
    shell('locations', `<div class="loc-hero ht" ${bgStyle(l, torn('lh' + id, 2, 2, 'b'))}></div>
      ${head('Локация', l.name, l.description)}
      <h2 class="h2s">Сцены здесь</h2>${scenes.length ? `<ol class="scenes">${scenes.map(({ ep, sc }, i) => `<li><a class="sc-pic ht" href="#play-${ep.id}-${sc.id}" ${bgStyle(loc(sc.bg))}><span>${pad2(i + 1)}</span></a><div class="sc-txt"><b>${esc(sc.title)}</b><small>${esc(ep.title)}</small></div></li>`).join('')}</ol>` : '<p class="muted">Здесь ещё ничего не происходило.</p>'}`);
  }

  function clues() {
    const blocks = epList().filter((ep) => (ep.clues || []).length).map((ep) => {
      const where = {};
      ep.scenes.forEach((sc) => sc.lines.forEach((l, li) => { const id = l.clue || (l.check && l.check.clue); if (id && !where[id]) where[id] = { sc, li }; }));
      const p = window.Case ? Case.progress(ep) : { found: 0, total: 0 };
      return `<h2 class="h2s">${esc(ep.title)} · дело ${p.found}/${p.total}</h2>${caseNotes(ep, (k) => { const w = where[k.id]; return w ? `<a class="mono" href="#play-${ep.id}-${w.sc.id}">${esc(w.sc.title)} →</a>` : ''; })}`;
    }).join('');
    shell('clues', `${head('Расследование', 'Улики', 'Здесь собирается ваше дело: улики появляются, когда вы находите их в эпизодах.')}${blocks || '<p class="muted">Пока пусто.</p>'}`);
  }

  function world() {
    shell('world', `${head(S.config.system, 'Мир', S.config.intro)}
      ${(S.config.worldSections && S.config.worldSections.length ? S.config.worldSections : [{ title: 'Словарь', items: S.config.glossary || [] }]).map((sec, si) => `<h2 class="h2s">${esc(sec.title)}</h2><div class="notes">${(sec.items || []).map((g, i) => note({ id: 'w' + si + '-' + i, name: g.term, text: g.text }, i)).join('')}</div>`).join('')}`);
  }

  function search() {
    shell('search', `${head('Поиск', 'Кто что сказал')}
      <label class="sr" for="q">Поиск по репликам</label>
      <input id="q" class="search" type="search" placeholder="Например: портсигар, Картер, 1886" autocomplete="off"><div id="hits"></div>`);
    const q = document.getElementById('q'), hits = document.getElementById('hits');
    const lines = allLines().filter((x) => !x.ln.roll);
    q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      if (v.length < 2) { hits.innerHTML = ''; return; }
      const found = lines.filter((x) => lineText(x.ln).toLowerCase().includes(v)).slice(0, 80);
      const re = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      hits.innerHTML = found.length ? found.map((x) => { const c = char(x.ln.c); return `<a class="hit" href="#play-${x.ep.id}-${x.sc.id}-${x.li}">
        <small>${esc(x.ep.title)} · ${esc(x.sc.title)}${x.ln.t ? ' · ' + esc(x.ln.t) : ''}</small>
        <span>${c ? `<b style="color:${esc(c.color)}">${esc(c.short || c.name)}:</b> ` : ''}${esc(lineText(x.ln)).replace(re, (m) => `<mark>${m}</mark>`)}</span></a>`; }).join('') : '<p class="muted">Ничего не нашлось.</p>';
    };
    q.focus();
  }

  function channel() {
    const c = S.config.channelPage; if (!c) return notFound();
    shell('channel', `${head('Канал', c.title || S.config.channel, c.lead)}
      ${c.note ? `<p class="callout">${esc(c.note)}</p>` : ''}
      <h2 class="h2s">Миры</h2>
      <div class="worlds">${(c.worlds || []).map((w, i) => `<article class="world${w.here ? ' here' : ''}" style="${torn('wo' + i, 1.6, 4, 'tblr')}">
        <div class="eyebrow">${esc(w.system)}${w.here ? ' · вы здесь' : ''}</div>
        <h3>${ransom(w.name)}</h3><p>${esc(w.text)}</p></article>`).join('')}</div>
      ${c.art ? `<p class="read" style="margin-top:28px">${esc(c.art)}</p>` : ''}
      <h2 class="h2s">Ссылки</h2>
      <div class="links-grid">${(c.links || []).map((l) => `<a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener"><b>${esc(l.name)}</b><span>${esc(l.label)}</span></a>`).join('')}</div>`);
  }

  function musicPage() {
    const list = window.Music ? Music.list() : [];
    const open = list.filter((t) => Music.isOpen(t)).length;
    const m = S.config.about && S.config.about.music;
    shell('music', `${head('Кассета', 'Музыка', `Треки из игр. Один уже на кассете, остальные открываются, когда звучат в новелле. Открыто ${open} из ${list.length}.`)}
      <ol class="tracks">${list.map((t, i) => Music.isOpen(t)
        ? `<li><button class="trk" data-track="${i}"><span class="trk-n">${pad2(i + 1)}</span><b>${esc(t.title)}</b><small>${esc(t.artist || (m ? m.name : ''))}${t.where ? ' · ' + esc(t.where) : ''}</small><span class="trk-p">▶</span></button></li>`
        : `<li><div class="trk locked"><span class="trk-n">${pad2(i + 1)}</span><b>? ? ?</b><small>${esc(t.hint || 'Откроется в одном из эпизодов')}</small><span class="trk-p">🔒︎</span></div></li>`).join('')}</ol>
      ${m ? `<p class="music-credit" style="margin-top:28px">Музыка для игр — <a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.name)}</a><small>«${esc(m.quote || '')}»</small></p>` : ''}`);
    document.querySelectorAll('[data-track]').forEach((b) => b.onclick = () => { const i = +b.dataset.track; if (Music.current() === i && Music.playing()) Music.pause(); else Music.play(i); });
    Music.repaint();
  }

  function notFound() { shell('', `${head('404', 'Здесь пусто', 'Такой страницы нет. Возможно, эпизод ещё не добавлен в data/config.json.')}<a class="btn" href="#">На главную</a>`); }

  // ---------- Роутер ----------
  function route() {
    if (window.Player) Player.close();
    SiteMusic.page(!location.hash.startsWith('#play-'));
    const h = decodeURIComponent(location.hash.slice(1));
    const [k, a, b, c] = h.split('-');
    if (!h) return home();
    if (k === 'episodes') return episodes();
    if (k === 'ep') return episodePage(a);
    if (k === 'bonus') return bonusPage(a);
    if (k === 'play' && b === 'bonus' && S.eps[a] && !Case.bonusOpen(S.eps[a])) { location.hash = 'bonus-' + a; return; }
    if (k === 'play') return S.eps[a] ? Player.open(S.eps[a], b, c !== undefined ? parseInt(c, 10) : undefined) : notFound();
    if (k === 'characters') return shell('characters', `${head('Досье', 'Персонажи')}${charGrid()}`);
    if (k === 'char') return charPage(a);
    if (k === 'locations') return locations();
    if (k === 'loc') return locPage(a);
    if (k === 'clues') return clues();
    if (k === 'world') return world();
    if (k === 'channel') return channel();
    if (k === 'music') return musicPage();
    if (k === 'search') return search();
    if (k === 'news') return newsPage();
    notFound();
  }
  window.addEventListener('hashchange', route);

  // Уровень эффектов из настроек плеера: all / soft / off
  function applyFx() {
    let fx = 'all';
    try { fx = (JSON.parse(localStorage.getItem('corpsman:settings') || '{}').fx) || 'all'; } catch (e) {}
    const h = document.documentElement;
    h.classList.toggle('fx-soft', fx === 'soft');
    h.classList.toggle('fx-off', fx === 'off');
  }
  applyFx();

  window.App = { epNo, applyFx, S, bgStyle, spriteCls, store, esc, char, loc, ytLink, epList, lineText, spriteSrc, blinkSrc, bgSrc, ransom, torn, pad2, root: $app };
  load().then(() => { if (window.Music) Music.init(S.config); route(); }).catch((e) => {
    $app.innerHTML = `<main class="wrap">${'<h1>Не загрузились данные</h1>'}<p class="lead">${esc(e.message)}</p>
      <p class="muted">Если вы открыли index.html двойным щелчком, браузер не даёт читать файлы с диска. Запустите в папке проекта <code>python -m http.server</code> и откройте http://localhost:8000, или смотрите сайт на GitHub Pages.</p></main>`;
  });
})();
