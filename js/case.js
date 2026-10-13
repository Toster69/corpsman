/* «Дело» зрителя: какие улики он нашёл сам, жетоны невзгод и открытые бонусы.
   Всё хранится в браузере зрителя (localStorage). */
(function () {
  const TOK = 'corpsman:tokens';
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // Улики, которые добываются проверкой (строка "check" в эпизоде)
  function checkedClues(ep) {
    const ids = [];
    (ep.scenes || []).forEach((sc) => sc.lines.forEach((l) => { if (l.check && l.check.clue && !ids.includes(l.check.clue)) ids.push(l.check.clue); }));
    return ids;
  }
  function state(ep) { return get('case:' + ep.id, { clues: {} }); }
  function status(ep, clueId) { return state(ep).clues[clueId] || ''; }
  // found — найдена броском, partial — только обрывок, auto — получена без кубиков
  function mark(ep, clueId, st) {
    const s = state(ep); const cur = s.clues[clueId];
    const rank = { '': 0, partial: 1, auto: 2, found: 3 };
    if ((rank[st] || 0) >= (rank[cur || ''] || 0)) s.clues[clueId] = st;
    set('case:' + ep.id, s);
    if (complete(ep)) set('bonus:' + ep.id, true);
  }
  function progress(ep) {
    const ids = checkedClues(ep); const s = state(ep);
    return { total: ids.length, found: ids.filter((id) => s.clues[id] === 'found').length, any: ids.filter((id) => s.clues[id]).length, auto: ids.some((id) => s.clues[id] === 'auto') };
  }
  function complete(ep) { const p = progress(ep); return p.total > 0 && p.found === p.total; }
  function bonusOpen(ep) { return !!get('bonus:' + ep.id, false) || complete(ep); }
  function tokens() { return get(TOK, 0) || 0; }
  function addTokens(n) { set(TOK, Math.max(0, tokens() + n)); return tokens(); }

  window.Case = { checkedClues, status, mark, progress, complete, bonusOpen, tokens, addTokens };
})();
