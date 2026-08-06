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

  /* ---------------- ambient gas trail ---------------- */
  if (fine) {
    var canvas = document.createElement('canvas');
    canvas.id = 'gas-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var particles = [];
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;

    /* Pre-rendered noise tile, stamped over the gas each frame via
       source-atop so grain only shows where the gas itself is drawn. */
    var noiseTile = document.createElement('canvas');
    noiseTile.width = 96;
    noiseTile.height = 96;
    (function paintNoise() {
      var nctx = noiseTile.getContext('2d');
      var img = nctx.createImageData(96, 96);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 90;
      }
      nctx.putImageData(img, 0, 0);
    })();
    var noisePattern = ctx.createPattern(noiseTile, 'repeat');
    var lastSpawn = 0;

    function resizeCanvas() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function hexToRgb(hex) {
      var v = hex.replace('#', '');
      if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
      return [parseInt(v.substr(0, 2), 16), parseInt(v.substr(2, 2), 16), parseInt(v.substr(4, 2), 16)];
    }
    var ionRGB = [100, 255, 218];
    var signalRGB = [139, 107, 255];
    function refreshGasColors() {
      var cs = getComputedStyle(root);
      var ion = cs.getPropertyValue('--accent').trim();
      var signal = cs.getPropertyValue('--signal').trim();
      try { if (ion.indexOf('#') === 0) ionRGB = hexToRgb(ion); } catch (e) {}
      try { if (signal.indexOf('#') === 0) signalRGB = hexToRgb(signal); } catch (e) {}
    }
    window.__refreshGasColors = refreshGasColors;
    refreshGasColors();

    window.addEventListener('pointermove', function (e) {
      mx = e.clientX;
      my = e.clientY;
      var now = performance.now();
      if (now - lastSpawn > 30 && particles.length < 110 && !reducedMotion) {
        lastSpawn = now;
        particles.push({
          x: mx + (Math.random() - 0.5) * 14,
          y: my + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5 - 0.15,
          size: 24 + Math.random() * 30,
          born: now,
          life: 1600 + Math.random() * 900,
          mix: Math.random()
        });
      }
    }, { passive: true });

    function drawGas(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        var age = t - p.born;
        if (age > p.life) { particles.splice(i, 1); continue; }
        var lifeT = age / p.life;
        p.x += p.vx;
        p.y += p.vy;
        p.vx += (Math.random() - 0.5) * 0.06;
        p.vy += (Math.random() - 0.5) * 0.06 - 0.006;
        p.vx *= 0.985;
        p.vy *= 0.985;

        var fade = lifeT < 0.12 ? lifeT / 0.12 : 1 - (lifeT - 0.12) / 0.88;
        var alpha = Math.max(0, fade) * 0.24;
        var size = p.size * (1 + lifeT * 1.6);

        var r = Math.round(ionRGB[0] + (signalRGB[0] - ionRGB[0]) * p.mix);
        var g = Math.round(ionRGB[1] + (signalRGB[1] - ionRGB[1]) * p.mix);
        var b = Math.round(ionRGB[2] + (signalRGB[2] - ionRGB[2]) * p.mix);

        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')');
        grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (particles.length && noisePattern) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = noisePattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (!reducedMotion) {
      requestAnimationFrame(function loop(t) { drawGas(t); requestAnimationFrame(loop); });
    }
  }
})();
