/* Shared chrome: custom cursor, ambient gas trail, grain overlay, theme + sound
   toggles. Loaded on every page so the experience is identical site-wide. */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------------- theme ---------------- */
  var themeSwitch = document.getElementById('theme-switch');
  var storedTheme = null;
  try { storedTheme = localStorage.getItem('mo-theme'); } catch (e) {}
  if (storedTheme) root.setAttribute('data-theme', storedTheme);

  function isLight() {
    if (root.hasAttribute('data-theme')) return root.getAttribute('data-theme') === 'light';
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  }
  function syncThemeSwitch() {
    if (!themeSwitch) return;
    var light = isLight();
    themeSwitch.classList.toggle('is-light', light);
    themeSwitch.setAttribute('aria-checked', String(light));
  }
  if (themeSwitch) {
    themeSwitch.addEventListener('click', function () {
      var next = isLight() ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('mo-theme', next); } catch (e) {}
      syncThemeSwitch();
      playToggle();
      if (window.__refreshGasColors) window.__refreshGasColors();
    });
    syncThemeSwitch();
  }

  /* ---------------- sound synth ---------------- */
  var audioCtx = null;
  var soundOn = true;
  try { soundOn = localStorage.getItem('mo-sound') !== 'off'; } catch (e) {}

  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freqStart, freqEnd, duration, type, peak, delay) {
    if (!soundOn) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak || 0.05, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }
  function playHover() { tone(760, 1020, 0.06, 'sine', 0.022); }
  function playSelect() { tone(640, 640, 0.045, 'triangle', 0.04); tone(980, 980, 0.09, 'triangle', 0.035, 0.05); }
  function playToggle() { tone(300, 920, 0.035, 'square', 0.014); }

  document.addEventListener('pointerdown', function unlock() {
    ensureAudio();
    document.removeEventListener('pointerdown', unlock);
  }, { once: true });

  var SOUND_HOVER_SELECTOR = 'a, button, .tile, .filter-btn, .faq-trigger, .arrow-btn, .dot, .project-card';
  document.addEventListener('mouseover', function (e) {
    if (e.target.closest(SOUND_HOVER_SELECTOR)) playHover();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('button, .project-card-link, .filter-btn, a.nav-cta, a.btn')) playSelect();
  });

  var soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    var syncSoundIcon = function () {
      soundToggle.setAttribute('aria-pressed', String(soundOn));
      soundToggle.classList.toggle('is-muted', !soundOn);
    };
    soundToggle.addEventListener('click', function () {
      soundOn = !soundOn;
      try { localStorage.setItem('mo-sound', soundOn ? 'on' : 'off'); } catch (e) {}
      syncSoundIcon();
      if (soundOn) playToggle();
    });
    syncSoundIcon();
  }

  /* ---------------- custom cursor (dot + ring, magnetic) ---------------- */
  var fine = window.matchMedia('(pointer: fine)').matches;
  var cursorRing = document.querySelector('.custom-cursor');
  var cursorDot = document.querySelector('.custom-cursor-dot');

  if (fine && cursorRing) {
    root.classList.add('has-custom-cursor');
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    var ringX = cx, ringY = cy;
    var shown = false;

    window.addEventListener('pointermove', function (e) {
      cx = e.clientX;
      cy = e.clientY;
      if (!shown) {
        shown = true;
        ringX = cx; ringY = cy;
        root.classList.add('cursor-visible');
      }
      if (cursorDot) {
        cursorDot.style.left = cx + 'px';
        cursorDot.style.top = cy + 'px';
      }
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      root.classList.remove('cursor-visible');
      shown = false;
    });

    (function tickRing() {
      var ease = reducedMotion ? 1 : 0.16;
      ringX += (cx - ringX) * ease;
      ringY += (cy - ringY) * ease;
      cursorRing.style.left = ringX + 'px';
      cursorRing.style.top = ringY + 'px';
      requestAnimationFrame(tickRing);
    })();

    var CURSOR_HOVER_SELECTOR = 'a, button, .tile, .project-card, .filter-btn, .faq-trigger, .arrow-btn, .dot, input, textarea';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(CURSOR_HOVER_SELECTOR)) root.classList.add('cursor-hover');
    });
    document.addEventListener('mouseout', function (e) {
      var stillHovering = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(CURSOR_HOVER_SELECTOR);
      if (e.target.closest(CURSOR_HOVER_SELECTOR) && !stillHovering) {
        root.classList.remove('cursor-hover');
      }
    });

    if (!reducedMotion) {
      var magnets = document.querySelectorAll('.btn-primary, .nav-cta, .menu-toggle, .theme-switch, #sound-toggle, .arrow-btn');
      magnets.forEach(function (el) {
        el.addEventListener('mousemove', function (e) {
          var r = el.getBoundingClientRect();
          var relX = e.clientX - (r.left + r.width / 2);
          var relY = e.clientY - (r.top + r.height / 2);
          el.style.transform = 'translate(' + (relX * 0.25) + 'px, ' + (relY * 0.25) + 'px)';
        });
        el.addEventListener('mouseleave', function () { el.style.transform = ''; });
      });
    }
  }

  /* ---------------- grain overlay ---------------- */
  var grain = document.createElement('div');
  grain.className = 'grain';
  grain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grain);

  /* ---------------- magnetic particle field ---------------- */
  if (fine) {
    var canvas = document.createElement('canvas');
    canvas.id = 'gas-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeCanvas() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    /* Spectrum sweeps from the brand blue through violet into warm tones,
       so it reads as the site's palette rather than a generic rainbow. */
    var HUE_START = 200;
    var HUE_SPAN = 170;
    function refreshGasColors() {} /* kept as a no-op so theme toggle callers stay valid */
    window.__refreshGasColors = refreshGasColors;

    /* A persistent field, not a spawn/decay trail: every particle is always
       alive, always drifting, and gets pulled into orbit around the cursor
       (magnetic-field style: radial pull + tangential swirl) whenever the
       mouse is active. When the mouse goes idle they keep gently pulsing
       on their own and the whole field softens with blur. */
    var COUNT = reducedMotion ? 90 : 170;
    var particles = [];
    for (var i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: 0,
        vy: 0,
        len: 7 + Math.random() * 13,
        width: 1.4 + Math.random() * 1.6,
        hue: HUE_START + Math.random() * HUE_SPAN,
        phase: Math.random() * Math.PI * 2
      });
    }

    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 2;
    var lastMoveTime = -99999;

    window.addEventListener('pointermove', function (e) {
      targetX = e.clientX;
      targetY = e.clientY;
      lastMoveTime = performance.now();
    }, { passive: true });

    function drawGas(t) {
      var idleFor = t - lastMoveTime;
      var idleT = Math.max(0, Math.min(1, (idleFor - 400) / 2200));
      var activity = reducedMotion ? 0.3 : 1 - idleT * 0.75;
      canvas.style.filter = idleT > 0.02 ? 'blur(' + (idleT * 7).toFixed(1) + 'px)' : 'none';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (var idx = 0; idx < particles.length; idx++) {
        var p = particles[idx];
        var dx = targetX - p.x;
        var dy = targetY - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = dx / dist;
        var ny = dy / dist;
        var tx = -ny;
        var ty = nx;

        var pull = Math.min(0.5, 55 / dist) * activity;
        var swirl = 0.4 * activity;

        p.vx += (nx * pull + tx * swirl) * 0.05;
        p.vy += (ny * pull + ty * swirl) * 0.05;

        p.phase += 0.014;
        p.vx += Math.sin(p.phase) * 0.012;
        p.vy += Math.cos(p.phase * 0.85) * 0.012;

        p.vx *= 0.945;
        p.vy *= 0.945;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -60) p.x = window.innerWidth + 60;
        if (p.x > window.innerWidth + 60) p.x = -60;
        if (p.y < -60) p.y = window.innerHeight + 60;
        if (p.y > window.innerHeight + 60) p.y = -60;

        var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        var angle = Math.atan2(p.vy, p.vx);
        var alpha = 0.28 + Math.min(0.4, speed * 1.6);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.strokeStyle = 'hsla(' + p.hue + ', 82%, 66%, ' + alpha + ')';
        ctx.lineWidth = p.width;
        ctx.beginPath();
        ctx.moveTo(-p.len / 2, 0);
        ctx.lineTo(p.len / 2, 0);
        ctx.stroke();
        ctx.restore();
      }
    }

    requestAnimationFrame(function loop(t) { drawGas(t); requestAnimationFrame(loop); });
  }
})();
