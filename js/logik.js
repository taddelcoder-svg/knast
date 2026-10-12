/* Knastknacker – Spielregeln. Ein Spiel = eine Runde Ausbruch. Läuft auf dem Server (Online-Räume) und im Browser (Solo).
   Bewegung der Spieler rechnet der Browser selbst (mit derselben Kollision wie hier), der Server prüft nur nach.
   Wärter, Mithäftlinge, Gegenstände, Türen, Tore, Strom und Ausbrüche rechnet allein die Spiel-Instanz. */
(function (wurzel, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik(require('./karte.js'));
  else wurzel.KK_LOGIK = fabrik(wurzel.KK_KARTE);
})(typeof self !== 'undefined' ? self : this, function (KA) {
  'use strict';
  const TAKT = 20, DT = 1 / TAKT;
  const MAX_SPIELER = 10;
  const W = KA.W, H = KA.H;
  const TIERE = ['loewe', 'fuchs', 'waschbaer', 'pinguin', 'hase', 'baer', 'affe', 'panda', 'krokodil', 'schwein'];
  const TIER_NAMEN = { loewe:'Löwe', fuchs:'Fuchs', waschbaer:'Waschbär', pinguin:'Pinguin', hase:'Hase', baer:'Bär', affe:'Affe', panda:'Panda', krokodil:'Krokodil', schwein:'Schwein' };
  const MODI = ['jeder', 'banden', 'alle'];

  const ITEMS = {
    loeffel:{ name:'Löffel', illegal:false, grab:5, loch:8 },
    schaufel:{ name:'Schaufel', illegal:true, grab:1.6, loch:3, schlag:30 },
    schraubenzieher:{ name:'Schraubenzieher', illegal:true },
    drahtschere:{ name:'Drahtschere', illegal:true },
    hammer:{ name:'Hammer', illegal:true, schlag:36 },
    schlagstock:{ name:'Schlagstock', illegal:true, schlag:34 },
    laken:{ name:'Bettlaken', illegal:false },
    seil:{ name:'Lakenseil', illegal:true },
    duenger:{ name:'Dünger', illegal:false },
    reiniger:{ name:'Reiniger', illegal:false },
    sprengstoff:{ name:'Sprengstoff', illegal:true },
    uniform:{ name:'Wärter-Uniform', illegal:true },
    keyblau:{ name:'Karte Blau', illegal:true },
    keyrot:{ name:'Karte Rot', illegal:true },
    vanschluessel:{ name:'Van-Schlüssel', illegal:true },
    helischluessel:{ name:'Heli-Schlüssel', illegal:true }
  };
  const UNIKAT = new Set(['keyblau', 'keyrot', 'vanschluessel', 'helischluessel']);
  const WIEDER_S = 45;

  // Tempo je Ebene (m/s): gehen, rennen
  const TEMPO = { 0:[3.4, 5.7], 1:[2.2, 2.6], 2:[1.6, 1.8], 3:[3.4, 5.7] };
  const RADIUS = 0.3;

  /* ---------- Hilfen ---------- */
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const winkelDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const r2 = v => Math.round(v * 100) / 100;

  /* ---------- Kollision (geteilt mit dem Browser) ---------- */
  function frei(K, x, z, e, wer, r = RADIUS) {
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), z0 = Math.floor(z - r), z1 = Math.floor(z + r);
    for (let zi = z0; zi <= z1; zi++) for (let xi = x0; xi <= x1; xi++) if (!K.begehbar(e, xi, zi, wer)) return false;
    return true;
  }
  function bewegen(K, p, dx, dz, e, wer, r = RADIUS) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.2));
    for (let s = 0; s < n; s++) {
      const nx = p.x + dx / n; if (frei(K, nx, p.z, e, wer, r)) p.x = nx;
      const nz = p.z + dz / n; if (frei(K, p.x, nz, e, wer, r)) p.z = nz;
    }
  }

  /* ---------- Van ---------- */
  const VAN = { laenge:4.4, breite:2.0, maxV:13, rueck:-5 };
  function vanPunkte(x, z, r) {
    const s = Math.sin(r), c = Math.cos(r), L = VAN.laenge / 2, B = VAN.breite / 2, pts = [];
    for (const [a, b] of [[L, B], [L, -B], [-L, B], [-L, -B], [L, 0], [-L, 0], [0, B], [0, -B], [0, 0]])
      pts.push([x + s * a + c * b, z + c * a - s * b]);
    return pts;
  }
  // Ein Fahrschritt; gibt Zellen zurück, die beim Rammen getroffen wurden
  function vanSchritt(K, f, gas, lenk, dt, wer) {
    if (gas > 0) f.v += (f.v < 0 ? 14 : 6.5) * gas * dt;
    else if (gas < 0) f.v -= (f.v > 0 ? 14 : 5) * -gas * dt;
    else { f.v *= Math.max(0, 1 - 1.4 * dt); if (Math.abs(f.v) < 0.08) f.v = 0; }
    f.v = Math.max(VAN.rueck, Math.min(VAN.maxV, f.v));
    f.r -= lenk * dt * 1.9 * Math.max(-1, Math.min(1, f.v / 5));
    const nx = f.x + Math.sin(f.r) * f.v * dt, nz = f.z + Math.cos(f.r) * f.v * dt;
    const ramm = [];
    let zu = false;
    for (const [px, pz] of vanPunkte(nx, nz, f.r)) {
      const xi = Math.floor(px), zi = Math.floor(pz);
      if (K.begehbar(0, xi, zi, wer)) continue;
      const c = K.code(xi, zi);
      if ((c === 'T' || c === 'G') && Math.abs(f.v) > 4) { ramm.push([xi, zi]); continue; }
      zu = true;
    }
    if (zu) f.v *= -0.25;
    else { f.x = nx; f.z = nz; if (ramm.length) f.v *= 0.75; }
    return ramm;
  }

  /* ---------- Scheinwerfer der Wachtürme ---------- */
  const LICHTWEGE = [
    [[46, 9.5], [9.5, 9.5], [9.5, 41]],
    [[54, 9.5], [90.5, 9.5], [90.5, 41]],
    [[9.5, 40], [9.5, 74.5], [50, 74.5]],
    [[90.5, 40], [90.5, 74.5], [49, 74.5]]
  ];
  const LICHT_R = 3.1;
  function scheinwerfer(i, t) {
    const w = LICHTWEGE[i];
    const laengen = []; let ges = 0;
    for (let k = 1; k < w.length; k++) { const l = dist(w[k - 1][0], w[k - 1][1], w[k][0], w[k][1]); laengen.push(l); ges += l; }
    let s = (Math.sin(t * 0.17 + i * 1.7) + 1) / 2 * ges;
    for (let k = 0; k < laengen.length; k++) {
      if (s <= laengen[k] || k === laengen.length - 1) {
        const a = Math.min(1, s / laengen[k]);
        return { x:w[k][0] + (w[k + 1][0] - w[k][0]) * a, z:w[k][1] + (w[k + 1][1] - w[k][1]) * a };
      }
      s -= laengen[k];
    }
    return { x:w[0][0], z:w[0][1] };
  }

  /* ---------- Was kann ein Spieler gerade tun? (geteilt: Server prüft, Browser zeigt den Hinweis) ----------
     S braucht: K, items, strom, toreOffen, seile, van, heli. sp braucht: x, z, r, e, inv, hand, uniform, fz. */
  const hat = (sp, art) => sp.inv.indexOf(art) >= 0;
  const zaehle = (sp, art) => sp.inv.filter(a => a === art).length;
  function vorne(sp, d) { return [Math.floor(sp.x + Math.sin(sp.r) * d), Math.floor(sp.z + Math.cos(sp.r) * d)]; }
  function moeglich(S, sp) {
    const K = S.K, hand = sp.inv[sp.hand], e = sp.e;
    const A = (art, text, dauer, extra) => Object.assign({ art, text, dauer }, extra || {});
    const info = text => ({ art:null, text, dauer:0, info:true });
    if (sp.fz) return A('aussteigen', sp.fz === 'heli' ? 'Aus dem Heli steigen' : 'Aus dem Van steigen', 0.3);
    // Gegenstand aufheben
    let best = null, bd = 1.5;
    for (const it of S.items) { if (it.e !== e) continue; const d = dist(sp.x, sp.z, it.x, it.z); if (d < bd) { bd = d; best = it; } }
    if (best) return A('nehmen', ITEMS[best.art].name + ' aufheben', 0, { item:best.id });
    if (hand === 'laken' && zaehle(sp, 'laken') >= 2) return A('knoten', 'Lakenseil knoten', 3);
    if (hand === 'uniform') return A('uniform', 'Uniform anziehen', 2);
    const xi = Math.floor(sp.x), zi = Math.floor(sp.z);
    const grab = hand && ITEMS[hand].grab ? ITEMS[hand] : null;

    if (e === 0) {
      const c = K.code(xi, zi);
      // Van
      if (S.van && !S.van.weg && dist(sp.x, sp.z, S.van.x, S.van.z) < 3.2) {
        if (S.van.sitze.length >= 4) return info('Der Van ist voll');
        if (!S.van.fahrer && hat(sp, 'vanschluessel')) return A('van_rein', 'Ans Steuer setzen', 0.6);
        return A('van_rein', S.van.fahrer ? 'In den Van springen' : 'In den Van setzen (ohne Schlüssel kein Fahren)', 0.6);
      }
      if (c === 'O') return A('loch_runter', 'In den Tunnel steigen', 0.6);
      // Seil im Todesstreifen hoch
      for (let i = 0; i < KA.OBJ.haken.length; i++) {
        const h = KA.OBJ.haken[i];
        if (S.seile[i] && dist(sp.x, sp.z, h.unten.x, h.unten.z) < 1.4) return A('seil_hoch', 'Am Seil aufs Dach klettern', 2.5, { haken:i });
      }
      // Lüftungsgitter in der Decke
      for (let i = 0; i < K.gitter.length; i++) {
        const g = K.gitter[i];
        if (dist(sp.x, sp.z, g.x + 0.5, g.z + 0.5) > 1.2) continue;
        if (g.offen) return A('gitter_rein', 'In die Lüftung klettern', 1, { gitter:i });
        if (hand === 'schraubenzieher') return A('gitter_auf', 'Lüftungsgitter abschrauben', 2.5, { gitter:i });
        return info('Lüftungsgitter (Schraubenzieher in die Hand)');
      }
      if (dist(sp.x, sp.z, KA.OBJ.treppeUnten.x, KA.OBJ.treppeUnten.z) < 1.5) return A('treppe_hoch', 'Treppe aufs Dach', 1.2);
      if (dist(sp.x, sp.z, KA.OBJ.torschalter.x, KA.OBJ.torschalter.z) < 1.6) return A('tor', 'Tore öffnen', 1.5);
      if (hand === 'sprengstoff') {
        const ziel = sprengZiel(S, sp);
        if (ziel) return A('sprengen', 'Sprengstoff anbringen', 2, ziel);
      }
      if (hand === 'hammer' && S.strom && dist(sp.x, sp.z, KA.OBJ.generator.x, KA.OBJ.generator.z) < 3.2) return A('generator', 'Generator zertrümmern', 6);
      if (hand === 'drahtschere') {
        for (const d of [0.7, 1.2]) { const [fx, fz] = vorne(sp, d); if (K.code(fx, fz) === 'Z') return A('zaun', S.strom ? 'Zaun aufschneiden (Strom an!)' : 'Zaun aufschneiden', 3, { zx:fx, zz:fz }); }
      }
      if (dist(sp.x, sp.z, KA.OBJ.werkbank.x, KA.OBJ.werkbank.z) < 2.6) {
        if (hat(sp, 'duenger') && hat(sp, 'reiniger')) return A('bauen', 'Sprengstoff bauen (Dünger + Reiniger)', 4);
        if (!hand || !grab) { /* Hinweis nur ohne Grabwerkzeug */ }
      }
      if (grab && KA.GRABBAR.has(K.boden[zi * W + xi]) && !K.draussen(sp.x, sp.z)) return A('loch', 'Loch in den Boden graben', grab.loch);
      if (dist(sp.x, sp.z, KA.OBJ.werkbank.x, KA.OBJ.werkbank.z) < 2.6) return info('Werkbank: Dünger + Reiniger = Sprengstoff');
      return null;
    }
    if (e === 1) {
      const loch = K.code(xi, zi) === 'O';
      if (grab && K.draussen(sp.x, sp.z) && KA.GRABBAR.has(K.boden[zi * W + xi]) && !loch) return A('tunnel_hoch', 'Nach oben durchgraben – in die Freiheit!', grab.loch * 0.6);
      if (grab) {
        const q = Math.round(sp.r / (Math.PI / 2)), dx = Math.round(Math.sin(q * Math.PI / 2)), dz = Math.round(Math.cos(q * Math.PI / 2));
        const nx = xi + dx, nz = zi + dz;
        if (nx > 0 && nz > 0 && nx < W - 1 && nz < H - 1 && !K.tunnel[nz * W + nx]) return A('graben', 'Weitergraben', grab.grab, { gx:nx, gz:nz });
        if (loch) return A('loch_hoch', 'Hochklettern', 0.6);
        if (KA.GRABBAR.has(K.boden[zi * W + xi])) return A('tunnel_hoch', 'Nach oben durchgraben', grab.loch * 0.6);
        return info('Hier oben ist Mauer oder Gebäude');
      }
      return loch ? A('loch_hoch', 'Hochklettern', 0.6) : info('Zum Graben Löffel oder Schaufel in die Hand');
    }
    if (e === 2) {
      for (let i = 0; i < K.gitter.length; i++) {
        const g = K.gitter[i];
        if (g.x !== xi || g.z !== zi) continue;
        if (g.offen) return A('gitter_raus', 'Runter: ' + g.ort, 1, { gitter:i });
        if (hand === 'schraubenzieher') return A('gitter_auf', 'Gitter von innen abschrauben', 2.5, { gitter:i });
        return info('Gitter zu: ' + g.ort + ' (Schraubenzieher)');
      }
      if (xi === KA.LUKE.x && zi === KA.LUKE.z) return A('luke_hoch', 'Luke aufs Dach', 1);
      return null;
    }
    if (e === 3) {
      if (S.heli && !S.heli.weg && dist(sp.x, sp.z, S.heli.x, S.heli.z) < 4) {
        if (S.heli.startBis) return S.heli.sitze.length < 4 ? A('heli_rein', 'In den startenden Heli springen!', 0.5) : info('Heli voll');
        if (hat(sp, 'helischluessel')) return A('heli_start', 'Heli starten', 3);
        if (S.heli.sitze.length < 4) return A('heli_rein', 'In den Heli setzen (Pilot braucht den Schlüssel)', 0.5);
      }
      if (dist(sp.x, sp.z, KA.OBJ.treppeOben.x, KA.OBJ.treppeOben.z) < 1.4) return A('treppe_runter', 'Treppe runter', 1.2);
      if (dist(sp.x, sp.z, KA.OBJ.luke.x, KA.OBJ.luke.z) < 1.2) return A('luke_runter', 'Durch die Luke in die Lüftung', 1);
      for (let i = 0; i < KA.OBJ.haken.length; i++) {
        const h = KA.OBJ.haken[i];
        if (dist(sp.x, sp.z, h.x, h.z) > 1.5) continue;
        if (S.seile[i]) return A('abseilen', 'Abseilen', 2, { haken:i });
        if (hat(sp, 'seil')) return A('seil_fest', 'Lakenseil festknoten', 2, { haken:i });
        return info('Haken am Dachrand (Lakenseil nötig)');
      }
      return null;
    }
    return null;
  }
  function sprengZiel(S, sp) {
    if (S.strom && dist(sp.x, sp.z, KA.OBJ.generator.x, KA.OBJ.generator.z) < 3.2) return { bx:KA.OBJ.generator.x, bz:KA.OBJ.generator.z, ci:-1, cj:-1 };
    for (const d of [0.7, 1.2]) {
      const [fx, fz] = vorne(sp, d);
      const c = S.K.code(fx, fz);
      if (KA.SPRENGBAR.has(KA.C(c)) && fx > 0 && fz > 0 && fx < W - 1 && fz < H - 1) return { bx:sp.x + Math.sin(sp.r) * 0.5, bz:sp.z + Math.cos(sp.r) * 0.5, ci:fx, cj:fz };
    }
    return null;
  }

  /* ---------- A* auf dem Bodenraster ---------- */
  const N = W * H;
  const gKost = new Float32Array(N), offen = new Int32Array(N), woher = new Int32Array(N), stempel = new Int32Array(N), zu = new Int32Array(N);
  let lauf = 0;
  const heap = [];
  function hPush(f, i) { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } }
  function hPop() { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; }
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  function pfad(K, wer, sx, sz, zx, zz, max = 9000) {
    sx = Math.floor(sx); sz = Math.floor(sz); zx = Math.floor(zx); zz = Math.floor(zz);
    if (!K.drin(zx, zz)) return null;
    // Ziel unbegehbar? Nächste begehbare Nachbarzelle nehmen
    if (!K.begehbar(0, zx, zz, wer)) {
      let ok = false;
      for (let r = 1; r <= 2 && !ok; r++) for (let dz = -r; dz <= r && !ok; dz++) for (let dx = -r; dx <= r && !ok; dx++) if (K.begehbar(0, zx + dx, zz + dz, wer)) { zx += dx; zz += dz; ok = true; }
      if (!ok) return null;
    }
    lauf++; heap.length = 0;
    const s = sz * W + sx, z = zz * W + zx;
    gKost[s] = 0; stempel[s] = lauf; woher[s] = -1; zu[s] = 0;
    hPush(dist(sx, sz, zx, zz), s);
    let n = 0;
    while (heap.length && n++ < max) {
      const [, i] = hPop();
      if (zu[i] === lauf) continue;
      zu[i] = lauf;
      if (i === z) {
        const p = []; let k = i;
        while (k !== -1) { p.push([(k % W) + 0.5, Math.floor(k / W) + 0.5]); k = woher[k]; }
        p.reverse(); return p;
      }
      const x = i % W, y = (i - x) / W;
      for (const [dx, dz, c] of NB) {
        const nx = x + dx, nz = y + dz;
        if (!K.begehbar(0, nx, nz, wer)) continue;
        if (dx && dz && (!K.begehbar(0, x + dx, y, wer) || !K.begehbar(0, x, y + dz, wer))) continue;
        const j = nz * W + nx;
        if (zu[j] === lauf) continue;
        const g = gKost[i] + c;
        if (stempel[j] !== lauf || g < gKost[j]) { stempel[j] = lauf; gKost[j] = g; woher[j] = i; hPush(g + dist(nx, nz, zx, zz), j); }
      }
    }
    return null;
  }

  /* ================================================================== */
  class Spiel {
    constructor(o = {}) {
      this.seed = (o.seed >>> 0) || 1;
      this.rng = mulberry(this.seed);
      this.modus = MODI.includes(o.modus) ? o.modus : 'jeder';
      this.dauer = [600, 900, 1200].includes(o.dauer) ? o.dauer : 900;
      this.K = KA.neu();
      this.zeit = 0; this.tick = 0; this.phase = 'laufen';
      this.spieler = new Map(); this.reihe = 0;
      this.items = []; this.naechsteId = 1;
      this.spawns = KA.SPAWNS.map(s => ({ ...s, item:null, wieder:0 }));
      for (const s of this.spawns) this.spawnen(s);
      this.waerter = []; this.insassen = [];
      this.bomben = []; this.seile = KA.OBJ.haken.map(() => false);
      this.strom = true; this.gen = { hp:100, ausSeit:0, reparierer:null, arbeit:0 };
      this.toreBis = 0;
      this.alarm = { stufe:0, bis:0, x:0, z:0 };
      this.van = { x:KA.OBJ.van.x, z:KA.OBJ.van.z, r:KA.OBJ.van.r, v:0, fahrer:null, sitze:[], weg:false, bewegt:0 };
      this.heli = { x:KA.OBJ.heli.x, z:KA.OBJ.heli.z, sitze:[], startBis:0, weg:false };
      this.ereignisse = []; this.version = 1; this.ergebnis = null; this.ohneWache = !!o.ohneWache;
      this.insassenAufstellen();
    }
    geaendert() { this.version++; }
    ev(e) { this.ereignisse.push(e); }
    nimmEreignisse() { const e = this.ereignisse; this.ereignisse = []; return e; }
    meldung(text) { this.ev({ art:'meldung', text }); }
    get toreOffen() { return this.toreBis > this.zeit; }
    werVon(sp) { return { blau:hat(sp, 'keyblau'), rot:hat(sp, 'keyrot'), strom:this.strom, toreOffen:this.toreOffen }; }
    werWache() { return { waerter:true, strom:this.strom, toreOffen:this.toreOffen }; }

    /* ---------- Gegenstände ---------- */
    itemNeu(art, x, z, e = 0) { const it = { id:this.naechsteId++, art, x, z, e }; this.items.push(it); this.geaendert(); return it; }
    anzahl(art) { let n = 0; for (const it of this.items) if (it.art === art) n++; for (const sp of this.spieler.values()) for (const a of sp.inv) if (a === art) n++; return n; }
    spawnen(s) {
      const it = this.itemNeu(s.art, s.x, s.z, 0); s.item = it.id;
    }
    gib(sp, art) {
      if (!sp.inv[sp.hand]) { sp.inv[sp.hand] = art; return true; }
      const i = sp.inv.indexOf(null);
      if (i >= 0) { sp.inv[i] = art; return true; }
      this.itemNeu(art, sp.x, sp.z, sp.e); return false;
    }
    nimm(sp, art) { const i = sp.inv.indexOf(art); if (i < 0) return false; sp.inv[i] = null; return true; }
    allesFallen(sp) {
      sp.inv.forEach((a, i) => { if (!a) return; const w = i * 1.6 + this.rng(); this.itemNeu(a, sp.x + Math.sin(w) * 0.7, sp.z + Math.cos(w) * 0.7, sp.e); sp.inv[i] = null; });
    }

    /* ---------- Spieler ---------- */
    spielerHinzu(id, name, tier) {
      if (this.spieler.has(id)) { const sp = this.spieler.get(id); sp.name = name; sp.tier = tier; this.geaendert(); return sp; }
      const n = this.reihe++;
      const team = this.modus === 'alle' ? 0 : this.modus === 'banden' ? Math.floor(n / 2) : n;
      const zelle = n % KA.OBJ.zellen.length, Z = KA.OBJ.zellen[zelle];
      const sp = { id, name, tier, team, zelle, x:Z.x, z:Z.z, r:Z.r, e:0, hp:100, inv:[null, null, null, null], hand:0, uniform:false,
        zustand:'aktiv', bis:0, aktion:null, tp:1, anim:0, abwesend:false, gesuchtBis:0, schlugBis:0, schlagCd:0, getroffen:0,
        wege:[], frei:null, gefasst:0, kos:0, fz:null, posZeit:0 };
      this.spieler.set(id, sp);
      this.ev({ art:'tele', an:id, x:sp.x, z:sp.z, e:0, r:sp.r, tp:sp.tp });
      this.geaendert();
      return sp;
    }
    spielerWeg(id) {
      const sp = this.spieler.get(id); if (!sp) return;
      this.aussteigen(sp, true);
      this.allesFallen(sp);
      this.spieler.delete(id);
      this.geaendert();
    }
    abwesend(id, weg) { const sp = this.spieler.get(id); if (sp) { sp.abwesend = !!weg; this.geaendert(); } }
    tele(sp, x, z, e, r) {
      sp.x = x; sp.z = z; sp.e = e; if (r != null) sp.r = r; sp.tp++;
      this.ev({ art:'tele', an:sp.id, x, z, e, r:sp.r, tp:sp.tp });
      this.geaendert();
    }
    // Position vom Browser (nur prüfen, nicht rechnen)
    position(id, d) {
      const sp = this.spieler.get(id);
      if (!sp || !d || sp.zustand !== 'aktiv' || sp.fz || d.tp !== sp.tp) return;
      const x = +d.x, z = +d.z, r = +d.r;
      if (!isFinite(x) || !isFinite(z)) return;
      const ds = dist(x, z, sp.x, sp.z), erlaubt = TEMPO[sp.e][1] * Math.max(DT, this.zeit - sp.posZeit) * 1.7 + 0.7;
      const wer = this.werVon(sp);
      // Wer in einer gerade geschlossenen Tür steht, darf sich herausbewegen
      if (ds > erlaubt || (!frei(this.K, x, z, sp.e, wer, RADIUS - 0.05) && frei(this.K, sp.x, sp.z, sp.e, wer, RADIUS - 0.05))) { this.tele(sp, sp.x, sp.z, sp.e); return; }
      sp.x = x; sp.z = z; if (isFinite(r)) sp.r = r; sp.anim = d.a | 0; sp.posZeit = this.zeit;
      if (sp.aktion && dist(x, z, sp.aktion.x, sp.aktion.z) > 0.45) this.abbrechen(sp);
      // Ausbruchsweg merken
      if (sp.e === 0) {
        const c = this.K.code(Math.floor(x), Math.floor(z));
        if (c === 'l') this.weg(sp, 'Zaun');
        else if (c === 'L') this.weg(sp, 'Sprengloch');
        else if (c === 'T') this.weg(sp, 'Tor');
        else if (c === 'B' && Math.floor(x) === 12) this.weg(sp, 'Personaltür');
      }
    }
    weg(sp, w) { if (sp.wege[sp.wege.length - 1] !== w) { sp.wege.push(w); if (sp.wege.length > 4) sp.wege.shift(); } }

    /* ---------- Aktionen ---------- */
    aktion(id, b) {
      const sp = this.spieler.get(id);
      if (!sp || !b || this.phase !== 'laufen') return;
      if (b.a === 'chat') {
        const text = String(b.text || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
        if (text) this.ev({ art:'chat', id, text });
        return;
      }
      if (sp.zustand !== 'aktiv') return;
      switch (b.a) {
        case 'hand': { const i = b.i | 0; if (i >= 0 && i < 4) { sp.hand = i; this.abbrechen(sp); this.geaendert(); } return; }
        case 'werfen': {
          const a = sp.inv[sp.hand]; if (!a || sp.fz) return;
          sp.inv[sp.hand] = null;
          this.itemNeu(a, sp.x + Math.sin(sp.r) * 0.6, sp.z + Math.cos(sp.r) * 0.6, sp.e);
          return;
        }
        case 'schlag': this.schlagen(sp); return;
        case 'stop': this.abbrechen(sp); return;
        case 'start': {
          const m = moeglich(this, sp);
          if (!m || m.info || m.art !== b.art) { this.ev({ art:'nein', an:id }); return; }
          if (m.art === 'nehmen') return this.nehmen(sp, m.item);
          if (m.art === 'aussteigen') return this.aussteigen(sp);
          if (m.art === 'zaun' && this.strom) { this.schock(sp); return; }
          sp.aktion = { ...m, t:0, x:sp.x, z:sp.z };
          this.geaendert();
          return;
        }
      }
    }
    abbrechen(sp) { if (sp.aktion) { sp.aktion = null; this.geaendert(); } }
    nehmen(sp, itemId) {
      const i = this.items.findIndex(it => it.id === itemId); if (i < 0) return;
      const it = this.items[i];
      if (dist(sp.x, sp.z, it.x, it.z) > 2 || it.e !== sp.e) return;
      this.items.splice(i, 1);
      for (const s of this.spawns) if (s.item === it.id) { s.item = null; s.wieder = this.zeit + WIEDER_S; }
      // Kein Platz: Gegenstand aus der Hand gegen den neuen tauschen
      if (sp.inv.indexOf(null) < 0) { const alt = sp.inv[sp.hand]; sp.inv[sp.hand] = it.art; this.itemNeu(alt, it.x, it.z, it.e); }
      else this.gib(sp, it.art);
      this.ev({ art:'nehmen', an:sp.id, item:it.art });
      this.geaendert();
    }
    schock(sp) {
      sp.hp -= 30; sp.getroffen = this.zeit;
      this.ev({ art:'schock', x:sp.x, z:sp.z, an:sp.id });
      this.laerm(sp.x, sp.z, 10);
      if (sp.hp <= 0) this.koSpieler(sp);
      this.geaendert();
    }
    ausfuehren(sp, a) {
      const K = this.K, O = KA.OBJ;
      switch (a.art) {
        case 'loch_runter': this.tele(sp, Math.floor(sp.x) + 0.5, Math.floor(sp.z) + 0.5, 1); break;
        case 'loch_hoch': this.tele(sp, Math.floor(sp.x) + 0.5, Math.floor(sp.z) + 0.5, 0); break;
        case 'loch': {
          const x = Math.floor(sp.x), z = Math.floor(sp.z);
          K.setze(x, z, 'O'); K.graben(x, z);
          this.tele(sp, x + 0.5, z + 0.5, 1);
          this.ev({ art:'graben', x:sp.x, z:sp.z });
          break;
        }
        case 'graben': K.graben(a.gx, a.gz); this.ev({ art:'graben', x:a.gx + 0.5, z:a.gz + 0.5, e:1 }); break;
        case 'tunnel_hoch': {
          const x = Math.floor(sp.x), z = Math.floor(sp.z);
          K.setze(x, z, 'O');
          this.weg(sp, 'Tunnel');
          this.tele(sp, x + 0.5, z + 0.5, 0);
          break;
        }
        case 'gitter_auf': K.gitter[a.gitter].offen = true; this.ev({ art:'gitter', i:a.gitter }); break;
        case 'gitter_rein': { const g = K.gitter[a.gitter]; this.tele(sp, g.x + 0.5, g.z + 0.5, 2); break; }
        case 'gitter_raus': { const g = K.gitter[a.gitter]; this.weg(sp, 'Lüftung'); this.tele(sp, g.x + 0.5, g.z + 0.5, 0); break; }
        case 'luke_hoch': this.tele(sp, O.luke.x, O.luke.z, 3); break;
        case 'luke_runter': this.tele(sp, KA.LUKE.x + 0.5, KA.LUKE.z + 0.5, 2); break;
        case 'treppe_hoch': this.tele(sp, O.treppeOben.x, O.treppeOben.z, 3, 0); break;
        case 'treppe_runter': this.tele(sp, O.treppeUnten.x, O.treppeUnten.z, 0, 0); break;
        case 'seil_fest': if (this.nimm(sp, 'seil')) { this.seile[a.haken] = true; this.meldung(sp.name + ' hat ein Lakenseil vom Dach gelassen'); } break;
        case 'abseilen': { const h = O.haken[a.haken]; this.weg(sp, 'Seil'); this.tele(sp, h.unten.x, h.unten.z, 0, h.richtung); break; }
        case 'seil_hoch': { const h = O.haken[a.haken]; this.tele(sp, h.x, h.z, 3, h.richtung + Math.PI); break; }
        case 'knoten': if (zaehle(sp, 'laken') >= 2) { this.nimm(sp, 'laken'); this.nimm(sp, 'laken'); this.gib(sp, 'seil'); } break;
        case 'bauen': if (hat(sp, 'duenger') && hat(sp, 'reiniger')) { this.nimm(sp, 'duenger'); this.nimm(sp, 'reiniger'); this.gib(sp, 'sprengstoff'); this.laerm(sp.x, sp.z, 6); } break;
        case 'uniform': if (this.nimm(sp, 'uniform')) sp.uniform = true; break;
        case 'sprengen':
          if (this.nimm(sp, 'sprengstoff')) {
            this.bomben.push({ x:a.bx, z:a.bz, ci:a.ci, cj:a.cj, rest:5, von:sp.id });
            this.ev({ art:'zuender', x:a.bx, z:a.bz });
          }
          break;
        case 'generator': this.generatorKaputt(sp.name); break;
        case 'zaun': if (!this.strom && K.code(a.zx, a.zz) === 'Z') { K.setze(a.zx, a.zz, 'l'); this.ev({ art:'zaun', x:a.zx + 0.5, z:a.zz + 0.5 }); this.laerm(sp.x, sp.z, 8); } break;
        case 'tor':
          this.toreBis = this.zeit + 15;
          this.alarmAus(2, 49.5, 68.5, 'Die Tore gehen auf!');
          this.ev({ art:'tor' });
          break;
        case 'van_rein': this.einsteigen(sp, 'van'); break;
        case 'heli_rein': this.einsteigen(sp, 'heli'); break;
        case 'heli_start':
          if (!this.heli.startBis) {
            this.heli.startBis = this.zeit + 7;
            this.einsteigen(sp, 'heli');
            this.alarmAus(2, this.heli.x, this.heli.z, 'Der Heli auf dem Dach startet!');
            this.ev({ art:'heli' });
          }
          break;
      }
      this.geaendert();
    }
    einsteigen(sp, fz) {
      const f = fz === 'van' ? this.van : this.heli;
      if (f.weg || f.sitze.length >= 4 || f.sitze.includes(sp.id)) return;
      f.sitze.push(sp.id); sp.fz = fz;
      if (fz === 'van' && !f.fahrer && hat(sp, 'vanschluessel')) f.fahrer = sp.id;
      sp.x = f.x; sp.z = f.z;
      this.geaendert();
    }
    aussteigen(sp, still) {
      if (!sp.fz) return;
      const f = sp.fz === 'van' ? this.van : this.heli;
      f.sitze = f.sitze.filter(id => id !== sp.id);
      if (f.fahrer === sp.id) { f.fahrer = null; f.v = 0; }
      const e = sp.fz === 'heli' ? 3 : 0;
      sp.fz = null;
      if (still) return;
      // Freien Platz neben dem Fahrzeug suchen
      const wer = this.werVon(sp);
      for (let r = 1.8; r < 5; r += 0.6) for (let k = 0; k < 12; k++) {
        const w = (f.r || 0) + Math.PI / 2 + k * Math.PI / 6, x = f.x + Math.sin(w) * r, z = f.z + Math.cos(w) * r;
        if (frei(this.K, x, z, e, wer)) { this.tele(sp, x, z, e); return; }
      }
      this.tele(sp, f.x, f.z, e);
    }
    // Fahrzeugposition vom Fahrer
    fahrzeug(id, d) {
      const v = this.van, sp = this.spieler.get(id);
      if (!sp || v.fahrer !== id || v.weg || !d) return;
      const x = +d.x, z = +d.z, r = +d.r, vv = +d.v;
      if (![x, z, r, vv].every(isFinite)) return;
      if (dist(x, z, v.x, v.z) > 16 * Math.max(DT, this.zeit - (v.zeitPos || 0)) * 1.8 + 1) return;
      // Rammen: Tore/Rolltor unter dem Van brechen auf
      const wer = { fahrzeug:true, toreOffen:this.toreOffen };
      let ok = true;
      for (const [px, pz] of vanPunkte(x, z, r)) {
        const xi = Math.floor(px), zi = Math.floor(pz);
        if (this.K.begehbar(0, xi, zi, wer)) continue;
        const c = this.K.code(xi, zi);
        if ((c === 'T' || c === 'G') && Math.abs(vv) > 3) { this.torBrechen(xi, zi); continue; }
        ok = false;
      }
      if (!ok) return;
      if (Math.abs(vv) > 0.5) v.bewegt = this.zeit;
      v.x = x; v.z = z; v.r = r; v.v = vv; v.zeitPos = this.zeit;
      for (const sid of v.sitze) { const s = this.spieler.get(sid); if (s) { s.x = x; s.z = z; } }
      // Wärter überfahren
      if (Math.abs(vv) > 3) for (const g of this.waerter) if (g.zustand !== 'ko' && dist(g.x, g.z, x, z) < 2) { this.koWache(g); this.ev({ art:'krach', x:g.x, z:g.z }); }
      if (this.K.draussen(x, z)) {
        v.weg = true;
        for (const sid of [...v.sitze]) { const s = this.spieler.get(sid); if (s) { this.weg(s, 'Van'); s.fz = null; this.befreit(s); } }
        v.sitze = []; v.fahrer = null;
        this.geaendert();
      }
    }
    torBrechen(xi, zi) {
      const c = this.K.code(xi, zi);
      // ganze zusammenhängende Torreihe
      const stapel = [[xi, zi]], gesehen = new Set();
      while (stapel.length) {
        const [x, z] = stapel.pop(), k = z * W + x;
        if (gesehen.has(k) || this.K.code(x, z) !== c) continue;
        gesehen.add(k); this.K.setze(x, z, 'L');
        stapel.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
      }
      this.ev({ art:'krach', x:xi + 0.5, z:zi + 0.5 });
      this.alarmAus(2, xi + 0.5, zi + 0.5, c === 'G' ? 'Der Van bricht aus der Garage!' : 'Der Van durchbricht das Tor!');
      this.geaendert();
    }

    /* ---------- Kämpfen ---------- */
    schlagen(sp) {
      if (sp.fz || this.zeit < sp.schlagCd) return;
      sp.schlagCd = this.zeit + 0.45; sp.schlugBis = this.zeit + 1.5;
      const h = sp.inv[sp.hand], schaden = (h && ITEMS[h].schlag) || 18;
      const fx = Math.sin(sp.r), fz = Math.cos(sp.r);
      const trifft = (x, z) => { const dx = x - sp.x, dz = z - sp.z, d = Math.hypot(dx, dz); return d < 1.7 && (d < 0.5 || (dx * fx + dz * fz) / d > 0.45); };
      this.ev({ art:'schlag', id:sp.id, x:sp.x, z:sp.z, e:sp.e });
      this.laerm(sp.x, sp.z, 6);
      if (sp.e === 0) for (const g of this.waerter) {
        if (g.zustand === 'ko' || !trifft(g.x, g.z)) continue;
        g.hp -= schaden; g.getroffen = this.zeit;
        this.ev({ art:'treffer', x:g.x, z:g.z });
        if (g.hp <= 0) this.koWache(g);
        else { this.jagen(g, sp); }
        return;
      }
      for (const o of this.spieler.values()) {
        if (o === sp || o.zustand !== 'aktiv' || o.fz || o.e !== sp.e || !trifft(o.x, o.z)) continue;
        if (this.modus === 'alle' || o.team === sp.team) continue;
        o.hp -= schaden; o.getroffen = this.zeit;
        this.ev({ art:'treffer', x:o.x, z:o.z, an:o.id, von:sp.id });
        if (o.hp <= 0) { this.koSpieler(o); this.meldung(sp.name + ' hat ' + o.name + ' umgehauen'); }
        this.geaendert();
        return;
      }
      if (sp.e === 0) for (const n of this.insassen) {
        if (n.ko > this.zeit || !trifft(n.x, n.z)) continue;
        n.hp -= schaden; n.flieht = this.zeit + 3; n.pfad = null;
        this.ev({ art:'treffer', x:n.x, z:n.z });
        if (n.hp <= 0) { n.ko = this.zeit + 12; n.hp = 60; }
        return;
      }
    }
    koSpieler(sp) {
      this.abbrechen(sp); this.aussteigen(sp, true);
      this.allesFallen(sp);
      sp.zustand = 'ko'; sp.bis = this.zeit + 6; sp.kos++;
      this.ev({ art:'ko', id:sp.id, x:sp.x, z:sp.z });
      this.geaendert();
    }
    koWache(g) {
      g.zustand = 'ko'; g.bis = this.zeit + 25; g.hp = 0; g.pfad = null; g.ziel = null;
      if (g.stock) { g.stock = false; this.itemNeu('schlagstock', g.x + 0.5, g.z + 0.3, 0); }
      if (g.karte) { g.karte = false; this.itemNeu('keyblau', g.x - 0.4, g.z + 0.5, 0); this.meldung('Der Oberwärter hat seine blaue Karte verloren!'); }
      if (this.gen.reparierer === g.id) { this.gen.reparierer = null; this.gen.arbeit = 0; }
      this.ev({ art:'wacheKo', x:g.x, z:g.z });
      this.geaendert();
    }
    gefasst(sp, g) {
      this.abbrechen(sp); this.aussteigen(sp, true);
      // Verbotenes wird beschlagnahmt, Uniform ausgezogen
      sp.inv = sp.inv.map(a => (a && ITEMS[a].illegal ? null : a));
      sp.uniform = false; sp.hp = 100; sp.wege = []; sp.gesuchtBis = 0;
      sp.zustand = 'iso'; sp.bis = this.zeit + 20; sp.gefasst++;
      const iso = KA.OBJ.iso[sp.gefasst % KA.OBJ.iso.length];
      this.tele(sp, iso.x, iso.z, 0);
      for (const w of this.waerter) if (w.ziel === sp.id) this.zurueck(w);
      this.ev({ art:'gefasst', id:sp.id });
      this.meldung(sp.name + ' wurde geschnappt – ab in die Einzelhaft!');
      this.geaendert();
    }
    befreit(sp) {
      if (sp.frei) return;
      this.abbrechen(sp);
      sp.zustand = 'frei';
      sp.frei = { zeit:this.zeit, wege:sp.wege.slice() };
      sp.e = 0;
      this.ev({ art:'frei', id:sp.id, wege:sp.frei.wege });
      this.meldung(sp.name + ' ist ENTKOMMEN! (' + (sp.frei.wege.join(' + ') || 'zu Fuß') + ')');
      this.geaendert();
    }

    /* ---------- Alarm, Lärm, Strom ---------- */
    alarmAus(stufe, x, z, text) {
      const neu = stufe > this.alarm.stufe || this.alarm.bis < this.zeit + 10;
      this.alarm.stufe = Math.max(this.alarm.stufe, stufe);
      this.alarm.x = x; this.alarm.z = z;
      if (stufe >= 2) this.alarm.bis = Math.max(this.alarm.bis, this.zeit + 40);
      if (stufe >= 2 && neu) {
        if (text) this.meldung(text);
        this.ev({ art:'alarm', stufe });
        // Die nächsten freien Wärter laufen hin
        const frei = this.waerter.filter(g => g.zustand === 'patrouille' || g.zustand === 'pruefen' || g.zustand === 'zurueck')
          .sort((a, b) => dist(a.x, a.z, x, z) - dist(b.x, b.z, x, z)).slice(0, 4);
        for (const g of frei) this.pruefen(g, x, z, true);
      }
      this.geaendert();
    }
    laerm(x, z, r) {
      for (const g of this.waerter) {
        if (g.zustand !== 'patrouille' && g.zustand !== 'zurueck') continue;
        if (dist(g.x, g.z, x, z) < r) this.pruefen(g, x, z, false);
      }
    }
    generatorKaputt(wer) {
      if (!this.strom) return;
      this.strom = false; this.gen.hp = 0; this.gen.ausSeit = this.zeit; this.gen.reparierer = null; this.gen.arbeit = 0;
      this.ev({ art:'strom', an:false });
      this.meldung('STROMAUSFALL! ' + (wer ? wer + ' hat den Generator erledigt. ' : '') + 'Zaun tot, Kartentüren offen.');
      this.alarmAus(1, KA.OBJ.generator.x, KA.OBJ.generator.z);
      this.laerm(KA.OBJ.generator.x, KA.OBJ.generator.z, 30);
      this.geaendert();
    }

    /* ---------- Takt ---------- */
    takt() {
      if (this.phase !== 'laufen') return;
      this.tick++; this.zeit += DT;
      if (!this.waerter.length && !this.ohneWache) this.wacheAufstellen();
      this.spielerTakt();
      this.waerterTakt();
      if (this.tick % 2 === 0) this.insassenTakt(DT * 2);
      this.weltTakt();
      // Ende: Zeit um oder alle draußen
      const da = [...this.spieler.values()].filter(s => !s.abwesend);
      // Alle draußen: noch 3 s jubeln lassen, dann Auswertung
      if (da.length && da.every(s => s.zustand === 'frei')) { if (this.alleFreiSeit == null) this.alleFreiSeit = this.zeit; } else this.alleFreiSeit = null;
      if (this.zeit >= this.dauer || (this.alleFreiSeit != null && this.zeit - this.alleFreiSeit >= 3)) this.beenden();
    }
    spielerTakt() {
      for (const sp of this.spieler.values()) {
        if (sp.zustand === 'ko' && this.zeit >= sp.bis) { sp.zustand = 'aktiv'; sp.hp = 45; this.geaendert(); }
        if (sp.zustand === 'iso' && this.zeit >= sp.bis) {
          sp.zustand = 'aktiv';
          const Z = KA.OBJ.zellen[sp.zelle];
          this.tele(sp, Z.x, Z.z, 0, Z.r);
        }
        if (sp.zustand !== 'aktiv') continue;
        // Erholen
        if (sp.hp < 100 && this.zeit - sp.getroffen > 5 && this.tick % 10 === 0) { sp.hp = Math.min(100, sp.hp + 2); this.geaendert(); }
        if (sp.aktion) {
          const a = sp.aktion;
          a.t += DT;
          if (this.tick % 10 === 0) this.geaendert();
          if (a.art === 'graben' || a.art === 'loch' || a.art === 'tunnel_hoch' || a.art === 'generator') { if (this.tick % 20 === 0) this.laerm(sp.x, sp.z, a.art === 'generator' ? 14 : 4); }
          if (a.t >= a.dauer) { sp.aktion = null; this.ausfuehren(sp, a); }
        }
        if (!sp.fz && sp.e === 0 && this.K.draussen(sp.x, sp.z)) this.befreit(sp);
      }
    }
    weltTakt() {
      const t = this.zeit;
      // Gegenstände wachsen nach
      if (this.tick % TAKT === 0) for (const s of this.spawns) {
        if (s.item || t < s.wieder) continue;
        const max = UNIKAT.has(s.art) ? 1 : this.spawns.filter(x => x.art === s.art).length + 1;
        if (this.anzahl(s.art) < max) this.spawnen(s);
      }
      // Bomben
      for (const b of this.bomben) { b.rest -= DT; if (b.rest <= 0) this.explosion(b); }
      if (this.bomben.some(b => b.rest <= 0)) { this.bomben = this.bomben.filter(b => b.rest > 0); this.geaendert(); }
      // Tore schließen wieder
      if (this.toreBis && t >= this.toreBis) { this.toreBis = 0; this.ev({ art:'torZu' }); this.geaendert(); }
      // Alarm klingt ab
      const jagd = this.waerter.some(g => g.zustand === 'jagd');
      const stufe = this.alarm.bis > t ? 2 : jagd ? 1 : 0;
      if (stufe !== this.alarm.stufe) { this.alarm.stufe = stufe; this.ev({ art:'alarm', stufe }); this.geaendert(); }
      // Scheinwerfer im Todesstreifen
      if (this.strom && this.tick % 4 === 0) {
        for (let i = 0; i < 4; i++) {
          const p = scheinwerfer(i, t);
          for (const sp of this.spieler.values()) {
            if (sp.zustand !== 'aktiv' || sp.fz || sp.e !== 0 || dist(sp.x, sp.z, p.x, p.z) > LICHT_R) continue;
            if (this.K.zoneBei(sp.x, sp.z).id !== 'streifen') continue;
            if (sp.gesuchtBis < t) this.alarmAus(2, sp.x, sp.z, 'Scheinwerfer! ' + sp.name + ' ist im Todesstreifen!');
            sp.gesuchtBis = t + 20; this.alarm.x = sp.x; this.alarm.z = sp.z;
          }
        }
      }
      // Heli hebt ab
      const h = this.heli;
      if (h.startBis && !h.weg && t >= h.startBis) {
        h.weg = true;
        for (const sid of h.sitze) { const s = this.spieler.get(sid); if (s) { this.weg(s, 'Heli'); s.fz = null; this.befreit(s); } }
        h.sitze = [];
        this.geaendert();
      }
      // Generator reparieren lassen
      if (!this.strom && t - this.gen.ausSeit > 20 && !this.gen.reparierer && this.tick % TAKT === 0) {
        const g = this.waerter.filter(w => w.zustand === 'patrouille' || w.zustand === 'zurueck')
          .sort((a, b) => dist(a.x, a.z, 39.5, 63.5) - dist(b.x, b.z, 39.5, 63.5))[0];
        if (g) { this.gen.reparierer = g.id; g.zustand = 'reparieren'; g.pfad = null; g.arbeit = 0; }
      }
      // Van im Hof bewegt sich: verdächtig, wenn ein Wärter es sieht
      if (this.van.bewegt > t - 0.5 && !this.van.weg && this.tick % 5 === 0)
        for (const g of this.waerter) if (g.zustand !== 'ko' && this.siehtPunkt(g, this.van.x, this.van.z, 25)) { this.alarmAus(2, this.van.x, this.van.z, 'Der Gefängnis-Van rollt los!'); break; }
    }
    explosion(b) {
      const K = this.K;
      this.ev({ art:'boom', x:b.x, z:b.z });
      if (b.ci >= 0) {
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const x = b.ci + dx, z = b.cj + dz;
          if (x <= 0 || z <= 0 || x >= W - 1 || z >= H - 1) continue;
          const c = K.code(x, z);
          if (c === 'T') this.torBrechen(x, z);
          else if (KA.SPRENGBAR.has(KA.C(c))) K.setze(x, z, 'L');
        }
      }
      if (dist(b.x, b.z, KA.OBJ.generator.x, KA.OBJ.generator.z) < 3.5) this.generatorKaputt(this.spieler.get(b.von) ? this.spieler.get(b.von).name : null);
      for (const sp of this.spieler.values()) {
        if (sp.zustand !== 'aktiv' || sp.e !== 0 || sp.fz) continue;
        const d = dist(sp.x, sp.z, b.x, b.z);
        if (d < 3.5) { sp.hp -= Math.round(80 * (1 - d / 3.5)) + 20; sp.getroffen = this.zeit; if (sp.hp <= 0) this.koSpieler(sp); }
      }
      for (const g of this.waerter) if (g.zustand !== 'ko' && dist(g.x, g.z, b.x, b.z) < 3.5) this.koWache(g);
      this.alarmAus(2, b.x, b.z, 'EXPLOSION! Alle Wärter auf Alarm!');
      this.laerm(b.x, b.z, 45);
      this.geaendert();
    }
    beenden() {
      if (this.phase === 'ende') return;
      this.phase = 'ende';
      const liste = [...this.spieler.values()].map(s => ({ id:s.id, name:s.name, tier:s.tier, team:s.team, frei:s.frei ? s.frei.zeit : null, wege:s.frei ? s.frei.wege : [], gefasst:s.gefasst, kos:s.kos }));
      liste.sort((a, b) => (a.frei == null) - (b.frei == null) || (a.frei || 0) - (b.frei || 0) || a.gefasst - b.gefasst);
      this.ergebnis = liste;
      this.ev({ art:'ende' });
      this.geaendert();
    }

    /* ---------- Wärter ---------- */
    wacheAufstellen() {
      const n = Math.min(KA.ROUTEN.length, 6 + Math.ceil(this.spieler.size / 2));
      for (let i = 0; i < n; i++) {
        const R = KA.ROUTEN[i];
        this.waerter.push({ id:i, route:i, wp:0, x:R[0][0] + 0.5, z:R[0][1] + 0.5, r:0, hp:100, zustand:'patrouille', pfad:null, pi:0,
          ziel:null, lx:0, lz:0, nichtGesehen:0, verdacht:{}, cd:0, warte:this.rng() * 2, karte:i === 1, stock:true, anim:0, arbeit:0,
          px:0, pz:0, schlagT:-9, getroffen:-9, stuck:0, sx:0, sz:0 });
      }
    }
    siehtPunkt(g, x, z, weit) {
      const dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz);
      if (d > weit) return false;
      if (d > 2.2 && (dx * Math.sin(g.r) + dz * Math.cos(g.r)) / d < 0.42) return false;
      return this.K.sichtFrei(g.x, g.z, x, z);
    }
    verdachtRate(g, sp, d) {
      const t = this.zeit;
      if (sp.gesuchtBis > t) return 99;
      if (sp.aktion) return 99;
      if (sp.schlugBis > t && d < 9) return 99;
      let r = 0;
      const z = this.K.zoneBei(sp.x, sp.z);
      if (z.verboten) r += sp.uniform ? (d < 2.5 ? 0.6 : 0) : (z.id === 'streifen' || z.id === 'tor' ? 4 : 1.8);
      const h = sp.inv[sp.hand];
      if (h && ITEMS[h].illegal) r += sp.uniform ? 0.5 : 1.3;
      if (sp.anim === 2 && !sp.uniform) r += 0.15;     // Rennen ist ein bisschen auffällig
      return r * (d < 6 ? 2 : 1);
    }
    jagen(g, sp) {
      if (g.zustand === 'ko') return;
      if (g.zustand !== 'jagd') this.ev({ art:'halt', x:g.x, z:g.z });
      g.zustand = 'jagd'; g.ziel = sp.id; g.lx = sp.x; g.lz = sp.z; g.nichtGesehen = 0; g.pfad = null;
      sp.gesuchtBis = Math.max(sp.gesuchtBis, this.zeit + 12);
      if (this.gen.reparierer === g.id) { this.gen.reparierer = null; this.gen.arbeit = 0; }
    }
    pruefen(g, x, z, eilig) {
      if (g.zustand === 'ko' || g.zustand === 'jagd' || g.zustand === 'reparieren') return;
      g.zustand = 'pruefen'; g.px = x; g.pz = z; g.pfad = null; g.warte = 0; g.eilig = eilig; g.schaut = 0;
    }
    zurueck(g) { g.zustand = 'zurueck'; g.ziel = null; g.pfad = null; g.warte = 0; }
    gehe(g, zx, zz, tempo) {
      // Pfad bei Bedarf neu
      const zielCell = Math.floor(zx) + Math.floor(zz) * W;
      if (!g.pfad || g.pfadZiel !== zielCell || g.stuck > 1) {
        g.pfad = pfad(this.K, this.werWache(), g.x, g.z, zx, zz); g.pi = 1; g.pfadZiel = zielCell; g.stuck = 0;
        if (!g.pfad) return false;
      }
      let ziel = g.pfad[g.pi];
      while (ziel && dist(g.x, g.z, ziel[0], ziel[1]) < 0.35) { g.pi++; ziel = g.pfad[g.pi]; }
      if (!ziel) { if (dist(g.x, g.z, zx, zz) > 0.4 && this.K.begehbar(0, Math.floor(zx), Math.floor(zz), this.werWache())) ziel = [zx, zz]; else return true; }
      const dx = ziel[0] - g.x, dz = ziel[1] - g.z, d = Math.hypot(dx, dz);
      const s = Math.min(d, tempo * DT);
      const vx = g.x, vz = g.z;
      bewegen(this.K, g, dx / d * s, dz / d * s, 0, this.werWache(), 0.28);
      const soll = Math.atan2(dx, dz);
      g.r += winkelDiff(g.r, soll) * Math.min(1, DT * 10);
      g.anim = tempo > 4 ? 2 : 1;
      if (dist(vx, vz, g.x, g.z) < s * 0.3) g.stuck += DT; else g.stuck = Math.max(0, g.stuck - DT);
      return false;
    }
    waerterTakt() {
      const t = this.zeit, K = this.K;
      for (const g of this.waerter) {
        g.anim = 0;
        if (g.zustand === 'ko') { g.anim = 4; if (t >= g.bis) { g.hp = 100; this.zurueck(g); this.alarmAus(2, g.x, g.z, 'Ein Wärter ist wieder wach und schlägt Alarm!'); } continue; }
        // Wahrnehmung (5x pro Sekunde, versetzt)
        if ((this.tick + g.id) % 4 === 0) this.wahrnehmen(g);
        switch (g.zustand) {
          case 'jagd': {
            const sp = this.spieler.get(g.ziel);
            if (!sp || sp.zustand !== 'aktiv' || sp.fz || sp.e !== 0) {
              // Spieler weg (Tunnel, Lüftung, Fahrzeug): zur letzten Stelle und nachsehen
              this.pruefen(Object.assign(g, { zustand:'patrouille' }), g.lx, g.lz, true); break;
            }
            const d = dist(g.x, g.z, sp.x, sp.z);
            if (g.nichtGesehen > 6) { this.pruefen(Object.assign(g, { zustand:'patrouille' }), g.lx, g.lz, true); break; }
            if (d < 1.25) {
              g.r += winkelDiff(g.r, Math.atan2(sp.x - g.x, sp.z - g.z)) * 0.5;
              if (t >= g.cd) {
                g.cd = t + 0.85; g.schlagT = t;
                sp.hp -= 24; sp.getroffen = t;
                this.ev({ art:'knueppel', x:sp.x, z:sp.z, an:sp.id });
                if (sp.hp <= 0) this.gefasst(sp, g); else this.geaendert();
              }
              g.anim = t - g.schlagT < 0.3 ? 3 : 0;
            } else this.gehe(g, g.lx, g.lz, 4.9);
            break;
          }
          case 'pruefen': {
            if (g.warte > 0) {
              g.warte -= DT; g.schaut += DT;
              g.r += Math.sin(g.schaut * 2) * DT * 1.5;
              // Loch oder offenes Gitter in der Nähe? Zumachen!
              if (g.zumachen) {
                g.anim = 5; g.zumachen.t -= DT;
                if (g.zumachen.t <= 0) {
                  const zm = g.zumachen; g.zumachen = null;
                  if (zm.loch) { if (K.code(zm.x, zm.z) === 'O') { K.setze(zm.x, zm.z, K.ursprung(zm.x, zm.z)); this.meldung('Ein Wärter hat ein Tunnelloch zugeschüttet'); } }
                  else { K.gitter[zm.i].offen = false; this.meldung('Ein Wärter hat ein Lüftungsgitter wieder zugeschraubt'); }
                  this.geaendert();
                }
              }
              if (g.warte <= 0) this.zurueck(g);
              break;
            }
            if (this.gehe(g, g.px, g.pz, g.eilig ? 4.4 : 3) || dist(g.x, g.z, g.px, g.pz) < 0.8 || !g.pfad) {
              g.warte = 4;
              // Zum Zumachen nachsehen
              const xi = Math.floor(g.x), zi = Math.floor(g.z);
              outer: for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (K.code(xi + dx, zi + dz) === 'O') { g.zumachen = { loch:true, x:xi + dx, z:zi + dz, t:3 }; g.warte = 4; break outer; }
              if (!g.zumachen) K.gitter.forEach((gi, i) => { if (gi.offen && dist(g.x, g.z, gi.x + 0.5, gi.z + 0.5) < 2.5 && !g.zumachen) g.zumachen = { i, t:3 }; });
            }
            break;
          }
          case 'reparieren': {
            if (this.strom) { this.zurueck(g); break; }
            if (dist(g.x, g.z, 39.5, 63.8) > 0.8) { if (this.gehe(g, 39.5, 63.8, 3) && dist(g.x, g.z, 39.5, 63.8) > 1.5) { /* kommt nicht hin */ } }
            else {
              g.anim = 5; g.arbeit += DT; g.r = Math.PI * 0;
              if (g.arbeit >= 20) {
                this.strom = true; this.gen.hp = 100; this.gen.reparierer = null; g.arbeit = 0;
                this.ev({ art:'strom', an:true }); this.meldung('Der Strom ist wieder da. Zaun und Kartentüren sind wieder scharf.');
                this.zurueck(g); this.geaendert();
              }
            }
            break;
          }
          case 'zurueck':
          case 'patrouille': {
            const R = KA.ROUTEN[g.route];
            if (g.zustand === 'zurueck') {
              // nächsten Wegpunkt der Route nehmen
              let best = 0, bd = 1e9; R.forEach((p, i) => { const d = dist(g.x, g.z, p[0] + 0.5, p[1] + 0.5); if (d < bd) { bd = d; best = i; } });
              g.wp = best; g.zustand = 'patrouille'; g.pfad = null;
            }
            if (g.warte > 0) { g.warte -= DT; g.r += Math.sin(t * 1.3 + g.id) * DT * 0.8; break; }
            const p = R[g.wp];
            if (this.gehe(g, p[0] + 0.5, p[1] + 0.5, 2.1) || dist(g.x, g.z, p[0] + 0.5, p[1] + 0.5) < 0.6) {
              g.wp = (g.wp + 1) % R.length; g.pfad = null;
              if (this.rng() < 0.45) g.warte = 1 + this.rng() * 2.5;
            }
            break;
          }
        }
      }
    }
    wahrnehmen(g) {
      const t = this.zeit, weit = this.strom ? 14 : 8;
      const DTW = DT * 4;
      for (const sp of this.spieler.values()) {
        if (sp.zustand !== 'aktiv' || sp.fz || sp.e !== 0) { delete g.verdacht[sp.id]; continue; }
        const d = dist(g.x, g.z, sp.x, sp.z);
        const sieht = this.siehtPunkt(g, sp.x, sp.z, weit);
        if (g.zustand === 'jagd' && g.ziel === sp.id) {
          if (sieht) { g.lx = sp.x; g.lz = sp.z; g.nichtGesehen = 0; sp.gesuchtBis = Math.max(sp.gesuchtBis, t + 8); }
          else g.nichtGesehen += DTW;
          continue;
        }
        if (!sieht) { g.verdacht[sp.id] = Math.max(0, (g.verdacht[sp.id] || 0) - 0.3 * DTW); continue; }
        const rate = this.verdachtRate(g, sp, d);
        if (rate <= 0) { g.verdacht[sp.id] = Math.max(0, (g.verdacht[sp.id] || 0) - 0.3 * DTW); continue; }
        g.verdacht[sp.id] = (g.verdacht[sp.id] || 0) + rate * DTW;
        if (g.verdacht[sp.id] >= 1 && (g.zustand !== 'jagd' || dist(g.x, g.z, sp.x, sp.z) < dist(g.x, g.z, g.lx, g.lz) - 3)) {
          g.verdacht[sp.id] = 0;
          this.jagen(g, sp);
          if (this.alarm.stufe < 1) { this.alarm.stufe = 1; this.ev({ art:'alarm', stufe:1 }); }
          this.geaendert();
        }
      }
    }

    /* ---------- Mithäftlinge (Statisten) ---------- */
    insassenAufstellen() {
      const tiere = ['hund', 'katze', 'ziege', 'maus', 'otter', 'hund', 'katze'];
      for (let i = 0; i < 7; i++) {
        const p = KA.BUMMEL[Math.floor(this.rng() * KA.BUMMEL.length)];
        this.insassen.push({ x:p[0] + 0.5, z:p[1] + 0.5, r:this.rng() * 6, tier:tiere[i], pfad:null, pi:0, warte:this.rng() * 4, flieht:0, hp:60, ko:0, anim:0 });
      }
    }
    insassenTakt(dt) {
      const wer = { strom:this.strom };
      for (const n of this.insassen) {
        n.anim = 0;
        if (n.ko > this.zeit) { n.anim = 4; continue; }
        if (n.warte > 0 && n.flieht < this.zeit) { n.warte -= dt; continue; }
        if (!n.pfad) {
          const p = KA.BUMMEL[Math.floor(this.rng() * KA.BUMMEL.length)];
          n.pfad = pfad(this.K, wer, n.x, n.z, p[0] + 0.5, p[1] + 0.5, 4000); n.pi = 1;
          if (!n.pfad) { n.warte = 2; continue; }
        }
        const ziel = n.pfad[n.pi];
        if (!ziel) { n.pfad = null; n.warte = 2 + this.rng() * 6; continue; }
        const dx = ziel[0] - n.x, dz = ziel[1] - n.z, d = Math.hypot(dx, dz);
        if (d < 0.3) { n.pi++; continue; }
        const v = n.flieht > this.zeit ? 4 : 1.5;
        const s = Math.min(d, v * dt);
        bewegen(this.K, n, dx / d * s, dz / d * s, 0, wer, 0.28);
        n.r += winkelDiff(n.r, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
        n.anim = v > 3 ? 2 : 1;
      }
    }

    /* ---------- Für die Browser ---------- */
    zustand() {
      const K = this.K;
      return {
        v:this.version, t:r2(this.zeit), dauer:this.dauer, phase:this.phase, modus:this.modus,
        strom:this.strom, tore:this.toreOffen, alarm:this.alarm.stufe, ax:r2(this.alarm.x), az:r2(this.alarm.z),
        sp:[...this.spieler.values()].map(s => ({ id:s.id, name:s.name, tier:s.tier, team:s.team, hp:Math.max(0, Math.round(s.hp)), inv:s.inv, hand:s.hand,
          uni:s.uniform, z:s.zustand, bis:r2(s.bis), e:s.e, fz:s.fz, weg:s.abwesend, gesucht:s.gesuchtBis > this.zeit,
          akt:s.aktion ? { art:s.aktion.art, text:s.aktion.text, dauer:s.aktion.dauer, t:r2(s.aktion.t) } : null,
          frei:s.frei, gefasst:s.gefasst, tp:s.tp })),
        items:this.items.map(it => [it.id, it.art, r2(it.x), r2(it.z), it.e]),
        ae:K.aenderungen, tun:K.tunnelNeu,
        git:K.gitter.map(g => (g.offen ? 1 : 0)).join(''),
        seile:this.seile, bomben:this.bomben.map(b => [r2(b.x), r2(b.z), r2(b.rest)]),
        van:{ fahrer:this.van.fahrer, sitze:this.van.sitze, weg:this.van.weg },
        heli:{ sitze:this.heli.sitze, startBis:this.heli.startBis, weg:this.heli.weg },
        gen:this.gen.hp, ergebnis:this.ergebnis
      };
    }
    positionen() {
      return {
        t:r2(this.zeit),
        s:[...this.spieler.values()].filter(s => s.zustand !== 'frei').map(s => [s.id, r2(s.x), r2(s.z), r2(s.r), s.e, s.zustand === 'ko' ? 4 : s.aktion ? 5 : s.anim, s.tp]),
        w:this.waerter.map(g => [r2(g.x), r2(g.z), r2(g.r), g.anim, g.zustand === 'jagd' ? 2 : g.zustand === 'pruefen' ? 1 : 0, g.karte ? 1 : 0]),
        n:this.insassen.map(n => [r2(n.x), r2(n.z), r2(n.r), n.anim]),
        van:[r2(this.van.x), r2(this.van.z), r2(this.van.r), r2(this.van.v)]
      };
    }
  }

  return { TAKT, DT, MAX_SPIELER, TIERE, TIER_NAMEN, MODI, ITEMS, UNIKAT, TEMPO, RADIUS, VAN, LICHT_R,
    Spiel, frei, bewegen, vanSchritt, vanPunkte, scheinwerfer, moeglich, pfad, hat };
});
