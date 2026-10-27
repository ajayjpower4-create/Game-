// Tow Dispatch app for Tow Truck Calls.
// Lists incoming tow calls, runs the current job and pops up the strap-down
// minigames over the screen. Game logic lives in lua/ge/extensions/towTruckCalls.lua.
angular.module('beamng.apps')
.directive('towTruckCalls', [function () {
  return {
    templateUrl: '/ui/modules/apps/TowTruckCalls/app.html',
    replace: true,
    restrict: 'EA',
    scope: true,
    link: function (scope, element) {
      var root = element[0];
      var bodyEl = root.querySelector('.ttc-body');
      var dutyBtn = root.querySelector('.ttc-duty');
      var STRAPS = ['FRONT LEFT', 'FRONT RIGHT', 'REAR LEFT', 'REAR RIGHT'];

      var state = null;
      var units = 'imperial';
      var structKey = '';
      var firstState = true;
      var seenOffers = [];
      var lastResult = 0;
      var strapSeen = {};
      var cancelArmed = 0;
      var progress = {};
      var game = null;
      var raf = 0;
      var lastFrame = 0;
      var bannerOffer = null;
      var bannerTimer = 0;
      var resultTimer = 0;

      function lua(call) {
        if (typeof bngApi !== 'undefined') bngApi.engineLua('if towTruckCalls then towTruckCalls.' + call + ' end');
      }

      // Formatting ---------------------------------------------------------------------------------

      function money(n) {
        n = Math.round(n || 0);
        return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
      }
      function dist(m) {
        m = m || 0;
        if (units === 'metric') return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km';
        var ft = m * 3.28084;
        return ft < 1000 ? Math.round(ft / 10) * 10 + ' ft' : (m / 1609.344).toFixed(1) + ' mi';
      }
      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      // Lua sends empty arrays as {}.
      function list(x) {
        if (Array.isArray(x)) return x;
        if (x && typeof x === 'object') return Object.keys(x).map(function (k) { return x[k]; });
        return [];
      }
      function setF(scopeEl, name, text) {
        var els = scopeEl.querySelectorAll('[data-f="' + name + '"]');
        for (var i = 0; i < els.length; i++) if (els[i].textContent !== text) els[i].textContent = text;
      }

      // Sounds (made on the fly, no files) ---------------------------------------------------------

      var Snd = (function () {
        var ctx = null;
        function ac() {
          try {
            if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') ctx.resume();
          } catch (e) { ctx = null; }
          return ctx;
        }
        function tone(freq, dur, type, vol, toFreq, delay) {
          var c = ac(); if (!c) return;
          var t = c.currentTime + (delay || 0);
          var o = c.createOscillator(), g = c.createGain();
          o.type = type || 'sine';
          o.frequency.setValueAtTime(freq, t);
          if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(c.destination);
          o.start(t); o.stop(t + dur + 0.05);
        }
        function noise(dur, vol, freq, delay) {
          var c = ac(); if (!c) return;
          var t = c.currentTime + (delay || 0);
          var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
          for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
          var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
          s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 2000; f.Q.value = 1.2;
          g.gain.value = vol || 0.2;
          s.connect(f); f.connect(g); g.connect(c.destination);
          s.start(t);
        }
        return {
          click: function () { tone(900, 0.05, 'square', 0.04); },
          radio: function () { noise(0.18, 0.12, 1800); tone(1200, 0.08, 'square', 0.07, 0, 0.2); tone(1600, 0.1, 'square', 0.07, 0, 0.3); },
          clink: function () { tone(2400, 0.12, 'triangle', 0.18); tone(3300, 0.08, 'triangle', 0.1, 0, 0.02); },
          ratchet: function () { noise(0.04, 0.35, 3500); noise(0.04, 0.3, 3000, 0.07); },
          slip: function () { noise(0.25, 0.25, 900); tone(300, 0.25, 'sawtooth', 0.06, 120); },
          bad: function () { tone(220, 0.18, 'square', 0.08, 160); },
          good: function () { tone(660, 0.09, 'triangle', 0.15); tone(990, 0.14, 'triangle', 0.15, 0, 0.09); },
          secured: function () { tone(523, 0.12, 'triangle', 0.15); tone(659, 0.12, 'triangle', 0.15, 0, 0.12); tone(784, 0.25, 'triangle', 0.17, 0, 0.24); },
          cash: function () { noise(0.3, 0.25, 600); tone(1318, 0.15, 'triangle', 0.18, 0, 0.05); tone(1760, 0.4, 'triangle', 0.18, 0, 0.17); }
        };
      })();

      // Pop-up layer over the whole screen ------------------------------------------------------------

      var layer = document.createElement('div');
      layer.className = 'ttc-layer';
      layer.innerHTML =
        '<div class="ttc-banner"></div>' +
        '<div class="ttc-modal">' +
          '<div class="ttc-modal-head"><div class="ttc-modal-title">STRAP IT DOWN</div><button class="ttc-close" data-act="closegame">CLOSE</button></div>' +
          '<div class="ttc-strapdots"></div>' +
          '<div class="ttc-stage"></div>' +
          '<div class="ttc-canvas-wrap"><canvas class="ttc-canvas" width="480" height="220"></canvas><div class="ttc-pause"></div></div>' +
          '<div class="ttc-quality"><span>Strap quality: <b class="ttc-q">100%</b></span><span class="ttc-truck"></span></div>' +
        '</div>' +
        '<div class="ttc-result"></div>';
      document.body.appendChild(layer);
      var banner = layer.querySelector('.ttc-banner');
      var modal = layer.querySelector('.ttc-modal');
      var dotsEl = layer.querySelector('.ttc-strapdots');
      var stageEl = layer.querySelector('.ttc-stage');
      var canvas = layer.querySelector('.ttc-canvas');
      var pauseEl = layer.querySelector('.ttc-pause');
      var qEl = layer.querySelector('.ttc-q');
      var truckEl = layer.querySelector('.ttc-truck');
      var resultEl = layer.querySelector('.ttc-result');
      var cx = canvas.getContext('2d');
      // Peek at the minigame from the UI dev console (Ctrl+U): document.querySelector('.ttc-layer').__game()
      layer.__game = function () { return game; };

      // The app panel ------------------------------------------------------------------------------------

      function stepClass(done, now) { return done ? 'done' : (now ? 'now' : ''); }

      function jobCard(j) {
        var p = j.phase, towedEnough = j.towed >= j.minTow, armed = cancelArmed > Date.now();
        return '<div class="ttc-sec">CURRENT JOB</div><div class="ttc-card ttc-job">' +
          '<div class="ttc-row"><span class="ttc-badge t-' + esc(j.typeId) + '">' + esc(j.typeLabel) + '</span>' +
            '<span class="ttc-pay">' + money(j.pay) + '</span></div>' +
          '<div class="ttc-veh">' + esc(j.vehicle) + '</div>' +
          '<div class="ttc-sub">Caller: ' + esc(j.caller) +
            (j.losses ? ' &middot; <span style="color:#ff8787">came loose x' + j.losses + '</span>' : '') + '</div>' +
          '<ol class="ttc-steps">' +
            '<li class="' + stepClass(p !== 'enroute', p === 'enroute') + '">Drive to the car <span data-f="jdist"></span></li>' +
            '<li class="' + stepClass(p === 'secured' || (p === 'onscene' && j.canStrap), p === 'onscene' && !j.canStrap) + '">Load it on your truck</li>' +
            '<li class="' + stepClass(p === 'secured', p === 'onscene' && j.canStrap) + '">Strap it down <span data-f="quality"></span></li>' +
            '<li class="' + stepClass(p === 'secured' && towedEnough, p === 'secured' && !towedEnough) + '">Tow it anywhere <span data-f="towed"></span></li>' +
            '<li class="' + stepClass(false, p === 'secured' && towedEnough) + '">Say you\'re DONE</li>' +
          '</ol>' +
          '<div class="ttc-hint" data-f="hint"></div>' +
          '<div class="ttc-btns">' +
            '<button class="strap" data-act="strap"' + (p === 'onscene' && j.canStrap ? '' : ' disabled') + '>STRAP DOWN</button>' +
            '<button class="done" data-act="done"' + (j.canDone ? '' : ' disabled') + '>DONE</button>' +
          '</div>' +
          '<div class="ttc-btns small">' +
            '<button data-act="brake">CAR BRAKE: ' + (j.carBrake ? 'ON' : 'OFF') + '</button>' +
            '<button data-act="gps">GPS TO CAR</button>' +
            '<button data-act="cancel"' + (armed ? ' class="warn">SURE? CLICK' : '>CANCEL JOB') + '</button>' +
          '</div></div>';
      }

      function offerCard(o, busy) {
        return '<div class="ttc-card">' +
          '<div class="ttc-row"><span class="ttc-badge t-' + esc(o.typeId) + '">' + esc(o.typeLabel) + '</span>' +
            '<span class="ttc-pay">' + money(o.pay) + '</span></div>' +
          '<div class="ttc-veh">' + esc(o.vehicle) + '</div>' +
          '<div class="ttc-sub">' + esc(o.caller) + ' &middot; <span data-f="odist' + o.id + '"></span></div>' +
          '<div class="ttc-desc">' + esc(o.desc) + '</div>' +
          '<div class="ttc-timer"><i data-w="ottl' + o.id + '"></i></div>' +
          '<div class="ttc-btns">' +
            '<button class="go" data-act="accept" data-id="' + o.id + '"' + (busy ? ' disabled title="Finish your current job first"' : '') + '>ACCEPT</button>' +
            '<button data-act="decline" data-id="' + o.id + '">DECLINE</button>' +
          '</div></div>';
      }

      function buildBody(s, offers, job) {
        if (!s.inLevel) {
          return '<div class="ttc-empty"><div class="ttc-wave">((&bull;))</div>Load a map in Freeroam to start getting tow calls.</div>';
        }
        var h = job ? jobCard(job) : '';
        if (!s.duty) {
          return h + '<div class="ttc-empty">You are <b>off duty</b>. No calls will come in.' +
            '<div class="ttc-btns"><button class="go" data-act="duty">GO ON DUTY</button></div></div>';
        }
        h += '<div class="ttc-sec">INCOMING CALLS' + (offers.length ? ' (' + offers.length + ')' : '') + '</div>';
        if (!offers.length) {
          h += '<div class="ttc-empty"><div class="ttc-wave">((&bull;))</div>Waiting for calls...' +
            '<div class="ttc-btns"><button data-act="call">ASK DISPATCH FOR WORK</button></div></div>';
        }
        offers.forEach(function (o) { h += offerCard(o, !!job); });
        return h;
      }

      function render() {
        var s = state;
        if (!s) return;
        units = s.units || 'imperial';
        var offers = list(s.offers), job = s.job || null;
        var key = JSON.stringify([s.inLevel, s.duty, offers.map(function (o) { return o.id; }),
          job && [job.id, job.phase, job.canStrap, job.canDone, job.carBrake, job.losses, job.towed >= job.minTow],
          cancelArmed > Date.now()]);
        if (key !== structKey) {
          structKey = key;
          bodyEl.innerHTML = buildBody(s, offers, job);
        }
        dutyBtn.className = 'ttc-duty' + (s.duty ? ' on' : '');
        dutyBtn.textContent = s.duty ? 'ON DUTY' : 'OFF DUTY';
        setF(root, 'bank', money(s.bank));
        setF(root, 'session', money(s.session));
        setF(root, 'jobs', String(s.jobsDone || 0));
        offers.forEach(function (o) {
          setF(bodyEl, 'odist' + o.id, dist(o.dist) + ' ' + o.dir);
          var bar = bodyEl.querySelector('[data-w="ottl' + o.id + '"]');
          if (bar) bar.style.width = Math.max(0, Math.min(100, o.ttl / o.ttlMax * 100)) + '%';
        });
        if (job) {
          setF(bodyEl, 'jdist', job.phase === 'enroute' ? dist(job.dist) + ' ' + job.dir : '');
          setF(bodyEl, 'towed', job.phase === 'secured' ? dist(job.towed) : '');
          setF(bodyEl, 'quality', job.quality != null ? job.quality + '%' : '');
          setF(bodyEl, 'hint', job.hint || '');
        }
      }

      // New-call banner ----------------------------------------------------------------------------------

      function showBanner(o) {
        bannerOffer = o.id;
        var busy = !!(state && state.job);
        banner.innerHTML =
          '<div class="ttc-row"><span class="ttc-radio">((&bull;)) DISPATCH: NEW TOW CALL</span><span class="ttc-pay">' + money(o.pay) + '</span></div>' +
          '<div class="ttc-row" style="margin-top:6px"><span><span class="ttc-badge t-' + esc(o.typeId) + '">' + esc(o.typeLabel) + '</span> ' +
            '<b>' + esc(o.vehicle) + '</b></span><span class="ttc-sub">' + esc(dist(o.dist)) + ' ' + esc(o.dir) + '</span></div>' +
          '<div class="ttc-desc">"' + esc(o.desc) + '" - ' + esc(o.caller) + '</div>' +
          '<div class="ttc-btns">' +
            (busy ? '' : '<button class="go" data-act="accept" data-id="' + o.id + '">ACCEPT</button>') +
            '<button data-act="hidebanner">' + (busy ? 'OK' : 'LATER') + '</button></div>';
        banner.classList.add('show');
        Snd.radio();
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(hideBanner, 9000);
      }
      function hideBanner() {
        banner.classList.remove('show');
        bannerOffer = null;
      }

      // Job done pop-up ------------------------------------------------------------------------------------

      function showResult(r) {
        var rows = list(r.lines).map(function (l) {
          return '<tr><td>' + esc(l.label) + '</td><td class="amt' + (l.amount < 0 ? ' neg' : '') + '">' + money(l.amount) + '</td></tr>';
        }).join('');
        resultEl.innerHTML = '<div class="head">JOB DONE</div><div class="big">+' + money(r.total) + '</div>' +
          '<div class="what">' + esc(r.vehicle) + ' towed ' + esc(dist(r.towed)) + ' for ' + esc(r.caller) + '</div>' +
          '<table>' + rows + '<tr class="total"><td>Paid</td><td class="amt">' + money(r.total) + '</td></tr></table>';
        resultEl.classList.remove('show');
        void resultEl.offsetWidth;
        resultEl.classList.add('show');
        Snd.cash();
        clearTimeout(resultTimer);
        resultTimer = setTimeout(hideResult, 7000);
      }
      function hideResult() { resultEl.classList.remove('show'); }

      // Strap-down minigames ----------------------------------------------------------------------------------
      //  1. HOOK IT   - click when the swinging hook is over the green slot on the deck.
      //  2. RATCHET   - click when the needle is in the green zone, 4 good pumps.
      //  3. TENSION   - hold to crank the strap, let go inside the green band.
      // Four straps (one per wheel). Misses cost strap quality, which changes the pay.

      var W = 480, H = 220, SLOT_X0 = 60, SLOT_DX = 60, SLOT_W = 28, SLOTS = 7;

      function progressKey(job) { return job.id + ':' + (job.losses || 0); }

      function openGame() {
        var job = state && state.job;
        if (!job || job.phase !== 'onscene') return;
        var key = progressKey(job);
        var p = progress[key] || (progress[key] = { strap: 0, quality: 100 });
        game = { key: key, jobId: job.id, strap: p.strap, quality: p.quality, stage: '', t: 0, flash: null, target: -1 };
        if (game.strap >= 4) finish(); else startStage('hook');
        modal.classList.add('show');
        lastFrame = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }

      function closeGame() {
        game = null;
        modal.classList.remove('show');
        cancelAnimationFrame(raf);
        raf = 0;
      }

      function saveProgress() {
        if (game) progress[game.key] = { strap: game.strap, quality: game.quality };
      }

      function newZone(g) {
        var w = Math.max(0.11, 0.2 - g.pumps * 0.02 - g.strap * 0.01);
        var c = 0.15 + w / 2 + Math.random() * (0.7 - w);
        g.zone = [c - w / 2, c + w / 2];
      }

      function startStage(name) {
        var g = game, lvl = g.strap;
        g.stage = name;
        g.t = 0;
        if (name === 'hook') {
          var t;
          do { t = Math.floor(Math.random() * SLOTS); } while (t === g.target);
          g.target = t;
          g.phase = Math.random() * Math.PI * 2;
          g.speed = 2.0 + lvl * 0.35;
        } else if (name === 'ratchet') {
          g.pumps = 0;
          g.nphase = Math.random();
          g.nspeed = 0.75 + lvl * 0.12;
          newZone(g);
        } else if (name === 'tension') {
          g.v = 0.45;
          g.holding = false;
          g.band = [0.76, 0.9];
          g.rate = 0.3 + lvl * 0.04;
        }
        updateTexts();
      }

      function updateTexts() {
        var g = game;
        if (!g) return;
        var html = '';
        for (var i = 0; i < 4; i++) {
          html += '<div class="' + (i < g.strap ? 'done' : (i === g.strap && g.stage !== 'final' ? 'now' : '')) + '">' + STRAPS[i] + '</div>';
        }
        dotsEl.innerHTML = html;
        var txt = {
          hook: '<b>HOOK IT:</b> click when the hook is over the <b>green slot</b>.',
          ratchet: '<b>RATCHET:</b> click when the needle is in the <b>green</b>. ' + (g.pumps || 0) + '/4',
          tension: '<b>TENSION:</b> hold the mouse button to crank, let go in the <b>green band</b>.',
          between: '<b>Strap locked.</b> Next one...',
          final: '<b>All four straps are tight.</b>'
        }[g.stage] || '';
        stageEl.innerHTML = txt;
        qEl.textContent = Math.round(g.quality) + '%';
      }

      function flash(text, good) {
        if (game) game.flash = { text: text, good: good, t: 0 };
      }

      function hookX(g) { return W / 2 + 190 * Math.sin(g.phase); }
      function slotX(i) { return SLOT_X0 + i * SLOT_DX; }
      function needle(g) { var f = g.nphase % 2; return f < 1 ? f : 2 - f; }

      function pauseReason() {
        var job = state && state.job;
        if (!job) return 'The job is over.';
        if (game.stage === 'final') return '';
        if (job.phase !== 'onscene') return 'Nothing to strap right now.';
        if (!job.canStrap) return job.hint || 'Load the car on your truck and stop.';
        return '';
      }

      function press() {
        var g = game;
        if (!g || pauseReason()) return;
        if (g.stage === 'hook') {
          if (Math.abs(hookX(g) - slotX(g.target)) <= SLOT_W * 0.6) {
            Snd.clink();
            flash('HOOKED!', true);
            startStage('ratchet');
          } else {
            g.quality = Math.max(20, g.quality - 4);
            Snd.bad();
            flash('Missed the slot!', false);
          }
        } else if (g.stage === 'ratchet') {
          var p = needle(g);
          if (p >= g.zone[0] && p <= g.zone[1]) {
            g.pumps++;
            Snd.ratchet();
            if (g.pumps >= 4) {
              flash('TIGHT!', true);
              startStage('tension');
            } else {
              newZone(g);
              flash('CLICK', true);
            }
          } else {
            g.pumps = Math.max(0, g.pumps - 1);
            g.quality = Math.max(20, g.quality - 3);
            Snd.slip();
            flash('Slipped a notch!', false);
          }
        } else if (g.stage === 'tension') {
          g.holding = true;
        }
        updateTexts();
        saveProgress();
      }

      function release() {
        var g = game;
        if (!g || g.stage !== 'tension' || !g.holding) return;
        g.holding = false;
        if (g.v >= g.band[0] && g.v <= g.band[1]) {
          Snd.good();
          g.strap++;
          flash('STRAP ' + g.strap + ' LOCKED', true);
          startStage('between');
        } else if (g.v < g.band[0]) {
          g.quality = Math.max(20, g.quality - 1);
          flash('Not tight enough. Crank more.', false);
        } else {
          g.quality = Math.max(20, g.quality - 4);
          g.v = 0.6;
          Snd.slip();
          flash('Too tight! Backed it off.', false);
        }
        updateTexts();
        saveProgress();
      }

      function finish() {
        var g = game;
        g.stage = 'final';
        g.t = 0;
        g.quality = Math.max(20, Math.round(g.quality));
        saveProgress();
        updateTexts();
        Snd.secured();
        lua('strapsDone(' + g.quality + ')');
      }

      function tick(dt) {
        var g = game;
        var job = state && state.job;
        if (!job || job.id !== g.jobId || progressKey(job) !== g.key) { closeGame(); return; }
        var why = pauseReason();
        pauseEl.textContent = why;
        pauseEl.classList.toggle('show', !!why);
        truckEl.textContent = job.truckSpeed > 0.6 ? 'Truck: MOVING' : 'Truck: stopped';
        if (g.flash) g.flash.t += dt;
        if (why) { g.holding = false; return; }
        g.t += dt;
        if (g.stage === 'hook') g.phase += dt * g.speed;
        else if (g.stage === 'ratchet') g.nphase += dt * g.nspeed;
        else if (g.stage === 'tension' && g.holding) {
          g.v += dt * g.rate;
          if (g.v > 1) {
            g.holding = false;
            g.v = 0.5;
            g.quality = Math.max(20, g.quality - 6);
            Snd.slip();
            flash('WAY TOO TIGHT! It slipped back.', false);
            updateTexts();
          }
        } else if (g.stage === 'between' && g.t > 0.8) {
          if (g.strap >= 4) finish(); else startStage('hook');
        } else if (g.stage === 'final' && (g.t > 1.8 || job.phase === 'secured' && g.t > 1.2)) {
          closeGame();
        }
      }

      // Drawing ------------------------------------------------------------------------------------------------

      function roundRect(x, y, w, h, r) {
        cx.beginPath();
        cx.moveTo(x + r, y); cx.lineTo(x + w - r, y); cx.quadraticCurveTo(x + w, y, x + w, y + r);
        cx.lineTo(x + w, y + h - r); cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        cx.lineTo(x + r, y + h); cx.quadraticCurveTo(x, y + h, x, y + h - r);
        cx.lineTo(x, y + r); cx.quadraticCurveTo(x, y, x + r, y);
        cx.closePath();
      }

      function drawTire(x, y, r) {
        cx.fillStyle = '#111';
        cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#2b2b2b'; cx.lineWidth = 5;
        for (var i = 0; i < 16; i++) {
          var a = i / 16 * Math.PI * 2;
          cx.beginPath(); cx.moveTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6));
          cx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); cx.stroke();
        }
        cx.fillStyle = '#9aa0a8';
        cx.beginPath(); cx.arc(x, y, r * 0.55, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#5d636b';
        cx.beginPath(); cx.arc(x, y, r * 0.18, 0, Math.PI * 2); cx.fill();
      }

      function drawDeck() {
        var grd = cx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#1d1f25'); grd.addColorStop(1, '#101114');
        cx.fillStyle = grd; cx.fillRect(0, 0, W, H);
        cx.strokeStyle = 'rgba(255,255,255,0.035)'; cx.lineWidth = 2;
        for (var x = -H; x < W; x += 16) { cx.beginPath(); cx.moveTo(x, H); cx.lineTo(x + H, 0); cx.stroke(); }
      }

      function drawStrap(x1, y1, x2, y2, color, wobble) {
        cx.strokeStyle = color; cx.lineWidth = 9; cx.lineCap = 'butt';
        cx.beginPath(); cx.moveTo(x1, y1);
        var mx = (x1 + x2) / 2 + (wobble || 0), my = (y1 + y2) / 2;
        cx.quadraticCurveTo(mx, my, x2, y2); cx.stroke();
        cx.strokeStyle = 'rgba(0,0,0,0.25)'; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(x1, y1); cx.quadraticCurveTo(mx, my, x2, y2); cx.stroke();
      }

      function drawHook(x, y) {
        cx.strokeStyle = '#d9dde3'; cx.lineWidth = 6; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(x, y - 18); cx.lineTo(x, y + 6); cx.arc(x - 8, y + 6, 8, 0, Math.PI, false); cx.stroke();
        cx.fillStyle = '#c8ccd2'; cx.fillRect(x - 7, y - 26, 14, 10);
      }

      function drawRail(glowIndex, pulse) {
        cx.fillStyle = '#3a3e46'; roundRect(30, 170, W - 60, 22, 4); cx.fill();
        for (var i = 0; i < SLOTS; i++) {
          var x = slotX(i);
          var glow = i === glowIndex;
          cx.fillStyle = glow ? 'rgba(64, 192, 87,' + (0.55 + 0.45 * pulse) + ')' : '#15161a';
          roundRect(x - SLOT_W / 2, 175, SLOT_W, 12, 3); cx.fill();
          if (glow) { cx.strokeStyle = '#69db7c'; cx.lineWidth = 2; roundRect(x - SLOT_W / 2 - 3, 172, SLOT_W + 6, 18, 4); cx.stroke(); }
        }
      }

      function drawFlash(g) {
        if (!g.flash || g.flash.t > 0.9) return;
        var a = 1 - g.flash.t / 0.9;
        cx.font = '900 22px sans-serif'; cx.textAlign = 'center';
        cx.fillStyle = g.flash.good ? 'rgba(105,219,124,' + a + ')' : 'rgba(255,107,107,' + a + ')';
        cx.fillText(g.flash.text, W / 2, 34 - g.flash.t * 12);
      }

      function draw() {
        var g = game;
        if (!g) return;
        var pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
        drawDeck();
        if (g.stage === 'hook') {
          drawTire(W / 2, 62, 40);
          var hx = hookX(g);
          drawStrap(W / 2, 100, hx, 140, '#f5c400');
          drawRail(g.target, pulse);
          drawHook(hx, 150);
        } else if (g.stage === 'ratchet') {
          drawTire(120, 70, 42);
          drawStrap(120, 110, 290, 125, '#f5c400');
          var ang = -0.6 + (g.pumps || 0) * 0.25 + Math.sin(g.t * 3) * 0.04;
          cx.save(); cx.translate(290, 125); cx.rotate(ang);
          cx.fillStyle = '#7d848e'; roundRect(-22, -12, 44, 24, 4); cx.fill();
          cx.fillStyle = '#c92a2a'; roundRect(10, -6, 60, 12, 5); cx.fill();
          cx.restore();
          drawStrap(312, 125, 425, 158, '#f5c400');
          cx.fillStyle = '#3a3e46'; cx.fillRect(415, 156, 26, 14);
          var bx = 40, bw = 400, by = 184;
          cx.fillStyle = '#5c2020'; roundRect(bx, by, bw, 20, 4); cx.fill();
          cx.fillStyle = '#2f9e44'; cx.fillRect(bx + g.zone[0] * bw, by, (g.zone[1] - g.zone[0]) * bw, 20);
          var nx = bx + needle(g) * bw;
          cx.fillStyle = '#fff';
          cx.beginPath(); cx.moveTo(nx, by - 2); cx.lineTo(nx - 8, by - 14); cx.lineTo(nx + 8, by - 14); cx.closePath(); cx.fill();
          cx.fillRect(nx - 1.5, by - 2, 3, 24);
          for (var i = 0; i < 4; i++) {
            cx.fillStyle = i < g.pumps ? '#ff9f1a' : '#2a2c33';
            roundRect(340 + i * 26, 14, 20, 30, 3); cx.fill();
          }
          cx.fillStyle = '#8b8f99'; cx.font = '700 11px sans-serif'; cx.textAlign = 'left';
          cx.fillText('TENSION', 340, 58);
        } else if (g.stage === 'tension') {
          drawTire(130, 80, 46);
          var col = g.v < g.band[0] ? '#f5c400' : (g.v <= g.band[1] ? '#69db7c' : '#ff6b6b');
          var shake = g.holding ? Math.sin(performance.now() / 18) * g.v * 3 : 0;
          drawStrap(130, 126, 330, 170, col, shake);
          cx.fillStyle = '#3a3e46'; cx.fillRect(318, 168, 30, 14);
          var x0 = 400, y0 = 24, bh = 170;
          cx.fillStyle = '#2a2c33'; roundRect(x0, y0, 34, bh, 5); cx.fill();
          cx.fillStyle = 'rgba(64,192,87,0.45)';
          cx.fillRect(x0, y0 + bh * (1 - g.band[1]), 34, bh * (g.band[1] - g.band[0]));
          cx.fillStyle = col;
          cx.fillRect(x0 + 6, y0 + bh * (1 - g.v), 22, bh * g.v);
          cx.strokeStyle = '#69db7c'; cx.lineWidth = 2;
          cx.strokeRect(x0 - 3, y0 + bh * (1 - g.band[1]), 40, bh * (g.band[1] - g.band[0]));
          cx.fillStyle = g.holding ? '#ffd08a' : '#8b8f99'; cx.font = '800 13px sans-serif'; cx.textAlign = 'center';
          cx.fillText(g.holding ? 'CRANKING...' : 'HOLD TO CRANK', 230, 206);
        } else if (g.stage === 'between' || g.stage === 'final') {
          cx.strokeStyle = '#69db7c'; cx.lineWidth = 12; cx.lineCap = 'round';
          var s = Math.min(1, g.t / 0.25);
          cx.beginPath(); cx.moveTo(W / 2 - 40, 100); cx.lineTo(W / 2 - 10, 130 * s + 100 * (1 - s)); cx.lineTo(W / 2 + 45, 70); cx.stroke();
          cx.fillStyle = '#fff'; cx.font = '900 22px sans-serif'; cx.textAlign = 'center';
          cx.fillText(g.stage === 'final' ? 'LOAD SECURED  ' + g.quality + '%' : 'STRAP ' + g.strap + ' OF 4 LOCKED', W / 2, 180);
        }
        drawFlash(g);
      }

      function loop(now) {
        if (!game) return;
        var dt = Math.min(0.05, (now - lastFrame) / 1000);
        lastFrame = now;
        tick(dt);
        if (game) {
          draw();
          raf = requestAnimationFrame(loop);
        }
      }

      canvas.addEventListener('mousedown', function (e) { if (e.button === 0) { e.preventDefault(); press(); } });
      window.addEventListener('mouseup', release);
      canvas.addEventListener('mouseleave', release);

      // Clicks -------------------------------------------------------------------------------------------------

      function onClick(e) {
        var b = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!b) {
          if (resultEl.contains(e.target)) hideResult();
          return;
        }
        if (b.disabled) return;
        var act = b.getAttribute('data-act'), id = parseInt(b.getAttribute('data-id'), 10);
        Snd.click();
        if (act === 'duty') lua('toggleDuty()');
        else if (act === 'call') lua('requestCall()');
        else if (act === 'accept') { lua('accept(' + id + ')'); hideBanner(); }
        else if (act === 'decline') lua('decline(' + id + ')');
        else if (act === 'hidebanner') hideBanner();
        else if (act === 'strap') openGame();
        else if (act === 'closegame') closeGame();
        else if (act === 'done') lua('done()');
        else if (act === 'brake') lua('toggleCarBrake()');
        else if (act === 'gps') lua('routeToCar()');
        else if (act === 'cancel') {
          if (cancelArmed > Date.now()) { cancelArmed = 0; lua('cancel()'); } else { cancelArmed = Date.now() + 3000; }
          render();
        }
      }
      root.addEventListener('click', onClick);
      layer.addEventListener('click', onClick);

      // State from Lua ---------------------------------------------------------------------------------------

      scope.$on('TowTruckCallsState', function (event, data) {
        state = data || {};
        var offers = list(state.offers), job = state.job;
        var ids = offers.map(function (o) { return o.id; });
        var result = state.result;
        if (firstState) {
          // Don't replay pop-ups from before the UI was opened.
          seenOffers = ids;
          lastResult = result ? result.token : 0;
          if (job) strapSeen[job.id] = job.strapToken;
          firstState = false;
        } else {
          var fresh = offers.filter(function (o) { return seenOffers.indexOf(o.id) < 0; });
          seenOffers = ids;
          if (fresh.length) showBanner(fresh[fresh.length - 1]);
          if (result && result.token !== lastResult) { lastResult = result.token; closeGame(); showResult(result); }
          if (job && job.phase === 'onscene' && job.strapToken > (strapSeen[job.id] || 0)) {
            strapSeen[job.id] = job.strapToken;
            if (!game) openGame();
          }
        }
        if (bannerOffer !== null && ids.indexOf(bannerOffer) < 0) hideBanner();
        if (cancelArmed && cancelArmed < Date.now()) cancelArmed = 0;
        render();
      });

      scope.$on('$destroy', function () {
        cancelAnimationFrame(raf);
        clearTimeout(bannerTimer);
        clearTimeout(resultTimer);
        window.removeEventListener('mouseup', release);
        if (layer.parentNode) layer.parentNode.removeChild(layer);
      });

      lua('requestState()');
    }
  };
}]);
