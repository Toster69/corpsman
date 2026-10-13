/* Кассетный плеер сайта. Треки — в data/config.json → "tracks".
   Трек открывается, когда впервые звучит в новелле (или сразу, если "free": true).
   Открытые треки хранятся в браузере зрителя. */
(function () {
  const KEY = 'corpsman:tracks';
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const save = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s || '').replace(/^\.?\//, '');

  let tracks = [], cur = -1, el = null, audio = null, listeners = [];

  function init(cfg) {
    tracks = (cfg.tracks || []).filter((t) => t && t.src);
    if (!tracks.length || el) return;
    audio = new Audio(); audio.preload = 'none'; audio.volume = 0.7;
    audio.addEventListener('ended', () => step(1));
    audio.addEventListener('timeupdate', paintTime);
    audio.addEventListener('play', paint); audio.addEventListener('pause', paint);
    el = document.createElement('div'); el.className = 'tape'; el.id = 'tape';
    el.innerHTML = `
      <button class="tape-reel" data-t="toggle" aria-label="Играть / пауза"><span class="reel"></span><span class="reel"></span><i class="tape-ico">▶</i></button>
      <div class="tape-info"><b id="tape-title">Кассета</b><small id="tape-sub">${esc(cfg.about && cfg.about.music ? 'Музыка: ' + cfg.about.music.name : '')}</small><span class="tape-bar"><i id="tape-prog"></i></span></div>
      <button class="tape-btn" data-t="prev" aria-label="Предыдущий">◀◀</button>
      <button class="tape-btn" data-t="next" aria-label="Следующий">▶▶</button>
      <a class="tape-btn" href="#music" aria-label="Все треки">☰</a>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      if (b.dataset.t === 'toggle') toggle();
      if (b.dataset.t === 'prev') step(-1);
      if (b.dataset.t === 'next') step(1);
    });
    cur = Math.max(0, tracks.findIndex((t) => isOpen(t)));
    paint();
  }

  function isOpen(t) { return !!t.free || get().includes(t.id); }
  function openList() { return tracks.filter(isOpen); }

  // Вызывается новеллой, когда начинает звучать трек. Возвращает трек, если он открылся впервые.
  function unlockBySrc(src) {
    const t = tracks.find((x) => norm(x.src) === norm(src));
    if (!t || isOpen(t)) return null;
    const a = get(); a.push(t.id); save(a);
    listeners.forEach((f) => f(t)); paint();
    return t;
  }

  function play(i) {
    const t = tracks[i]; if (!t || !isOpen(t)) return;
    cur = i;
    if (norm(audio.getAttribute('src')) !== norm(t.src)) audio.src = t.src;
    audio.play().catch(() => {});
    paint();
  }
  function toggle() { if (!audio) return; if (audio.paused) play(cur < 0 ? 0 : cur); else audio.pause(); }
  function pause() { if (audio && !audio.paused) audio.pause(); }
  function step(d) {
    const open = tracks.map((t, i) => (isOpen(t) ? i : -1)).filter((i) => i >= 0);
    if (!open.length) return;
    const k = open.indexOf(cur); const n = open[(k + d + open.length) % open.length];
    play(n);
  }
  function paintTime() { const p = document.getElementById('tape-prog'); if (p && audio.duration) p.style.width = (audio.currentTime / audio.duration * 100) + '%'; }
  function paint() {
    if (!el) return;
    const t = tracks[cur];
    el.classList.toggle('on', !!audio && !audio.paused);
    el.querySelector('#tape-title').textContent = t && isOpen(t) ? t.title : 'Кассета';
    el.querySelector('.tape-ico').textContent = audio && !audio.paused ? '❚❚' : '▶';
    const n = openList().length; el.querySelector('#tape-sub').textContent = `Открыто ${n} из ${tracks.length}`;
    document.querySelectorAll('[data-track]').forEach((b) => b.classList.toggle('cur', +b.dataset.track === cur && !audio.paused));
  }

  window.Music = {
    init, isOpen, unlockBySrc, play, pause, toggle,
    list: () => tracks, current: () => cur, playing: () => !!audio && !audio.paused,
    onUnlock: (f) => listeners.push(f), repaint: paint
  };
})();
