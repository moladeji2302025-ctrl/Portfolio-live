/* Shared chrome: custom cursor, ambient gas trail, grain overlay, theme + sound
   toggles. Loaded on every page so the experience is identical site-wide. */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------------- theme ---------------- */
  /* Light is the default; a stored preference (set only by the manual
     toggle) is what persists across reloads and page navigations - an
     inline script earlier in <body> already applied it before first
     paint (so there's no flash), same trick the page-loader uses for
     mo-nav. This just reads that state and wires up the toggle itself. */
  var themeSwitch = document.getElementById('theme-switch');

  function isLight() {
    return root.getAttribute('data-theme') !== 'dark';
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
  var reverb = null;
  var reverbWet = null;
  var soundOn = true;
  try { soundOn = localStorage.getItem('mo-sound') !== 'off'; } catch (e) {}

  /* A shared, lightweight synthetic reverb (no audio files) - every sound
     on the site routes through the same one, so their tails linger and
     genuinely overlap with whatever plays next, the way notes in a room
     bleed into each other, rather than each sound existing in total
     isolation and just stopping. */
  function buildReverbImpulse(ctx) {
    var duration = 2.2;
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * duration);
    var impulse = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = impulse.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        var decay = Math.pow(1 - i / length, 2.6);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    return impulse;
  }
  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
      if (audioCtx) {
        reverb = audioCtx.createConvolver();
        reverb.buffer = buildReverbImpulse(audioCtx);
        reverbWet = audioCtx.createGain();
        reverbWet.gain.value = 0.34;
        reverb.connect(reverbWet).connect(audioCtx.destination);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  /* Soft bell-like chime: a steady sine fundamental plus a quiet overtone,
     both with a gentle attack and a long, slow decay - ringing out into
     the shared reverb rather than cutting off, so it reads as one note in
     an ongoing piece of music instead of an isolated UI beep. */
  function chime(freq, duration, peak, delay, overtone) {
    if (!soundOn) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (delay || 0);
    var attack = 0.04;

    function partial(f, gainScale) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak * gainScale, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.connect(reverb);
      osc.start(t0);
      osc.stop(t0 + attack + duration + 0.3);
    }

    partial(freq, 1);
    if (overtone) partial(freq * overtone, 0.3);
  }
  function playHover() { chime(880, 0.32, 0.016, 0, 2); }
  function playSelect() { chime(659, 0.42, 0.04, 0, 1.5); chime(988, 0.52, 0.028, 0.07, 1.5); }
  function playToggle() { chime(523, 0.48, 0.036, 0, 2); }
  /* A soft, static-pitch tap for empty space - same gentle sine-plus-
     overtone character as the rest of the chime family, just its own
     note, rather than the fast pitch-sweep "laser zap" the water-drop
     version had (a quick downward frequency ramp reads as a sci-fi
     blaster, not a soothing UI sound, no matter how quiet it's mixed). */
  function playTap() { chime(392, 0.5, 0.03, 0, 2); }

  /* A quiet, ever-continuing tune, one note per click anywhere on the
     site - any interactive element or empty space alike, layered under
     whatever click sound also plays. A warm pentatonic scale, so no
     matter which note lands next it still sounds musical, picked fully
     at random each time rather than stepping through the scale in
     order. Runs well under the other sounds in volume so it stays a
     soft ambient thread, not a jingle. */
  var TUNE_SCALE = [392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
  function playTuneNote() {
    if (!soundOn) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var freq = TUNE_SCALE[Math.floor(Math.random() * TUNE_SCALE.length)];
    var t0 = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.014, t0 + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(reverb);
    osc.start(t0);
    osc.stop(t0 + 1.4);
  }

  document.addEventListener('pointerdown', function unlock() {
    ensureAudio();
    document.removeEventListener('pointerdown', unlock);
  }, { once: true });

  var SOUND_HOVER_SELECTOR = 'a, button, .tile, .filter-btn, .faq-trigger, .arrow-btn, .dot, .project-card';
  document.addEventListener('mouseover', function (e) {
    if (e.target.closest(SOUND_HOVER_SELECTOR)) playHover();
  });
  /* Anything actually interactive gets its existing click sound; a click
     that lands on genuinely empty space gets the soft tap instead. Either
     way, every click also advances the quiet background tune one note. */
  var SOUND_INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, [role="button"], .tile, .filter-btn, .faq-trigger, .arrow-btn, .dot, .project-card, .theme-switch, #sound-toggle, #mobile-menu-toggle';
  document.addEventListener('click', function (e) {
    if (e.target.closest('button, .project-card-link, .filter-btn, a.nav-cta, a.btn')) {
      playSelect();
    } else if (!e.target.closest(SOUND_INTERACTIVE_SELECTOR)) {
      playTap();
    }
    playTuneNote();
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
      var seedAngle = Math.random() * Math.PI * 2;
      var seedR = Math.random() * 260;
      particles.push({
        x: cx + Math.cos(seedAngle) * seedR,
        y: cy + Math.sin(seedAngle) * seedR,
        vx: 0,
        vy: 0,
        len: 3.5 + Math.random() * 5,
        width: 1.3 + Math.random() * 1.4,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleFreq: 0.6 + Math.random() * 0.8
      });
    }

    /* Tracks how fast the target itself is moving, smoothed frame to frame.
       Used to break the swarm's shape out of a symmetric ring while it's
       actively traveling (a flock stretches and jitters in flight) and let
       it settle back into the round rest formation as soon as it stops -
       nothing to do with the load-state transition, which has its own
       fixed target and isn't affected by this. */
    var prevTx = cx, prevTy = cy;
    var smoothVX = 0, smoothVY = 0;

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

    /* The page-transition reveal doesn't want the click burst's sharp
       outward kick - it wants the swarm to just let go of the center and
       drift apart on its own. Fading the pull force toward zero over time
       and leaning on the ever-present repulsion between particles to do
       the actual separating reads as a soft release, not an explosion. */
    var releasing = false;
    var releaseStart = 0;
    var RELEASE_DURATION = 1900;
    function gentleRelease() {
      releasing = true;
      releaseStart = performance.now();
    }
    triggerGentleRelease = gentleRelease;

    /* Easing the pull in on arrival too, so the swarm gathers into the
       center smoothly instead of snapping straight to it. */
    var convergeStart = null;
    var CONVERGE_DURATION = 1100;

    var hoverBoost = 0;

    var pullK = reducedMotion ? 0.03 : 0.078;
    var swirlK = reducedMotion ? 0.006 : 0.012;
    var repelK = 0.9;
    var damping = 0.82;
    var baseSpacing = 260;
    var loaderSpacing = baseSpacing * 2.1;

    function drawGas(t) {
      var inTransition = !!loaderCenter;

      /* Finish an in-progress release: fade the pull to zero, then hand
         back to normal cursor-follow. */
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

      /* Ease the pull in on arrival so the swarm gathers smoothly instead
         of snapping straight to the center. */
      var convergeMult = 1;
      if (inTransition && !releasing) {
        if (convergeStart === null) convergeStart = t;
        convergeMult = Math.min(1, (t - convergeStart) / CONVERGE_DURATION);
        convergeMult = 0.22 + convergeMult * 0.78;
      } else if (!inTransition) {
        convergeStart = null;
      }

      /* Ambient idle pulse: a single shared phase drives both the blur and
         the spacing breathing below, so the swarm visibly expands as it
         blurs and contracts back as it sharpens, instead of blur being the
         only thing pulsing. Scoped to the idle (non-transition) state only -
         it fades to zero the moment the cursor starts moving again. */
      var idleFor = t - lastMoveTime;
      var idleT = inTransition ? 0 : Math.max(0, Math.min(1, (idleFor - 600) / 2600));
      var pulseSin = Math.sin(t * 0.0014);
      var ambientSpacingPulse = 1 + idleT * pulseSin * 0.3;

      if (releasing) {
        /* Blur ramps up hard as the swarm disperses, so it visibly
           dissolves away rather than just scattering while staying sharp. */
        var disperseBlur = 0.9 + Math.pow(releaseT, 1.4) * 13;
        canvas.style.filter = 'blur(' + disperseBlur.toFixed(1) + 'px)';
      } else if (inTransition) {
        /* Just a whisper of blur breathing with the energy wave, not the
           fuller idle blur - the load state should read as mostly sharp. */
        var loaderBlur = (0.5 + Math.sin(t * 0.0023) * 0.5) * 0.9;
        canvas.style.filter = loaderBlur > 0.05 ? 'blur(' + loaderBlur.toFixed(1) + 'px)' : 'none';
      } else {
        /* Oscillates between a blurred floor and a blurrier peak - never
           back down to clear - so the idle pulse reads as breathing, not
           as clearing up and reblurring. */
        var blurPulse = 0.5 + pulseSin * 0.5;
        var blurAmount = idleT * (0.35 + blurPulse * 0.55);
        canvas.style.filter = blurAmount > 0.05 ? 'blur(' + blurAmount.toFixed(1) + 'px)' : 'none';
      }

      var hovering = root.classList.contains('cursor-hover');
      hoverBoost += ((hovering ? 1 : 0) - hoverBoost) * 0.12;

      /* A click's energy pulse is a genuine traveling wavefront, not a
         shared on/off flash: it reaches particles closest to the cursor
         first and arrives at farther ones later, timed by distance over a
         fixed propagation speed. Each particle computes its own arrival
         time from `dist` inside the loop below (BURST_WAVE_SPEED/
         BURST_PULSE_WIDTH), so this is just the shared click clock. */
      var BURST_WAVE_SPEED = 1.0;
      var BURST_PULSE_WIDTH = 520;
      var BURST_FORCE = 20;
      var BURST_ATTACK = 0.22;
      var sinceBurst = t - burstAt;

      /* A traveling ripple, not a shared on/off pulse: phase depends on each
         particle's own distance from the target, so the wave visibly moves
         outward through the swarm like a shockwave. During a page-transition
         load it runs wider and stronger, reading as deliberate energy waves
         rather than the subtler ambient ripple. */
      var target = loaderCenter || { x: cx, y: cy };
      var tx = target.x;
      var ty = target.y;
      var waveAmp = inTransition ? 1.5 : 0.3;
      var waveSpatialFreq = inTransition ? 0.022 : 0.045;
      var waveTimeFreq = inTransition ? 0.0046 : 0.0032;
      /* During the load state the comfortable spacing itself breathes -
         shrinks in tight, then expands back out - on top of the wider
         base distance, rather than staying at one fixed width. */
      var loaderSpacingPulse = inTransition ? 0.4 + (0.5 + Math.sin(t * 0.0016) * 0.5) * 0.9 : 1;
      var spacing = (inTransition ? loaderSpacing * loaderSpacingPulse : baseSpacing * ambientSpacingPulse) * (1 + hoverBoost * 0.7);
      var spacing2 = spacing * spacing;
      var pullMult = convergeMult * releaseMult;

      /* Break the swarm out of a symmetric ring while the target is
         actually traveling - a flock stretches and flutters in flight, not
         while it's holding position. Speed fades this back out on its own,
         so stopping lets the shared attraction/repulsion/swirl below settle
         it back into the round rest formation with no separate "return"
         logic needed. Has no effect during the load-state transition, since
         its target doesn't move. */
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

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      /* Neighbor repulsion is the expensive part - checking every particle
         against every other one is O(n^2), which gets heavy fast as the
         count grows. Bucket particles into a grid sized to the current
         spacing so each particle only has to check the ~9 cells around it
         instead of the whole swarm. Rebuilt every frame since particles
         (and spacing itself, via the pulse) keep moving. */
      var cellSize = Math.max(spacing, 40);
      var grid = Object.create(null);
      for (var gi = 0; gi < particles.length; gi++) {
        var gp = particles[gi];
        var gkey = (Math.floor(gp.x / cellSize)) + '_' + (Math.floor(gp.y / cellSize));
        (grid[gkey] || (grid[gkey] = [])).push(gi);
      }

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var dx = tx - p.x;
        var dy = ty - p.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var wave = Math.sin(t * waveTimeFreq - dist * waveSpatialFreq);

        /* This particle's own moment in the traveling burst wave: zero
           until the ring (expanding outward from the cursor at
           BURST_WAVE_SPEED) actually reaches its distance, then an eased
           rise as the leading edge of the wave hits it followed by an
           eased fall as it passes on by - a shockwave crest, not a
           symmetric blip - so it reads as a lit ridge sweeping outward
           through the swarm rather than a uniform flash. Sine easing on
           both halves (not a linear ramp) so the crest breathes in and
           out smoothly instead of snapping. Zero again once it's moved
           on. */
        var burstArrival = dist / BURST_WAVE_SPEED;
        var burstEnergy = 0;
        var burstLocalT = sinceBurst - burstArrival;
        if (sinceBurst >= 0 && burstLocalT > -40 && burstLocalT < BURST_PULSE_WIDTH) {
          var burstW = Math.max(0, Math.min(1, (burstLocalT + 40) / (BURST_PULSE_WIDTH + 40)));
          burstEnergy = burstW < BURST_ATTACK
            ? Math.sin((burstW / BURST_ATTACK) * Math.PI * 0.5)
            : Math.cos(((burstW - BURST_ATTACK) / (1 - BURST_ATTACK)) * Math.PI * 0.5);
        }

        var ax = (dx / dist) * pullK * dist * pullMult;
        var ay = (dy / dist) * pullK * dist * pullMult;
        ax += (-dy / dist) * swirlK * Math.min(dist, 340) * pullMult;
        ay += (dx / dist) * swirlK * Math.min(dist, 340) * pullMult;

        if (speedFactor > 0.001) {
          /* Particles trailing behind the direction of travel get less pull
             (they drag, like the back of a flock), particles leading get to
             keep theirs - an asymmetric, elongated shape instead of a ring. */
          var alongMove = (p.x - tx) * moveDirX + (p.y - ty) * moveDirY;
          var trailBias = Math.max(0, -alongMove) / (dist + 40);
          var pullTrail = 1 - Math.min(0.72, trailBias * speedFactor * 2.1);
          ax *= pullTrail;
          ay *= pullTrail;

          /* Independent per-particle flutter, each on its own phase, scaled
             by how fast the swarm is traveling - the "insects/birds" quality
             that keeps the whole group from moving as one rigid piece. */
          var flutter = Math.sin(t * 0.006 * p.wobbleFreq + p.wobblePhase) * speedFactor * 1.7;
          ax += (-dy / dist) * flutter;
          ay += (dx / dist) * flutter;
        }

        ax += -(dx / dist) * wave * waveAmp;
        ay += -(dy / dist) * wave * waveAmp;

        /* Amoeba-style deformation for the idle pulse: several angular
           lobes at incommensurate frequencies, summed and drifting slowly
           over time, so different parts of the swarm's edge bulge out or
           draw in at different moments instead of the whole shape
           breathing as one uniform circle. Still fully coordinated, since
           it's a smooth continuous function of angle (neighboring
           particles always get near-identical values), but the combined
           frequencies never resettle into a repeating, symmetric pattern -
           reads as organic and unpredictable rather than mechanical. */
        if (!inTransition) {
          var pAngle = Math.atan2(p.y - ty, p.x - tx);
          var blobLobe = Math.sin(pAngle * 2 + t * 0.00065) * 0.5
            + Math.sin(pAngle * 3 - t * 0.00095 + 1.7) * 0.32
            + Math.sin(pAngle * 5 + t * 0.00042 + 4.2) * 0.22;
          var blobPush = idleT * blobLobe * dist * 0.026;
          ax += -(dx / dist) * blobPush;
          ay += -(dy / dist) * blobPush;
        }

        /* The traveling burst ring gives an actual outward kick as it
           passes through, on top of the visual glow/size boost below - so
           the wave reads as a physical pulse propagating through the
           swarm, not just a brightness effect. */
        ax += -(dx / dist) * burstEnergy * BURST_FORCE;
        ay += -(dy / dist) * burstEnergy * BURST_FORCE;

        var cgx = Math.floor(p.x / cellSize);
        var cgy = Math.floor(p.y / cellSize);
        for (var ngx = cgx - 1; ngx <= cgx + 1; ngx++) {
          for (var ngy = cgy - 1; ngy <= cgy + 1; ngy++) {
            var cell = grid[ngx + '_' + ngy];
            if (!cell) continue;
            for (var ci = 0; ci < cell.length; ci++) {
              var j = cell[ci];
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
        var glow = 0.5 + wave * 0.25 + burstEnergy * 1.6;
        var alpha = (0.3 + Math.min(0.45, speed * 0.9) + glow * 0.2) * (reducedMotion ? 0.75 : 1);
        /* A pale, high-lightness stroke glows against a dark background under
           the "screen" blend mode, but that same pale color has almost no
           contrast against white regardless of blend mode - multiply doesn't
           recolor it, it only controls how much of it shows through. Light
           mode needs a genuinely darker, richer stroke, not just a different
           blend mode. */
        var light = isLight();
        var lightness = light ? 40 : 66;
        /* A specular-style lift as the burst crest passes through, like
           light catching the ridge of a traveling 3D wave rather than a
           flat brightness bump. */
        lightness += burstEnergy * (light ? 32 : 26);
        if (light) alpha = Math.min(1, alpha * 1.6);

        /* Full size only lives in a middle "sweet spot" band - particles
           shrink smoothly both as they close in on the cursor/target and as
           they drift far out past it, since dist changes constantly as the
           swarm moves either direction. */
        var nearT = Math.max(0, 1 - dist / 130);
        var farT = Math.min(1, Math.max(0, (dist - 340) / 300));
        var sizeMult = 1 - nearT * 0.9 - farT * 0.4;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);
        ctx.strokeStyle = 'hsla(' + hue + ', 82%, ' + lightness + '%, ' + alpha + ')';
        ctx.lineWidth = p.width * (1 + burstEnergy * 0.7) * sizeMult;
        var len = p.len * (1 + burstEnergy * 0.9) * sizeMult;
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
