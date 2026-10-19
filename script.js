(() => {
  const TOTAL = 80, W = 1920, FPS_LABEL = 14; let H = 1080;         // FPS_LABEL only used for the HUD clock          // FPS_LABEL only used for the HUD clock
  const path = n => `Assets/frame_${String(n).padStart(3, '0')}.jpg`;
  const $ = id => document.getElementById(id);
  const film = $('film').getContext('2d'), fx = $('fx').getContext('2d');
  const stage = $('stage');

   /* ---------- fill the whole window (no black bars) ---------- */
  const ZOOM = 1.06;
  const fit = () => {
    const s = innerWidth / W;                       // scale so the stage is exactly as wide as the window
    H = Math.round(innerHeight / s);                // stage height follows the window's aspect ratio
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    stage.style.transform = `scale(${s})`;
    film.canvas.width = fx.canvas.width = W;
    film.canvas.height = fx.canvas.height = H;
    // keep the emblem exactly over the source frames' corner watermark
    const sc = Math.max(W / 1280, H / 720) * ZOOM, mk = document.querySelector('.mark');
    mk.style.left = (W / 2 + .406 * 1280 * sc - 56) + 'px';
    mk.style.top  = Math.min(H / 2 + .333 * 720 * sc - 56, H - 130) + 'px';
  };
  addEventListener('resize', fit); fit();
  
  /* ---------- chapters (frame ranges → words + accent) ---------- */
    const chapters = [
    { from: 1,  kicker: 'Prologue',   word: '目覚め',     sub: 'Darkness stirs',        color: '#8a8fa8' },
    { from: 10, kicker: 'Chapter 01', word: '写輪眼',     sub: 'The eyes that see all', color: '#ff2a3d' },
    { from: 30, kicker: 'Chapter 02', word: '千鳥',       sub: 'One thousand birds',    color: '#37c8ff' },
    { from: 52, kicker: 'Chapter 03', word: '須佐能乎',   sub: 'Armor of the avenger',  color: '#b06bff' },
    { from: 70, kicker: 'Finale',     word: 'うちは',     sub: 'The last avenger',      color: '#ff2a3d' },
  ];
  const chapterAt = f => [...chapters].reverse().find(c => f >= c.from);

  /* ---------- preload ---------- */
  const imgs = new Array(TOTAL);
  let loaded = 0;
  const ticks = $('ticks'); for (let i = 0; i < 21; i++) ticks.appendChild(document.createElement('i'));
  $('tot').textContent = String(TOTAL).padStart(3, '0');

  /* cursed-eyes image revealed when the glass shatters */
  const eyes = new Image();
  const eyesReady = new Promise(res => { eyes.onload = eyes.onerror = res; eyes.src = 'Assets/cursed_eyes.png'; });

  const ready = Promise.all([eyesReady, ...Array.from({ length: TOTAL }, (_, i) => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => { loaded++; $('pct').textContent = Math.round(loaded / TOTAL * 100) + '%'; res(); };
    im.src = path(i + 1); imgs[i] = im;
  }))]);

  /* ---------- state ---------- */
  let u = 0, target = 0, pos = 0, speed = 1, last = 0, curChapter = null;
  let shatterAt = 0, impact = [W / 2, 540];                           // click-triggered glass break on the last frame
  const SHATTER_MS = 2200;
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const readScroll = () => { target = Math.min(1, Math.max(0, scrollY / maxScroll())); };
  addEventListener('scroll', readScroll, { passive: true }); readScroll();

  /* draw with cover-fit + zoom, 2 frames blended for smoothness */
  const drawFrame = (im, alpha, zoom) => {
    if (!im || !im.naturalWidth) return;
    film.globalAlpha = alpha;
    const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom;
    const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
    film.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  };

  /* ---------- glass shards: irregular Voronoi cells, denser around the click point ---------- */
  const snap = document.createElement('canvas'), sctx = snap.getContext('2d');
  let shards = [];
  // keep the part of polygon `poly` that is closer to seed a than to seed b
  const clipHalf = (poly, a, b) => {
    const nx = b[0] - a[0], ny = b[1] - a[1], c = (nx * (a[0] + b[0]) + ny * (a[1] + b[1])) / 2;
    const side = p => nx * p[0] + ny * p[1] - c, out = [];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
      if (sp <= 0) out.push(p);
      if ((sp < 0) !== (sq < 0) && sp !== sq) { const k = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]); }
    });
    return out;
  };
  function buildShards(cx, cy) {
    const seeds = [], maxR = Math.hypot(W, H);
    for (let i = 0; i < 70; i++) {                                     // small pieces near the impact, big ones far away
      const a = Math.random() * 6.283, r = Math.pow(Math.random(), 1.8) * maxR * .7;
      seeds.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    for (let i = 0; i < 18; i++) seeds.push([Math.random() * W, Math.random() * H]);
    shards = [];
    for (const s of seeds) {
      let poly = [[0, 0], [W, 0], [W, H], [0, H]];
      for (const o of seeds) if (o !== s && poly.length) poly = clipHalf(poly, s, o);
      if (poly.length < 3) continue;
      const mx = poly.reduce((a, p) => a + p[0], 0) / poly.length, my = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
      shards.push({ poly, mx, my, ux: dx / d, uy: dy / d, d: d / maxR,
        sp: 250 + Math.random() * 700, rot: (Math.random() - .5) * 2, fall: 600 + Math.random() * 900,
        delay: (d / maxR) * .3 + Math.random() * .1, depth: .1 + Math.random() * .6 });
    }
  }
  const ease = x => x * x * (3 - 2 * x);

  function drawShatter(sh, t) {
    if (snap.width !== W || snap.height !== H) { snap.width = W; snap.height = H; }
    sctx.drawImage(film.canvas, 0, 0);                                 // freeze the current frame as the "glass"

    // background: the cursed eyes, pushing in slowly
    film.globalAlpha = 1; film.fillStyle = '#000'; film.fillRect(0, 0, W, H);
    const crackP = Math.min(1, sh / .12), breakP = Math.max(0, (sh - .12) / .88);
    if (eyes.naturalWidth) {
      const z = 1.18 - .12 * ease(breakP) + .01 * Math.sin(t / 900);
      const sc = Math.max(W / eyes.naturalWidth, H / eyes.naturalHeight) * z;
      const dw = eyes.naturalWidth * sc, dh = eyes.naturalHeight * sc;
      film.filter = `brightness(${.35 + .75 * ease(breakP)}) saturate(${.6 + .6 * breakP})`;
      film.drawImage(eyes, (W - dw) / 2, H * .45 - dh * .45, dw, dh);
      film.filter = 'none';
    }

    // shards of the frozen frame flying toward the camera
    for (const s of shards) {
      const p = Math.max(0, Math.min(1, (breakP - s.delay) / (1 - s.delay)));
      const e = p * p, alpha = 1 - Math.max(0, (p - .55) / .45);
      if (alpha <= 0) continue;
      film.save();
      film.globalAlpha = alpha;
      film.translate(s.mx + s.ux * s.sp * e, s.my + s.uy * s.sp * e + s.fall * e * e);
      film.rotate(s.rot * e);
      film.scale(1 + s.depth * e, 1 + s.depth * e);
      film.translate(-s.mx, -s.my);
      film.beginPath(); s.poly.forEach((q, n) => n ? film.lineTo(q[0], q[1]) : film.moveTo(q[0], q[1])); film.closePath();
      film.save(); film.clip(); film.drawImage(snap, 0, 0);
      film.fillStyle = `rgba(255,255,255,${.04 + .1 * e})`; film.fillRect(0, 0, W, H);   // glass sheen
      film.restore();
      // edges light up from the impact outward, then fade as the pieces fly
      const edge = Math.max(0, Math.min(1, (crackP - s.d) * 3)) * (1 - e);
      if (edge > 0) { film.strokeStyle = `rgba(255,255,255,${.7 * edge})`; film.lineWidth = 1.4; film.stroke(); }
      film.restore();
    }

    // flash at the impact and at the break
    const flash = Math.max(0, 1 - sh / .05) * .6 + Math.max(0, 1 - Math.abs(sh - .14) / .06) * .5;
    if (flash > 0) {
      film.globalAlpha = flash; film.globalCompositeOperation = 'screen';
      film.fillStyle = `rgb(${rgb})`; film.fillRect(0, 0, W, H);
      film.globalCompositeOperation = 'source-over'; film.globalAlpha = 1;
    }
  }

  /* ---------- particles (embers) ---------- */
  const parts = Array.from({ length: 90 }, () => spawn(true));
  function spawn(init) {
    return { x: Math.random() * W, y: init ? Math.random() * H : H + 20, r: Math.random() * 2.4 + .4,
             vy: -(Math.random() * 1.2 + .3), vx: (Math.random() - .5) * .6, a: Math.random() * .8 + .2, ph: Math.random() * 6.28 };
  }

  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  let rgb = [255, 42, 61];

  function setChapter(c) {
    curChapter = c;
    const root = document.documentElement.style;
    root.setProperty('--accent', c.color);
    rgb = hexToRgb(c.color);
    const w = $('word'), s = $('sub'), k = $('kicker');
    [w, s, k].forEach(e => e.classList.add('swap'));
    setTimeout(() => {
      w.textContent = c.word; w.dataset.text = c.word; s.textContent = c.sub; k.textContent = c.kicker;
      [w, s, k].forEach(e => e.classList.remove('swap'));
    }, 350);
  }

  /* ---------- main loop ---------- */
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    u += (target - u) * Math.min(1, dt * 7);                           // smooth, eased follow of the scroll position
    pos = u * (TOTAL - 1);
    const atEnd = u > .985;
    if (!atEnd) shatterAt = 0;                                         // scrolling back puts the glass back together
    const sh = shatterAt ? Math.min(1, (t - shatterAt) / SHATTER_MS) : 0;   // 0 -> 1 glass-shatter progress
    $('reveal').classList.toggle('show', atEnd && !shatterAt);

    const i = Math.min(Math.floor(pos), TOTAL - 1), f = pos - i;
    film.globalAlpha = 1; film.fillStyle = '#000'; film.fillRect(0, 0, W, H);
    const zoom = ZOOM;                                               // fixed zoom keeps the corner mark aligned
    drawFrame(imgs[i], 1, zoom);
    drawFrame(imgs[Math.min(i + 1, TOTAL - 1)], f, zoom);              // cross-blend → fluid motion
    film.globalAlpha = 1;
    if (sh > 0) drawShatter(sh, t);
    stage.classList.toggle('revealed', sh > .5);

    // shake when the chapter changes
    const frameNo = i + 1;
    const c = chapterAt(frameNo);
    if (c !== curChapter) { setChapter(c); stage.animate([{ transform: stage.style.transform + ' translate(0,0)' }, { transform: stage.style.transform + ' translate(-8px,5px)' }, { transform: stage.style.transform + ' translate(6px,-4px)' }, { transform: stage.style.transform }], { duration: 260 }); }

    // fx layer: embers
    fx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.x += p.vx + Math.sin(t / 700 + p.ph) * .35; p.y += p.vy * (1 + speed * .3);
      if (p.y < -10) Object.assign(p, spawn(false));
      const tw = .5 + .5 * Math.sin(t / 300 + p.ph);
      const g = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      g.addColorStop(0, `rgba(${rgb},${p.a * tw})`); g.addColorStop(1, `rgba(${rgb},0)`);
      fx.fillStyle = g; fx.beginPath(); fx.arc(p.x, p.y, p.r * 6, 0, 6.283); fx.fill();
    }

    // HUD
    const prog = u;
    $('fill').style.width = prog * 100 + '%';
    $('knob').style.left = prog * 100 + '%';
    $('cur').textContent = String(frameNo).padStart(3, '0');
    const secs = pos / FPS_LABEL;
    $('clock').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${(secs % 60).toFixed(2).padStart(5, '0')}`;
    $('fps').textContent = 'SCROLL ' + Math.round(prog * 100) + '%';
    $('hint').classList.toggle('hide', prog > .02);
    requestAnimationFrame(loop);
  }

  /* ---------- controls: click or drag the timeline to scroll ---------- */
  const tl = $('timeline');
  let drag = false;
  const seek = e => {
    const r = tl.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    scrollTo(0, p * maxScroll());
  };
  tl.addEventListener('pointerdown', e => { drag = true; tl.setPointerCapture(e.pointerId); seek(e); });
  tl.addEventListener('pointermove', e => drag && seek(e));
  tl.addEventListener('pointerup', () => drag = false);

  /* ---------- click the last frame to shatter it ---------- */
  $('viewport').addEventListener('click', e => {
    if (shatterAt || u < .985) return;
    const s = W / innerWidth;                                          // window px -> stage px
    impact = [e.clientX * s, e.clientY * s];
    buildShards(impact[0], impact[1]);
    shatterAt = performance.now();
    const tf = stage.style.transform;
    stage.animate([{ transform: tf + ' translate(0,0)' }, { transform: tf + ' translate(-14px,9px)' }, { transform: tf + ' translate(10px,-7px)' }, { transform: tf + ' translate(-5px,3px)' }, { transform: tf }], { duration: 380 });
  });

  ready.then(() => {
    $('loader').classList.add('done');
    last = performance.now(); readScroll(); u = target; requestAnimationFrame(loop);
  });
})();