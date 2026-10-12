/* Knastknacker – kleine Geräusche aus dem WebAudio-Synth (keine Dateien). Abschaltbar. */
(function () {
  'use strict';
  let ctx = null, an = true, master = null, sirene = null;
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination); } catch (_) { ctx = null; }
  }
  function rauschen(dauer) {
    const n = Math.floor(ctx.sampleRate * dauer), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  function huelle(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function ton(freq, dauer, typ = 'square', laut = 0.2, gleit) {
    if (!ctx || !an) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(freq, t); if (gleit) o.frequency.exponentialRampToValueAtTime(gleit, t + dauer);
    huelle(g, t, 0.01, dauer, laut); o.connect(g); g.connect(master); o.start(t); o.stop(t + dauer + 0.05);
  }
  function knall(dauer, filter, laut) {
    if (!ctx || !an) return;
    const t = ctx.currentTime, s = rauschen(dauer), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(filter, t); f.frequency.exponentialRampToValueAtTime(60, t + dauer);
    huelle(g, t, 0.005, dauer, laut); s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  const T = {
    start,
    an:v => { an = v; if (!v) T.sirene(false); },
    istAn:() => an,
    schlag:() => knall(0.12, 1800, 0.5),
    treffer:() => { knall(0.15, 900, 0.7); ton(120, 0.12, 'sine', 0.4, 60); },
    boom:() => { knall(1.6, 900, 1); ton(60, 1, 'sine', 0.6, 30); },
    krach:() => { knall(0.6, 2400, 0.8); },
    graben:() => knall(0.18, 600, 0.25),
    nehmen:() => { ton(660, 0.06, 'triangle', 0.2); setTimeout(() => ton(990, 0.08, 'triangle', 0.2), 60); },
    nein:() => ton(140, 0.15, 'square', 0.15),
    halt:() => { ton(1900, 0.12, 'sine', 0.25); setTimeout(() => ton(1500, 0.25, 'sine', 0.25), 140); },
    schock:() => { ton(80, 0.4, 'sawtooth', 0.35); knall(0.3, 5000, 0.3); },
    piep:() => ton(1400, 0.05, 'square', 0.12),
    frei:() => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ton(f, 0.25, 'triangle', 0.25), i * 120)),
    gefasst:() => [392, 330, 262].forEach((f, i) => setTimeout(() => ton(f, 0.3, 'triangle', 0.25), i * 180)),
    sirene(ein) {
      if (!ctx) return;
      if (ein && an && !sirene) {
        const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 650; l.frequency.value = 0.9; lg.gain.value = 220;
        l.connect(lg); lg.connect(o.frequency); g.gain.value = 0.045; o.connect(g); g.connect(master); o.start(); l.start();
        sirene = { o, l };
      } else if (!ein && sirene) { sirene.o.stop(); sirene.l.stop(); sirene = null; }
    }
  };
  window.KKTon = T;
})();
