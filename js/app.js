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
  function cutout(c, e, cls = '') {
    return `<img class="sticker ${cls}" alt="${esc(c.name)}" src="${esc(spriteSrc(c, e))}" onerror="__imgFallback(this,'${c.id}','${e || 'default'}')">`;
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
    const tabs = [['episodes', 'Эпизоды'], ['characters', 'Персонажи'], ['locations', 'Локации'], ['clues', 'Улики'], ['world', 'Мир'], ['search', 'Поиск']];
    const logo = S.config.logo || 'assets/brand/logo.webp';
    $app.innerHTML = `
      <header class="top"><div class="top-in">
        <a class="brand" href="#" aria-label="${esc(S.config.title)} — на главную"><img src="${esc(logo)}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(S.config.title)}'))"></a>
        <nav class="nav">${tabs.map(([h, t]) => `<a href="#${h}" class="${active === h ? 'on' : ''}">${t}</a>`).join('')}</nav>
      </div></header>
      <main class="wrap">${inner}</main>
      <footer class="foot"><div class="foot-in">
        <span>${esc(S.config.title)} · ${esc(S.config.system)}</span>
        <span>Ведущий: ${esc(S.config.gm)} · ${S.config.channelUrl && S.config.channelUrl.length > 26 ? `<a href="${esc(S.config.channelUrl)}" target="_blank" rel="noopener">${esc(S.config.channel)}</a>` : esc(S.config.channel)}</span>
      </div></footer>`;
    window.scrollTo(0, 0);
  }
  const head = (eyebrow, title, lead) => `<header class="page-head"><div class="eyebrow">${esc(eyebrow)}</div><h1>${ransom(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</header>`;

  function epCard(ep) {
    const first = ep.scenes[0];
    const l = loc(first && first.bg);
    return `<article class="ep" style="${torn('ep' + ep.id, 1.2, 3, 'tb')}">
      <a class="ep-pic ht" href="#play-${ep.id}" ${bgStyle(l)} aria-label="Читать: ${esc(ep.title)}">
        <span class="ep-no">${ransom(pad2(ep.number), { seed: 'n' })}</span>
      </a>
      <div class="ep-body">
        <div class="eyebrow">Эпизод ${esc(ep.number)} · ${esc(ep.date || '')}</div>
        <h3>${esc(ep.title)}</h3>
        <p>${esc(ep.summary)}</p>
        <div class="btns">
          <a class="btn hot" href="#play-${ep.id}">Читать</a>
          <a class="btn" href="#ep-${ep.id}">Сцены</a>
          ${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Запись</a>` : ''}
        </div>
      </div>
    </article>`;
  }

  function charGrid() {
    return `<div class="cast">${S.chars.map((c, i) => `
      <a class="who" href="#char-${c.id}" style="--c:${esc(c.color)}">
        <span class="who-shape" style="${torn('w' + c.id, 6, 8, 'tblr')};transform:rotate(${(i % 2 ? 3 : -4)}deg)"></span>
        <span class="who-pic">${cutout(c, 'default')}</span>
        <span class="who-tag"><b>${esc(c.short || c.name)}</b><small>${esc(c.role)}</small></span>
      </a>`).join('')}</div>`;
  }

  // ---------- Страницы ----------
  function home() {
    const ep = epList()[0];
    const banner = S.config.banner || 'assets/brand/banner.webp';
    shell('', `
      <section class="hero">
        <div class="hero-img" style="background-image:url('${esc(banner)}');${torn('hero', 2.2, 2, 'b')}" role="img" aria-label="${esc(S.config.title)}"></div>
        <div class="clip" style="${torn('clip', 2.5, 4, 'tblr')}">
          <div class="eyebrow">${esc(S.config.system)}</div>
          <p>${esc(S.config.intro)}</p>
          <div class="btns">
            ${ep ? `<a class="btn hot" href="#play-${ep.id}">Смотреть эпизод ${esc(ep.number)}</a>` : ''}
            <a class="btn ink" href="#characters">Кто есть кто</a>
          </div>
        </div>
      </section>
      <h2>${ransom('Эпизоды')}</h2>
      <div class="eps">${epList().map(epCard).join('') || '<p class="muted">Пока нет эпизодов.</p>'}</div>
      <h2>${ransom('Персонажи')}</h2>
      ${charGrid()}`);
  }

  function episodes() { shell('episodes', `${head('Архив', 'Эпизоды')}<div class="eps">${epList().map(epCard).join('')}</div>`); }

  function episodePage(id) {
    const ep = S.eps[id]; if (!ep) return notFound();
    const rolls = [];
    ep.scenes.forEach((sc) => sc.lines.forEach((l) => l.roll && rolls.push({ sc, l })));
    shell('episodes', `
      ${head('Эпизод ' + ep.number + (ep.date ? ' · ' + ep.date : ''), ep.title, ep.summary)}
      <div class="btns"><a class="btn hot" href="#play-${ep.id}">Читать</a>${ep.video ? `<a class="btn" href="${ytLink(ep)}" target="_blank" rel="noopener">Полная запись</a>` : ''}</div>
      <h2 class="h2s">Сцены</h2>
      <ol class="scenes">${ep.scenes.map((sc, i) => { const l = loc(sc.bg); return `<li>
        <a class="sc-pic ht" href="#play-${ep.id}-${sc.id}" ${bgStyle(l)}><span>${pad2(i + 1)}</span></a>
        <div class="sc-txt"><b>${esc(sc.title)}</b><small>${esc((l || {}).name || '')}${sc.t ? ' · ' + esc(sc.t) : ''}</small></div>
        ${ep.video && sc.t ? `<a class="tc" href="${ytLink(ep, sc.t)}" target="_blank" rel="noopener" title="Открыть момент в записи">▶ ${esc(sc.t)}</a>` : ''}
      </li>`; }).join('')}</ol>
      ${(ep.clues || []).length ? `<h2 class="h2s">Улики</h2><div class="notes">${ep.clues.map((k, i) => note(k, i)).join('')}</div>` : ''}
      ${rolls.length ? `<details class="rolls-wrap"><summary>Журнал бросков (${rolls.length})</summary><div class="table-x"><table class="rolls"><thead><tr><th>Время</th><th>Кто</th><th>Проверка</th><th>Итог</th><th>Зачем</th></tr></thead><tbody>
        ${rolls.map(({ l }) => { const r = l.roll, c = char(r.who); return `<tr><td class="mono">${ep.video && l.t ? `<a href="${ytLink(ep, l.t)}" target="_blank" rel="noopener">${esc(l.t)}</a>` : esc(l.t || '')}</td><td>${esc(c ? c.short || c.name : r.who)}</td><td class="mono">${esc(r.stat)} ${esc(r.die)} · сл. ${esc(r.dc)}${r.result != null ? ' · ' + r.result : ''}</td><td>${r.success ? 'успех' : 'провал'}${r.tokens ? ` <span class="muted">· ${esc(r.tokens)}</span>` : ''}</td><td class="muted">${esc(r.note || '')}</td></tr>`; }).join('')}
      </tbody></table></div></details>` : ''}`);
  }

  function note(k, i, extra = '') {
    return `<div class="note" style="${torn('k' + k.id, 2, 5, 'tblr')};transform:rotate(${((i % 3) - 1) * 0.8}deg)"><b>${esc(k.name)}</b><p>${esc(k.text)}</p>${extra}</div>`;
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
            <dt>Игрок</dt><dd>${esc(c.player || '—')}</dd>
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
      ep.scenes.forEach((sc) => sc.lines.forEach((l, li) => { if (l.clue && !where[l.clue]) where[l.clue] = { sc, li, t: l.t }; }));
      return `<h2 class="h2s">${esc(ep.title)}</h2><div class="notes">${ep.clues.map((k, i) => { const w = where[k.id]; return note(k, i, w ? `<a class="mono" href="#play-${ep.id}-${w.sc.id}-${w.li}">${esc(w.sc.title)}${w.t ? ' · ' + esc(w.t) : ''} →</a>` : ''); }).join('')}</div>`;
    }).join('');
    shell('clues', `${head('Расследование', 'Улики', 'Предметы, снимки и странности, которые всплыли в игре.')}${blocks || '<p class="muted">Пока пусто.</p>'}`);
  }

  function world() {
    shell('world', `${head(S.config.system, 'Мир', S.config.intro)}
      <h2 class="h2s">Словарь</h2><div class="notes">${(S.config.glossary || []).map((g, i) => note({ id: 'g' + i, name: g.term, text: g.text }, i)).join('')}</div>`);
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

  function notFound() { shell('', `${head('404', 'Здесь пусто', 'Такой страницы нет. Возможно, эпизод ещё не добавлен в data/config.json.')}<a class="btn" href="#">На главную</a>`); }

  // ---------- Роутер ----------
  function route() {
    if (window.Player) Player.close();
    const h = decodeURIComponent(location.hash.slice(1));
    const [k, a, b, c] = h.split('-');
    if (!h) return home();
    if (k === 'episodes') return episodes();
    if (k === 'ep') return episodePage(a);
    if (k === 'play') return S.eps[a] ? Player.open(S.eps[a], b, c !== undefined ? parseInt(c, 10) : undefined) : notFound();
    if (k === 'characters') return shell('characters', `${head('Досье', 'Персонажи')}${charGrid()}`);
    if (k === 'char') return charPage(a);
    if (k === 'locations') return locations();
    if (k === 'loc') return locPage(a);
    if (k === 'clues') return clues();
    if (k === 'world') return world();
    if (k === 'search') return search();
    notFound();
  }
  window.addEventListener('hashchange', route);

  window.App = { S, bgStyle, store, esc, char, loc, ytLink, epList, lineText, spriteSrc, blinkSrc, bgSrc, ransom, torn, pad2, root: $app };
  load().then(route).catch((e) => {
    $app.innerHTML = `<main class="wrap">${'<h1>Не загрузились данные</h1>'}<p class="lead">${esc(e.message)}</p>
      <p class="muted">Если вы открыли index.html двойным щелчком, браузер не даёт читать файлы с диска. Запустите в папке проекта <code>python -m http.server</code> и откройте http://localhost:8000, или смотрите сайт на GitHub Pages.</p></main>`;
  });
})();
