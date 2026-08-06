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
  var triggerGentleRelease = function () { loaderCenter = null; };

  function centerOfScreen() {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  /* The particle canvas normally sits behind all page content (z-index -1),
     but the loader cover sits above everything (150) - without this, the
     opaque cover would hide the swarm along with the real page underneath
     it. Bring the canvas in front of the cover only while transitioning. */
  function setCanvasFront(active) {
    var c = document.getElementById('gas-canvas');
    if (c) c.style.zIndex = active ? '151' : '';
  }

  if (pageLoader) {
    (function () {
      /* Matches the energy-wave rhythm in the gas-trail block (2*PI/0.0046) -
         kept as a literal here since that code hasn't run yet when this
         section first executes. */
      var LOAD_PULSE_PERIOD = 1366;
      var MIN_PULSES = 4;
      var OUT_DELAY = 480;

      function revealPage() {
        triggerGentleRelease();
        setTimeout(function () {
          pageLoader.classList.remove('is-instant');
          pageLoader.classList.remove('is-active');
        }, 400);
        /* setCanvasFront(false) is triggered from inside drawGas the instant
           the release animation itself finishes, not on a separate guessed
           timer - so it can never fall out of sync with what's actually
           still visibly dispersing. */
      }

      if (pageLoader.classList.contains('is-active')) {
        loaderCenter = centerOfScreen();
        setCanvasFront(true);
        var arrivedAt = performance.now();
        var doReveal = function () {
          /* Always let the swarm complete at least 4 full pulse cycles
             before it's allowed to disperse, regardless of how fast the
             page itself loaded - a load that takes longer than that is
             simply shown for exactly as long as it actually took. */
          var elapsed = performance.now() - arrivedAt;
          var wait = Math.max(0, MIN_PULSES * LOAD_PULSE_PERIOD - elapsed);
          setTimeout(revealPage, wait);
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
        setCanvasFront(true);
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
    var dotX = cx, dotY = cy;
    var shown = false;

    window.addEventListener('pointermove', function (e) {
      cx = e.clientX;
      cy = e.clientY;
      if (!shown) {
        shown = true;
        ringX = cx; ringY = cy;
        dotX = cx; dotY = cy;
        root.classList.add('cursor-visible');
      }
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      root.classList.remove('cursor-visible');
      shown = false;
    });

    var magnets = document.querySelectorAll('.btn-primary, .nav-cta, .menu-toggle, .theme-switch, #sound-toggle, .arrow-btn');

    /* Pulls the cursor toward the exact center of the nearest magnetic
       button once the raw cursor is within range of it - a curved ramp
       (not linear) so the pull builds gently at range and gathers strongly
       right up to the button, letting the ring genuinely settle near its
       center rather than just nudging toward it. */
    function magnetOffsetFor(px, py) {
      var range = 90;
      var best = null;
      for (var m = 0; m < magnets.length; m++) {
        var r = magnets[m].getBoundingClientRect();
        var ex = r.left + r.width / 2;
        var ey = r.top + r.height / 2;
        var edgeDist = Math.max(0, Math.hypot(px - ex, py - ey) - Math.max(r.width, r.height) / 2);
        if (edgeDist < range && (!best || edgeDist < best.d)) best = { x: ex, y: ey, d: edgeDist };
      }
      if (!best) return { x: 0, y: 0 };
      var t = 1 - best.d / range;
      var strength = t * t * 0.82;
      return { x: (best.x - px) * strength, y: (best.y - py) * strength };
    }

    (function tickCursor() {
      var ringEase = reducedMotion ? 1 : 0.16;
      var dotEase = reducedMotion ? 1 : 0.4;
      var magnet = reducedMotion ? { x: 0, y: 0 } : magnetOffsetFor(cx, cy);
      ringX += (cx + magnet.x - ringX) * ringEase;
      ringY += (cy + magnet.y - ringY) * ringEase;
      dotX += (cx + magnet.x * 0.6 - dotX) * dotEase;
      dotY += (cy + magnet.y * 0.6 - dotY) * dotEase;
      cursorRing.style.left = ringX + 'px';
      cursorRing.style.top = ringY + 'px';
      if (cursorDot) {
        cursorDot.style.left = dotX + 'px';
        cursorDot.style.top = dotY + 'px';
      }
      requestAnimationFrame(tickCursor);
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
    /* setCanvasFront() may have already been called on the arriving page,
       before this canvas existed to receive it - catch up now. */
    if (loaderCenter) canvas.style.zIndex = '151';
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
    var COUNT = reducedMotion ? 480 : 1040;
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    var particles = [];
    for (var i = 0; i < COUNT; i++) {
      var frac = (i + 0.5) / COUNT;
      particles.push({
        len: 3.5 + Math.random() * 5,
        width: 1.3 + Math.random() * 1.4,
        /* Fixed spot on a Fibonacci-distributed sphere shell - position is
           computed fresh every frame from this plus the shared rotation, not
           simulated with persistent velocity, so this works identically for
           the cursor-follow swarm and the load-state blob alike. */
        theta: Math.PI * (1 + Math.sqrt(5)) * i,
        phi: Math.acos(1 - 2 * frac),
        radiusJitter: 0.72 + Math.random() * 0.56,
        noisePhaseA: Math.random() * Math.PI * 2,
        noiseFreqA: 0.5 + Math.random() * 0.5,
        noisePhaseB: Math.random() * Math.PI * 2,
        noiseFreqB: 0.9 + Math.random() * 0.6
      });
    }
    /* Reused every frame (mutated in place, not reallocated) to hold each
       particle's projected screen position so it can be depth-sorted before
       drawing - near particles must be painted over far ones for the solid
       "3D object" read, not a flat cloud of dots. */
    var blobProjected = [];
    for (var pj = 0; pj < COUNT; pj++) blobProjected.push({ p: null, x: 0, y: 0, depthT: 0 });
    var blobRotation = 0;
    var blobTilt = 0;
    var BLOB_RADIUS = 190;
    var BLOB_FOCAL = 340;

    /* Tracks how fast the target itself is moving, smoothed frame to frame.
       Drives the blob's spin speed and its directional stretch while
       actually traveling - it has no effect during the load-state
       transition, since that target is fixed and speed naturally stays
       at zero. */
    var prevTx = cx, prevTy = cy;
    var smoothVX = 0, smoothVY = 0;

    var lastMoveTime = -99999;
    window.addEventListener('pointermove', function (e) {
      cx = e.clientX;
      cy = e.clientY;
      lastMoveTime = performance.now();
    }, { passive: true });

    /* Both a click and a page-transition reveal just mark a moment in time -
       burstEnergy (derived below) decays from it and drives a radius/glow
       bloom in the renderer, rather than pushing particles around directly. */
    var burstAt = -99999;
    function burstNow() { burstAt = performance.now(); }
    document.addEventListener('click', burstNow);
    triggerBurst = burstNow;

    /* The page-transition reveal wants a soft bloom-and-dissolve, not a
       sharp explosion: the blob expands and fades over this duration while
       blur ramps up, rather than particles being kicked outward. */
    var releasing = false;
    var releaseStart = 0;
    var RELEASE_DURATION = 1900;
    function gentleRelease() {
      releasing = true;
      releaseStart = performance.now();
    }
    triggerGentleRelease = gentleRelease;

    /* Easing the pull in on arrival so the blob condenses into being
       smoothly instead of popping in at full size. */
    var convergeStart = null;
    var CONVERGE_DURATION = 1100;

    var hoverBoost = 0;
    var baseSpin = reducedMotion ? 0.0009 : 0.0016;

    function drawGas(t) {
      var inTransition = !!loaderCenter;

      var releaseMult = 1;
      var releaseT = 0;
      if (releasing) {
        releaseT = Math.min(1, (t - releaseStart) / RELEASE_DURATION);
        releaseMult = 1 - releaseT;
        if (releaseT >= 1) {
          releasing = false;
          loaderCenter = null;
          inTransition = false;
          setCanvasFront(false);
        }
      }

      var convergeMult = 1;
      if (inTransition && !releasing) {
        if (convergeStart === null) convergeStart = t;
        convergeMult = Math.min(1, (t - convergeStart) / CONVERGE_DURATION);
        convergeMult = 0.22 + convergeMult * 0.78;
      } else if (!inTransition) {
        convergeStart = null;
      }

      if (releasing) {
        /* Blur ramps up hard as the blob disperses, so it visibly
           dissolves away rather than just shrinking while staying sharp. */
        var disperseBlur = 0.9 + Math.pow(releaseT, 1.4) * 13;
        canvas.style.filter = 'blur(' + disperseBlur.toFixed(1) + 'px)';
      } else if (inTransition) {
        var loaderBlur = (0.5 + Math.sin(t * 0.0023) * 0.5) * 0.9;
        canvas.style.filter = loaderBlur > 0.05 ? 'blur(' + loaderBlur.toFixed(1) + 'px)' : 'none';
      } else {
        var idleFor = t - lastMoveTime;
        var idleT = Math.max(0, Math.min(1, (idleFor - 600) / 2600));
        var blurPulse = 0.5 + Math.sin(t * 0.0014) * 0.5;
        var blurAmount = idleT * 2.6 * blurPulse;
        canvas.style.filter = blurAmount > 0.05 ? 'blur(' + blurAmount.toFixed(1) + 'px)' : 'none';
      }

      var hovering = root.classList.contains('cursor-hover');
      hoverBoost += ((hovering ? 1 : 0) - hoverBoost) * 0.12;

      var sinceBurst = t - burstAt;
      var burstT = Math.max(0, Math.min(1, sinceBurst / 1250));
      var burstEnergy = sinceBurst >= 0 ? (1 - burstT) * (1 - burstT) : 0;

      var target = loaderCenter || { x: cx, y: cy };
      var tx = target.x;
      var ty = target.y;

      /* Speed of the target itself feeds the blob's spin rate and its
         directional stretch below - stationary means a slow ambient tumble,
         moving fast means a quicker spin and an elongated, thrown-forward
         silhouette. Zeroed during the load-state transition since that
         target never moves. */
      var rawVX = tx - prevTx;
      var rawVY = ty - prevTy;
      prevTx = tx;
      prevTy = ty;
      if (inTransition) {
        smoothVX = 0;
        smoothVY = 0;
      } else {
        smoothVX += (rawVX - smoothVX) * 0.18;
        smoothVY += (rawVY - smoothVY) * 0.18;
      }
      var moveSpeed = Math.hypot(smoothVX, smoothVY);
      var speedFactor = Math.min(1, moveSpeed / 22);
      var moveDirX = moveSpeed > 0.01 ? smoothVX / moveSpeed : 0;
      var moveDirY = moveSpeed > 0.01 ? smoothVY / moveSpeed : 0;

      /* The blob itself: a rotating, organically deforming sphere rendered
         with real perspective and depth sorting, not a flat shape merely
         drawn to suggest one angle. It keeps spinning and undulating on its
         own even at rest, spins faster and stretches along the direction of
         travel while the cursor is actually moving, blooms outward on a
         click, and runs bigger with a stronger internal pulse during the
         load state - the same renderer throughout, just different
         parameters feeding it depending on state. */
      var spin = baseSpin + speedFactor * 0.0042 + burstEnergy * 0.01 + (inTransition ? 0.0016 : 0);
      blobRotation += spin;
      blobTilt = Math.sin(t * 0.00055) * 0.3 + speedFactor * 0.12;

      var hoverGrow = 1 + hoverBoost * 0.35;
      var burstGrow = 1 + burstEnergy * 0.55;
      var convergeGrow = inTransition && !releasing ? convergeMult : 1;
      var releaseGrow = releasing ? 1 + releaseT * 1.9 : 1;
      var loaderGrow = inTransition ? 1.9 : 1;
      var breathe = 1 + Math.sin(t * (inTransition ? 0.0016 : 0.0009)) * (inTransition ? 0.22 : 0.07);
      var radius = BLOB_RADIUS * loaderGrow * hoverGrow * burstGrow * convergeGrow * releaseGrow * breathe;

      var noiseAmp = inTransition ? 0.34 : 0.2 + speedFactor * 0.14;
      var alphaBoost = releasing ? (1 - releaseT) : 1;
      var cosTilt = Math.cos(blobTilt);
      var sinTilt = Math.sin(blobTilt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (var bi = 0; bi < particles.length; bi++) {
        var bp = particles[bi];
        var angle = bp.theta + blobRotation;
        /* Two independent sine waves, each on the particle's own phase and
           frequency, summed into one organic ripple across the surface -
           not a rigid sphere, a breathing/undulating one. */
        var noise = Math.sin(t * 0.0011 * bp.noiseFreqA + bp.noisePhaseA) * 0.5
          + Math.sin(t * 0.002 * bp.noiseFreqB + bp.noisePhaseB) * 0.32;
        var r = radius * bp.radiusJitter * (1 + noise * noiseAmp);

        var sinPhi = Math.sin(bp.phi);
        var x3 = r * sinPhi * Math.cos(angle);
        var y3 = r * Math.cos(bp.phi);
        var z3 = r * sinPhi * Math.sin(angle);

        /* Tilt (rotate around the horizontal/X axis) so the sphere reads as
           tumbling in 3D rather than spinning flat-on around one fixed axis. */
        var y3t = y3 * cosTilt - z3 * sinTilt;
        var z3t = y3 * sinTilt + z3 * cosTilt;

        var scale = BLOB_FOCAL / (BLOB_FOCAL + z3t);
        var sx = tx + x3 * scale;
        var sy = ty + y3t * scale;

        if (speedFactor > 0.001) {
          /* Anisotropic stretch in screen space: elongate along the travel
             direction, compress slightly across it - the blob reads as
             being carried/thrown through space rather than sliding rigidly. */
          var relX = sx - tx;
          var relY = sy - ty;
          var along = relX * moveDirX + relY * moveDirY;
          var perp = relX * -moveDirY + relY * moveDirX;
          var newAlong = along * (1 + speedFactor * 1.1);
          var newPerp = perp * (1 - speedFactor * 0.3);
          sx = tx + moveDirX * newAlong - moveDirY * newPerp;
          sy = ty + moveDirY * newAlong + moveDirX * newPerp;
        }

        var slot = blobProjected[bi];
        slot.p = bp;
        slot.x = sx;
        slot.y = sy;
        slot.depthT = (z3t / r + 1) / 2;
        slot.angle = angle;
      }

      /* Depth sort so near particles paint over far ones - this occlusion,
         more than anything else, is what makes it read as a solid object
         with volume instead of a flat scatter of dots. */
      blobProjected.sort(function (a, b) { return a.depthT - b.depthT; });

      for (var pk = 0; pk < blobProjected.length; pk++) {
        var slot2 = blobProjected[pk];
        var bp2 = slot2.p;
        var depthT2 = slot2.depthT;

        var hueT = (((slot2.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
        var hue = HUE_START + hueT * HUE_SPAN;
        var alpha = (0.16 + depthT2 * 0.58) * alphaBoost * (reducedMotion ? 0.75 : 1);
        var sizeMult = 0.45 + depthT2 * 0.95;
        var dirAngle = Math.atan2(slot2.y - ty, slot2.x - tx) + Math.PI / 2;

        ctx.save();
        ctx.translate(slot2.x, slot2.y);
        ctx.rotate(dirAngle);
        ctx.strokeStyle = 'hsla(' + hue + ', 80%, 64%, ' + alpha + ')';
        ctx.lineWidth = bp2.width * sizeMult;
        var len = bp2.len * sizeMult;
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
