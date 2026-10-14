'use strict';
// Knastknacker – Regeltests: jeder Ausbruchsweg einmal durchgespielt, Wärter, Karte.
const test = require('node:test');
const assert = require('node:assert');
const KA = require('../js/karte.js');
const L = require('../js/logik.js');

const lauf = (S, sek) => { for (let i = 0; i < sek * L.TAKT; i++) S.takt(); };
// Eine Aktion starten und laufen lassen, bis sie fertig ist
function mach(S, sp, art, max = 15) {
  const m = L.moeglich(S, sp);
  assert.ok(m && m.art === art, `erwartet ${art}, möglich ist ${m ? m.art + ' (' + m.text + ')' : 'nichts'}`);
  S.aktion(sp.id, { a:'start', art });
  for (let i = 0; i < max * L.TAKT && sp.aktion; i++) S.takt();
  assert.ok(!sp.aktion, art + ' wurde nicht fertig');
}
// Im Browser würde der Spieler laufen; hier in kleinen gültigen Schritten
function gehZu(S, sp, x, z) {
  for (let i = 0; i < 400; i++) {
    const d = Math.hypot(x - sp.x, z - sp.z);
    if (d < 0.05) return;
    const s = Math.min(d, 0.15);
    const p = { x:sp.x, z:sp.z };
    L.bewegen(S.K, p, (x - sp.x) / d * s, (z - sp.z) / d * s, sp.e, S.werVon(sp));
    S.position(sp.id, { x:p.x, z:p.z, r:sp.r, tp:sp.tp });
    S.takt();
    if (Math.hypot(p.x - sp.x, p.z - sp.z) > 0.01) return;   // abgelehnt
  }
}
const setze = (sp, x, z, e = 0) => { sp.x = x; sp.z = z; sp.e = e; };

test('Karte: Wärterrouten und Bummelziele sind erreichbar', () => {
  const K = KA.neu();
  const wer = { waerter:true, strom:true };
  for (const R of KA.ROUTEN) for (let i = 1; i < R.length; i++) {
    const p = L.pfad(K, wer, R[i - 1][0] + 0.5, R[i - 1][1] + 0.5, R[i][0] + 0.5, R[i][1] + 0.5, 20000);
    assert.ok(p, `Route ${R[i - 1]} → ${R[i]} unerreichbar`);
  }
  for (const b of KA.BUMMEL) assert.ok(L.pfad(K, { strom:true }, 44.5, 40.5, b[0] + 0.5, b[1] + 0.5, 20000), 'Bummelziel ' + b);
  // Aus jeder Zelle kommt man ohne Karte in den Hof, aber nicht in die Wachstube
  for (const z of KA.OBJ.zellen) {
    assert.ok(L.pfad(K, { strom:true }, z.x, z.z, 44.5, 40.5, 20000), 'Zelle ' + z.x);
    assert.ok(!L.pfad(K, { strom:true }, z.x, z.z, 24.5, 42.5, 20000), 'Wachstube ohne Karte erreichbar');
  }
  assert.ok(L.pfad(K, { blau:true, strom:true }, 15.5, 16.2, 24.5, 42.5, 20000), 'Wachstube mit Karte');
});

test('Tunnel: mit dem Löffel aus der Zelle unter Mauer und Zaun durch', () => {
  const S = new L.Spiel({ seed:1, ohneWache:true });
  const sp = S.spielerHinzu('a', 'Ana', 'fuchs');
  sp.inv[0] = 'loeffel';
  setze(sp, 15.5, 16.5); sp.r = Math.PI;      // Blick nach Norden
  mach(S, sp, 'loch');
  assert.strictEqual(sp.e, 1);
  assert.strictEqual(S.K.code(15, 16), 'O');
  while (!S.K.draussen(sp.x, sp.z)) {
    mach(S, sp, 'graben');
    gehZu(S, sp, sp.x, sp.z - 1);
  }
  mach(S, sp, 'tunnel_hoch');
  lauf(S, 0.2);
  assert.strictEqual(sp.zustand, 'frei');
  assert.deepStrictEqual(sp.frei.wege, ['Tunnel']);
});

test('Sprengstoff: bauen, Außenmauer aus der Zelle sprengen, Strom weg, Zaun schneiden', () => {
  const S = new L.Spiel({ seed:2, ohneWache:true });
  const sp = S.spielerHinzu('a', 'Ben', 'baer');
  sp.inv = ['duenger', 'reiniger', null, null]; sp.hand = 2;
  setze(sp, 72.5, 54.6);
  mach(S, sp, 'bauen');
  assert.ok(sp.inv.includes('sprengstoff'));
  sp.hand = sp.inv.indexOf('sprengstoff');
  setze(sp, 20.5, 13.6); sp.r = Math.PI;     // Zelle Nordreihe, vor der Außenmauer
  mach(S, sp, 'sprengen');
  lauf(S, 6);
  assert.strictEqual(S.K.code(20, 12), 'L', 'Mauer sollte ein Loch haben');
  assert.strictEqual(S.alarm.stufe, 2);
  // durch das Loch in den Todesstreifen
  sp.hp = 100; sp.zustand = 'aktiv';
  gehZu(S, sp, 20.5, 10.5);
  assert.ok(sp.z < 11, 'durchs Loch gekommen');
  // Generator mit dem Hammer
  sp.inv = ['hammer', 'drahtschere', null, null]; sp.hand = 0;
  setze(sp, 39.5, 63.8); sp.r = 0;
  mach(S, sp, 'generator');
  assert.strictEqual(S.strom, false);
  sp.hand = 1;
  setze(sp, 20.5, 7.6); sp.r = Math.PI;
  mach(S, sp, 'zaun');
  assert.strictEqual(S.K.code(20, 6), 'l');
  gehZu(S, sp, 20.5, 4);
  lauf(S, 0.1);
  assert.strictEqual(sp.zustand, 'frei');
  assert.deepStrictEqual(sp.frei.wege, ['Sprengloch', 'Zaun']);
});

test('Elektrozaun schockt, solange Strom da ist', () => {
  const S = new L.Spiel({ seed:3, ohneWache:true });
  const sp = S.spielerHinzu('a', 'Cem', 'hase');
  sp.inv[0] = 'drahtschere';
  setze(sp, 30.5, 7.6); sp.r = Math.PI;
  S.aktion('a', { a:'start', art:'zaun' });
  assert.ok(sp.hp < 100);
  assert.ok(!sp.aktion);
  assert.strictEqual(S.K.code(30, 6), 'Z');
});

test('Van: Schlüssel, durch Rolltor und Haupttor rammen, raus', () => {
  const S = new L.Spiel({ seed:4, ohneWache:true });
  const a = S.spielerHinzu('a', 'Dora', 'panda'), b = S.spielerHinzu('b', 'Emil', 'affe');
  a.inv[0] = 'vanschluessel';
  setze(a, 76, 64.2); setze(b, 77, 64.2);
  mach(S, a, 'van_rein'); mach(S, b, 'van_rein');
  assert.strictEqual(S.van.fahrer, 'a');
  assert.strictEqual(S.van.sitze.length, 2);
  // Fahrer fährt (wie im Browser) und meldet die Position
  const f = { x:S.van.x, z:S.van.z, r:S.van.r, v:0 };
  const fahre = (gas, lenk, schritte) => {
    for (let i = 0; i < schritte; i++) {
      L.vanSchritt(S.K, f, gas, lenk, L.DT, { fahrzeug:true, toreOffen:S.toreOffen });
      S.fahrzeug('a', f); S.takt();
    }
  };
  fahre(1, 0, 60);                       // nach Westen durchs Rolltor
  assert.strictEqual(S.K.code(62, 66), 'L', 'Rolltor gerammt');
  // Wie ein Fahrer: Kurs auf Wegpunkte (Vorplatz, vor dem Tor, durchs Tor, raus)
  for (const [tx, tz, gas] of [[56, 66, 0.5], [50, 64, 0.4], [49.5, 69, 0.6], [49.5, 82, 1]]) {
    for (let i = 0; i < 400 && Math.hypot(tx - f.x, tz - f.z) > 1.2 && !S.van.weg; i++) {
      const soll = Math.atan2(tx - f.x, tz - f.z);
      let d = (soll - f.r) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      fahre(Math.abs(d) > 0.6 && f.v > 3 ? 0 : gas, Math.max(-1, Math.min(1, -d * 3)), 1);
    }
  }
  assert.ok(S.van.weg, 'Van ist weg: ' + JSON.stringify(f));
  assert.strictEqual(a.zustand, 'frei'); assert.strictEqual(b.zustand, 'frei');
  assert.ok(a.frei.wege.includes('Van'));
});

test('Heli: Schlüssel, Dach, abheben – Mitflieger kommen mit', () => {
  const S = new L.Spiel({ seed:5, ohneWache:true });
  const a = S.spielerHinzu('a', 'Fritzi', 'loewe'), b = S.spielerHinzu('b', 'Gus', 'pinguin');
  a.inv[0] = 'helischluessel';
  setze(a, 55.5, 15.9);
  mach(S, a, 'treppe_hoch', 3);         // ohne Karte? Treppenhaus erreicht man nur mit Karte, hier gesetzt
  assert.strictEqual(a.e, 3);
  setze(a, 30.5, 25.5, 3); setze(b, 31.5, 25.5, 3);
  mach(S, a, 'heli_start');
  mach(S, b, 'heli_rein');
  lauf(S, 8);
  assert.strictEqual(a.zustand, 'frei'); assert.strictEqual(b.zustand, 'frei');
  assert.ok(S.heli.weg);
});

test('Lüftung + Seil: Gitter, Kriechgang, Luke, abseilen', () => {
  const S = new L.Spiel({ seed:6, ohneWache:true });
  const sp = S.spielerHinzu('a', 'Hanna', 'waschbaer');
  sp.inv = ['schraubenzieher', 'laken', 'laken', null];
  setze(sp, 20.5, 15.8);
  mach(S, sp, 'gitter_auf');
  mach(S, sp, 'gitter_rein');
  assert.strictEqual(sp.e, 2);
  gehZu(S, sp, 20.5, 22.5); gehZu(S, sp, 56.5, 22.5);
  mach(S, sp, 'luke_hoch');
  assert.strictEqual(sp.e, 3);
  sp.hand = 1;
  mach(S, sp, 'knoten');
  assert.ok(sp.inv.includes('seil'));
  gehZu(S, sp, 22.5, 14);
  gehZu(S, sp, 22.5, 13.4);
  mach(S, sp, 'seil_fest');
  mach(S, sp, 'abseilen');
  assert.strictEqual(sp.e, 0);
  assert.strictEqual(S.K.zoneBei(sp.x, sp.z).id, 'streifen');
});

test('Wärter: erwischt einen Häftling in der Wachstube und steckt ihn in Einzelhaft', () => {
  const S = new L.Spiel({ seed:7 });
  const sp = S.spielerHinzu('a', 'Ida', 'hase');
  S.takt();
  const g = S.waerter[5];
  sp.inv[0] = 'keyblau';
  setze(sp, g.x + 1.5, g.z + 0.2);
  g.r = Math.atan2(sp.x - g.x, sp.z - g.z);
  lauf(S, 6);
  assert.ok(sp.zustand === 'iso' || sp.gefasst > 0, 'gefasst: ' + sp.zustand + ' hp ' + sp.hp);
  assert.ok(!sp.inv.includes('keyblau'), 'Karte beschlagnahmt');
  lauf(S, 21);
  assert.strictEqual(sp.zustand, 'aktiv');
  assert.strictEqual(S.K.zoneBei(sp.x, sp.z).id, 'zellen');
});

test('Wärter umhauen: Oberwärter verliert die blaue Karte', () => {
  const S = new L.Spiel({ seed:8 });
  const sp = S.spielerHinzu('a', 'Jo', 'baer');
  S.takt();
  const g = S.waerter.find(w => w.karte);
  sp.inv[0] = 'hammer';
  for (let i = 0; i < 6 && g.zustand !== 'ko'; i++) {
    setze(sp, g.x, g.z - 0.9); sp.r = 0; sp.zustand = 'aktiv'; sp.hp = 100;
    S.aktion('a', { a:'schlag' }); lauf(S, 0.5);
  }
  assert.strictEqual(g.zustand, 'ko');
  assert.ok(S.items.some(it => it.art === 'keyblau' && Math.hypot(it.x - g.x, it.z - g.z) < 1.5));
});

test('Gegenstände wachsen nach, Einzelstücke nur einmal', () => {
  const S = new L.Spiel({ seed:9, ohneWache:true });
  const sp = S.spielerHinzu('a', 'Kai', 'affe');
  const rot = S.items.find(it => it.art === 'keyrot');
  setze(sp, rot.x, rot.z + 0.5);
  S.aktion('a', { a:'start', art:'nehmen' });
  assert.ok(sp.inv.includes('keyrot'));
  lauf(S, L.UNIKAT.size ? 50 : 0);
  assert.strictEqual(S.items.filter(it => it.art === 'keyrot').length, 0, 'keine zweite rote Karte');
  const l = S.items.find(it => it.art === 'loeffel');
  setze(sp, l.x, l.z + 0.5);
  S.aktion('a', { a:'start', art:'nehmen' });
  lauf(S, 50);
  assert.strictEqual(S.items.filter(it => it.art === 'loeffel').length, 4);
});

test('Ende: Zeit um, Rangliste', () => {
  const S = new L.Spiel({ seed:10, dauer:600, ohneWache:true });
  S.spielerHinzu('a', 'Lu', 'hase');
  lauf(S, 601);
  assert.strictEqual(S.phase, 'ende');
  assert.strictEqual(S.ergebnis.length, 1);
});

test('Tipp: führt vom leeren Inventar bis zum Schlüssel', () => {
  const items = [[1, 'loeffel', 80.5, 14, 0], [2, 'schaufel', 35.5, 57.3, 0]];
  const sp = { x:81, z:15, inv:[] };
  const t0 = L.tipp(items, sp, true);
  assert.match(t0.text, /Löffel/); assert.strictEqual(t0.x, 80.5);
  assert.match(L.tipp(items, { ...sp, inv:['loeffel'] }, true).text, /grab/);
  assert.match(L.tipp(items, { ...sp, inv:['laken', 'laken'] }, true).text, /Lakenseil/);
  assert.match(L.tipp(items, { ...sp, inv:['seil'] }, true).text, /Haken/);
  assert.deepStrictEqual([L.tipp(items, { ...sp, inv:['duenger', 'reiniger'] }, true).x, L.tipp(items, { ...sp, inv:['duenger', 'reiniger'] }, true).z], [KA.OBJ.werkbank.x, KA.OBJ.werkbank.z]);
  assert.match(L.tipp(items, { ...sp, inv:['drahtschere'] }, false).text, /stromlos/);
  assert.match(L.tipp(items, { ...sp, inv:['helischluessel'] }, true).text, /Heli/);
  assert.ok(L.tipp([], { x:0, z:0, inv:[] }, true).text);
});

test('Schwierigkeit: Wärter werden je Stufe schneller oder langsamer misstrauisch', () => {
  const rate = stufe => {
    const S = new L.Spiel({ seed:3, ohneWache:true, schwer:stufe });
    const sp = S.spielerHinzu('a', 'Ana', 'fuchs'); setze(sp, 50, 8);   // im Todesstreifen
    return S.verdachtRate({}, sp, 10);
  };
  assert.ok(rate('leicht') < rate('normal') && rate('normal') < rate('schwer'));
  assert.strictEqual(new L.Spiel({ schwer:'quatsch' }).stufe, 'normal');
});
