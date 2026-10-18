/* Заглушки в стиле Corpsman: плоские двухтоновые фигуры со стикерным контуром
   и фоны, пропущенные через CMYK-постеризацию. Используются, только пока
   в data/*.json не указан путь к вашей картинке. */
(function () {
  const cache = {};
  const PAPER = '#efece2';

  function hex(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  function mix(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

  // ---------- Спрайты ----------
  function sprite(ch, expr, opt) {
    opt = opt || {};
    const e = expr || 'default';
    const key = ch.id + ':' + e + (opt.blink ? ':b' : '');
    if (cache[key]) return cache[key];
    const L = Object.assign({ hair: '#222', hairStyle: 'short' }, ch.look || {});
    const main = ch.color || '#22b8cf';
    if (ch.id === 'narrator' || L.style === 'mirror') return (cache[key] = mirrorFigure(opt.blink));

    const id = key.replace(/[^a-z0-9]/gi, '');
    const skin = mix(main, PAPER, 0.45);
    const hair = mix(L.hair, '#0b0b0d', 0.35);
    const brow = e === 'worried' || e === 'scared' ? 'M150 228 Q170 216 186 226 M214 226 Q230 216 250 228' : 'M150 226 Q168 220 186 224 M214 224 Q232 220 250 226';
    const mouth = e === 'smile' ? 'M178 318 Q200 338 222 318' : e === 'scared' ? 'M188 322 Q200 310 212 322 Q200 336 188 322' : 'M182 322 Q200 327 218 322';
    const er = e === 'scared' ? 9 : 7;
    const eyes = opt.blink
      ? '<path d="M158 258 L178 258 M222 258 L242 258" stroke="#0b0b0d" stroke-width="6" stroke-linecap="round"/>'
      : `<ellipse cx="168" cy="256" rx="${er}" ry="${er + 1}" fill="#0b0b0d"/><ellipse cx="232" cy="256" rx="${er}" ry="${er + 1}" fill="#0b0b0d"/>`;
    let hairBack = '', hairFront = '';
    if (L.hairStyle === 'long') {
      hairBack = `<path d="M108 250 Q100 140 200 132 Q300 140 292 250 L306 470 Q250 500 200 470 Q150 500 94 470 Z" fill="${hair}"/>`;
      hairFront = `<path d="M116 248 Q118 150 200 146 Q284 150 286 246 Q262 196 236 186 Q200 214 150 200 Q128 214 116 248 Z" fill="${hair}"/>`;
    } else if (L.hairStyle === 'old') {
      hairFront = `<path d="M118 236 Q116 158 200 152 Q284 158 282 236 Q270 196 246 188 Q200 176 154 188 Q130 196 118 236 Z" fill="${mix(L.hair, PAPER, 0.2)}"/>`;
    } else {
      hairBack = `<path d="M114 262 Q104 146 200 136 Q296 146 286 262 L280 300 L120 300 Z" fill="${hair}"/>`;
      hairFront = `<path d="M114 250 Q112 150 200 144 Q288 150 286 250 Q276 200 250 182 Q220 210 168 196 Q132 206 114 250 Z" fill="${hair}"/>`;
    }
    const lift = L.hairStyle === 'old' ? -30 : 0;
    const fig = `${hairBack}
      <path d="M40 900 L52 640 Q60 520 150 488 L176 470 L224 470 L250 488 Q340 520 348 640 L360 900 Z" fill="${main}"/>
      <path d="M176 470 L200 570 L224 470 Z" fill="#0b0b0d"/>
      <rect x="176" y="380" width="48" height="96" rx="20" fill="${skin}"/>
      <ellipse cx="200" cy="262" rx="88" ry="104" fill="${skin}"/>
      ${hairFront}`;
    const smoke = e === 'smoke' ? '<rect x="222" y="318" width="46" height="8" rx="3" fill="#efece2"/><circle cx="270" cy="322" r="5" fill="#e8452c"/><path d="M274 312 Q294 280 272 250 Q256 220 284 190" stroke="#efece2" stroke-width="7" fill="none" opacity=".55"/>' : '';
    const body = `
      <g transform="translate(0 ${lift})">
        ${fig}
        <g clip-path="url(#c${id})" opacity=".86">${fig.replace(/fill="[^"]+"/g, 'fill="#0b0b0d"')}</g>
        <path d="M120 600 Q150 700 130 900" stroke="#0b0b0d" stroke-width="7" fill="none" opacity=".7"/>
        <path d="${brow}" stroke="#0b0b0d" stroke-width="6" fill="none" stroke-linecap="round"/>
        ${eyes}
        <path d="${mouth}" stroke="#0b0b0d" stroke-width="6" fill="${e === 'scared' ? '#0b0b0d' : 'none'}" stroke-linecap="round"/>
        ${smoke}
      </g>`;
    let inner = body;
    if (e === 'glitch') inner = `<g opacity=".55" transform="translate(-18 0)">${body}</g><g opacity=".55" transform="translate(18 6)">${body}</g>${body}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-250 0 900 900"><defs><clipPath id="c${id}"><path d="M232 0 L400 0 L400 900 L262 900 L284 700 L240 560 L264 420 L230 330 L266 210 L240 120 Z"/></clipPath></defs>${inner}</svg>`;
    return (cache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }

  // Зеркальный человек: чёрная фигура, белый нервный контур, голова-пламя
  function mirrorFigure(blink) {
    const s = (d, w) => `<path d="${d}" fill="none" stroke="#f4fbff" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const o = 'M170 300 Q150 250 168 210 Q160 160 186 120 Q190 160 200 150 Q206 100 222 70 Q226 130 240 140 Q252 180 236 220 Q256 260 232 300 Q236 330 214 340 L216 380 Q300 400 318 470 L330 700 Q330 720 314 718 L300 560 L290 900 L230 900 L206 680 L190 900 L130 900 L112 560 L94 720 Q78 720 80 700 L92 470 Q110 400 186 380 L186 340 Q166 330 170 300 Z';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-250 0 900 900"><path d="${o}" fill="#0b0b0d"/>${s(o, 7)}<g transform="translate(5 -4)" opacity=".45">${s(o, 3)}</g>${blink ? '' : '<path d="M184 262 Q196 252 202 268 Q192 276 184 262 Z M214 262 Q224 254 232 266 Q222 274 214 262 Z" fill="#f4fbff"/>'}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // ---------- Фоны ----------
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  function trees(g, r, n, yBase, hMin, hMax, color, W) {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = r() * W, h = hMin + r() * (hMax - hMin), w = h * (0.16 + r() * 0.08);
      g.beginPath(); g.moveTo(x, yBase - h);
      for (let k = 1; k <= 6; k++) { const yy = yBase - h + (h * k) / 6.4, ww = (w * k) / 6; g.lineTo(x + ww, yy); g.lineTo(x + ww * 0.45, yy); }
      for (let k = 6; k >= 1; k--) { const yy = yBase - h + (h * k) / 6.4, ww = (w * k) / 6; g.lineTo(x - ww * 0.45, yy); g.lineTo(x - ww, yy); }
      g.closePath(); g.fill(); g.fillRect(x - w * 0.05, yBase - h * 0.08, w * 0.1, h * 0.1);
    }
  }
  function grad(g, W, H, stops) { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  function glow(g, x, y, r0, r1, c) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1600, 900); }
  function leaves(g, r, n, W, H) { for (let i = 0; i < n; i++) { g.fillStyle = r() > 0.5 ? '#ddd' : '#999'; g.save(); g.translate(r() * W, r() * H); g.rotate(r() * 6); g.beginPath(); g.ellipse(0, 0, 8, 4, 0, 0, 6.3); g.fill(); g.restore(); } }
  function moon(g, x, y, R) { g.fillStyle = '#f6f6f6'; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill(); g.fillStyle = '#b0b0b0'; [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.35, 0.12]].forEach(([a, b, c]) => { g.beginPath(); g.arc(x + a * R, y + b * R, c * R, 0, 7); g.fill(); }); }

  const presets = {
    town(g, W, H, r) {
      grad(g, W, H, [[0, '#111'], [0.5, '#777'], [0.62, '#ccc'], [1, '#222']]);
      moon(g, W * 0.72, H * 0.24, 70);
      trees(g, r, 70, H * 0.72, 120, 260, '#555', W);
      for (let i = 0; i < 14; i++) { g.fillStyle = '#2a2a2a'; const x = 80 + i * 110 + r() * 30, w = 70 + r() * 40, h = 50 + r() * 50; g.fillRect(x, H * 0.78 - h, w, h + 200); g.beginPath(); g.moveTo(x - 8, H * 0.78 - h); g.lineTo(x + w / 2, H * 0.78 - h - 40); g.lineTo(x + w + 8, H * 0.78 - h); g.fill(); g.fillStyle = '#eee'; if (r() > 0.4) g.fillRect(x + 14, H * 0.78 - h + 16, 12, 14); }
      trees(g, r, 30, H * 1.05, 260, 480, '#0e0e0e', W);
    },
    park(g, W, H, r) {
      grad(g, W, H, [[0, '#ddd'], [0.55, '#888'], [1, '#222']]);
      trees(g, r, 60, H * 0.7, 200, 380, '#777', W);
      glow(g, W * 0.5, H * 0.66, 10, 520, 'rgba(255,255,255,.35)');
      trees(g, r, 40, H * 0.82, 300, 520, '#444', W);
      g.fillStyle = '#9a9a9a'; g.beginPath(); g.moveTo(W * 0.44, H * 0.7); g.lineTo(W * 0.56, H * 0.7); g.lineTo(W * 0.85, H); g.lineTo(W * 0.15, H); g.fill();
      trees(g, r, 14, H * 1.02, 500, 820, '#141414', W);
      leaves(g, r, 220, W, H);
    },
    gazebo(g, W, H, r) {
      presets.park(g, W, H, r);
      const cx = W * 0.62, base = H * 0.78;
      g.fillStyle = '#f2f2f2'; g.strokeStyle = '#111'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(cx - 260, base - 300); g.lineTo(cx, base - 430); g.lineTo(cx + 260, base - 300); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#d6d6d6';
      [-230, -80, 80, 230].forEach((dx) => g.fillRect(cx + dx - 10, base - 300, 20, 300));
      g.fillRect(cx - 250, base - 120, 500, 14); g.fillRect(cx - 270, base, 540, 26);
      for (let i = -240; i < 240; i += 26) g.fillRect(cx + i, base - 110, 6, 110);
    },
    studio(g, W, H, r) {
      grad(g, W, H, [[0, '#555'], [1, '#151515']]);
      for (let s = 0; s < 4; s++) {
        const y = 140 + s * 170;
        g.fillStyle = '#333'; g.fillRect(60, y + 120, W - 120, 16);
        for (let x = 80; x < W - 140;) {
          const w = 60 + r() * 70, h = 70 + r() * 45;
          g.fillStyle = '#bbb'; g.fillRect(x, y + 120 - h, w, h);
          g.fillStyle = r() > 0.5 ? '#777' : '#3c3c3c'; g.fillRect(x + 7, y + 127 - h, w - 14, h - 14);
          x += w + 18 + r() * 30;
        }
      }
      glow(g, W * 0.3, 0, 40, 900, 'rgba(255,255,255,.35)');
      g.fillStyle = '#0d0d0d'; g.fillRect(0, H * 0.86, W, H);
    },
    street(g, W, H, r) {
      grad(g, W, H, [[0, '#0d0d0d'], [0.6, '#3a3a3a'], [1, '#141414']]);
      trees(g, r, 50, H * 0.7, 200, 380, '#262626', W);
      g.fillStyle = '#4a4a4a'; g.fillRect(0, H * 0.78, W, H);
      [0.2, 0.75].forEach((p) => { const x = W * p; g.fillStyle = '#0c0c0c'; g.fillRect(x - 6, H * 0.3, 12, H * 0.5); glow(g, x, H * 0.3, 10, 400, 'rgba(255,255,255,.75)'); });
      g.fillStyle = '#1b1b1b'; g.fillRect(W * 0.38, H * 0.72, W * 0.24, 18); g.fillRect(W * 0.39, H * 0.66, W * 0.22, 12); g.fillRect(W * 0.4, H * 0.72, 10, 70); g.fillRect(W * 0.6 - 10, H * 0.72, 10, 70);
    },
    negative(g, W, H, r) { presets.street(g, W, H, r); },
    // Изнанка линии B: лес из обрывков бумаги, картонная земля, луна — дырка в коробке
    cardboard(g, W, H, r) {
      grad(g, W, H, [[0, '#2a2a2a'], [0.55, '#555'], [1, '#1a1a1a']]);
      const scraps = (n, y0, y1, s0, s1, c) => { for (let i = 0; i < n; i++) { const x = r() * W, y = y0 + r() * (y1 - y0), s = s0 + r() * (s1 - s0); g.fillStyle = c[Math.floor(r() * c.length)]; g.beginPath(); g.moveTo(x + (r() - .5) * s, y - s * .6); for (let k = 0; k < 5; k++) g.lineTo(x + (r() - .5) * s * 1.4, y + (r() - .5) * s); g.closePath(); g.fill(); } };
      scraps(70, H * 0.05, H * 0.55, 60, 160, ['#6a6a6a', '#7a7a7a', '#5a5a5a']);
      g.fillStyle = '#fafafa'; g.beginPath(); g.arc(W * 0.7, H * 0.2, 64, 0, 7); g.fill();
      glow(g, W * 0.7, H * 0.2, 60, 520, 'rgba(255,255,255,.4)');
      trees(g, r, 40, H * 0.74, 220, 400, '#3a3a3a', W);
      for (let i = 0; i < 22; i++) { const x = r() * W, w = 10 + r() * 16, h = 260 + r() * 340; g.fillStyle = r() > 0.5 ? '#202020' : '#2c2c2c'; g.fillRect(x, H * 0.82 - h, w, h); }
      scraps(90, H * 0.08, H * 0.6, 50, 140, ['#999', '#888', '#aaa', '#777']);
      g.fillStyle = '#8a8a8a'; g.fillRect(0, H * 0.8, W, H * 0.2);
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 4;
      for (let y = H * 0.82; y < H; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (r() - .5) * 6); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(W * 0.62, H * 0.24); g.lineTo(W * 0.78, H * 0.24); g.lineTo(W * 0.62, H); g.lineTo(W * 0.3, H); g.fill();
      trees(g, r, 10, H * 1.02, 480, 760, '#141414', W);
    },
    rain(g, W, H, r) {
      presets.street(g, W, H, r);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 700; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 28); g.stroke(); }
    },
    manor(g, W, H, r) {
      grad(g, W, H, [[0, '#ddd'], [1, '#555']]);
      moon(g, W * 0.2, H * 0.2, 60);
      trees(g, r, 40, H * 0.75, 200, 360, '#444', W);
      g.fillStyle = '#151515'; const x = W * 0.3, y = H * 0.35; g.fillRect(x, y, W * 0.4, H * 0.45);
      g.beginPath(); g.moveTo(x - 30, y); g.lineTo(W * 0.5, y - 160); g.lineTo(x + W * 0.4 + 30, y); g.fill();
      g.fillRect(x + 40, y - 150, 40, 120); g.fillStyle = '#aaa';
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) g.fillRect(x + 40 + i * 95, y + 40 + j * 110, 34, 60);
      glow(g, W * 0.5, H * 0.85, 10, 500, 'rgba(255,255,255,.45)');
    },
    plain(g, W, H) { grad(g, W, H, [[0, '#1a1a1a'], [1, '#050505']]); glow(g, W * 0.5, H * 0.4, 10, 700, 'rgba(255,255,255,.25)'); }
  };

  // Карта градиента: тёмное → светлое, 5 плоских уровней, как на постерах Corpsman
  const PALETTES = {
    town: ['#0b0b0d', '#3b2a6b', '#c2456a', '#f08a5d', '#f2d230'],
    park: ['#0b0b0d', '#25524a', '#d0543c', '#f0a03a', '#f2e3a0'],
    gazebo: ['#0b0b0d', '#16675f', '#4fbf7a', '#e8d36a', '#efece2'],
    studio: ['#0b0b0d', '#3a2350', '#9a4a3a', '#e09a3a', '#f2d78a'],
    street: ['#0b0b0d', '#1f2a5c', '#1d8f9a', '#7fd0c0', '#f2d230'],
    negative: ['#0b0b0d', '#0d4f4a', '#1fb39a', '#8ef0b0', '#f4fbe8'],
    cardboard: ['#0b0b0d', '#3a2160', '#7d4fcf', '#3fbf8a', '#d9f2c4'],
    rain: ['#0b0b0d', '#16224a', '#2a5d9a', '#3fb9d6', '#d8f1f6'],
    manor: ['#0b0b0d', '#2c2c30', '#6b6b70', '#b8b6ae', '#efece2'],
    plain: ['#0b0b0d', '#2a2350', '#1d8f9a', '#e8457a', '#f2d230']
  };

  function gradientMap(g, W, H, pal, invert, r) {
    const d = g.getImageData(0, 0, W, H), p = d.data, cols = pal.map(hex), n = cols.length;
    for (let i = 0; i < p.length; i += 4) {
      let l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
      if (invert) l = 1 - l;
      l += (r() - 0.5) * 0.08;
      const c = cols[Math.max(0, Math.min(n - 1, Math.floor(l * n)))];
      p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2];
    }
    g.putImageData(d, 0, 0);
  }

  function background(loc) {
    const preset = (loc && loc.preset) || 'plain';
    const key = 'bg:' + (loc && loc.id) + ':' + preset;
    if (cache[key]) return cache[key];
    const W = 1280, H = 720;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const r = rng(hash(loc && loc.id));
    g.save(); g.scale(W / 1600, H / 900); (presets[preset] || presets.plain)(g, 1600, 900, r); g.restore();
    gradientMap(g, W, H, PALETTES[preset] || PALETTES.plain, preset === 'negative', r);
    return (cache[key] = c.toDataURL('image/jpeg', 0.85));
  }

  // Шум для «переключения канала» и плёнки
  function noise(size, alpha) {
    const key = 'noise:' + size + ':' + alpha;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); const d = g.createImageData(size, size);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = alpha; }
    g.putImageData(d, 0, 0);
    return (cache[key] = c.toDataURL('image/png'));
  }

  window.Art = { sprite, background, noise, hash, rng, presets: Object.keys(presets) };
})();
