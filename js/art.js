/* Заглушки: рисованные силуэты персонажей и процедурные фоны.
   Они используются, только пока в data/*.json не указан путь к вашему PNG/JPG. */
(function () {
  const cache = {};

  // ---------- Спрайты-силуэты (SVG) ----------
  function sprite(ch, expr) {
    const key = ch.id + ':' + (expr || 'default');
    if (cache[key]) return cache[key];
    const L = Object.assign({ hair: '#333', skin: '#eed', cloth: '#456', accent: '#ccc', hairStyle: 'short' }, ch.look || {});
    const e = expr || 'default';
    const brow = e === 'worried' || e === 'scared' ? 'M150 228 Q170 218 186 226 M214 226 Q230 218 250 228' : 'M150 226 Q168 220 186 224 M214 224 Q232 220 250 226';
    const mouth = e === 'smile' ? 'M178 318 Q200 336 222 318' : e === 'scared' ? 'M188 322 Q200 312 212 322 Q200 334 188 322' : 'M182 322 Q200 326 218 322';
    const eyeR = e === 'scared' ? 9 : 7;
    let hairBack = '', hairFront = '';
    if (L.hairStyle === 'long') {
      hairBack = `<path d="M108 250 Q100 140 200 132 Q300 140 292 250 L306 470 Q250 500 200 470 Q150 500 94 470 Z" fill="${L.hair}"/>`;
      hairFront = `<path d="M116 248 Q118 150 200 146 Q284 150 286 246 Q262 196 236 186 Q200 214 150 200 Q128 214 116 248 Z" fill="${L.hair}"/>`;
    } else if (L.hairStyle === 'old') {
      hairFront = `<path d="M118 236 Q116 158 200 152 Q284 158 282 236 Q270 196 246 188 Q200 176 154 188 Q130 196 118 236 Z" fill="${L.hair}"/>`;
    } else {
      hairBack = `<path d="M114 262 Q104 146 200 136 Q296 146 286 262 L280 300 L120 300 Z" fill="${L.hair}"/>`;
      hairFront = `<path d="M114 250 Q112 150 200 144 Q288 150 286 250 Q276 200 250 182 Q220 210 168 196 Q132 206 114 250 Z" fill="${L.hair}"/>`;
    }
    const tall = L.hairStyle === 'old' ? -30 : 0;
    const body = `
      <g transform="translate(0 ${tall})">
      ${hairBack}
      <path d="M40 900 L52 640 Q60 520 150 488 L176 470 L224 470 L250 488 Q340 520 348 640 L360 900 Z" fill="${L.cloth}"/>
      <path d="M176 470 L200 560 L224 470 Z" fill="${L.accent}" opacity=".85"/>
      <rect x="176" y="380" width="48" height="96" rx="20" fill="${L.skin}"/>
      <ellipse cx="200" cy="262" rx="88" ry="104" fill="${L.skin}"/>
      ${hairFront}
      <path d="${brow}" stroke="#2a2420" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
      <circle cx="168" cy="256" r="${eyeR}" fill="#1e2a26"/><circle cx="232" cy="256" r="${eyeR}" fill="#1e2a26"/>
      <path d="${mouth}" stroke="#7a3b32" stroke-width="5" fill="${e === 'scared' ? '#5a2a26' : 'none'}" stroke-linecap="round"/>
      ${e === 'smoke' ? '<rect x="222" y="318" width="44" height="7" rx="3" fill="#eee"/><circle cx="268" cy="321" r="4" fill="#e8834a"/><path d="M272 312 Q290 280 270 250 Q256 220 282 190" stroke="#cfd8d4" stroke-width="6" fill="none" opacity=".5"/>' : ''}
      </g>`;
    let inner = body;
    if (e === 'glitch') {
      inner = `<g opacity=".55" transform="translate(-14 0)" style="mix-blend-mode:screen">${body}</g><g opacity=".55" transform="translate(14 6)">${body}</g>${body}`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 900">${inner}</svg>`;
    return (cache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }

  // ---------- Процедурные фоны (canvas) ----------
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h; }

  function trees(g, r, n, yBase, hMin, hMax, color, W) {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = r() * W, h = hMin + r() * (hMax - hMin), w = h * (0.16 + r() * 0.08);
      g.beginPath();
      g.moveTo(x, yBase - h);
      for (let k = 1; k <= 6; k++) {
        const yy = yBase - h + (h * k) / 6.4, ww = (w * k) / 6;
        g.lineTo(x + ww, yy); g.lineTo(x + ww * 0.45, yy);
      }
      for (let k = 6; k >= 1; k--) {
        const yy = yBase - h + (h * k) / 6.4, ww = (w * k) / 6;
        g.lineTo(x - ww * 0.45, yy); g.lineTo(x - ww, yy);
      }
      g.closePath(); g.fill();
      g.fillRect(x - w * 0.05, yBase - h * 0.08, w * 0.1, h * 0.1);
    }
  }
  function grad(g, W, H, stops) { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  function fog(g, W, H, y, color) { const gr = g.createLinearGradient(0, y - 140, 0, y + 80); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, color); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y - 140, W, 220); }
  function leaves(g, r, n, W, H, colors) { for (let i = 0; i < n; i++) { g.fillStyle = colors[(r() * colors.length) | 0]; g.save(); g.translate(r() * W, r() * H); g.rotate(r() * 6); g.beginPath(); g.ellipse(0, 0, 7, 3.5, 0, 0, 6.3); g.fill(); g.restore(); } }

  const presets = {
    town(g, W, H, r) {
      grad(g, W, H, [[0, '#2b3b4a'], [0.45, '#c8735a'], [0.62, '#e9a76b'], [1, '#2a2620']]);
      g.fillStyle = 'rgba(255,214,150,.9)'; g.beginPath(); g.arc(W * 0.7, H * 0.55, 60, 0, 7); g.fill();
      trees(g, r, 70, H * 0.72, 120, 260, '#3b3a3a', W);
      g.fillStyle = '#231f1d';
      for (let i = 0; i < 14; i++) { const x = 80 + i * 110 + r() * 30, w = 70 + r() * 40, h = 50 + r() * 50; g.fillRect(x, H * 0.78 - h, w, h + 200); g.beginPath(); g.moveTo(x - 8, H * 0.78 - h); g.lineTo(x + w / 2, H * 0.78 - h - 40); g.lineTo(x + w + 8, H * 0.78 - h); g.fill(); g.fillStyle = 'rgba(255,190,110,.75)'; if (r() > 0.4) g.fillRect(x + 14, H * 0.78 - h + 16, 12, 14); g.fillStyle = '#231f1d'; }
      trees(g, r, 30, H * 1.05, 260, 480, '#141413', W);
    },
    park(g, W, H, r) {
      grad(g, W, H, [[0, '#d8b48a'], [0.5, '#b8784c'], [1, '#3a2a1e']]);
      trees(g, r, 60, H * 0.7, 200, 380, '#7a5038', W); fog(g, W, H, H * 0.7, 'rgba(240,200,160,.45)');
      trees(g, r, 40, H * 0.82, 300, 520, '#4f3524', W);
      g.fillStyle = '#6e5442'; g.beginPath(); g.moveTo(W * 0.42, H * 0.7); g.lineTo(W * 0.58, H * 0.7); g.lineTo(W * 0.85, H); g.lineTo(W * 0.15, H); g.fill();
      trees(g, r, 14, H * 1.02, 500, 820, '#231811', W);
      leaves(g, r, 260, W, H, ['#e8834a', '#d9a441', '#c4582a', '#f0b25a']);
    },
    gazebo(g, W, H, r) {
      presets.park(g, W, H, r);
      const cx = W * 0.62, base = H * 0.78;
      g.fillStyle = '#efe6d8'; g.strokeStyle = '#3a2a1e'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx - 260, base - 300); g.lineTo(cx, base - 430); g.lineTo(cx + 260, base - 300); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#d9cdb8';
      [-230, -80, 80, 230].forEach((dx) => g.fillRect(cx + dx - 10, base - 300, 20, 300));
      g.fillRect(cx - 250, base - 120, 500, 14); g.fillRect(cx - 270, base, 540, 26);
      for (let i = -240; i < 240; i += 26) g.fillRect(cx + i, base - 110, 6, 110);
      leaves(g, r, 120, W, H, ['#e8834a', '#d9a441']);
    },
    studio(g, W, H, r) {
      grad(g, W, H, [[0, '#3a2c22'], [1, '#1b1410']]);
      for (let s = 0; s < 4; s++) {
        const y = 140 + s * 170;
        g.fillStyle = '#5a4130'; g.fillRect(60, y + 120, W - 120, 16);
        for (let x = 80; x < W - 140; ) {
          const w = 60 + r() * 70, h = 70 + r() * 45;
          g.fillStyle = '#c9a46a'; g.fillRect(x, y + 120 - h, w, h);
          g.fillStyle = s === 0 ? '#8a6a48' : r() > 0.5 ? '#7d7a72' : '#4a4a46'; g.fillRect(x + 7, y + 127 - h, w - 14, h - 14);
          x += w + 18 + r() * 30;
        }
      }
      const gr = g.createRadialGradient(W * 0.3, 0, 40, W * 0.3, 0, 900); gr.addColorStop(0, 'rgba(255,214,150,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#120d0a'; g.fillRect(0, H * 0.86, W, H);
    },
    street(g, W, H, r) {
      grad(g, W, H, [[0, '#0f1820'], [0.6, '#22303a'], [1, '#121618']]);
      trees(g, r, 50, H * 0.7, 200, 380, '#16211f', W);
      g.fillStyle = '#2a2a28'; g.fillRect(0, H * 0.78, W, H);
      [0.2, 0.75].forEach((p) => {
        const x = W * p; g.fillStyle = '#0c0d0d'; g.fillRect(x - 6, H * 0.3, 12, H * 0.5);
        const gr = g.createRadialGradient(x, H * 0.3, 10, x, H * 0.4, 380); gr.addColorStop(0, 'rgba(255,214,140,.75)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.fillRect(x - 400, 0, 800, H);
      });
      g.fillStyle = '#3d2d22'; g.fillRect(W * 0.38, H * 0.72, W * 0.24, 18); g.fillRect(W * 0.39, H * 0.66, W * 0.22, 12); g.fillRect(W * 0.4, H * 0.72, 10, 70); g.fillRect(W * 0.6 - 10, H * 0.72, 10, 70);
    },
    negative(g, W, H, r) {
      presets.street(g, W, H, r);
      const d = g.getImageData(0, 0, W, H), p = d.data;
      for (let i = 0; i < p.length; i += 4) { const l = 255 - (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11); p[i] = l * 0.55; p[i + 1] = l * 0.95; p[i + 2] = l * 0.7; }
      g.putImageData(d, 0, 0);
    },
    rain(g, W, H, r) {
      presets.street(g, W, H, r);
      g.fillStyle = 'rgba(40,60,80,.35)'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(200,220,240,.25)'; g.lineWidth = 1.5;
      for (let i = 0; i < 600; i++) { const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 26); g.stroke(); }
    },
    manor(g, W, H, r) {
      grad(g, W, H, [[0, '#d9d9d6'], [1, '#5d5d5a']]);
      trees(g, r, 40, H * 0.75, 200, 360, '#3a3a38', W);
      g.fillStyle = '#1d1d1c'; const x = W * 0.3, y = H * 0.35; g.fillRect(x, y, W * 0.4, H * 0.45);
      g.beginPath(); g.moveTo(x - 30, y); g.lineTo(W * 0.5, y - 160); g.lineTo(x + W * 0.4 + 30, y); g.fill();
      g.fillRect(x + 40, y - 150, 40, 120); g.fillStyle = '#9a9a92';
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) g.fillRect(x + 40 + i * 95, y + 40 + j * 110, 34, 60);
      fog(g, W, H, H * 0.82, 'rgba(230,230,226,.6)');
    },
    plain(g, W, H) { grad(g, W, H, [[0, '#1f2b28'], [1, '#0b100f']]); }
  };

  function background(loc) {
    const key = 'bg:' + loc.id + ':' + (loc.preset || 'plain');
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
    const g = c.getContext('2d');
    (presets[loc.preset] || presets.plain)(g, 1600, 900, rng(hash(loc.id)));
    return (cache[key] = c.toDataURL('image/jpeg', 0.86));
  }

  window.Art = { sprite, background, presets: Object.keys(presets) };
})();
