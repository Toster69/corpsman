/* Санитары — база знаний и плеер визуальной новеллы.
   Все тексты лежат в data/*.json. Этот файл трогать не нужно, чтобы добавлять эпизоды. */
(function () {
  const $app = document.getElementById('app');
  const S = { config: null, chars: [], locs: [], eps: {}, drafts: false };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    keys() { try { return Object.keys(localStorage); } catch (e) { return []; } }
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const char = (id) => S.chars.find((c) => c.id === id);
  const loc = (id) => S.locs.find((l) => l.id === id);
  const secs = (t) => { if (!t) return 0; const p = String(t).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
  const ytLink = (ep, t) => ep && ep.video ? `https://www.youtube.com/watch?v=${ep.video}${t ? '&t=' + secs(t) + 's' : ''}` : '';

  // ---------- Загрузка данных (с учётом черновиков из редактора) ----------
  async function loadJSON(path) {
    const d = store.get('draft:' + path);
    if (d) { try { S.drafts = true; return JSON.parse(d); } catch (e) {} }
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Не удалось загрузить ' + path);
    return r.json();
  }
  async function load() {
    S.drafts = false;
    S.config = await loadJSON('data/config.json');
    S.chars = await loadJSON('data/characters.json');
    S.locs = await loadJSON('data/locations.json');
    S.eps = {};
    for (const id of S.config.episodes || []) {
      try { S.eps[id] = await loadJSON(`data/episodes/${id}.json`); } catch (e) { console.warn(e); }
    }
  }
  const epList = () => (S.config.episodes || []).map((id) => S.eps[id]).filter(Boolean);

  // ---------- Картинки ----------
  function spriteSrc(c, e) {
    if (!c) return '';
    const sp = c.sprites || {};
    return sp[e] || sp.default || Art.sprite(c, e);
  }
  function bgSrc(l) { if (!l) return Art.background({ id: 'x', preset: 'plain' }); return l.bg || Art.background(l); }
  // Если файл спрайта/фона не найден, подставляем заглушку
  window.__imgFallback = function (img, cid, e) { img.onerror = null; const c = char(cid); if (c) img.src = Art.sprite(c, e); };

  function cutout(c, e, cls = '') {
    return `<img class="sticker ${cls}" alt="${esc(c.name)}" src="${esc(spriteSrc(c, e))}" onerror="__imgFallback(this,'${c.id}','${e || 'default'}')">`;
  }

  // ---------- Индексы для базы знаний ----------
  function allLines() {
    const out = [];
    epList().forEach((ep) => ep.scenes.forEach((sc, si) => sc.lines.forEach((ln, li) => out.push({ ep, sc, si, ln, li }))));
    return out;
  }
  function lineText(ln) { return ln.say || ln.think || ln.n || (ln.roll ? `${ln.roll.stat} ${ln.roll.die} сложность ${ln.roll.dc}` : ''); }
  function appearances(cid) {
    const res = [];
    epList().forEach((ep) => {
      const scenes = ep.scenes.filter((sc) => (sc.stage && sc.stage[cid]) || sc.lines.some((l) => l.c === cid || (l.show && l.show[cid]) || (l.roll && l.roll.who === cid)));
      if (scenes.length) res.push({ ep, scenes });
    });
    return res;
  }

  // ---------- Каркас ----------
  function shell(active, inner) {
    const tabs = [['', 'Главная'], ['episodes', 'Эпизоды'], ['characters', 'Персонажи'], ['locations', 'Локации'], ['clues', 'Улики'], ['world', 'Мир и правила'], ['search', 'Поиск'], ['editor', 'Редактор']];
    $app.innerHTML = `
      <header class="top"><div class="top-in">
        <a class="logo" href="#">${esc(S.config.title)}</a>
        <nav class="nav">${tabs.map(([h, t]) => `<a href="#${h}" class="${active === h ? 'on' : ''}">${t}</a>`).join('')}</nav>
        ${S.drafts ? '<button class="draft-flag" id="drafts-off" title="Показаны правки из редактора, которые ещё не выложены на GitHub">черновики · сбросить</button>' : ''}
      </div></header>
      <main class="wrap">${inner}</main>`;
    const d = document.getElementById('drafts-off');
    if (d) d.onclick = async () => { store.keys().filter((k) => k.startsWith('draft:')).forEach(store.del); await load(); route(); };
    window.scrollTo(0, 0);
  }

  function epCard(ep) {
    const first = ep.scenes[0];
    return `<div class="ep-row">
      <a class="pic" href="#ep-${ep.id}" style="background-image:url('${bgSrc(loc(first && first.bg))}')" aria-label="${esc(ep.title)}"></a>
      <div style="min-width:0">
        <div class="ep-num">Эпизод ${ep.number ?? ''}</div>
        <h3><a href="#ep-${ep.id}" style="color:inherit;text-decoration:none">${esc(ep.title)}</a></h3>
        <p class="muted" style="margin:6px 0 12px;font-size:15px">${esc(ep.summary)}</p>
        <div class="btn-row" style="margin-top:0">
          <a class="btn primary" href="#play-${ep.id}">▶ Читать</a>
          <a class="btn" href="#ep-${ep.id}">Сцены и броски</a>
          ${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Запись на YouTube</a>` : ''}
        </div>
      </div></div>`;
  }

  // ---------- Страницы ----------
  function home() {
    const ep = epList()[0];
    const emily = char((ep && ep.players && ep.players[0]) || (S.chars[0] && S.chars[0].id));
    const stranger = S.chars.find((c) => c.id !== (emily && emily.id) && c.id !== 'narrator');
    shell('', `
      <section class="hero">
        <div class="tv"><div class="screen">
          <div class="bg" style="background-image:url('${bgSrc(loc('park') || S.locs[0])}')"></div>
          ${emily ? `<div style="position:absolute;left:18%;bottom:-6%;height:82%;z-index:3">${cutout(emily, 'default').replace('<img', '<img style="height:100%;width:auto"')}</div>` : ''}
          ${stranger ? `<div style="position:absolute;right:10%;bottom:-6%;height:90%;z-index:3">${cutout(stranger, 'smoke').replace('<img', '<img style="height:100%;width:auto"')}</div>` : ''}
          <div class="bug">${esc(S.config.channel).replace(' ', '<br>')}</div>
        </div></div>
        <div class="copy">
          <div class="eyebrow">${esc(S.config.system)}</div>
          <div class="hero-title">${esc(S.config.title)}</div>
          <p class="lead">${esc(S.config.intro)}</p>
          <div class="btn-row">
            ${ep ? `<a class="btn primary" href="#play-${ep.id}">▶ Читать эпизод ${ep.number}</a>` : ''}
            <a class="btn" href="#characters">Кто есть кто</a>
          </div>
        </div>
      </section>
      <h2>Эпизоды</h2>
      <div style="display:grid;gap:14px">${epList().map(epCard).join('') || '<p class="muted">Пока нет эпизодов.</p>'}</div>
      <h2>Персонажи</h2>
      ${charGrid()}
    `);
  }

  function charGrid() {
    return `<div class="grid">${S.chars.map((c) => `
      <a class="card char-card" href="#char-${c.id}">
        <div class="pic">${cutout(c, 'default')}</div>
        <div class="body"><div class="eyebrow" style="color:${esc(c.color)};margin:0">${esc(c.role)}</div><h3>${esc(c.name)}</h3><p>${esc(c.player && c.player !== '—' ? 'Играет: ' + c.player : 'Упоминается')}</p></div>
      </a>`).join('')}</div>`;
  }

  function episodes() { shell('episodes', `<div class="eyebrow">Архив</div><h1>Эпизоды</h1><div style="display:grid;gap:14px">${epList().map(epCard).join('')}</div>`); }

  function episodePage(id) {
    const ep = S.eps[id]; if (!ep) return notFound();
    const rolls = [];
    ep.scenes.forEach((sc, si) => sc.lines.forEach((l, li) => l.roll && rolls.push({ sc, si, li, l })));
    shell('episodes', `
      <div class="eyebrow">Эпизод ${ep.number ?? ''} · ${esc(ep.date || '')}</div>
      <h1>${esc(ep.title)}</h1>
      <p class="lead">${esc(ep.summary)}</p>
      <div class="btn-row"><a class="btn primary" href="#play-${ep.id}-${ep.scenes[0] ? ep.scenes[0].id : ''}">▶ Читать с начала</a>${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Запись на YouTube</a>` : ''}</div>
      <h2>Сцены</h2>
      <ol class="scene-list">${ep.scenes.map((sc, i) => `<li>
        <span class="tc">${esc(sc.t || '')}</span>
        <div style="min-width:0"><b>${esc(sc.title)}</b><div class="muted" style="font-size:13px">${esc((loc(sc.bg) || {}).name || '')}</div></div>
        <span style="display:flex;gap:6px"><a class="btn small" href="#play-${ep.id}-${sc.id}">▶ Сцена</a>${ep.video && sc.t ? `<a class="btn small" href="${ytLink(ep, sc.t)}" target="_blank" rel="noopener">Видео</a>` : ''}</span>
      </li>`).join('')}</ol>
      <h2>Журнал бросков</h2>
      <div class="table-x"><table class="rolls"><thead><tr><th>Время</th><th>Кто</th><th>Проверка</th><th>Сложность</th><th>Выпало</th><th>Итог</th><th>Зачем</th></tr></thead><tbody>
      ${rolls.map(({ sc, l }) => { const r = l.roll; const c = char(r.who); return `<tr>
        <td class="tc">${ep.video && l.t ? `<a href="${ytLink(ep, l.t)}" target="_blank" rel="noopener">${esc(l.t)}</a>` : esc(l.t || '')}</td>
        <td>${esc(c ? c.short || c.name : r.who)}</td><td>${esc(r.stat)} <span class="mono">${esc(r.die)}</span></td><td class="mono">${esc(r.dc)}</td>
        <td class="mono">${r.result ?? '—'}</td><td><span class="res ${r.success ? 'ok' : 'bad'}">${r.success ? 'успех' : 'провал'}</span>${r.tokens ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(r.tokens)}</div>` : ''}</td>
        <td>${esc(r.note || '')}<div class="muted" style="font-size:12px">${esc(sc.title)}</div></td></tr>`; }).join('')}
      </tbody></table></div>
      ${(ep.clues || []).length ? `<h2>Найденные улики</h2><div class="gloss">${ep.clues.map((k) => `<div><b>${esc(k.name)}</b><p>${esc(k.text)}</p></div>`).join('')}</div>` : ''}
    `);
  }

  function charPage(id) {
    const c = char(id); if (!c) return notFound();
    const app = appearances(id);
    const quotes = allLines().filter((x) => x.ln.c === id && x.ln.say).slice(0, 6);
    shell('characters', `
      <div class="detail">
        <div class="portrait">${cutout(c, 'default')}</div>
        <div style="min-width:0">
          <div class="eyebrow" style="color:${esc(c.color)}">${esc(c.role)}</div>
          <h1>${esc(c.name)}</h1>
          <div class="chips">${(c.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
          <dl class="kv">
            <dt>Игрок</dt><dd>${esc(c.player || '—')}</dd>
            <dt>Возраст</dt><dd>${esc(c.age || '—')}</dd>
            ${Object.keys(c.stats || {}).length ? `<dt>Кубики</dt><dd class="mono">${Object.entries(c.stats).map(([k, v]) => `${esc(k)} ${esc(v)}`).join(' · ')}</dd>` : ''}
          </dl>
          <p style="max-width:64ch">${esc(c.description)}</p>
          ${quotes.length ? `<h2>Реплики</h2>${quotes.map((q) => `<blockquote class="quote">${esc(q.ln.say)}<br><a href="#play-${q.ep.id}-${q.sc.id}-${q.li}">${esc(q.sc.title)} ${q.ln.t ? '· ' + esc(q.ln.t) : ''} →</a></blockquote>`).join('')}` : ''}
          <h2>Появления</h2>
          ${app.length ? app.map((a) => `<p><b>${esc(a.ep.title)}</b><br>${a.scenes.map((sc) => `<a href="#play-${a.ep.id}-${sc.id}">${esc(sc.title)}</a>`).join(' · ')}</p>`).join('') : '<p class="muted">Пока только в разговорах.</p>'}
        </div>
      </div>`);
  }

  function locations() {
    shell('locations', `<div class="eyebrow">Карта</div><h1>Локации</h1><div class="grid">${S.locs.map((l) => `
      <a class="card" href="#loc-${l.id}"><div class="pic" style="background-image:url('${bgSrc(l)}')"></div>
      <div class="body"><h3>${esc(l.name)}</h3><p>${esc(l.description)}</p></div></a>`).join('')}</div>`);
  }
  function locPage(id) {
    const l = loc(id); if (!l) return notFound();
    const scenes = []; epList().forEach((ep) => ep.scenes.forEach((sc) => { if (sc.bg === id || sc.lines.some((x) => x.bg === id)) scenes.push({ ep, sc }); }));
    shell('locations', `<div class="tv" style="margin-bottom:24px"><div class="screen"><div class="bg" style="background-image:url('${bgSrc(l)}')"></div></div></div>
      <div class="eyebrow">Локация</div><h1>${esc(l.name)}</h1><p class="lead">${esc(l.description)}</p>
      <h2>Сцены здесь</h2>${scenes.length ? `<ol class="scene-list">${scenes.map(({ ep, sc }) => `<li><span class="tc">${esc(sc.t || '')}</span><div><b>${esc(sc.title)}</b><div class="muted" style="font-size:13px">${esc(ep.title)}</div></div><a class="btn small" href="#play-${ep.id}-${sc.id}">▶</a></li>`).join('')}</ol>` : '<p class="muted">Здесь ещё ничего не происходило.</p>'}`);
  }

  function clues() {
    const blocks = epList().filter((ep) => (ep.clues || []).length).map((ep) => {
      const where = {}; ep.scenes.forEach((sc, si) => sc.lines.forEach((l, li) => { if (l.clue && !where[l.clue]) where[l.clue] = { sc, li, t: l.t }; }));
      return `<h2>${esc(ep.title)}</h2><div class="gloss">${ep.clues.map((k) => { const w = where[k.id]; return `<div><b>${esc(k.name)}</b><p>${esc(k.text)}</p>${w ? `<p><a class="mono" href="#play-${ep.id}-${w.sc.id}-${w.li}">${esc(w.sc.title)}${w.t ? ' · ' + esc(w.t) : ''} →</a></p>` : ''}</div>`; }).join('')}</div>`;
    }).join('');
    shell('clues', `<div class="eyebrow">Расследование</div><h1>Улики и находки</h1><p class="lead">Предметы, снимки и странности, которые всплыли в игре.</p>${blocks || '<p class="muted">Пока пусто.</p>'}`);
  }

  function world() {
    shell('world', `<div class="eyebrow">${esc(S.config.system)}</div><h1>Мир и правила</h1><p class="lead">${esc(S.config.intro)}</p>
      <h2>Словарь</h2><div class="gloss">${(S.config.glossary || []).map((g) => `<div><b>${esc(g.term)}</b><p>${esc(g.text)}</p></div>`).join('')}</div>
      <h2>За столом</h2><dl class="kv"><dt>Ведущий</dt><dd>${esc(S.config.gm)}</dd><dt>Канал</dt><dd>${esc(S.config.channel)}</dd></dl>`);
  }

  function search() {
    shell('search', `<div class="eyebrow">Поиск</div><h1>Что говорили?</h1>
      <input id="q" class="search" type="search" placeholder="Например: портсигар, Картер, 1886" autocomplete="off"><div id="hits" style="margin-top:12px"></div>`);
    const q = document.getElementById('q'), hits = document.getElementById('hits');
    const lines = allLines();
    q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      if (v.length < 2) { hits.innerHTML = ''; return; }
      const found = lines.filter((x) => lineText(x.ln).toLowerCase().includes(v)).slice(0, 80);
      const re = new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      hits.innerHTML = found.length ? found.map((x) => { const c = char(x.ln.c); return `<div class="hit"><div class="mono muted">${esc(x.ep.title)} · ${esc(x.sc.title)} ${x.ln.t ? '· ' + esc(x.ln.t) : ''}</div>
        <div>${c ? `<b style="color:${esc(c.color)}">${esc(c.short || c.name)}:</b> ` : ''}${esc(lineText(x.ln)).replace(re, (m) => `<mark>${m}</mark>`)}</div>
        <a class="mono" href="#play-${x.ep.id}-${x.sc.id}-${x.li}">открыть в новелле →</a></div>`; }).join('') : '<p class="muted">Ничего не нашлось.</p>';
    };
    q.focus();
  }

  function notFound() { shell('', `<h1>Здесь пусто</h1><p class="lead">Такой страницы нет. Возможно, эпизод ещё не добавлен в data/config.json.</p><a class="btn" href="#">На главную</a>`); }

  // ---------- Плеер ----------
  const POS = { farleft: 14, left: 25, center: 50, right: 75, farright: 86 };
  const PERSIST_FX = ['negative', 'rain'];

  function stateAt(sc, idx) {
    const st = { bg: sc.bg, stage: Object.assign({}, sc.stage || {}), expr: {}, fx: {} };
    for (let i = 0; i <= idx && i < sc.lines.length; i++) {
      const l = sc.lines[i];
      if (l.bg) st.bg = l.bg;
      if (l.show) Object.assign(st.stage, l.show);
      if (l.hide) l.hide.forEach((c) => delete st.stage[c]);
      if (l.e) { if (typeof l.e === 'string') { if (l.c) st.expr[l.c] = l.e; } else Object.assign(st.expr, l.e); }
      if (l.fx) { if (l.fx === 'none') st.fx = {}; else if (PERSIST_FX.includes(l.fx)) st.fx[l.fx] = true; }
    }
    return st;
  }

  function player(epId, sceneId, lineIdx) {
    const ep = S.eps[epId]; if (!ep || !ep.scenes.length) return notFound();
    let si = Math.max(0, ep.scenes.findIndex((s) => s.id === sceneId)); if (!sceneId) si = 0;
    let li = Number.isFinite(lineIdx) ? lineIdx : 0;
    let typing = null, auto = false, autoTimer = null, panel = null, rainAnim = null, lastBg = null;
    const log = [];

    $app.innerHTML = `<div class="player" role="dialog" aria-label="Визуальная новелла">
      <div class="p-bar">
        <a href="#ep-${ep.id}" title="Выйти">✕</a>
        <span class="title">${esc(ep.title)} · <span id="p-sc"></span></span>
        <button id="b-back" title="Назад (←)">◀</button>
        <button id="b-auto" title="Автопрокрутка">Авто</button>
        <button id="b-log" title="История">Лог</button>
        <button id="b-scenes" title="Сцены">Сцены</button>
        <button id="b-clues" title="Улики">Улики</button>
      </div>
      <div class="p-stage-wrap"><div class="p-stage" id="stage" tabindex="0">
        <div class="p-bg" id="bg1"></div><div class="p-bg" id="bg2" style="opacity:0"></div>
        <div class="p-sprites" id="sprites"></div>
        <canvas class="rain" id="rain" hidden></canvas>
        <div class="p-box" id="box"><div class="p-name" id="name" hidden></div><div class="p-text" id="text"></div>
          <div class="p-meta"><span id="tc"></span><span class="p-next" id="nexti"></span></div></div>
      </div></div></div>`;
    const $ = (id) => document.getElementById(id);
    const stage = $('stage');
    stage.focus();

    function setBg(id) {
      const src = bgSrc(loc(id)); if (src === lastBg) return; lastBg = src;
      const a = $('bg1'), b = $('bg2'); const top = a.style.opacity === '0' ? a : b, bottom = top === a ? b : a;
      top.style.backgroundImage = `url('${src}')`; top.style.opacity = '1'; bottom.style.opacity = '0';
    }
    function renderSprites(st, speaker) {
      const box = $('sprites'); const keep = new Set();
      Object.entries(st.stage).forEach(([cid, pos]) => {
        const c = char(cid); if (!c) return; keep.add(cid);
        let img = box.querySelector(`[data-c="${cid}"]`);
        const e = st.expr[cid] || 'default';
        const src = spriteSrc(c, e);
        if (!img) { img = document.createElement('img'); img.className = 'spr sticker gone'; img.dataset.c = cid; img.alt = c.name; img.onerror = () => { img.onerror = null; img.src = Art.sprite(c, e); }; box.appendChild(img); requestAnimationFrame(() => img.classList.remove('gone')); }
        if (img.dataset.src !== src) { img.src = src; img.dataset.src = src; }
        img.style.left = (POS[pos] ?? (parseFloat(pos) || 50)) + '%';
        img.classList.toggle('speak', cid === speaker);
        img.classList.toggle('dim', !!speaker && cid !== speaker && speaker !== 'narrator');
        img.classList.toggle('glitchy', e === 'glitch');
        img.classList.toggle('immune', cid === 'stranger');
      });
      box.querySelectorAll('.spr').forEach((img) => { if (!keep.has(img.dataset.c)) { img.classList.add('gone'); setTimeout(() => img.remove(), 400); } });
    }
    function rain(on) {
      const cv = $('rain'); cv.hidden = !on; cancelAnimationFrame(rainAnim); if (!on) return;
      const g = cv.getContext('2d'); cv.width = stage.clientWidth; cv.height = stage.clientHeight;
      const drops = Array.from({ length: 160 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, v: 6 + Math.random() * 8 }));
      const tick = () => { g.clearRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(210,230,240,.35)'; g.lineWidth = 1;
        drops.forEach((d) => { g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - 2, d.y + 12); g.stroke(); d.y += d.v; d.x -= 0.6; if (d.y > cv.height) { d.y = -12; d.x = Math.random() * cv.width; } });
        rainAnim = requestAnimationFrame(tick); };
      tick();
    }
    function oneShot(fx) {
      if (!fx || PERSIST_FX.includes(fx) || fx === 'none') return;
      stage.classList.remove('fx-' + fx); void stage.offsetWidth; stage.classList.add('fx-' + fx);
      setTimeout(() => stage.classList.remove('fx-' + fx), 1700);
    }
    function typeText(el, text) {
      clearInterval(typing); el.textContent = ''; let i = 0; $('nexti').style.visibility = 'hidden';
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = text; done(); return; }
      typing = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) done(); }, 22);
      function done() { clearInterval(typing); typing = null; el.textContent = text; $('nexti').style.visibility = 'visible'; if (auto) autoTimer = setTimeout(next, 1400 + text.length * 25); }
    }

    function show(fresh) {
      const sc = ep.scenes[si]; const ln = sc.lines[li]; if (!ln) return;
      $('p-sc').textContent = sc.title;
      const st = stateAt(sc, li);
      setBg(st.bg);
      stage.classList.toggle('fx-negative', !!st.fx.negative);
      rain(!!st.fx.rain);
      renderSprites(st, ln.c);
      if (fresh) oneShot(ln.fx);
      if (li === 0 && fresh) { const t = document.createElement('div'); t.className = 'p-scenetitle'; t.textContent = sc.title; stage.appendChild(t); setTimeout(() => t.remove(), 3300); }
      stage.querySelectorAll('.roll-card').forEach((x) => x.remove());
      const nm = $('name'), tx = $('text'), c = char(ln.c);
      tx.className = 'p-text' + (ln.think ? ' think' : ln.n || ln.roll ? ' narr' : '');
      if (c && (ln.say || ln.think)) { nm.hidden = false; nm.textContent = c.short || c.name; nm.style.background = c.color; } else nm.hidden = true;
      const tlink = ln.t && ep.video ? `<a href="${ytLink(ep, ln.t)}" target="_blank" rel="noopener" title="Открыть этот момент на YouTube">▶ ${esc(ln.t)}</a>` : esc(ln.t || '');
      $('tc').innerHTML = tlink;
      if (ln.roll) { rollCard(ln.roll); typeText(tx, ln.roll.note || ''); }
      else typeText(tx, (ln.think ? '«' : '') + (ln.say || ln.think || ln.n || '') + (ln.think ? '»' : ''));
      if (ln.clue && fresh) { const k = (ep.clues || []).find((x) => x.id === ln.clue); if (k) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = 'Улика: ' + k.name; stage.appendChild(t); setTimeout(() => t.remove(), 3500); } }
      if (fresh) log.push({ c, ln, sc: sc.title });
      try { history.replaceState(null, '', `#play-${ep.id}-${sc.id}-${li}`); } catch (e) {}
      store.set('progress:' + ep.id, JSON.stringify({ s: sc.id, l: li }));
    }
    function rollCard(r) {
      const c = char(r.who); const d = document.createElement('div'); d.className = 'roll-card';
      d.innerHTML = `<div class="roll-in"><div class="stat">${esc(c ? c.short || c.name : '')} · ${esc(r.stat)} ${esc(r.die)} · сложность ${esc(r.dc)}</div>
        <div class="die spin">${r.result ?? (r.success ? '✓' : '✗')}</div>
        <div class="verdict ${r.success ? 'ok' : 'bad'}">${r.success ? 'Успех' : 'Провал'}</div>
        ${r.tokens ? `<p>${esc(r.tokens)}</p>` : ''}</div>`;
      stage.appendChild(d);
    }
    function next() {
      clearTimeout(autoTimer);
      if (typing) { clearInterval(typing); typing = null; const ln = ep.scenes[si].lines[li]; $('text').textContent = ln.roll ? ln.roll.note || '' : (ln.think ? '«' : '') + (ln.say || ln.think || ln.n || '') + (ln.think ? '»' : ''); $('nexti').style.visibility = 'visible'; return; }
      if (li < ep.scenes[si].lines.length - 1) li++;
      else if (si < ep.scenes.length - 1) { si++; li = 0; }
      else return finish();
      show(true);
    }
    function back() {
      clearTimeout(autoTimer);
      if (li > 0) li--; else if (si > 0) { si--; li = ep.scenes[si].lines.length - 1; } else return;
      show(false);
    }
    function finish() {
      const idx = epList().indexOf(ep); const nx = epList()[idx + 1];
      $('name').hidden = true; $('tc').textContent = '';
      $('text').innerHTML = `<b>Конец эпизода.</b> ${nx ? `<a href="#play-${nx.id}">Следующий: ${esc(nx.title)} →</a>` : 'Продолжение следует.'} · <a href="#ep-${ep.id}">к эпизоду</a>`;
    }
    function openPanel(kind) {
      if (panel) { panel.remove(); const same = panel.dataset.k === kind; panel = null; if (same) return; }
      panel = document.createElement('div'); panel.className = 'side'; panel.dataset.k = kind;
      panel.onclick = (e) => e.stopPropagation();
      if (kind === 'log') panel.innerHTML = `<h3>История</h3>${log.slice().reverse().map((x) => `<div class="log-item">${x.c && !x.ln.n ? `<b style="color:${esc(x.c.color)}">${esc(x.c.short || x.c.name)}</b><br>` : ''}${esc(lineText(x.ln))}</div>`).join('') || '<p class="muted">Пока пусто.</p>'}`;
      if (kind === 'scenes') { panel.innerHTML = `<h3>Сцены</h3>${ep.scenes.map((s, i) => `<button class="jump ${i === si ? 'on' : ''}" data-i="${i}"><span class="tc">${esc(s.t || '')}</span> ${esc(s.title)}</button>`).join('')}`;
        panel.querySelectorAll('.jump').forEach((b) => b.onclick = () => { si = +b.dataset.i; li = 0; panel.remove(); panel = null; show(true); }); }
      if (kind === 'clues') {
        const seen = new Set(); ep.scenes.forEach((s, i) => s.lines.forEach((l, j) => { if (l.clue && (i < si || (i === si && j <= li))) seen.add(l.clue); }));
        const list = (ep.clues || []).filter((k) => seen.has(k.id));
        panel.innerHTML = `<h3>Улики</h3>${list.map((k) => `<div class="log-item"><b>${esc(k.name)}</b><br>${esc(k.text)}</div>`).join('') || '<p class="muted">Пока ничего не найдено.</p>'}`;
      }
      stage.appendChild(panel);
    }
    stage.onclick = (e) => { if (e.target.closest('a')) return; if (panel) { panel.remove(); panel = null; return; } next(); };
    stage.onkeydown = (e) => { if (['ArrowRight', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); } if (e.key === 'ArrowLeft') { e.preventDefault(); back(); } if (e.key === 'Escape' && panel) { panel.remove(); panel = null; } };
    $('b-back').onclick = back;
    $('b-auto').onclick = () => { auto = !auto; $('b-auto').classList.toggle('on', auto); if (auto && !typing) next(); else clearTimeout(autoTimer); };
    $('b-log').onclick = () => openPanel('log');
    $('b-scenes').onclick = () => openPanel('scenes');
    $('b-clues').onclick = () => openPanel('clues');
    li = Math.min(li, ep.scenes[si].lines.length - 1);
    show(true);
  }

  // ---------- Роутер ----------
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    const [k, a, b, c] = h.split('-');
    if (!h) return home();
    if (k === 'episodes') return episodes();
    if (k === 'ep') return episodePage(a);
    if (k === 'play') {
      if (!b) { try { const p = JSON.parse(store.get('progress:' + a) || 'null'); if (p && S.eps[a]) return player(a, p.s, p.l); } catch (e) {} }
      return player(a, b, c !== undefined ? parseInt(c, 10) : undefined);
    }
    if (k === 'characters') return shell('characters', `<div class="eyebrow">Досье</div><h1>Персонажи</h1>${charGrid()}`);
    if (k === 'char') return charPage(a);
    if (k === 'locations') return locations();
    if (k === 'loc') return locPage(a);
    if (k === 'clues') return clues();
    if (k === 'world') return world();
    if (k === 'search') return search();
    if (k === 'editor') return window.Editor ? Editor.open(S, { load, route, store, esc, char, loc }) : notFound();
    notFound();
  }
  // history.replaceState внутри плеера не вызывает hashchange, поэтому обычное переключение безопасно
  window.addEventListener('hashchange', route);

  window.App = { S, load, route, store, esc };
  load().then(route).catch((e) => {
    $app.innerHTML = `<main class="wrap"><h1>Не загрузились данные</h1><p class="lead">${esc(e.message)}</p>
      <p class="muted">Если вы открыли index.html двойным щелчком, браузер блокирует чтение JSON. Запустите в папке проекта <code>python -m http.server</code> и откройте http://localhost:8000 — или смотрите сайт на GitHub Pages.</p></main>`;
  });
})();
