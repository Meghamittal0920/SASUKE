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

  const ready = Promise.all(Array.from({ length: TOTAL }, (_, i) => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => { loaded++; $('pct').textContent = Math.round(loaded / TOTAL * 100) + '%'; res(); };
    im.src = path(i + 1); imgs[i] = im;
  })));

  /* ---------- state ---------- */
  let pos = 0, target = 0, speed = 1, last = 0, curChapter = null;
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const readScroll = () => { target = Math.min(1, Math.max(0, scrollY / maxScroll())) * (TOTAL - 1); };
  addEventListener('scroll', readScroll, { passive: true }); readScroll();

  /* draw with cover-fit + zoom, 2 frames blended for smoothness */
  const drawFrame = (im, alpha, zoom) => {
    if (!im || !im.naturalWidth) return;
    film.globalAlpha = alpha;
    const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom;
    const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
    film.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  };

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
    pos += (target - pos) * Math.min(1, dt * 7);                       // smooth, eased follow of the scroll position

    const i = Math.min(Math.floor(pos), TOTAL - 1), f = pos - i;
    film.globalAlpha = 1; film.fillStyle = '#000'; film.fillRect(0, 0, W, H);
    const zoom = ZOOM;                                               // fixed zoom keeps the corner mark aligned
    drawFrame(imgs[i], 1, zoom);
    drawFrame(imgs[Math.min(i + 1, TOTAL - 1)], f, zoom);              // cross-blend → fluid motion
    film.globalAlpha = 1;

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
    const prog = pos / (TOTAL - 1);
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

  ready.then(() => {
    $('loader').classList.add('done');
    last = performance.now(); readScroll(); pos = target; requestAnimationFrame(loop);
  });
})();