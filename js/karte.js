/* Knastknacker – die Gefängniskarte. Ein Raster aus 1-m-Zellen (x nach Osten, z nach Süden), vier Ebenen:
   0 Boden, 1 Tunnel (wird gegraben), 2 Lüftung (Kriechgänge unter der Decke), 3 Dach des Zellenblocks.
   Läuft im Browser (window.KK_KARTE) und in Node (require). Keine Abhängigkeiten. */
(function (wurzel, fabrik) {
  if (typeof module === 'object' && module.exports) module.exports = fabrik();
  else wurzel.KK_KARTE = fabrik();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const W = 100, H = 84;

  /* Bodencodes (ein Zeichen je Zelle)
     ,  Gras draußen        _  Kies im Todesstreifen   =  Straße          :  Hof-Erde        .  Betonboden innen
     #  Gebäudewand         M  Außenmauer (5 m)        Z  Elektrozaun     T  Tor (Mauer/Zaun) G  Rolltor der Garage
     D  Tür                 B  Tür blau (Karte blau)   R  Tür rot (Karte rot)
     x  Möbel/Hindernis     S  Treppe zum Dach         O  Loch im Boden   L  Sprengloch      l  aufgeschnittener Zaun */
  const C = s => s.charCodeAt(0);
  const BEGEHBAR = new Set([',', '_', '=', ':', '.', 'D', 'S', 'O', 'L', 'l'].map(C));
  const SICHT_ZU = new Set(['#', 'M', 'G'].map(C));
  const GRABBAR = new Set([',', '_', '=', ':', '.'].map(C));
  const SPRENGBAR = new Set(['M', 'Z', 'T', '#', 'G', 'B', 'R'].map(C));
  const FAHRBAR = new Set([',', '_', '=', ':', '.', 'L', 'l', 'O'].map(C));

  const ZONEN = [
    { id:'frei', name:'Freiheit', verboten:false },
    { id:'streifen', name:'Todesstreifen', verboten:true },
    { id:'hof', name:'Hof', verboten:false },
    { id:'zellen', name:'Zellenblock', verboten:false },
    { id:'treppe', name:'Treppenhaus', verboten:true },
    { id:'duschen', name:'Duschen', verboten:false },
    { id:'kantine', name:'Kantine', verboten:false },
    { id:'kueche', name:'Küche', verboten:false },
    { id:'waescherei', name:'Wäscherei', verboten:false },
    { id:'werkstatt', name:'Werkstatt', verboten:false },
    { id:'garage', name:'Garage', verboten:true },
    { id:'generator', name:'Generatorhaus', verboten:true },
    { id:'wachstube', name:'Wachstube', verboten:true },
    { id:'flur', name:'Verwaltung', verboten:true },
    { id:'direktor', name:'Direktorbüro', verboten:true },
    { id:'iso', name:'Einzelhaft', verboten:true },
    { id:'schuppen', name:'Gartenschuppen', verboten:false },
    { id:'tor', name:'Torbereich', verboten:true },
    { id:'dach', name:'Dach', verboten:true },
    { id:'tunnel', name:'Tunnel', verboten:true },
    { id:'lueftung', name:'Lüftung', verboten:true }
  ];
  const ZI = {}; ZONEN.forEach((z, i) => { ZI[z.id] = i; });

  // Feste Grenzen: Zaunring, Außenmauer
  const ZAUN = { x0:6, z0:6, x1:93, z1:77 };
  const MAUER = { x0:12, z0:12, x1:87, z1:71 };
  const TOR_X = [47, 52];

  /* ---------- Bauplan (wird einmal berechnet) ---------- */
  function bauplan() {
    const b = new Uint8Array(W * H).fill(C(','));
    const zone = new Uint8Array(W * H).fill(ZI.frei);
    const set = (x, z, c) => { if (x >= 0 && z >= 0 && x < W && z < H) b[z * W + x] = C(c); };
    const get = (x, z) => String.fromCharCode(b[z * W + x]);
    const rect = (x0, z0, x1, z1, c) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, c); };
    const zrect = (x0, z0, x1, z1, id) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) zone[z * W + x] = ZI[id]; };
    const rahmen = (x0, z0, x1, z1, c) => { for (let x = x0; x <= x1; x++) { set(x, z0, c); set(x, z1, c); } for (let z = z0; z <= z1; z++) { set(x0, z, c); set(x1, z, c); } };
    // Gebäudewand, ohne die Außenmauer zu überschreiben
    const wand = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (get(x, z) !== 'M') set(x, z, '#'); };
    const gebaeude = (x0, z0, x1, z1, zid) => { rect(x0 + 1, z0 + 1, x1 - 1, z1 - 1, '.'); wand(x0, z0, x1, z0); wand(x0, z1, x1, z1); wand(x0, z0, x0, z1); wand(x1, z0, x1, z1); if (zid) zrect(x0, z0, x1, z1, zid); };

    // Außenbereich: Straße nach Süden
    rect(46, 72, 53, H - 1, '=');
    // Todesstreifen und Zaun
    rect(ZAUN.x0, ZAUN.z0, ZAUN.x1, ZAUN.z1, '_');
    zrect(ZAUN.x0, ZAUN.z0, ZAUN.x1, ZAUN.z1, 'streifen');
    rahmen(ZAUN.x0, ZAUN.z0, ZAUN.x1, ZAUN.z1, 'Z');
    rect(46, 72, 53, 76, '=');
    for (let x = TOR_X[0]; x <= TOR_X[1]; x++) set(x, ZAUN.z1, 'T');
    // Wachtürme in den Ecken des Streifens
    rect(8, 8, 9, 9, 'x'); rect(90, 8, 91, 9, 'x'); rect(8, 74, 9, 75, 'x'); rect(90, 74, 91, 75, 'x');
    // Außenmauer und Innenhof
    rect(MAUER.x0, MAUER.z0, MAUER.x1, MAUER.z1, ':');
    zrect(MAUER.x0, MAUER.z0, MAUER.x1, MAUER.z1, 'hof');
    rahmen(MAUER.x0, MAUER.z0, MAUER.x1, MAUER.z1, 'M');
    for (let x = TOR_X[0]; x <= TOR_X[1]; x++) set(x, MAUER.z1, 'T');
    // Zufahrt vom Tor in den Hof, Vorplatz der Garage
    rect(46, 47, 53, 70, '.'); rect(54, 61, 61, 69, '.');
    zrect(44, 64, 55, 70, 'tor');
    // Wege
    rect(29, 33, 32, 46, '.'); rect(33, 46, 45, 47, '.'); rect(54, 33, 59, 34, '.'); rect(66, 31, 67, 32, '.');

    /* Zellenblock (Nordwand = Außenmauer) */
    gebaeude(12, 12, 58, 32, 'zellen');
    for (let k = 0; k < 8; k++) {
      const x0 = 13 + 5 * k;
      wand(x0 + 4, 13, x0 + 4, 18);      // Trennwand Nordreihe
      wand(x0 + 4, 26, x0 + 4, 31);      // Trennwand Südreihe
      set(x0, 13, 'x'); set(x0, 14, 'x'); set(x0 + 3, 13, 'x');   // Pritsche + Klo
      set(x0, 31, 'x'); set(x0, 30, 'x'); set(x0 + 3, 31, 'x');
    }
    wand(13, 18, 57, 18); wand(13, 26, 57, 26);
    for (let k = 0; k < 8; k++) { set(15 + 5 * k, 18, 'D'); set(15 + 5 * k, 26, 'D'); }
    // Treppenhaus (Nordost) und Duschen (Südost)
    zrect(53, 13, 57, 17, 'treppe'); set(55, 18, 'B'); set(55, 14, 'S'); set(56, 14, 'S');
    zrect(53, 27, 57, 31, 'duschen'); set(55, 26, 'D');
    // Ausgänge
    set(30, 32, 'D'); set(31, 32, 'D'); set(58, 22, 'D');

    /* Kantine + Küche (Nordost) */
    gebaeude(58, 12, 87, 30, 'kantine');
    wand(77, 13, 77, 29); set(77, 20, 'D'); zrect(78, 13, 86, 29, 'kueche');
    set(58, 22, 'D'); set(66, 30, 'D'); set(67, 30, 'D');
    for (const tz of [15, 19, 26]) for (const tx of [61, 67, 72]) rect(tx, tz, tx + 2, tz, 'x');
    rect(79, 13, 85, 13, 'x'); rect(85, 16, 86, 18, 'x'); rect(80, 25, 83, 25, 'x');

    /* Wäscherei */
    gebaeude(60, 33, 87, 44, 'waescherei'); set(60, 38, 'D');
    for (let x = 64; x <= 84; x += 3) rect(x, 34, x + 1, 34, 'x');
    rect(66, 40, 80, 40, 'x');

    /* Werkstatt */
    gebaeude(60, 47, 87, 58, 'werkstatt'); set(60, 52, 'D');
    rect(63, 48, 85, 48, 'x'); rect(70, 52, 73, 53, 'x'); rect(78, 55, 82, 56, 'x');

    /* Garage mit Rolltor nach Westen */
    gebaeude(62, 61, 87, 71, 'garage');
    for (let z = 63; z <= 68; z++) set(62, z, 'G');
    set(74, 61, 'B');
    rect(82, 63, 85, 64, 'x');

    /* Generatorhaus */
    gebaeude(34, 62, 44, 70, 'generator'); set(39, 62, 'B');
    rect(37, 65, 41, 67, 'x');

    /* Verwaltung: Wachstube, Flur, Direktorbüro, Einzelhaft */
    gebaeude(12, 35, 33, 60, 'flur');
    zrect(13, 36, 32, 46, 'wachstube');
    wand(13, 47, 32, 47); set(27, 47, 'D');
    set(33, 41, 'B');          // Tür zum Hof
    set(12, 41, 'B');          // Personaltür in der Außenmauer zum Todesstreifen
    wand(21, 48, 21, 59); set(21, 53, 'R'); zrect(13, 48, 20, 59, 'direktor');
    wand(26, 48, 26, 59); wand(27, 53, 32, 53); set(26, 50, 'D'); set(26, 56, 'D'); zrect(27, 48, 32, 52, 'iso'); zrect(27, 54, 32, 59, 'iso');
    rect(16, 39, 19, 40, 'x'); rect(14, 36, 20, 36, 'x'); rect(23, 44, 25, 45, 'x');
    rect(15, 55, 17, 56, 'x');

    /* Hof: Basketball, Bänke, Hanteln, Gartenschuppen */
    rect(36, 36, 46, 45, '.'); set(41, 36, 'x'); set(41, 45, 'x');
    rect(25, 34, 27, 34, 'x'); rect(34, 33, 36, 33, 'x'); rect(55, 36, 57, 37, 'x');
    gebaeude(34, 54, 38, 58, 'schuppen'); set(36, 54, 'D');
    rect(40, 50, 43, 51, 'x'); rect(40, 54, 43, 55, 'x');

    return { b, zone };
  }

  /* ---------- Lüftung ---------- */
  function lueftungsplan() {
    const l = new Uint8Array(W * H);
    const lin = (x0, z0, x1, z1) => { for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) l[z * W + x] = 1; };
    lin(14, 22, 80, 22);                       // Hauptschacht über dem Gang bis in die Küche
    for (const x of [20, 35, 45]) lin(x, 15, x, 21);    // in Nordzellen
    for (const x of [25, 40]) lin(x, 23, x, 29);        // in Südzellen
    lin(16, 23, 16, 52);                       // langer Schacht zur Verwaltung
    return l;
  }
  // Gitter: Verbindung Boden ↔ Lüftung (Position im Boden-Raster)
  const GITTER = [
    { x:20, z:15, ort:'Zelle' }, { x:35, z:15, ort:'Zelle' }, { x:45, z:15, ort:'Zelle' },
    { x:25, z:29, ort:'Zelle' }, { x:40, z:29, ort:'Zelle' },
    { x:14, z:22, ort:'Gang' }, { x:80, z:22, ort:'Küche' },
    { x:16, z:44, ort:'Wachstube' }, { x:16, z:52, ort:'Direktorbüro' }
  ];
  const LUKE = { x:56, z:22 };               // Lüftung → Dach

  /* ---------- Dach ---------- */
  function dachplan() {
    const d = new Uint8Array(W * H);
    for (let z = 13; z <= 31; z++) for (let x = 13; x <= 57; x++) d[z * W + x] = 1;
    const zu = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) d[z * W + x] = 0; };
    zu(53, 13, 57, 17);                        // Treppenhaus-Aufbau
    zu(40, 15, 41, 16); zu(45, 28, 46, 29); zu(20, 28, 21, 29);   // Klimageräte
    return d;
  }

  /* ---------- Feste Objekte ---------- */
  const OBJ = {
    werkbank:{ x:72, z:53 },
    generator:{ x:39.5, z:66.5 },
    torschalter:{ x:30.5, z:36.4 },
    treppeUnten:{ x:55.5, z:15.8 },
    treppeOben:{ x:55.5, z:18.8 },
    luke:{ x:LUKE.x + 0.5, z:LUKE.z + 0.5 },
    heli:{ x:30.5, z:22.5 },
    van:{ x:76, z:66.5, r:-Math.PI / 2 },
    haken:[
      { x:22.5, z:13.4, unten:{ x:22.5, z:10.3 }, richtung:Math.PI },
      { x:13.4, z:25.5, unten:{ x:10.3, z:25.5 }, richtung:-Math.PI / 2 }
    ],
    tuerme:[{ x:9, z:9 }, { x:91, z:9 }, { x:9, z:75 }, { x:91, z:75 }],
    iso:[{ x:29.5, z:50.5 }, { x:29.5, z:56.5 }],
    // Heimatzellen: Nordreihe, dann Südreihe
    zellen:[...Array.from({ length:8 }, (_, k) => ({ x:15.5 + 5 * k, z:16.2, r:0 })), ...Array.from({ length:8 }, (_, k) => ({ x:15.5 + 5 * k, z:28, r:Math.PI }))]
  };

  // Gegenstände: wo sie anfangs liegen und nachwachsen
  const SPAWNS = [
    ['loeffel', 80.5, 14.0], ['loeffel', 83.5, 14.0], ['loeffel', 62.5, 16.0], ['loeffel', 73.5, 20.0],
    ['schaufel', 66.5, 49.3], ['schaufel', 35.5, 57.3],
    ['schraubenzieher', 75.5, 49.3], ['schraubenzieher', 84.5, 49.3], ['schraubenzieher', 81, 57.4],
    ['drahtschere', 79.5, 49.3], ['drahtschere', 70.5, 54.3],
    ['hammer', 72.5, 51.7], ['hammer', 86, 26.5],
    ['laken', 67.5, 41.3], ['laken', 71.5, 41.3], ['laken', 75.5, 41.3], ['laken', 79, 39.6], ['laken', 14.1, 15.2], ['laken', 49.1, 29.8],
    ['uniform', 83.5, 41.5], ['uniform', 86, 37.5],
    ['reiniger', 84.5, 35.6], ['reiniger', 86, 23.5],
    ['duenger', 36.5, 56.2], ['duenger', 42, 52.6],
    ['keyblau', 18, 41.3],
    ['keyrot', 15.5, 37.4],
    ['vanschluessel', 24.5, 43.4],
    ['helischluessel', 16, 57.3]
  ].map(([art, x, z]) => ({ art, x, z }));

  // Streifen der Wärter (Wegpunkte, Pfade dazwischen per A*)
  const ROUTEN = [
    [[15, 22], [56, 22], [55, 29], [15, 22]],                              // Zellenblock
    [[35, 36], [57, 36], [57, 58], [45, 59], [33, 50]],                    // Hof (Oberwärter mit blauer Karte)
    [[60, 14], [75, 16], [75, 28], [82, 21], [60, 28]],                    // Kantine/Küche
    [[62, 38], [84, 37], [62, 38], [57, 45], [62, 52], [84, 51], [62, 52], [57, 45]],   // Wäscherei/Werkstatt
    [[50, 66], [58, 65], [70, 66], [58, 65], [39, 61], [50, 60]],          // Tor, Garage, Generator
    [[24, 42], [30, 38], [24, 56], [17, 50], [24, 42]],                    // Wachstube/Verwaltung
    [[10, 41], [10, 10], [89, 10], [89, 73], [10, 73], [10, 41]],          // Todesstreifen (über die Personaltür)
    [[20, 22], [50, 22], [44, 37], [36, 55], [20, 22]],                    // Zusatz: Zellenblock + Hof
    [[65, 21], [62, 38], [58, 52], [52, 64], [65, 21]]                     // Zusatz: Ostseite
  ];
  // Spazierziele der Mithäftlinge
  const BUMMEL = [[35, 42], [40, 40], [50, 38], [44, 52], [52, 55], [26, 22], [44, 22], [65, 22], [70, 18], [35, 34], [57, 44], [48, 50]];

  const PLAN = bauplan();
  const LUEFT = lueftungsplan();
  const DACH = dachplan();

  /* ---------- Eine veränderliche Karte für ein Spiel ---------- */
  function neu() {
    const boden = PLAN.b.slice();
    const k = {
      W, H, boden, zone:PLAN.zone, lueft:LUEFT, dach:DACH,
      tunnel:new Uint8Array(W * H),
      gitter:GITTER.map(g => ({ ...g, offen:false })),
      aenderungen:[], tunnelNeu:[],
      idx:(x, z) => z * W + x,
      drin:(x, z) => x >= 0 && z >= 0 && x < W && z < H,
      code(x, z) { return this.drin(x, z) ? String.fromCharCode(boden[z * W + x]) : 'M'; },
      setze(x, z, c) { if (!this.drin(x, z)) return; const i = z * W + x; if (boden[i] === C(c)) return; boden[i] = C(c); this.aenderungen.push([i, c]); },
      graben(x, z) { if (!this.drin(x, z)) return; const i = z * W + x; if (this.tunnel[i]) return; this.tunnel[i] = 1; this.tunnelNeu.push(i); },
      ursprung(x, z) { return String.fromCharCode(PLAN.b[z * W + x]); },
      zoneBei(x, z) { const xi = Math.floor(x), zi = Math.floor(z); if (!this.drin(xi, zi)) return ZONEN[ZI.frei]; return ZONEN[this.zone[zi * W + xi]]; },
      draussen:(x, z) => x < ZAUN.x0 || x >= ZAUN.x1 + 1 || z < ZAUN.z0 || z >= ZAUN.z1 + 1,
      /* Begehbarkeit einer Zelle auf einer Ebene. wer: { waerter, blau, rot, strom, toreOffen, fahrzeug } */
      begehbar(e, x, z, wer) {
        if (!this.drin(x, z)) return false;
        const i = z * W + x;
        if (e === 1) return this.tunnel[i] === 1;
        if (e === 2) return LUEFT[i] === 1;
        if (e === 3) return DACH[i] === 1;
        const c = boden[i];
        if (wer && wer.fahrzeug) return FAHRBAR.has(c) || ((c === 84 || c === 71) && wer.toreOffen);
        if (BEGEHBAR.has(c)) return true;
        if (c === 66) return !!(wer && (wer.waerter || wer.blau || wer.rot || !wer.strom));            // B
        if (c === 82) return !!(wer && (wer.waerter || wer.rot || !wer.strom));                        // R
        if (c === 84) return !!(wer && wer.toreOffen);                                                 // T
        if (c === 71) return !!(wer && (wer.waerter || wer.blau || wer.rot || !wer.strom));            // G
        return false;
      },
      sichtFrei(x0, z0, x1, z1) {
        const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.3);
        for (let s = 1; s < n; s++) {
          const x = Math.floor(x0 + dx * s / n), z = Math.floor(z0 + dz * s / n);
          if (SICHT_ZU.has(boden[z * W + x])) return false;
        }
        return true;
      }
    };
    return k;
  }

  // Textbild der Karte (für Tests und Fehlersuche)
  function text(k, e = 0) {
    const zeilen = [];
    for (let z = 0; z < H; z++) {
      let s = '';
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        if (e === 0) s += String.fromCharCode(k.boden[i]);
        else if (e === 1) s += k.tunnel[i] ? 'o' : ' ';
        else if (e === 2) s += LUEFT[i] ? 'v' : ' ';
        else s += DACH[i] ? 'd' : ' ';
      }
      zeilen.push(s);
    }
    return zeilen.join('\n');
  }

  return { W, H, C, ZONEN, ZI, ZAUN, MAUER, TOR_X, GITTER, LUKE, OBJ, SPAWNS, ROUTEN, BUMMEL,
    BEGEHBAR, GRABBAR, SPRENGBAR, FAHRBAR, SICHT_ZU, neu, text };
});
