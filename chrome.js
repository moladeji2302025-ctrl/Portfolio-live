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
    /* Light is the site's default regardless of OS preference; dark only
       applies once someone explicitly switches to it via the toggle. */
    if (root.hasAttribute('data-theme')) return root.getAttribute('data-theme') === 'light';
    return true;
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
  /* Soft bell-like chime: a steady sine fundamental plus a quiet overtone,
     both with a gentle attack and a long smooth decay - a click is a sharp
     transient with a hard cutoff; this rings out instead. */
  function chime(freq, duration, peak, delay, overtone) {
    if (!soundOn) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var attack = 0.025;

    function partial(f, gainScale) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak * gainScale, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + attack + duration + 0.05);
    }

    partial(freq, 1);
    if (overtone) partial(freq * overtone, 0.3);
  }
  function playHover() { chime(880, 0.14, 0.018, 0, 2); }
  function playSelect() { chime(659, 0.2, 0.045, 0, 1.5); chime(988, 0.26, 0.032, 0.055, 1.5); }
  function playToggle() { chime(523, 0.22, 0.04, 0, 2); }

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

  /* ---------------- page transition ---------------- */
  /* Replaces the old light-streak wipe. Clicking an internal page link fades
     the screen to blank and pulls the particle swarm to the exact center of
     the viewport instead of the cursor, where it keeps pulsing (the existing
     wave motion does that on its own) while the browser loads the next page.
     A tiny inline script in each page's <head> checks sessionStorage and, if
     we're arriving from one of these clicks, marks the loader active before
     the very first paint - so there's no flash of the destination page
     before the blank cover appears. Once that page has actually finished
     loading (and at least a minimum show time has passed, so it never just
     flickers), the swarm bursts outward from center and the cover fades. */
  var pageLoader = document.getElementById('pageLoader');
  var loaderCenter = null;
  var triggerBurst = function () {};

  function centerOfScreen() {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  if (pageLoader) {
    (function () {
      var MIN_SHOW = 650;
      var OUT_DELAY = 480;

      function revealPage() {
        triggerBurst();
        setTimeout(function () {
          pageLoader.classList.remove('is-instant');
          pageLoader.classList.remove('is-active');
          loaderCenter = null;
        }, 160);
      }

      if (pageLoader.classList.contains('is-active')) {
        loaderCenter = centerOfScreen();
        var arrivedAt = performance.now();
        var doReveal = function () {
          setTimeout(revealPage, Math.max(0, MIN_SHOW - (performance.now() - arrivedAt)));
        };
        if (document.readyState === 'complete') doReveal();
        else window.addEventListener('load', doReveal);
      }

      document.addEventListener('click', function (event) {
        var link = event.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href') || '';
        var isPageLink = href.endsWith('.html') || href.indexOf('.html?') > -1 || href.indexOf('./') === 0;
        var isHash = href.indexOf('#') > -1;
        if (!isPageLink || isHash || link.target === '_blank') return;

        event.preventDefault();
        loaderCenter = centerOfScreen();
        pageLoader.classList.add('is-active');
        try { sessionStorage.setItem('mo-nav', '1'); } catch (e) {}
        setTimeout(function () {
          window.location.href = href;
        }, OUT_DELAY);
      });
    })();
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

  /* ---------------- fluid particle swarm ---------------- */
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

    /* A real simulation, not a shape formula: every particle has its own
       velocity and is individually pulled toward the cursor, individually
       pushed apart from neighbors that get too close, and individually
       nudged sideways for a shared swirl. The cluster's form emerges frame
       to frame from those local forces - that's what makes it read as
       fluid rather than a rigid rotating body. */
    var COUNT = reducedMotion ? 120 : 260;
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    var particles = [];
    for (var i = 0; i < COUNT; i++) {
      var seedAngle = Math.random() * Math.PI * 2;
      var seedR = Math.random() * 260;
      particles.push({
        x: cx + Math.cos(seedAngle) * seedR,
        y: cy + Math.sin(seedAngle) * seedR,
        vx: 0,
        vy: 0,
        len: 3.5 + Math.random() * 5,
        width: 1.3 + Math.random() * 1.4
      });
    }

    var lastMoveTime = -99999;
    window.addEventListener('pointermove', function (e) {
      cx = e.clientX;
      cy = e.clientY;
      lastMoveTime = performance.now();
    }, { passive: true });

    /* A click (or a page-transition reveal) sends every particle flying
       outward from wherever the swarm was centered, then the standing
       forces below pull it back together on their own - the burst decays
       via the same damping as everything else. */
    var burstAt = -99999;
    function burstNow() {
      var origin = loaderCenter || { x: cx, y: cy };
      burstAt = performance.now();
      for (var b = 0; b < particles.length; b++) {
        var bp = particles[b];
        var bdx = bp.x - origin.x;
        var bdy = bp.y - origin.y;
        var bdist = Math.sqrt(bdx * bdx + bdy * bdy) || 0.001;
        var kick = 18 + Math.random() * 9;
        bp.vx += (bdx / bdist) * kick;
        bp.vy += (bdy / bdist) * kick;
      }
    }
    document.addEventListener('click', burstNow);
    triggerBurst = burstNow;

    var hoverBoost = 0;

    var pullK = reducedMotion ? 0.02 : 0.05;
    var swirlK = reducedMotion ? 0.006 : 0.014;
    var repelK = 0.9;
    var damping = 0.86;
    var baseSpacing = 170;

    function drawGas(t) {
      var idleFor = t - lastMoveTime;
      var idleT = Math.max(0, Math.min(1, (idleFor - 600) / 2600));
      var blurPulse = 0.5 + Math.sin(t * 0.0014) * 0.5;
      var blurAmount = idleT * 2.6 * blurPulse;
      canvas.style.filter = blurAmount > 0.05 ? 'blur(' + blurAmount.toFixed(1) + 'px)' : 'none';

      var hovering = root.classList.contains('cursor-hover');
      hoverBoost += ((hovering ? 1 : 0) - hoverBoost) * 0.12;

      var sinceBurst = t - burstAt;
      var burstT = Math.max(0, Math.min(1, sinceBurst / 1250));
      var burstEnergy = sinceBurst >= 0 ? (1 - burstT) * (1 - burstT) : 0;

      /* A traveling ripple, not a shared on/off pulse: phase depends on each
         particle's own distance from the target, so the wave visibly moves
         outward through the swarm like a shockwave, and clicking (or a page
         transition loading) spikes its amplitude for one big pulse before
         it settles back to ambient. */
      var target = loaderCenter || { x: cx, y: cy };
      var tx = target.x;
      var ty = target.y;
      var waveAmp = (0.3 + burstEnergy * 3.2) * (loaderCenter ? 1.5 : 1);
      var spacing = baseSpacing * (1 + hoverBoost * 0.7);
      var spacing2 = spacing * spacing;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var dx = tx - p.x;
        var dy = ty - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var wave = Math.sin(t * 0.0032 - dist * 0.045);

        var ax = (dx / dist) * pullK * dist;
        var ay = (dy / dist) * pullK * dist;
        ax += (-dy / dist) * swirlK * Math.min(dist, 340);
        ay += (dx / dist) * swirlK * Math.min(dist, 340);
        ax += -(dx / dist) * wave * waveAmp;
        ay += -(dy / dist) * wave * waveAmp;

        for (var j = 0; j < particles.length; j++) {
          if (j === i) continue;
          var q = particles[j];
          var ddx = p.x - q.x;
          var ddy = p.y - q.y;
          var d2 = ddx * ddx + ddy * ddy;
          if (d2 < spacing2 && d2 > 0.0001) {
            var d = Math.sqrt(d2);
            var push = (spacing - d) / spacing * repelK;
            ax += (ddx / d) * push;
            ay += (ddy / d) * push;
          }
        }

        p.vx = (p.vx + ax * 0.06) * damping;
        p.vy = (p.vy + ay * 0.06) * damping;
        p.x += p.vx;
        p.y += p.vy;

        var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        var angle = speed > 0.02 ? Math.atan2(p.vy, p.vx) : Math.atan2(ty - p.y, tx - p.x) + Math.PI / 2;
        var hueAngle = Math.atan2(p.y - ty, p.x - tx);
        var hue = HUE_START + ((hueAngle + Math.PI) / (Math.PI * 2)) * HUE_SPAN;
        var glow = 0.5 + wave * 0.25 + burstEnergy * 0.9;
        var alpha = (0.3 + Math.min(0.45, speed * 0.9) + glow * 0.2) * (reducedMotion ? 0.75 : 1);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.strokeStyle = 'hsla(' + hue + ', 82%, 66%, ' + alpha + ')';
        ctx.lineWidth = p.width * (1 + burstEnergy * 1.3);
        var len = p.len * (1 + burstEnergy * 2.2);
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();
        ctx.restore();
      }
    }

    requestAnimationFrame(function loop(t) { drawGas(t); requestAnimationFrame(loop); });
  }
})();
