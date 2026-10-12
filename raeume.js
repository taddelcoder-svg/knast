'use strict';
/* Knastknacker – Räume auf dem Server. Bis zu 10 Leute brechen zusammen (oder gegeneinander) aus. Der Server rechnet
   die Runde (js/logik.js), die Browser schicken Position und Aktionen und bekommen Zustand, Positionen und Ereignisse.
   Ohne WebSocket testbar: verbinden(transport) liefert nachricht/getrennt, takt() rechnet einen Schritt. */
const crypto = require('crypto');
const L = require('./js/logik.js');

const MAX_RAEUME = 40;
const WEG_MS = 90_000;            // so lange bleibt ein getrennter Spieler im Lauf
const LEER_MS = 10 * 60_000;      // Raum ohne Verbindung wird danach aufgeräumt
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const nameOk = n => String(n || '').replace(/[\u0000-\u001f\u007f<>&"]/g, '').trim().slice(0, 16) || 'Gast';
const tierOk = t => L.TIERE.includes(t) ? t : 'loewe';
const einstOk = e => { e = e || {}; return { modus:L.MODI.includes(e.modus) ? e.modus : 'jeder', dauer:[600, 900, 1200].includes(e.dauer) ? e.dauer : 900 }; };

function raeume({ jetzt = () => Date.now(), seed = () => crypto.randomBytes(4).readUInt32LE(0), zeiten = {} } = {}) {
  const Z = { weg:WEG_MS, leer:LEER_MS, ...zeiten };
  const liste = new Map();
  let naechsteId = 1;
  const code = () => { let c; do { c = Array.from({ length:4 }, () => CODE_ZEICHEN[crypto.randomInt(CODE_ZEICHEN.length)]).join(''); } while (liste.has(c)); return c; };
  const senden = (m, d) => { if (!m.transport) return; try { m.transport.send(typeof d === 'string' ? d : JSON.stringify(d)); } catch (_) { /* zu */ } };
  const mitglieder = raum => [...raum.mitglieder.values()];
  const online = raum => mitglieder(raum).filter(m => m.transport);

  function raumFuer(raum, m) {
    return { t:'raum', code:raum.code, host:raum.host, phase:raum.phase, du:m.id, einst:raum.einst,
      mitglieder:mitglieder(raum).map(x => ({ id:x.id, name:x.name, tier:x.tier, online:!!x.transport })) };
  }
  function raumSenden(raum) { for (const m of raum.mitglieder.values()) senden(m, raumFuer(raum, m)); }
  function zustandSenden(raum) {
    if (!raum.spiel) return;
    const z = JSON.stringify({ t:'z', z:raum.spiel.zustand() });
    for (const m of online(raum)) senden(m, z);
    raum.gesendet = raum.spiel.version; raum.zuletztZ = jetzt();
  }

  function raumErstellen(einst) {
    if (liste.size >= MAX_RAEUME) return null;
    const raum = { code:code(), host:null, phase:'lobby', mitglieder:new Map(), spiel:null, zuletzt:jetzt(), gesendet:0, zuletztZ:0, einst:einstOk(einst) };
    liste.set(raum.code, raum);
    return raum;
  }
  function beitreten(m, raum) {
    if (m.raum && m.raum !== raum) verlassen(m);
    if (!raum.mitglieder.has(m.id) && raum.mitglieder.size >= L.MAX_SPIELER) { senden(m, { t:'fehler', text:'Der Raum ist voll (10 Leute).' }); return; }
    // Tier schon vergeben? Dann das nächste freie
    const belegt = new Set(mitglieder(raum).filter(x => x !== m).map(x => x.tier));
    if (belegt.has(m.tier)) m.tier = L.TIERE.find(t => !belegt.has(t)) || m.tier;
    m.raum = raum;
    raum.mitglieder.set(m.id, m);
    if (!raum.host || !raum.mitglieder.has(raum.host) || !raum.mitglieder.get(raum.host).transport) raum.host = m.id;
    if (raum.spiel) { raum.spiel.spielerHinzu(m.id, m.name, m.tier); raum.spiel.abwesend(m.id, false); }
    raumSenden(raum);
    zustandSenden(raum);
  }
  function verlassen(m) {
    const raum = m.raum; if (!raum) return;
    raum.mitglieder.delete(m.id);
    if (raum.spiel) raum.spiel.spielerWeg(m.id);
    m.raum = null;
    hostPruefen(raum);
    if (!raum.mitglieder.size) { liste.delete(raum.code); return; }
    raumSenden(raum);
  }
  function getrennt(m) {
    const raum = m.raum; if (!raum) return;
    m.transport = null; m.weg = jetzt();
    if (raum.phase === 'lobby') { verlassen(m); return; }
    if (raum.spiel) raum.spiel.abwesend(m.id, true);
    hostPruefen(raum);
    raumSenden(raum);
  }
  function hostPruefen(raum) {
    const h = raum.mitglieder.get(raum.host);
    if (h && h.transport) return;
    const neu = online(raum)[0] || mitglieder(raum)[0];
    raum.host = neu ? neu.id : null;
  }
  function starten(raum) {
    raum.spiel = new L.Spiel({ seed:seed(), modus:raum.einst.modus, dauer:raum.einst.dauer });
    for (const m of online(raum)) raum.spiel.spielerHinzu(m.id, m.name, m.tier);
    raum.phase = 'spiel';
    raumSenden(raum);
    zustandSenden(raum);
  }

  /* ---------- Verbindungen ---------- */
  function verbinden(transport) {
    let m = { id:'m' + (naechsteId++), token:crypto.randomBytes(12).toString('hex'), name:'Gast', tier:'loewe', transport, raum:null, weg:null };
    let hallo = false;
    const nachricht = roh => {
      let d; try { d = JSON.parse(roh); } catch (_) { return; }
      if (!d || typeof d !== 'object') return;
      if (d.t === 'hallo') {
        if (hallo) return;
        hallo = true;
        m.name = nameOk(d.name); m.tier = tierOk(d.tier);
        // Wiederverbinden mit Token
        if (d.token && d.raum && liste.has(String(d.raum).toUpperCase())) {
          const raum = liste.get(String(d.raum).toUpperCase());
          const alt = mitglieder(raum).find(x => x.token === d.token);
          if (alt) {
            if (alt.transport && alt.transport !== transport) { try { alt.transport.close && alt.transport.close(); } catch (_) { /* egal */ } }
            alt.transport = transport; alt.weg = null; m = alt;
            senden(m, { t:'du', id:m.id, token:m.token });
            if (raum.spiel) raum.spiel.abwesend(m.id, false);
            hostPruefen(raum); raumSenden(raum); zustandSenden(raum);
            return;
          }
        }
        senden(m, { t:'du', id:m.id, token:m.token });
        return;
      }
      if (!hallo) return;
      const raum = m.raum;
      if (raum) raum.zuletzt = jetzt();
      switch (d.t) {
        case 'neu': { const r = raumErstellen(d.einst); if (!r) return senden(m, { t:'fehler', text:'Gerade zu viele Räume. Versuch es gleich nochmal.' }); beitreten(m, r); return; }
        case 'beitreten': {
          const r = liste.get(String(d.code || '').toUpperCase().trim());
          if (!r) return senden(m, { t:'fehler', text:'Diesen Raum gibt es nicht (mehr).' });
          beitreten(m, r); return;
        }
        case 'verlassen': verlassen(m); senden(m, { t:'raus' }); return;
        case 'ich': {
          if (d.name != null) m.name = nameOk(d.name);
          if (d.tier != null) { const t = tierOk(d.tier); if (!raum || !mitglieder(raum).some(x => x !== m && x.tier === t)) m.tier = t; }
          if (raum) {  raumSenden(raum); }
          return;
        }
        case 'einst': if (raum && raum.host === m.id && raum.phase === 'lobby') { raum.einst = einstOk(d.einst); raumSenden(raum); } return;
        case 'start': if (raum && raum.host === m.id && raum.phase === 'lobby') starten(raum); return;
        case 'nochmal': if (raum && raum.host === m.id && raum.spiel && raum.spiel.phase === 'ende') { raum.spiel = null; raum.phase = 'lobby'; raumSenden(raum); } return;
        case 'p': if (raum && raum.spiel) raum.spiel.position(m.id, d); return;
        case 'v': if (raum && raum.spiel) raum.spiel.fahrzeug(m.id, d); return;
        case 'a': if (raum && raum.spiel && d.b && typeof d.b === 'object') raum.spiel.aktion(m.id, d.b); return;
      }
    };
    return { nachricht, getrennt:() => getrennt(m), mitglied:() => m };
  }

  /* ---------- Takt (20 pro Sekunde) ---------- */
  function takt() {
    const t = jetzt();
    for (const raum of liste.values()) {
      // Weggebliebene endgültig entfernen, leere Räume aufräumen
      for (const m of mitglieder(raum)) if (!m.transport && m.weg != null && t - m.weg > Z.weg) verlassen(m);
      if (!liste.has(raum.code)) continue;
      if (!online(raum).length) { if (t - raum.zuletzt > Z.leer) liste.delete(raum.code); continue; }
      raum.zuletzt = t;
      const s = raum.spiel; if (!s) continue;
      s.takt();
      const ev = s.nimmEreignisse();
      if (ev.length) {
        const offen = ev.filter(e => !e.an);
        for (const m of online(raum)) {
          const meine = ev.filter(e => e.an === m.id);
          const alle = meine.length ? offen.concat(meine) : offen;
          if (alle.length) senden(m, { t:'ev', e:alle });
        }
      }
      if ((s.version !== raum.gesendet && t - raum.zuletztZ >= 140) || t - raum.zuletztZ > 1000) zustandSenden(raum);
      const pos = JSON.stringify({ t:'pos', p:s.positionen() });
      for (const m of online(raum)) senden(m, pos);
    }
  }

  return { verbinden, takt, liste, anzahl:() => liste.size };
}

module.exports = { raeume };
