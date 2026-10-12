/* Редактор: правит эпизоды прямо в браузере.
   Правки хранятся как черновик в этом браузере. Чтобы они появились на сайте,
   скачайте JSON и замените файл в репозитории (или вставьте текст через «Править на GitHub»). */
(function () {
  const FX = ['', 'none', 'negative', 'rain', 'shake', 'flicker', 'fade'];
  const FX_NAMES = { '': '—', none: 'снять эффекты', negative: 'негатив', rain: 'дождь', shake: 'тряска', flicker: 'мерцание', fade: 'затемнение' };
  const POSS = ['farleft', 'left', 'center', 'right', 'farright'];
  let S, H, cur = null, model = null, sceneI = 0, dirty = false;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pathOf = (k) => k === 'characters' ? 'data/characters.json' : k === 'locations' ? 'data/locations.json' : k === 'config' ? 'data/config.json' : k.startsWith('ep:') ? `data/episodes/${k.slice(3)}.json` : '';
  const parseMap = (s) => { const o = {}; String(s || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((p) => { const [a, b] = p.split(':').map((y) => y.trim()); if (a) o[a] = b || 'center'; }); return o; };
  const mapStr = (o) => Object.entries(o || {}).map(([a, b]) => `${a}:${b}`).join(', ');
  const kindOf = (l) => l.roll ? 'roll' : l.say !== undefined ? 'say' : l.think !== undefined ? 'think' : 'n';

  function open(state, helpers) {
    S = state; H = helpers;
    if (!cur) cur = S.config.episodes && S.config.episodes[0] ? 'ep:' + S.config.episodes[0] : 'characters';
    select(cur);
  }
  function select(k) {
    cur = k; sceneI = 0; dirty = false;
    if (k.startsWith('ep:')) model = clone(S.eps[k.slice(3)] || newEpisode(k.slice(3)));
    else if (k === 'characters') model = clone(S.chars);
    else if (k === 'locations') model = clone(S.locs);
    else if (k === 'config') model = clone(S.config);
    else model = null;
    render();
  }
  function newEpisode(id) {
    const n = (S.config.episodes || []).length + 1;
    return { id, number: n, title: 'Новый эпизод', date: new Date().toISOString().slice(0, 10), video: '', players: [], summary: '', clues: [],
      scenes: [{ id: 's1', title: 'Первая сцена', bg: (S.locs[0] || {}).id || '', t: '00:00:00', stage: {}, lines: [{ n: 'Текст рассказчика.' }] }] };
  }

  function saveDraft() {
    const p = pathOf(cur); if (!p || !model) return;
    H.store.set('draft:' + p, JSON.stringify(model, null, 2));
    dirty = false; status('Черновик сохранён в этом браузере');
  }
  function status(t) { const el = document.getElementById('ed-status'); if (el) { el.textContent = t; } }
  function jsonText() { return JSON.stringify(model, null, 2) + '\n'; }
  function download() {
    const p = pathOf(cur); const blob = new Blob([jsonText()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = p.split('/').pop(); document.body.appendChild(a); a.click(); a.remove();
    status('Скачан ' + p.split('/').pop() + ' — замените им файл ' + p + ' в репозитории');
  }
  function copy() {
    const t = jsonText();
    const fallback = () => { const ta = document.getElementById('ed-copybox'); ta.hidden = false; ta.value = t; ta.select(); status('Текст выделен — нажмите Ctrl+C'); };
    try { navigator.clipboard.writeText(t).then(() => status('JSON скопирован'), fallback); } catch (e) { fallback(); }
  }
  async function preview(sceneId, li) {
    saveDraft(); await H.load();
    location.hash = `play-${model.id}-${sceneId}${li !== undefined ? '-' + li : ''}`;
  }

  // ---------- Рендер ----------
  function render() {
    const esc = H.esc;
    const repo = S.config.repo;
    const p = pathOf(cur);
    const ghLink = repo && p ? `https://github.com/${repo}/edit/${S.config.branch || 'main'}/${p}` : '';
    const side = [
      ...(S.config.episodes || []).map((id) => [`ep:${id}`, `Эпизод: ${(S.eps[id] && S.eps[id].title) || id}`]),
      ['characters', 'Персонажи'], ['locations', 'Локации'], ['config', 'Мир и настройки'], ['new', '+ Новый эпизод'], ['srt', '+ Эпизод из .srt']
    ];
    const app = document.getElementById('app');
    app.innerHTML = `
      <header class="top"><div class="top-in"><a class="logo" href="#">${esc(S.config.title)}</a>
        <nav class="nav"><a href="#">← На сайт</a><a class="on" href="#editor">Редактор</a></nav></div></header>
      <main class="wrap">
        <div class="eyebrow">Редактор</div><h1>Правка базы знаний</h1>
        <div class="note">Правки сохраняются черновиком только в этом браузере, и сайт сразу их показывает (оранжевая метка «черновики»). Чтобы их увидели все: <b>Скачать JSON</b> → загрузите файл в репозиторий вместо <code>${esc(p || 'data/…')}</code>${ghLink ? ', или <b>Скопировать</b> → <a href="' + ghLink + '" target="_blank" rel="noopener">править на GitHub</a> → вставить → Commit' : ''}.</div>
        <div class="ed">
          <aside class="ed-side">${side.map(([k, t]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${esc(t)}</button>`).join('')}</aside>
          <section style="min-width:0">
            ${model ? `<div class="ed-tools">
              <button class="btn primary" id="ed-save">Сохранить черновик</button>
              <button class="btn" id="ed-dl">Скачать JSON</button>
              <button class="btn" id="ed-copy">Скопировать JSON</button>
              ${ghLink ? `<a class="btn" href="${ghLink}" target="_blank" rel="noopener">Править на GitHub</a>` : ''}
              <button class="btn danger" id="ed-reset">Отменить черновик</button>
              <span class="mono muted" id="ed-status" style="align-self:center"></span>
            </div><textarea id="ed-copybox" class="json-area" style="min-height:120px" hidden></textarea>` : ''}
            <div id="ed-main"></div>
          </section>
        </div>
      </main>`;
    app.querySelectorAll('.ed-side button').forEach((b) => b.onclick = () => {
      if (b.dataset.k === 'new') return newEpisodeForm();
      if (b.dataset.k === 'srt') return srtForm();
      if (dirty) saveDraft();
      select(b.dataset.k);
    });
    if (model) {
      document.getElementById('ed-save').onclick = saveDraft;
      document.getElementById('ed-dl').onclick = download;
      document.getElementById('ed-copy').onclick = copy;
      document.getElementById('ed-reset').onclick = async (e) => {
        const btn = e.currentTarget;
        if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'Точно отменить? Нажмите ещё раз'; return; }
        H.store.del('draft:' + p); await H.load(); select(cur);
      };
    }
    if (cur.startsWith('ep:')) renderEpisode();
    else if (model) renderJSON();
  }

  function renderJSON() {
    const main = document.getElementById('ed-main');
    const hint = cur === 'characters'
      ? 'Каждый персонаж: id (латиницей, без дефисов), name, short, role, player, color, description, stats, tags. В sprites укажите пути к вашим картинкам, например "default": "assets/sprites/emily/default.png". Пустая строка — нарисованная заглушка.'
      : cur === 'locations' ? 'Каждая локация: id, name, description. В bg укажите путь к фону, например "assets/bg/gazebo.jpg". Пока пусто — рисуется заглушка по preset (' + Art.presets.join(', ') + ').'
      : 'Название, описание мира, словарь. Поле "repo": "логин/репозиторий" включит кнопку «Править на GitHub». Список "episodes" задаёт порядок эпизодов.';
    main.innerHTML = `<p class="muted" style="max-width:72ch">${H.esc(hint)}</p><textarea class="json-area" id="ed-json" spellcheck="false">${H.esc(jsonText())}</textarea><div class="err" id="ed-err"></div>`;
    const ta = document.getElementById('ed-json');
    ta.oninput = () => { try { model = JSON.parse(ta.value); document.getElementById('ed-err').textContent = ''; dirty = true; status('Есть несохранённые правки'); } catch (e) { document.getElementById('ed-err').textContent = 'Ошибка в JSON: ' + e.message; } };
  }

  function renderEpisode() {
    const esc = H.esc, ep = model;
    const main = document.getElementById('ed-main');
    const sc = ep.scenes[sceneI];
    const charOpts = (sel) => `<option value="">—</option>` + S.chars.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.short || c.name)}</option>`).join('');
    const locOpts = (sel, empty) => (empty ? '<option value="">—</option>' : '') + S.locs.map((l) => `<option value="${l.id}" ${l.id === sel ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
    const clueOpts = (sel) => `<option value="">—</option>` + (ep.clues || []).map((k) => `<option value="${k.id}" ${k.id === sel ? 'selected' : ''}>${esc(k.name)}</option>`).join('');
    const exprList = Array.from(new Set(S.chars.flatMap((c) => Object.keys(c.sprites || {})).concat(['default']))).map((e) => `<option value="${e}">`).join('');

    main.innerHTML = `
      <datalist id="exprs">${exprList}</datalist>
      <details ${sceneI === 0 ? '' : ''}><summary class="eyebrow" style="cursor:pointer">Данные эпизода и улики</summary>
        <div class="fields" style="margin-top:12px">
          <label class="field">Название<input data-ep="title" value="${esc(ep.title)}"></label>
          <label class="field">Номер<input data-ep="number" type="number" value="${esc(ep.number)}"></label>
          <label class="field">Дата<input data-ep="date" value="${esc(ep.date)}"></label>
          <label class="field">ID видео YouTube<input data-ep="video" value="${esc(ep.video)}" placeholder="OpUXFk_Igis"></label>
          <label class="field">Персонажи игроков (id через запятую)<input data-ep="players" value="${esc((ep.players || []).join(', '))}"></label>
        </div>
        <label class="field" style="margin-bottom:14px">Краткое содержание<textarea data-ep="summary" rows="3">${esc(ep.summary)}</textarea></label>
        <div class="eyebrow">Улики</div>
        ${(ep.clues || []).map((k, i) => `<div class="ln"><div class="ln-head"><input data-clue="${i}" data-f="id" value="${esc(k.id)}" placeholder="id" style="width:130px"><input data-clue="${i}" data-f="name" value="${esc(k.name)}" placeholder="Название" style="flex:1"><button data-delclue="${i}">✕</button></div><textarea data-clue="${i}" data-f="text" rows="2">${esc(k.text)}</textarea></div>`).join('')}
        <button class="btn small" id="add-clue">+ Улика</button>
      </details>

      <h2>Сцены</h2>
      <div class="chips" style="margin-bottom:14px">${ep.scenes.map((s, i) => `<button class="btn small ${i === sceneI ? 'primary' : ''}" data-scene="${i}">${i + 1}. ${esc(s.title)}</button>`).join('')}<button class="btn small" id="add-scene">+ Сцена</button></div>
      ${sc ? `
      <div class="fields">
        <label class="field">ID сцены<input data-sc="id" value="${esc(sc.id)}"></label>
        <label class="field">Название<input data-sc="title" value="${esc(sc.title)}"></label>
        <label class="field">Фон<select data-sc="bg">${locOpts(sc.bg)}</select></label>
        <label class="field">Время в видео<input data-sc="t" value="${esc(sc.t || '')}" placeholder="00:12:34"></label>
        <label class="field" style="grid-column:span 2">На сцене в начале (id:позиция)<input data-sc="stage" value="${esc(mapStr(sc.stage))}" placeholder="emily:left, thompson:right"></label>
      </div>
      <div class="ed-tools"><button class="btn small" id="sc-play">▶ Проверить сцену</button><button class="btn small" id="sc-up">↑ Сцену выше</button><button class="btn small" id="sc-down">↓ Сцену ниже</button><button class="btn small danger" id="sc-del">Удалить сцену</button></div>
      <p class="mono muted">Позиции: ${POSS.join(', ')} или число в процентах. Эмоция = ключ из sprites персонажа.</p>
      <div id="lines">${sc.lines.map((l, i) => lineRow(l, i, charOpts, locOpts, clueOpts)).join('')}</div>
      <button class="btn" id="add-line">+ Строка в конец</button>` : '<p class="muted">Добавьте сцену.</p>'}`;

    // привязки
    main.querySelectorAll('[data-ep]').forEach((el) => el.oninput = () => { const f = el.dataset.ep; ep[f] = f === 'number' ? Number(el.value) : f === 'players' ? el.value.split(',').map((x) => x.trim()).filter(Boolean) : el.value; touch(); });
    main.querySelectorAll('[data-clue]').forEach((el) => el.oninput = () => { ep.clues[+el.dataset.clue][el.dataset.f] = el.value; touch(); });
    main.querySelectorAll('[data-delclue]').forEach((b) => b.onclick = () => { ep.clues.splice(+b.dataset.delclue, 1); touch(); renderEpisode(); });
    const ac = document.getElementById('add-clue'); if (ac) ac.onclick = () => { (ep.clues = ep.clues || []).push({ id: 'clue' + (ep.clues.length + 1), name: 'Новая улика', text: '' }); touch(); renderEpisode(); main.querySelector('details').open = true; };
    main.querySelectorAll('[data-scene]').forEach((b) => b.onclick = () => { sceneI = +b.dataset.scene; renderEpisode(); });
    document.getElementById('add-scene').onclick = () => { const n = ep.scenes.length + 1; ep.scenes.push({ id: 's' + n + Math.random().toString(36).slice(2, 5), title: 'Сцена ' + n, bg: sc ? sc.bg : (S.locs[0] || {}).id, t: '', stage: {}, lines: [{ n: '' }] }); sceneI = ep.scenes.length - 1; touch(); renderEpisode(); };
    if (!sc) return;
    main.querySelectorAll('[data-sc]').forEach((el) => el.oninput = el.onchange = () => { const f = el.dataset.sc; sc[f] = f === 'stage' ? parseMap(el.value) : el.value.replace(f === 'id' ? /-/g : /$^/, ''); touch(); });
    document.getElementById('sc-play').onclick = () => preview(sc.id);
    document.getElementById('sc-up').onclick = () => { if (sceneI > 0) { [ep.scenes[sceneI - 1], ep.scenes[sceneI]] = [ep.scenes[sceneI], ep.scenes[sceneI - 1]]; sceneI--; touch(); renderEpisode(); } };
    document.getElementById('sc-down').onclick = () => { if (sceneI < ep.scenes.length - 1) { [ep.scenes[sceneI + 1], ep.scenes[sceneI]] = [ep.scenes[sceneI], ep.scenes[sceneI + 1]]; sceneI++; touch(); renderEpisode(); } };
    document.getElementById('sc-del').onclick = (e) => { const b = e.currentTarget; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Удалить вместе со строками?'; return; } ep.scenes.splice(sceneI, 1); sceneI = Math.max(0, sceneI - 1); touch(); renderEpisode(); };
    document.getElementById('add-line').onclick = () => { sc.lines.push({ n: '' }); touch(); renderEpisode(); };

    main.querySelectorAll('.ln[data-i]').forEach((row) => {
      const i = +row.dataset.i; const l = sc.lines[i];
      row.querySelectorAll('[data-f]').forEach((el) => {
        el.oninput = el.onchange = () => {
          const f = el.dataset.f, v = el.value;
          if (f === 'kind') { const text = l.say ?? l.think ?? l.n ?? ''; delete l.say; delete l.think; delete l.n; if (v === 'roll') { l.roll = l.roll || { who: l.c || '', stat: 'Шарм', die: 'd8', dc: 8, result: null, success: false, tokens: '', note: text }; } else { delete l.roll; l[v] = text; if (v === 'n') { delete l.c; } } touch(); renderEpisode(); return; }
          if (f === 'text') { const k = kindOf(l); if (k === 'roll') l.roll.note = v; else l[k] = v; }
          else if (f === 'c') { if (v) l.c = v; else delete l.c; }
          else if (f === 'e') { if (v) l.e = v; else delete l.e; }
          else if (f === 'eo') { const m = parseMap(v); if (Object.keys(m).length) l.e = m; else delete l.e; }
          else if (f === 'show') { const m = parseMap(v); if (Object.keys(m).length) l.show = m; else delete l.show; }
          else if (f === 'hide') { const a = v.split(',').map((x) => x.trim()).filter(Boolean); if (a.length) l.hide = a; else delete l.hide; }
          else if (['t', 'bg', 'fx', 'clue'].includes(f)) { if (v) l[f] = v; else delete l[f]; }
          else if (f.startsWith('r.')) { const k = f.slice(2); l.roll[k] = k === 'dc' ? Number(v) : k === 'result' ? (v === '' ? null : Number(v)) : k === 'success' ? v === '1' : v; }
          touch();
        };
      });
      row.querySelector('[data-act="up"]').onclick = () => { if (i > 0) { [sc.lines[i - 1], sc.lines[i]] = [sc.lines[i], sc.lines[i - 1]]; touch(); renderEpisode(); } };
      row.querySelector('[data-act="down"]').onclick = () => { if (i < sc.lines.length - 1) { [sc.lines[i + 1], sc.lines[i]] = [sc.lines[i], sc.lines[i + 1]]; touch(); renderEpisode(); } };
      row.querySelector('[data-act="add"]').onclick = () => { sc.lines.splice(i + 1, 0, l.c ? { c: l.c, say: '' } : { n: '' }); touch(); renderEpisode(); };
      row.querySelector('[data-act="del"]').onclick = () => { sc.lines.splice(i, 1); touch(); renderEpisode(); };
      row.querySelector('[data-act="play"]').onclick = () => preview(sc.id, i);
    });
  }

  function lineRow(l, i, charOpts, locOpts, clueOpts) {
    const esc = H.esc, k = kindOf(l);
    const text = k === 'roll' ? l.roll.note || '' : l[k] || '';
    const eStr = typeof l.e === 'string' ? l.e : '', eObj = l.e && typeof l.e === 'object' ? mapStr(l.e) : '';
    const hasAdv = l.show || l.hide || l.bg || l.fx || l.clue || eObj;
    const r = l.roll || {};
    return `<div class="ln" data-i="${i}" data-k="${k}">
      <div class="ln-head">
        <span class="mono muted">${i + 1}</span>
        <select data-f="kind" aria-label="Тип строки"><option value="n" ${k === 'n' ? 'selected' : ''}>Рассказчик</option><option value="say" ${k === 'say' ? 'selected' : ''}>Реплика</option><option value="think" ${k === 'think' ? 'selected' : ''}>Мысль</option><option value="roll" ${k === 'roll' ? 'selected' : ''}>Бросок</option></select>
        ${k === 'say' || k === 'think' ? `<select data-f="c" aria-label="Кто">${charOpts(l.c)}</select><input data-f="e" list="exprs" value="${esc(eStr)}" placeholder="эмоция" style="width:100px">` : ''}
        <input data-f="t" value="${esc(l.t || '')}" placeholder="00:00:00" style="width:92px" aria-label="Время в видео">
        <span class="sp"></span>
        <button data-act="play" title="Проверить с этой строки">▶</button><button data-act="up" title="Выше">↑</button><button data-act="down" title="Ниже">↓</button><button data-act="add" title="Строка после">+</button><button data-act="del" title="Удалить">✕</button>
      </div>
      ${k === 'roll' ? `<div class="ln-adv">
        <select data-f="r.who">${charOpts(r.who)}</select>
        <input data-f="r.stat" value="${esc(r.stat)}" placeholder="Характеристика">
        <input data-f="r.die" value="${esc(r.die)}" placeholder="d8">
        <input data-f="r.dc" type="number" value="${esc(r.dc)}" placeholder="Сложность">
        <input data-f="r.result" type="number" value="${r.result ?? ''}" placeholder="Выпало">
        <select data-f="r.success"><option value="1" ${r.success ? 'selected' : ''}>Успех</option><option value="0" ${!r.success ? 'selected' : ''}>Провал</option></select>
        <input data-f="r.tokens" value="${esc(r.tokens || '')}" placeholder="Жетоны" style="grid-column:span 2">
      </div>` : ''}
      <textarea data-f="text" rows="2" placeholder="${k === 'roll' ? 'Зачем бросок' : 'Текст'}">${esc(text)}</textarea>
      <details class="adv" ${hasAdv ? 'open' : ''}><summary>Сцена: появления, фон, эффекты, улика</summary><div class="ln-adv" style="margin-top:6px">
        <input data-f="show" value="${esc(mapStr(l.show))}" placeholder="показать: id:позиция">
        <input data-f="hide" value="${esc((l.hide || []).join(', '))}" placeholder="убрать: id, id">
        <input data-f="eo" value="${esc(eObj)}" placeholder="эмоции: id:эмоция">
        <select data-f="bg" aria-label="Сменить фон">${locOpts(l.bg, true)}</select>
        <select data-f="fx" aria-label="Эффект">${FX.map((f) => `<option value="${f}" ${f === (l.fx || '') ? 'selected' : ''}>${FX_NAMES[f]}</option>`).join('')}</select>
        <select data-f="clue" aria-label="Улика">${clueOpts(l.clue)}</select>
      </div></details>
    </div>`;
  }
  function touch() { dirty = true; status('Есть несохранённые правки'); clearTimeout(touch.t); touch.t = setTimeout(saveDraft, 1500); }

  // ---------- Новый эпизод ----------
  function addEpisodeToConfig(id) {
    const cfg = clone(S.config); cfg.episodes = cfg.episodes || [];
    if (!cfg.episodes.includes(id)) cfg.episodes.push(id);
    H.store.set('draft:data/config.json', JSON.stringify(cfg, null, 2));
  }
  function newEpisodeForm() {
    const main = document.getElementById('ed-main');
    const next = 'ep' + String((S.config.episodes || []).length + 1).padStart(3, '0');
    main.innerHTML = `<h2>Новый эпизод</h2><div class="fields"><label class="field">ID файла (латиница, без дефисов)<input id="ne-id" value="${next}"></label></div>
      <button class="btn primary" id="ne-go">Создать</button>
      <p class="muted" style="max-width:68ch">После создания скачайте два файла: <code>data/episodes/${next}.json</code> и обновлённый <code>data/config.json</code> (в нём список эпизодов).</p>`;
    document.getElementById('ne-go').onclick = async () => {
      const id = document.getElementById('ne-id').value.trim().replace(/[^a-zA-Z0-9_]/g, ''); if (!id) return;
      H.store.set(`draft:data/episodes/${id}.json`, JSON.stringify(newEpisode(id), null, 2)); addEpisodeToConfig(id);
      await H.load(); select('ep:' + id);
    };
  }

  // ---------- Импорт субтитров ----------
  function parseSrt(text) {
    const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
    const cues = [];
    blocks.forEach((b) => {
      const m = b.match(/(\d\d:\d\d:\d\d)[,.](\d+)\s*-->\s*(\d\d:\d\d:\d\d)/); if (!m) return;
      const lines = b.split('\n'); const ti = lines.findIndex((x) => x.includes('-->'));
      const t = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim(); if (t) cues.push({ t: m[1], s: m[1].split(':').reduce((a, x) => a * 60 + +x, 0), text: t });
    });
    return cues;
  }
  function srtToEpisode(id, cues, sceneMin) {
    const ep = newEpisode(id); ep.title = 'Черновик по субтитрам'; ep.scenes = [];
    let buf = '', bufT = null, lastS = -99, scene = null;
    const flush = () => { if (buf.trim()) scene.lines.push({ n: buf.trim(), t: bufT }); buf = ''; bufT = null; };
    cues.forEach((c) => {
      const part = Math.floor(c.s / (sceneMin * 60));
      if (!scene || scene._p !== part) { if (scene) flush(); scene = { id: 's' + (ep.scenes.length + 1), title: 'Часть ' + (ep.scenes.length + 1), bg: (S.locs[0] || {}).id || '', t: c.t, stage: {}, lines: [], _p: part }; ep.scenes.push(scene); }
      if (c.s - lastS > 6 && buf.length > 60) flush();
      if (!bufT) bufT = c.t; buf += (buf ? ' ' : '') + c.text; lastS = c.s;
      if (/[.!?…]$/.test(c.text) && buf.length > 140) flush();
    });
    if (scene) flush();
    ep.scenes.forEach((s) => delete s._p);
    return ep;
  }
  function srtForm() {
    const main = document.getElementById('ed-main');
    const next = 'ep' + String((S.config.episodes || []).length + 1).padStart(3, '0');
    main.innerHTML = `<h2>Эпизод из субтитров</h2>
      <p class="muted" style="max-width:68ch">Загрузите .srt с записи игры. Получится черновик: весь текст разложен на строки рассказчика с таймкодами, по сценам каждые N минут. Дальше в редакторе назначьте, кто говорит, сократите лишнее и расставьте фоны.</p>
      <div class="fields"><label class="field">ID эпизода<input id="srt-id" value="${next}"></label><label class="field">Минут на сцену<input id="srt-min" type="number" value="6"></label><label class="field">Файл .srt<input id="srt-file" type="file" accept=".srt,.vtt,.txt"></label></div>
      <p class="err" id="srt-err"></p>`;
    document.getElementById('srt-file').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        const cues = parseSrt(String(rd.result)); if (!cues.length) { document.getElementById('srt-err').textContent = 'В файле не нашлось субтитров с таймкодами.'; return; }
        const id = document.getElementById('srt-id').value.trim().replace(/[^a-zA-Z0-9_]/g, '') || next;
        const ep = srtToEpisode(id, cues, Math.max(1, +document.getElementById('srt-min').value || 6));
        H.store.set(`draft:data/episodes/${id}.json`, JSON.stringify(ep, null, 2)); addEpisodeToConfig(id);
        await H.load(); select('ep:' + id);
      };
      rd.readAsText(f, 'utf-8');
    };
  }

  window.Editor = { open };
})();
