/* Knastknacker – Browser: Menüs, Netz (online) oder lokales Spiel (solo), Steuerung, Kamera, Anzeige. */
(function () {
  'use strict';
  const L = KK_LOGIK, KA = KK_KARTE, T = THREE, F = KKF, TON = KKTon;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const SPEICHER = 'knastknacker.v1', SITZUNG = 'knastknacker.sitzung';
  const ICON = { loeffel:'🥄', schaufel:'⛏️', schraubenzieher:'🪛', drahtschere:'✂️', hammer:'🔨', schlagstock:'🏏', laken:'🛏️', seil:'🪢', duenger:'🌱', reiniger:'🧴', sprengstoff:'🧨', uniform:'👮', keyblau:'💳', keyrot:'💳', vanschluessel:'🔑', helischluessel:'🗝️' };
  const TIER_ICON = { loewe:'🦁', fuchs:'🦊', waschbaer:'🦝', pinguin:'🐧', hase:'🐰', baer:'🐻', affe:'🐵', panda:'🐼', krokodil:'🐊', schwein:'🐷' };
  const TEAMFARBEN = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835, 0x8e24aa, 0x00acc1];
  const EBENE_Y = { 0:0, 1:-2.4, 2:3.1, 3:6.2 };
  // Touch-Steuerung: Handys/Tablets; iPads (melden sich als Mac) immer, auch mit Tastatur-Hülle. ?touch=1 erzwingt sie.
  const istIpad = /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  const touch = matchMedia('(pointer: coarse)').matches || istIpad || new URLSearchParams(location.search).get('touch') === '1';

  /* ---------- Einstellungen ---------- */
  let einst = { name:'', tier:'fuchs', modus:'jeder', dauer:900, grafik:touch ? 'mittel' : 'hoch', ton:true, empf:1, laut:1, schwer:'normal', tipps:true };
  try { Object.assign(einst, JSON.parse(localStorage.getItem(SPEICHER) || '{}')); } catch (_) { /* egal */ }
  const merken = () => { try { localStorage.setItem(SPEICHER, JSON.stringify(einst)); } catch (_) { /* egal */ } };
  TON.an(einst.ton); TON.laut(einst.laut);

  /* ---------- Renderer ---------- */
  const leinwand = $('bild');
  const PIXEL = { hoch:2, mittel:1.5, niedrig:1 };
  const renderer = new T.WebGLRenderer({ canvas:leinwand, antialias:einst.grafik === 'hoch' && !touch, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL[einst.grafik] || 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const kamera = new T.PerspectiveCamera(65, 1, 0.05, 900);
  function groesse() {
    renderer.setSize(innerWidth, innerHeight, false); kamera.aspect = innerWidth / innerHeight;
    kamera.fov = kamera.aspect < 1 ? 82 : 65;      // Hochformat: weiter sehen
    kamera.updateProjectionMatrix();
  }
  // Grafik automatisch herunterschalten, wenn es ruckelt (über 4 s gemessen)
  let fpsZeit = 0, fpsBilder = 0, fpsSchlecht = 0;
  function fpsPruefen(dtEcht) {
    if (modus !== 'spiel' || document.hidden || navigator.webdriver) return;
    fpsZeit += dtEcht; fpsBilder++;
    if (fpsZeit < 4) return;
    const fps = fpsBilder / fpsZeit; fpsZeit = 0; fpsBilder = 0;
    if (fps >= 27) { fpsSchlecht = 0; return; }
    if (++fpsSchlecht < 2 || einst.grafik === 'niedrig') return;
    fpsSchlecht = 0;
    einst.grafik = einst.grafik === 'hoch' ? 'mittel' : 'niedrig'; merken();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL[einst.grafik])); groesse();
    if (welt) welt.setGrafik(einst.grafik);
    hinweis('Grafik auf „' + einst.grafik + '“ gestellt, damit es flüssig läuft.');
  }
  addEventListener('resize', groesse); groesse();

  /* ---------- Spielzustand im Browser ---------- */
  let netz = null, du = null, raum = null, Z = null, ich = null;   // ich = mein Eintrag aus Z.sp
  let szene = null, welt = null, S = null;                          // S = Spiegel der Spielwelt für moeglich()
  let me = { x:0, z:0, r:0, e:0, tp:0 };                           // eigene Position (selbst gerechnet)
  let fahr = null;                                                  // Van, wenn ich fahre
  let pos = null, posZeit = 0;
  const figuren = new Map(), wachen = [], statisten = [];
  let yaw = Math.PI, pitch = 0.32, kamDist = 4.2, wackeln = 0;
  let ausdauer = 1, schlagT = -9, zuletztGesendet = 0, aktStart = 0;
  let zuschauer = 0;
  const tasten = new Set();
  let modus = 'menu';

  /* ================= Netz ================= */
  function online(beiOffen) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(proto + '//' + location.host + '/ws');
    let sitzung = null; try { sitzung = JSON.parse(sessionStorage.getItem(SITZUNG) || 'null'); } catch (_) { /* egal */ }
    ws.onopen = () => { ws.send(JSON.stringify({ t:'hallo', name:einst.name, tier:einst.tier, token:sitzung && sitzung.token, raum:sitzung && sitzung.raum })); if (beiOffen) beiOffen(); };
    ws.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (_) { return; } empfang(d); };
    ws.onclose = () => { if (netz && netz.ws === ws) { netz = null; if (modus !== 'menu') { hinweis('Verbindung weg – lade neu, um weiterzumachen.'); } } };
    return { ws, senden:d => { if (ws.readyState === 1) ws.send(JSON.stringify(d)); }, schliessen:() => { try { ws.close(); } catch (_) { /* egal */ } } };
  }
  function lokal() {
    const spiel = new L.Spiel({ seed:Math.random() * 1e9 >>> 0, modus:'jeder', dauer:einst.dauer, schwer:einst.schwer });
    spiel.spielerHinzu('ich', einst.name || 'Ich', einst.tier);
    du = 'ich';
    let v = -1, naechster = performance.now(), aktiv = true;
    function eins() {
      spiel.takt();
      const ev = spiel.nimmEreignisse(); if (ev.length) empfang({ t:'ev', e:ev });
      if (spiel.version !== v) { v = spiel.version; empfang({ t:'z', z:JSON.parse(JSON.stringify(spiel.zustand())) }); }
      empfang({ t:'pos', p:spiel.positionen() });
    }
    function schritt() {
      if (!aktiv) return;
      const jetzt = performance.now();
      let n = 0;
      while (jetzt >= naechster && n < 5) { eins(); n++; naechster += 1000 / L.TAKT; }
      if (jetzt - naechster > 500) naechster = jetzt;
    }
    const iv = setInterval(schritt, 16);
    window.knastknacker.spiel = () => spiel;
    return { spiel, lokal:true, pumpe:n => { for (let i = 0; i < n; i++) eins(); naechster = performance.now(); }, senden(d) {
      if (d.t === 'p') spiel.position('ich', d);
      else if (d.t === 'v') spiel.fahrzeug('ich', d);
      else if (d.t === 'a') spiel.aktion('ich', d.b);
    }, schliessen() { aktiv = false; clearInterval(iv); } };
  }
  const senden = d => { if (netz) netz.senden(d); };
  const aktion = b => senden({ t:'a', b });

  function empfang(d) {
    switch (d.t) {
      case 'du': du = d.id; if (raum || d.token) try { sessionStorage.setItem(SITZUNG, JSON.stringify({ token:d.token, raum:raum ? raum.code : null })); } catch (_) { /* egal */ } netz.token = d.token; break;
      case 'raum': {
        raum = d; du = d.du;
        try { sessionStorage.setItem(SITZUNG, JSON.stringify({ token:netz.token, raum:d.code })); } catch (_) { /* egal */ }
        if (d.phase === 'lobby') { if (modus === 'spiel' || modus === 'ende') spielEnde(); zeigeLobby(); }
        else if (modus !== 'spiel' && modus !== 'ende') spielStart();
        else zeigeLobbyKurz();
        break;
      }
      case 'raus': raum = null; try { sessionStorage.removeItem(SITZUNG); } catch (_) { /* egal */ } zeigeMenu(); break;
      case 'fehler': hinweis(d.text); break;
      case 'z': if (modus === 'menu' || modus === 'lobby') { if (netz && netz.lokal) spielStart(); else return; } zustand(d.z); break;
      case 'pos': pos = d.p; posZeit = performance.now(); break;
      case 'ev': for (const e of d.e) ereignis(e); break;
    }
  }

  /* ================= Spiel starten/beenden ================= */
  function spielStart() {
    modus = 'spiel';
    zeigeNur('hud');
    menuSzene = menuWelt = null;
    if (welt) spielAufraeumen();
    szene = new T.Scene();
    szene.fog = new T.FogExp2(0x141a2a, 0.012);
    S = { K:KA.neu(), items:[], strom:true, toreOffen:false, seile:[false, false], van:{ x:KA.OBJ.van.x, z:KA.OBJ.van.z, r:KA.OBJ.van.r, sitze:[], fahrer:null, weg:false }, heli:{ x:KA.OBJ.heli.x, z:KA.OBJ.heli.z, sitze:[], startBis:0, weg:false }, aeN:0, tunN:0, git:'' };
    welt = KKW.bauen(szene, S.K, { grafik:einst.grafik });
    Z = null; ich = null; pos = null; fahr = null; zuschauer = 0;
    karteBasis = null;
    $('feed').innerHTML = '';
    if (!touch) $('klick').hidden = false;
    TON.start();
  }
  function spielAufraeumen() {
    figuren.clear(); wachen.length = 0; statisten.length = 0;
    szene = null; welt = null;
    renderer.renderLists.dispose();
  }
  function spielEnde() { TON.sirene(false); if (document.pointerLockElement) document.exitPointerLock(); }

  /* ================= Zustand vom Spiel ================= */
  let karteBasis = null;
  function zustand(z) {
    const vorher = Z;
    Z = z;
    ich = z.sp.find(s => s.id === du) || null;
    const K = S.K;
    let kGeaendert = false, tGeaendert = false;
    for (let i = S.aeN; i < z.ae.length; i++) { const [idx, c] = z.ae[i]; K.boden[idx] = c.charCodeAt(0); kGeaendert = true; }
    S.aeN = z.ae.length;
    for (let i = S.tunN; i < z.tun.length; i++) { K.tunnel[z.tun[i]] = 1; tGeaendert = true; }
    S.tunN = z.tun.length;
    if (z.git !== S.git) { S.git = z.git; K.gitter.forEach((g, i) => { g.offen = z.git[i] === '1'; }); welt.gitterSetzen(); }
    if (kGeaendert) { welt.karteGeaendert(); karteBasis = null; } else if (tGeaendert) welt.tunnelGeaendert();
    S.items = z.items.map(([id, art, x, z2, e]) => ({ id, art, x, z:z2, e }));
    welt.itemsSetzen(z.items);
    welt.bombenSetzen(z.bomben);
    if (!vorher || vorher.strom !== z.strom) welt.setStrom(z.strom);
    S.strom = z.strom; S.toreOffen = z.tore; S.seile = z.seile;
    z.seile.forEach((s, i) => { welt.seilMesh[i].visible = s; });
    Object.assign(S.van, z.van); Object.assign(S.heli, z.heli);
    welt.setAlarm(z.alarm);
    TON.sirene(z.alarm >= 2);
    if (ich) {
      if (ich.akt && (!vorher || !vorher.sp.find(s => s.id === du) || !(vorher.sp.find(s => s.id === du) || {}).akt)) aktStart = performance.now() - ich.akt.t * 1000;
      if (ich.akt) aktStart = Math.min(aktStart, performance.now() - ich.akt.t * 1000);
      if (ich.fz === 'van' && z.van.fahrer === du && !fahr && pos) fahr = { x:pos.van[0], z:pos.van[1], r:pos.van[2], v:pos.van[3] };
      if (!(ich.fz === 'van' && z.van.fahrer === du)) fahr = null;
    }
    hudZustand(); tippAktualisieren();
    if (z.phase === 'ende' && modus === 'spiel') zeigeEnde();
  }

  /* ================= Ereignisse ================= */
  function ereignis(e) {
    if (!welt) return;
    const nah = (x, z, r = 30) => Math.hypot(x - me.x, z - me.z) < r;
    switch (e.art) {
      case 'tele': if (e.an === du) { const weit = Math.hypot(e.x - me.x, e.z - me.z) > 3 || e.e !== me.e; me.x = e.x; me.z = e.z; me.e = e.e; me.tp = e.tp; if (e.r != null) { me.r = e.r; if (weit) yaw = e.r; } } break;
      case 'meldung': feed(e.text); break;
      case 'chat': { const s = Z && Z.sp.find(x => x.id === e.id); feed('<b>' + esc(s ? s.name : '?') + ':</b> ' + esc(e.text), true); const f = figuren.get(e.id); if (f) blase(f, e.text); break; }
      case 'schlag': { const f = figuren.get(e.id); if (f && e.id !== du) f.fig.schlag(); if (nah(e.x, e.z, 20)) TON.schlag(); break; }
      case 'treffer': if (nah(e.x, e.z, 20)) { TON.treffer(); welt.funken(e.x, 1.2, e.z, 6, 0xffffff); } if (e.an === du) { wackeln = 0.25; blitzRot(); } break;
      case 'knueppel': if (nah(e.x, e.z, 20)) TON.treffer(); if (e.an === du) { wackeln = 0.3; blitzRot(); } break;
      case 'ko': if (e.id === du) feed('Du bist k.o. und hast alles fallen lassen!'); break;
      case 'gefasst': if (e.id === du) { TON.gefasst(); } break;
      case 'frei': if (e.id === du) { TON.frei(); grossText('ENTKOMMEN!', 'Du bist draußen. Schau den anderen zu (Klick wechselt).'); } else TON.piep(); break;
      case 'boom': welt.explosion(e.x, e.z); TON.boom(); { const d = Math.hypot(e.x - me.x, e.z - me.z); wackeln = Math.max(wackeln, Math.max(0, 1.2 - d / 30)); } break;
      case 'krach': welt.explosion(e.x, e.z); TON.krach(); break;
      case 'zuender': TON.piep(); break;
      case 'schock': welt.funken(e.x, 1.4, e.z, 25); TON.schock(); if (e.an === du) { wackeln = 0.4; blitzRot(); feed('Autsch! Der Zaun steht unter Strom.'); } break;
      case 'halt': if (nah(e.x, e.z, 25)) { TON.halt(); const g = naechsteWache(e.x, e.z); if (g) blase(g, 'HALT! Stehen bleiben!'); } break;
      case 'graben': if (nah(e.x, e.z, 15)) { TON.graben(); welt.staub(e.x, e.e === 1 ? -2.2 : 0.2, e.z); } break;
      case 'nehmen': if (e.an === du) TON.nehmen(); break;
      case 'nein': if (e.an === du) TON.nein(); break;
      case 'strom': feed(e.an ? '💡 Strom wieder da' : '⚡ Stromausfall!'); break;
      case 'wacheKo': if (nah(e.x, e.z, 25)) TON.treffer(); break;
      case 'ende': break;
    }
  }
  function naechsteWache(x, z) { let b = null, bd = 3; for (const w of wachen) { const d = Math.hypot(w.position.x - x, w.position.z - z); if (d < bd) { bd = d; b = w; } } return b; }

  /* ================= Eingabe ================= */
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
      if (e.key === 'Enter' && e.target.id === 'chatEin') { const t = e.target.value.trim(); if (t) aktion({ a:'chat', text:t }); e.target.value = ''; e.target.blur(); $('chat').hidden = true; sperren(); }
      if (e.key === 'Escape' && e.target.id === 'chatEin') { e.target.blur(); $('chat').hidden = true; }
      return;
    }
    if (modus !== 'spiel') return;
    const k = e.key.toLowerCase();
    tasten.add(e.code);
    if (k === 'e') benutzen();
    else if (k === 'f') schlagen();
    else if (k === 'q') aktion({ a:'werfen' });
    else if (k >= '1' && k <= '4') aktion({ a:'hand', i:+k - 1 });
    else if (k === 'm' || e.code === 'Tab') { e.preventDefault(); grosseKarte(!$('karteGross').classList.contains('an')); }
    else if (k === 'h') $('hilfeSpiel').hidden = !$('hilfeSpiel').hidden;
    else if (k === 't') tippUmschalten();
    else if (e.key === 'Enter') { $('chat').hidden = false; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => $('chatEin').focus(), 0); }
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { tasten.delete(e.code); if (e.code === 'KeyM' || e.code === 'Tab') grosseKarte(false); });
  addEventListener('blur', () => tasten.clear());
  function sperren() { if (!touch && modus === 'spiel' && leinwand.requestPointerLock) leinwand.requestPointerLock(); }
  leinwand.addEventListener('mousedown', e => {
    if (modus !== 'spiel') return;
    TON.start();
    if (!document.pointerLockElement && !touch) { sperren(); return; }
    if (ich && ich.z === 'frei') { zuschauer++; return; }
    if (e.button === 0) schlagen();
  });
  $('klick').addEventListener('click', () => { TON.start(); sperren(); });
  document.addEventListener('pointerlockchange', () => { $('klick').hidden = !!document.pointerLockElement || modus !== 'spiel' || touch; });
  addEventListener('mousemove', e => {
    if (!document.pointerLockElement) return;
    yaw -= e.movementX * 0.0024 * einst.empf; pitch += e.movementY * 0.0022 * einst.empf;
    pitch = Math.max(-0.9, Math.min(1.2, pitch));
  });
  addEventListener('wheel', e => {
    if (modus !== 'spiel' || !ich) return;
    if (e.ctrlKey) return;
    aktion({ a:'hand', i:(ich.hand + (e.deltaY > 0 ? 1 : 3)) % 4 });
  }, { passive:true });

  function benutzen() {
    if (!ich || ich.z !== 'aktiv' || !S) return;
    if (ich.akt) { aktion({ a:'stop' }); return; }
    const m = L.moeglich(S, sicht());
    if (!m || m.info) { TON.nein(); return; }
    aktion({ a:'start', art:m.art });
  }
  function schlagen() {
    if (!ich || ich.z !== 'aktiv' || ich.fz) return;
    if (performance.now() - schlagT < 450) return;
    schlagT = performance.now();
    const f = figuren.get(du); if (f) f.fig.schlag();
    aktion({ a:'schlag', r:me.r });
  }
  // Inventar antippen/anklicken
  [...$('inv').children].forEach((el, i) => el.addEventListener('pointerdown', e => { e.stopPropagation(); aktion({ a:'hand', i }); }));
  function sicht() { return { x:me.x, z:me.z, r:me.r, e:me.e, inv:ich.inv, hand:ich.hand, uniform:ich.uni, fz:ich.fz }; }

  /* ---------- Touch ---------- */
  const stick = { id:null, x0:0, y0:0, dx:0, dy:0 }, blick = { id:null, x:0, y:0 };
  let touchRennen = false;
  if (touch) {
    document.body.classList.add('touch');
    const zone = $('touch');
    zone.addEventListener('pointerdown', e => {
      TON.start();
      if (e.clientX < innerWidth * 0.42 && stick.id == null) { stick.id = e.pointerId; stick.x0 = e.clientX; stick.y0 = e.clientY; stick.dx = stick.dy = 0; $('stick').style.cssText = `display:block;left:${e.clientX - 50}px;top:${e.clientY - 50}px`; }
      else if (blick.id == null) { blick.id = e.pointerId; blick.x = e.clientX; blick.y = e.clientY; }
      if (ich && ich.z === 'frei') zuschauer++;
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId === stick.id) { stick.dx = Math.max(-1, Math.min(1, (e.clientX - stick.x0) / 50)); stick.dy = Math.max(-1, Math.min(1, (e.clientY - stick.y0) / 50)); $('knopf').style.transform = `translate(${stick.dx * 30}px,${stick.dy * 30}px)`; }
      else if (e.pointerId === blick.id) { yaw -= (e.clientX - blick.x) * 0.006 * einst.empf; pitch = Math.max(-0.9, Math.min(1.2, pitch + (e.clientY - blick.y) * 0.005 * einst.empf)); blick.x = e.clientX; blick.y = e.clientY; }
    });
    const los = e => { if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; $('stick').style.display = 'none'; $('knopf').style.transform = ''; } if (e.pointerId === blick.id) blick.id = null; };
    zone.addEventListener('pointerup', los); zone.addEventListener('pointercancel', los);
    $('tAktion').addEventListener('pointerdown', e => { e.stopPropagation(); benutzen(); });
    $('tSchlag').addEventListener('pointerdown', e => { e.stopPropagation(); schlagen(); });
    $('tRennen').addEventListener('pointerdown', e => { e.stopPropagation(); touchRennen = !touchRennen; $('tRennen').classList.toggle('an', touchRennen); });
    $('tWerfen').addEventListener('pointerdown', e => { e.stopPropagation(); aktion({ a:'werfen' }); });
    $('tKarte').addEventListener('pointerdown', e => { e.stopPropagation(); grosseKarte(!$('karteGross').classList.contains('an')); });
    $('tChat').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); $('chat').hidden = false; $('chatEin').focus(); });
    $('tHilfe').addEventListener('pointerdown', e => { e.stopPropagation(); $('hilfeSpiel').hidden = !$('hilfeSpiel').hidden; });
    $('prompt').addEventListener('pointerdown', e => { e.stopPropagation(); benutzen(); });
    $('karteGross').addEventListener('pointerdown', () => grosseKarte(false));
    // Vollbild beim ersten Antippen im Spiel (iPhone kann das nicht, iPad und Android schon)
    zone.addEventListener('pointerdown', () => {
      const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
      if (f && !document.fullscreenElement && !document.webkitFullscreenElement) try { const p = f.call(d); if (p && p.catch) p.catch(() => {}); } catch (_) { /* egal */ }
      try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (_) { /* egal */ }
    }, { once:true });
    // iPad/iPhone: kein Zoomen per Geste oder Doppeltipp
    for (const art of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(art, e => e.preventDefault());
    let letzterTipp = 0;
    document.addEventListener('touchend', e => { const j = Date.now(); if (j - letzterTipp < 350 && document.body.classList.contains('imSpiel')) e.preventDefault(); letzterTipp = j; }, { passive:false });
    document.addEventListener('touchmove', e => { if (e.touches.length > 1 || document.body.classList.contains('imSpiel')) e.preventDefault(); }, { passive:false });
  }

  /* ================= Bewegung ================= */
  function eingabe() {
    let vx = 0, vz = 0;
    if (tasten.has('KeyW') || tasten.has('ArrowUp')) vz += 1;
    if (tasten.has('KeyS') || tasten.has('ArrowDown')) vz -= 1;
    if (tasten.has('KeyA') || tasten.has('ArrowLeft')) vx -= 1;
    if (tasten.has('KeyD') || tasten.has('ArrowRight')) vx += 1;
    if (stick.id != null) { vx += stick.dx; vz -= stick.dy; }
    const l = Math.hypot(vx, vz); if (l > 1) { vx /= l; vz /= l; }
    return { vx, vz, rennen:tasten.has('ShiftLeft') || tasten.has('ShiftRight') || touchRennen };
  }
  function werVon() { return { blau:ich.inv.includes('keyblau'), rot:ich.inv.includes('keyrot'), strom:S.strom, toreOffen:S.toreOffen }; }
  function bewegen(dt) {
    const ein = eingabe();
    let anim = 0;
    if (fahr) {
      // Van fahren
      L.vanSchritt(S.K, fahr, ein.vz, ein.vx, dt, { fahrzeug:true, toreOffen:S.toreOffen });
      me.x = fahr.x; me.z = fahr.z;
      return 0;
    }
    if (!ich || ich.z !== 'aktiv' || ich.fz) { ausdauer = Math.min(1, ausdauer + dt * 0.3); return 0; }
    const ego = me.e === 1 || me.e === 2;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    let dx = (fx * ein.vz + rx * ein.vx), dz = (fz * ein.vz + rz * ein.vx);
    const l = Math.hypot(dx, dz);
    const rennt = ein.rennen && l > 0.1 && ausdauer > 0.05 && !ego;
    ausdauer = Math.max(0, Math.min(1, ausdauer + (rennt ? -0.2 : 0.14) * dt));
    const v = L.TEMPO[me.e][rennt ? 1 : 0] * (ich.akt ? 0 : 1);
    if (l > 0.05 && v > 0) {
      const wer = werVon();
      const vorher = { x:me.x, z:me.z };
      if (!L.frei(S.K, me.x, me.z, me.e, wer)) { me.x += dx * v * dt; me.z += dz * v * dt; }
      else L.bewegen(S.K, me, dx * v * dt, dz * v * dt, me.e, wer);
      if (!ego) me.r += winkel(me.r, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
      anim = Math.hypot(me.x - vorher.x, me.z - vorher.z) > 0.001 ? (rennt ? 2 : 1) : 0;
    }
    if (ego) me.r = yaw;
    if (performance.now() - schlagT < 300) anim = 3;
    return anim;
  }
  const winkel = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

  /* ================= Figuren ================= */
  function figurFuer(s) {
    let f = figuren.get(s.id);
    if (!f) {
      const fig = F.figur(s.tier, { nummer:100 + (s.name.length * 37 + s.tier.length * 11) % 900 });
      szene.add(fig);
      const schild = namensschild(s.name, s.id === du);
      fig.add(schild); schild.position.y = 1.55;
      f = { fig, schild, x:me.x, z:me.z, r:0, e:0, anim:0 };
      figuren.set(s.id, f);
    }
    return f;
  }
  function namensschild(text, ichSelbst) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.font = '700 30px "Barlow Semi Condensed", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = Math.min(250, x.measureText(text).width + 24);
    x.fillStyle = 'rgba(10,12,16,0.65)'; x.beginPath(); x.roundRect ? x.roundRect(128 - w / 2, 12, w, 40, 12) : x.rect(128 - w / 2, 12, w, 40); x.fill();
    x.fillStyle = ichSelbst ? '#ffb06a' : '#fff'; x.fillText(text, 128, 33);
    const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false, transparent:true }));
    sp.scale.set(0.8, 0.2, 1); sp.renderOrder = 10;
    return sp;
  }
  function blase(fig, text) {
    const ziel = fig.fig || fig;
    if (ziel.blase) ziel.remove(ziel.blase);
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const x = c.getContext('2d');
    x.font = '600 34px "Barlow Semi Condensed", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const t = text.length > 34 ? text.slice(0, 33) + '…' : text, w = Math.min(500, x.measureText(t).width + 36);
    x.fillStyle = '#fff'; x.beginPath(); x.roundRect ? x.roundRect(256 - w / 2, 8, w, 64, 18) : x.rect(256 - w / 2, 8, w, 64); x.fill();
    x.beginPath(); x.moveTo(246, 70); x.lineTo(256, 90); x.lineTo(266, 70); x.fill();
    x.fillStyle = '#16181c'; x.fillText(t, 256, 41);
    const sp = new T.Sprite(new T.SpriteMaterial({ map:new T.CanvasTexture(c), depthTest:false, transparent:true }));
    sp.scale.set(1.6, 0.3, 1); sp.position.y = 1.85; sp.renderOrder = 11;
    ziel.add(sp); ziel.blase = sp;
    setTimeout(() => { if (ziel.blase === sp) { ziel.remove(sp); ziel.blase = null; } }, 4500);
  }
  function wacheFigur(i) {
    while (wachen.length <= i) {
      const w = F.figur('bulldogge', { wache:true, skala:1.55 }); szene.add(w);
      // Sichtkegel auf dem Boden
      const n = 18, geo = new T.BufferGeometry(), p = new Float32Array((n + 2) * 3);
      geo.setAttribute('position', new T.BufferAttribute(p, 3));
      const idx = []; for (let k = 1; k <= n; k++) idx.push(0, k + 1, k);
      geo.setIndex(idx);
      const kegel = new T.Mesh(geo, new T.MeshBasicMaterial({ color:0xfff3c0, transparent:true, opacity:0.12, depthWrite:false, blending:T.AdditiveBlending, side:T.DoubleSide }));
      kegel.frustumCulled = false; szene.add(kegel);
      w.kegel = kegel; w.strahlen = n;
      w.x = 0; w.z = 0; w.r = 0;
      wachen.push(w);
    }
    return wachen[i];
  }
  function kegelSetzen(w, zust, weit) {
    const K = S.K, n = w.strahlen, p = w.kegel.geometry.attributes.position.array, halb = Math.acos(0.42);
    const sichtbar = Math.hypot(w.x - me.x, w.z - me.z) < 35 && me.e === 0 && w.anim !== 4;
    w.kegel.visible = sichtbar;
    if (!sichtbar) return;
    p[0] = w.x; p[1] = 0.05; p[2] = w.z;
    for (let k = 0; k <= n; k++) {
      const a = w.r - halb + 2 * halb * k / n, sx = Math.sin(a), sz = Math.cos(a);
      let d = 0.3;
      while (d < weit) { const x = Math.floor(w.x + sx * d), z = Math.floor(w.z + sz * d); if (KA.SICHT_ZU.has(K.boden[z * KA.W + x])) break; d += 0.35; }
      p[(k + 1) * 3] = w.x + sx * d; p[(k + 1) * 3 + 1] = 0.05; p[(k + 1) * 3 + 2] = w.z + sz * d;
    }
    w.kegel.geometry.attributes.position.needsUpdate = true;
    w.kegel.material.color.setHex(zust === 2 ? 0xff3030 : zust === 1 ? 0xffc040 : 0xfff3c0);
    w.kegel.material.opacity = zust === 2 ? 0.2 : 0.12;
  }

  /* ================= Bild für Bild ================= */
  let alt = performance.now();
  let echtAlt = performance.now();
  function bild() { requestAnimationFrame(bild); const j = performance.now(); fpsPruefen(Math.min(1, (j - echtAlt) / 1000)); echtAlt = j; bildSchritt(); }
  /* Menühintergrund: das Gefängnis bei Nacht, die Kamera kreist langsam darüber (nicht auf Handys) */
  let menuSzene = null, menuWelt = null, menuT = 0;
  function menuHintergrund() {
    if (menuSzene || touch || einst.grafik === 'niedrig' || modus === 'spiel') return;
    try {
      menuSzene = new T.Scene(); menuSzene.fog = new T.FogExp2(0x141a2a, 0.007);
      menuWelt = KKW.bauen(menuSzene, KA.neu(), { grafik:'mittel' });
      menuWelt.setStrom(true);
      menuWelt.licht.spielerLicht.intensity = 0;
    } catch (_) { menuSzene = menuWelt = null; }
  }
  function menuBild(dt) {
    if (!menuSzene) return;
    menuT += dt;
    const w = menuT * 0.05, cx = 50, cz = 40;
    kamera.position.set(cx + Math.cos(w) * 78, 30 + Math.sin(menuT * 0.12) * 4, cz + Math.sin(w) * 62);
    kamera.lookAt(cx, 0, cz);
    menuWelt.licht.mondLicht.position.set(cx - 40, 80, cz - 35); menuWelt.licht.mondLicht.target.position.set(cx, 0, cz);
    menuWelt.update(dt, menuT, { ents:[], ich:{ x:cx, z:cz, e:0 }, toreOffen:false, blau:false, rot:false, heli:null });
    renderer.render(menuSzene, kamera);
  }
  function bildSchritt() {
    const jetzt = performance.now(), dt = Math.min(0.05, (jetzt - alt) / 1000); alt = jetzt;
    if (modus === 'menu' || modus === 'lobby') { menuBild(dt); return; }
    if (modus !== 'spiel' && modus !== 'ende') return;
    if (!welt || !Z) { if (szene) renderer.render(szene, kamera); return; }
    const t = Z.t + (jetzt - posZeit) / 1000;
    const anim = bewegen(dt);
    // Position senden (20 Hz)
    if (jetzt - zuletztGesendet > 50 && ich) {
      zuletztGesendet = jetzt;
      if (fahr) senden({ t:'v', x:fahr.x, z:fahr.z, r:fahr.r, v:fahr.v });
      else if (ich.z === 'aktiv' && !ich.fz) senden({ t:'p', x:me.x, z:me.z, r:me.r, tp:me.tp, a:anim });
    }
    const glatt = 1 - Math.exp(-dt * 14);
    const ents = [];
    // Spieler
    if (pos) {
      const da = new Set();
      for (const [id, x, z, r, e, a, tp] of pos.s) {
        if (id === du && tp > me.tp) { me.x = x; me.z = z; me.e = e; me.r = r; me.tp = tp; }
        const s = Z.sp.find(q => q.id === id); if (!s) continue;
        da.add(id);
        const f = figurFuer(s);
        const selbst = id === du;
        if (selbst && !s.fz && s.z === 'aktiv') { f.x = me.x; f.z = me.z; f.r = me.r; f.e = me.e; f.anim = anim; }
        else { f.x += (x - f.x) * glatt; f.z += (z - f.z) * glatt; f.r += winkel(f.r, r) * glatt; f.e = e; f.anim = a; if (Math.hypot(x - f.x, z - f.z) > 4) { f.x = x; f.z = z; } }
        if (selbst && s.z !== 'aktiv') { me.x = f.x; me.z = f.z; }
        f.fig.position.set(f.x, EBENE_Y[f.e] + (f.e === 2 ? -0.25 : 0), f.z);
        f.fig.rotation.y = f.r;
        f.fig.scale.setScalar(f.fig.skala * (f.e === 2 ? 0.6 : 1));
        f.fig.visible = !s.fz && !(selbst && (me.e === 1 || me.e === 2)) && Math.hypot(f.x - me.x, f.z - me.z) < 60;
        f.fig.animieren(dt, f.anim);
        f.fig.halte(s.inv[s.hand]);
        f.fig.setUniform(s.uni);
        f.fig.setTeam(Z.modus === 'banden' ? TEAMFARBEN[s.team % TEAMFARBEN.length] : null);
        f.schild.visible = !selbst;
        ents.push({ x:f.x, z:f.z, ich:selbst, blau:selbst && s.inv.includes('keyblau'), rot:selbst && s.inv.includes('keyrot') });
      }
      for (const [id, f] of figuren) if (!da.has(id)) { szene.remove(f.fig); figuren.delete(id); }
      // Wärter
      pos.w.forEach(([x, z, r, a, zust, karte], i) => {
        const w = wacheFigur(i);
        if (!w.da) { w.x = x; w.z = z; w.da = true; }
        w.x += (x - w.x) * glatt; w.z += (z - w.z) * glatt; w.r += winkel(w.r, r) * glatt; w.anim = a;
        w.position.set(w.x, 0, w.z); w.rotation.y = w.r;
        w.visible = Math.hypot(w.x - me.x, w.z - me.z) < 55;
        w.animieren(dt, a);
        kegelSetzen(w, zust, S.strom ? 14 : 8);
        ents.push({ x:w.x, z:w.z, wache:true });
      });
      // Statisten
      pos.n.forEach(([x, z, r, a], i) => {
        let n = statisten[i];
        if (!n) { n = F.figur(['hund', 'katze', 'ziege', 'maus', 'otter', 'hund', 'katze'][i % 7], { nummer:300 + i * 17 }); n.x = x; n.z = z; n.r = r; szene.add(n); statisten[i] = n; }
        n.x += (x - n.x) * glatt; n.z += (z - n.z) * glatt; n.r += winkel(n.r, r) * glatt;
        n.position.set(n.x, 0, n.z); n.rotation.y = n.r; n.visible = Math.hypot(n.x - me.x, n.z - me.z) < 50;
        if (n.visible) n.animieren(dt, a);
        ents.push({ x:n.x, z:n.z });
      });
      // Van
      const v = fahr ? [fahr.x, fahr.z, fahr.r] : pos.van;
      const vg = welt.van.g;
      vg.position.x += (v[0] - vg.position.x) * (fahr ? 1 : glatt); vg.position.z += (v[1] - vg.position.z) * (fahr ? 1 : glatt);
      vg.rotation.y += winkel(vg.rotation.y, v[2]) * (fahr ? 1 : glatt);
      vg.visible = !S.van.weg || Math.hypot(vg.position.x - 49.5, vg.position.z - 78) < 60;
      if (S.van.weg) { vg.position.z += dt * 14; }
    }
    welt.update(dt, t, { ents, ich:me, toreOffen:S.toreOffen, blau:ich && ich.inv.includes('keyblau'), rot:ich && ich.inv.includes('keyrot'), heli:S.heli });
    kameraSetzen(dt);
    welt.sicht(me, kamera);
    // Licht folgt
    const L2 = welt.licht;
    L2.mondLicht.position.set(me.x - 40, 80, me.z - 35); L2.mondLicht.target.position.set(me.x, 0, me.z);
    const ego = me.e === 1 || me.e === 2;
    L2.spielerLicht.position.set(ego ? kamera.position.x : me.x, ego ? kamera.position.y + 0.2 : EBENE_Y[me.e] + 3, ego ? kamera.position.z : me.z);
    L2.spielerLicht.intensity = ego ? 1.1 : 0.7; L2.spielerLicht.distance = ego ? 9 : 13;
    szene.fog.density = ego ? 0.08 : 0.012;
    szene.fog.color.setHex(me.e === 1 ? 0x0b0805 : me.e === 2 ? 0x0c0f12 : 0x141a2a);
    hudBild(t);
    renderer.render(szene, kamera);
  }

  function kameraSetzen(dt) {
    let ziel;
    wackeln = Math.max(0, wackeln - dt);
    const w = wackeln * 0.35;
    const zittern = () => (Math.random() - 0.5) * w;
    // Zuschauen nach dem Ausbruch
    if (ich && ich.z === 'frei') {
      const andere = pos ? pos.s.filter(s => s[0] !== du) : [];
      let x = 49.5, z = 80, y = 0;
      if (andere.length) { const s = andere[zuschauer % andere.length]; const f = figuren.get(s[0]); if (f) { x = f.x; z = f.z; y = EBENE_Y[f.e]; } }
      else if (wachen.length) { const g = wachen[zuschauer % wachen.length]; x = g.x; z = g.z; }
      yaw += dt * 0.15;
      ziel = new T.Vector3(x, y + 1.4, z);
      kamera.position.set(x - Math.sin(yaw) * 7, y + 5, z - Math.cos(yaw) * 7);
      kamera.lookAt(ziel);
      return;
    }
    // Im Fahrzeug
    if (ich && ich.fz === 'van') {
      const g = welt.van.g;
      ziel = new T.Vector3(g.position.x, 1.6, g.position.z);
      const r = fahr ? fahr.r : g.rotation.y;
      if (fahr) yaw += winkel(yaw, r) * Math.min(1, dt * 3);
      kamera.position.set(ziel.x - Math.sin(yaw) * 9, 4.2 + pitch * 2, ziel.z - Math.cos(yaw) * 9);
      kamera.lookAt(ziel); return;
    }
    if (ich && ich.fz === 'heli') {
      const g = welt.heli.g;
      ziel = new T.Vector3(g.position.x, g.position.y + 1.5, g.position.z);
      kamera.position.set(ziel.x - Math.sin(yaw) * 11, ziel.y + 3 + pitch * 4, ziel.z - Math.cos(yaw) * 11);
      kamera.lookAt(ziel); return;
    }
    // Ego-Sicht im Tunnel und in der Lüftung
    if (me.e === 1 || me.e === 2) {
      const y = me.e === 1 ? -1.55 : 3.48;
      kamera.position.set(me.x + zittern(), y + zittern(), me.z + zittern());
      const p = Math.max(-0.8, Math.min(0.8, -pitch + 0.32));
      kamera.lookAt(me.x + Math.sin(yaw) * Math.cos(p), y + Math.sin(p), me.z + Math.cos(yaw) * Math.cos(p));
      return;
    }
    // Schulterkamera mit Wandkollision
    const basis = EBENE_Y[me.e];
    ziel = new T.Vector3(me.x, basis + 1.55, me.z);
    const dx = -Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = -Math.cos(yaw) * Math.cos(pitch);
    let d = 0.3;
    const K = S.K;
    while (d < kamDist) {
      const x = ziel.x + dx * d, y = ziel.y + dy * d, z = ziel.z + dz * d;
      const c = K.code(Math.floor(x), Math.floor(z));
      if ((c === '#' || c === 'M' || c === 'G') && y < 6.9) break;
      if ((c === 'D' || c === 'B' || c === 'R') && y > 2.25 && y < 4) break;   // Türsturz
      if (y < basis + 0.2) break;
      d += 0.15;
    }
    d = Math.max(0.35, d - 0.25);
    // In engen Räumen steigt die Kamera nach oben und schaut steiler herab
    const eng = Math.max(0, 1.6 - d) / 1.6;
    const hebe = eng * 1.6;
    // seitlich versetzt (über die Schulter)
    const sx = -Math.cos(yaw) * 0.45 * (1 - eng), sz = Math.sin(yaw) * 0.45 * (1 - eng);
    kamera.position.set(ziel.x + dx * d + sx * Math.min(1, d / 2) + zittern(), ziel.y + dy * d + hebe + zittern(), ziel.z + dz * d + sz * Math.min(1, d / 2) + zittern());
    kamera.lookAt(ziel.x + sx * 0.6, ziel.y, ziel.z + sz * 0.6);
  }

  /* ================= Anzeige ================= */
  function hudZustand() {
    if (!ich) return;
    // Inventar
    const slots = $('inv').children;
    for (let i = 0; i < 4; i++) {
      const a = ich.inv[i], el = slots[i];
      el.className = 'slot' + (i === ich.hand ? ' aktiv' : '') + (a === 'keyblau' ? ' blau' : a === 'keyrot' ? ' rot' : '') + (a && L.ITEMS[a].illegal ? ' illegal' : '');
      el.innerHTML = `<span class="nr">${i + 1}</span>${a ? `<span class="ic">${ICON[a] || '?'}</span><span class="nm">${esc(L.ITEMS[a].name)}</span>` : ''}`;
    }
    $('hp').style.width = ich.hp + '%';
    $('hp').classList.toggle('tief', ich.hp < 35);
    $('uni').hidden = !ich.uni;
    $('gesucht').hidden = !ich.gesucht;
    $('strom').textContent = Z.strom ? '⚡ Strom an' : '🔌 Stromausfall';
    $('strom').classList.toggle('aus', !Z.strom);
    $('alarm').className = 'alarm s' + Z.alarm;
    $('alarm').textContent = Z.alarm >= 2 ? '🚨 ALARM' : Z.alarm === 1 ? '⚠️ Verdacht' : '😴 Ruhig';
    document.body.classList.toggle('alarmRot', Z.alarm >= 2);
    // Overlays
    const ov = $('zustandOv');
    if (ich.z === 'iso') { ov.hidden = false; ov.innerHTML = '<b>EINZELHAFT</b><span id="isoZeit"></span><small>Dein verbotenes Zeug ist weg. Danach geht es zurück in deine Zelle.</small>'; }
    else if (ich.z === 'ko') { ov.hidden = false; ov.innerHTML = '<b>K.O.</b><small>Du hast alles fallen lassen …</small>'; }
    else if (ich.z === 'frei') { ov.hidden = false; ov.innerHTML = '<b>FREI!</b><small>Klick/Tippen: anderen zuschauen</small>'; ov.classList.add('frei'); }
    else { ov.hidden = true; ov.classList.remove('frei'); }
    // Mitspieler-Liste
    $('leute').innerHTML = Z.sp.map(s => `<div class="${s.z}${s.id === du ? ' ich' : ''}">${TIER_ICON[s.tier] || ''} ${esc(s.name)} ${s.z === 'frei' ? '✅' : s.z === 'iso' ? '🔒' : s.z === 'ko' ? '💫' : s.weg ? '📴' : ''}</div>`).join('');
  }
  /* Tipp: nächster sinnvoller Schritt, Ziel erscheint auf der Minikarte */
  let tippZiel = null, tippDistAlt = '';
  function tippAktualisieren() {
    const el = $('tipp');
    if (!einst.tipps || !ich || ich.z !== 'aktiv' || Z.phase === 'ende') { el.hidden = true; tippZiel = null; return; }
    const t = L.tipp(Z.items, { inv:ich.inv, x:me.x, z:me.z }, Z.strom);
    tippZiel = t.x != null ? t : null;
    el.hidden = false; $('tippText').textContent = t.text;
  }
  function tippUmschalten() {
    einst.tipps = !einst.tipps; merken(); $('tippsAn').checked = einst.tipps;
    if (einst.tipps) tippAktualisieren(); else $('tipp').hidden = true;
  }
  const RICHTUNG = ['Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest', 'Nord', 'Nordost'];
  function hudBild(t) {
    if (!ich) return;
    if (tippZiel) {
      const dx = tippZiel.x - me.x, dz = tippZiel.z - me.z;
      const txt = Math.round(Math.hypot(dx, dz)) + ' m ' + RICHTUNG[Math.round(Math.atan2(dz, dx) / (Math.PI / 4) + 8) % 8];
      if (txt !== tippDistAlt) { tippDistAlt = txt; $('tippDist').textContent = txt; }
    } else if (tippDistAlt) { tippDistAlt = ''; $('tippDist').textContent = ''; }
    const rest = Math.max(0, Z.dauer - t);
    $('uhr').textContent = Math.floor(rest / 60) + ':' + String(Math.floor(rest % 60)).padStart(2, '0');
    $('uhr').classList.toggle('knapp', rest < 60);
    const zone = me.e === 1 ? 'Tunnel' : me.e === 2 ? 'Lüftung' : me.e === 3 ? 'Dach' : S.K.zoneBei(me.x, me.z).name;
    const verboten = me.e === 3 || (me.e === 0 && S.K.zoneBei(me.x, me.z).verboten);
    $('ort').textContent = zone; $('ort').classList.toggle('verboten', verboten && !ich.uni);
    $('ausdauer').style.width = Math.round(ausdauer * 100) + '%';
    if (ich.z === 'iso' && $('isoZeit')) $('isoZeit').textContent = Math.max(0, Math.ceil(ich.bis - t)) + ' s';
    // Hinweis/Aktion
    const p = $('prompt');
    if (ich.akt) {
      const a = Math.min(1, (performance.now() - aktStart) / 1000 / ich.akt.dauer);
      p.hidden = false; p.className = 'prompt laeuft';
      p.innerHTML = `<span>${esc(ich.akt.text)} …</span><i style="width:${a * 100}%"></i><small>${touch ? '' : 'Bewegen bricht ab'}</small>`;
    } else if (ich.z === 'aktiv') {
      const m = L.moeglich(S, sicht());
      if (m) { p.hidden = false; p.className = 'prompt' + (m.info ? ' info' : ''); p.innerHTML = m.info ? `<span>${esc(m.text)}</span>` : `<kbd>${touch ? '✋' : 'E'}</kbd><span>${esc(m.text)}</span>`; }
      else p.hidden = true;
      $('tAktion').classList.toggle('bereit', !!m && !m.info);
    } else p.hidden = true;
    if (ich.fz === 'van' && S.van.fahrer === du) { p.hidden = false; p.className = 'prompt info'; p.innerHTML = `<span>${touch ? 'Stick: fahren · ✋ aussteigen' : 'W/S Gas/Bremse · A/D lenken · E aussteigen'} — Tore mit Schwung rammen!</span>`; }
    minikarte();
  }

  /* ---------- Karten ---------- */
  const ZONENFARBE = { frei:'#2f4a2a', streifen:'#6d675a', hof:'#5e4c38', zellen:'#8a8577', treppe:'#7a6e6e', duschen:'#7e8a8a', kantine:'#8a8070', kueche:'#8a7a6a', waescherei:'#7d8590', werkstatt:'#7a7468', garage:'#6e6e74', generator:'#6e6e60', wachstube:'#5e6b80', flur:'#6b6b7a', direktor:'#7a5e5e', iso:'#5a5a5a', schuppen:'#6b5a40', tor:'#6a6a6a' };
  function basisZeichnen(gr) {
    const c = document.createElement('canvas'); c.width = KA.W * gr; c.height = KA.H * gr;
    const x = c.getContext('2d'), K = S.K;
    for (let z = 0; z < KA.H; z++) for (let i = 0; i < KA.W; i++) {
      const code = K.code(i, z);
      let f = ZONENFARBE[K.zoneBei(i + 0.5, z + 0.5).id] || '#444';
      if (code === '#' || code === 'M') f = '#1b1d21';
      else if (code === 'Z') f = '#c9ced4';
      else if (code === 'B') f = '#2196f3';
      else if (code === 'R') f = '#e53935';
      else if (code === 'D') f = '#c8b48a';
      else if (code === 'T' || code === 'G') f = '#f2c14e';
      else if (code === 'x') f = '#3c3a36';
      else if (code === 'L' || code === 'l') f = '#ff7a1a';
      else if (code === 'O') f = '#000';
      else if (code === '=') f = '#3a3c40';
      x.fillStyle = f; x.fillRect(i * gr, z * gr, gr, gr);
    }
    return c;
  }
  let groessKarteBasis = null;
  function minikarte() {
    const c = $('mini'), x = c.getContext('2d');
    if (!karteBasis) { karteBasis = basisZeichnen(2); groessKarteBasis = null; }
    // Ausschnitt 46 m um mich herum
    const gr = 2, aus = 46, sx = me.x - aus / 2, sz = me.z - aus / 2, s = c.width / aus;
    x.fillStyle = '#0d0f12'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(karteBasis, sx * gr, sz * gr, aus * gr, aus * gr, 0, 0, c.width, c.height);
    const punkt = (px, pz, farbe, r) => { x.fillStyle = farbe; x.beginPath(); x.arc((px - sx) * s, (pz - sz) * s, r, 0, 7); x.fill(); };
    for (const w of wachen) if (Math.hypot(w.x - me.x, w.z - me.z) < 20) punkt(w.x, w.z, w.anim === 4 ? '#777' : '#ff3b30', 4);
    if (pos) for (const [id] of pos.s) { if (id === du) continue; const f = figuren.get(id); if (f) punkt(f.x, f.z, '#ffb06a', 3.5); }
    for (const it of S.items) if (Math.hypot(it.x - me.x, it.z - me.z) < 20) punkt(it.x, it.z, '#f2e27a', 2);
    // Tipp-Ziel: Ring auf der Karte, außerhalb als Pfeil am Rand
    if (tippZiel) {
      const tx = (tippZiel.x - sx) * s, tz = (tippZiel.z - sz) * s, m = c.width / 2, puls = 1 + Math.sin(performance.now() / 260) * 0.2;
      x.strokeStyle = '#ff7a1a'; x.fillStyle = '#ff7a1a'; x.lineWidth = 2.5;
      if (tx > 8 && tx < c.width - 8 && tz > 8 && tz < c.height - 8) { x.beginPath(); x.arc(tx, tz, 7 * puls, 0, 7); x.stroke(); x.beginPath(); x.arc(tx, tz, 2.5, 0, 7); x.fill(); }
      else {
        const a = Math.atan2(tz - m, tx - m), r = m - 10;
        x.save(); x.translate(m + Math.cos(a) * r, m + Math.sin(a) * r); x.rotate(a);
        x.beginPath(); x.moveTo(7 * puls, 0); x.lineTo(-5, 6); x.lineTo(-2, 0); x.lineTo(-5, -6); x.closePath(); x.fill(); x.restore();
      }
    }
    // ich als Pfeil
    x.save(); x.translate((me.x - sx) * s, (me.z - sz) * s); x.rotate(-me.r + Math.PI);
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 5); x.lineTo(0, 2); x.lineTo(-5, 5); x.closePath(); x.fill(); x.restore();
  }
  function grosseKarte(an) {
    const el = $('karteGross');
    el.classList.toggle('an', an);
    if (!an || !S) return;
    const c = $('gross'), x = c.getContext('2d'), gr = 8;
    if (!groessKarteBasis) groessKarteBasis = basisZeichnen(gr);
    c.width = KA.W * gr; c.height = KA.H * gr;
    x.drawImage(groessKarteBasis, 0, 0);
    // Beschriftungen
    x.font = '700 22px "Barlow Semi Condensed", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.shadowColor = '#000'; x.shadowBlur = 4;
    for (const [t, px, pz] of [['Zellenblock', 35, 22.5], ['Kantine', 67, 22], ['Küche', 82, 19], ['Wäscherei', 73, 37], ['Werkstatt', 73, 51], ['Garage', 74, 66], ['Generator', 39.5, 64], ['Wachstube', 22, 42], ['Direktor', 17, 51], ['Einzelhaft', 29.5, 53.7], ['Hof', 47, 44], ['Schuppen', 36, 56.5], ['Todesstreifen', 50, 9.5], ['Haupttor', 49.5, 70], ['FREIHEIT', 50, 3]]) x.fillText(t, px * gr, pz * gr);
    x.font = '22px sans-serif';
    for (const g of S.K.gitter) x.fillText(g.offen ? '🔓' : '▦', (g.x + 0.5) * gr, (g.z + 0.9) * gr);
    x.fillText('🚁', KA.OBJ.heli.x * gr, KA.OBJ.heli.z * gr);
    if (tippZiel) x.fillText('🎯', tippZiel.x * gr, tippZiel.z * gr);
    x.fillText('🔧', KA.OBJ.werkbank.x * gr, (KA.OBJ.werkbank.z + 1.5) * gr);
    x.fillText('🔴', KA.OBJ.torschalter.x * gr, (KA.OBJ.torschalter.z + 1) * gr);
    x.shadowBlur = 0;
    // Spieler
    if (pos) for (const [id] of pos.s) { const f = figuren.get(id); if (!f) continue; x.fillStyle = id === du ? '#fff' : '#ffb06a'; x.beginPath(); x.arc(f.x * gr, f.z * gr, id === du ? 9 : 7, 0, 7); x.fill(); }
    if (S.van && !S.van.weg) x.fillText('🚐', welt.van.g.position.x * gr, welt.van.g.position.z * gr);
  }

  /* ---------- Kleinkram ---------- */
  function feed(html, roh) {
    const d = document.createElement('div'); d.innerHTML = roh ? html : esc(html);
    $('feed').appendChild(d);
    while ($('feed').children.length > 6) $('feed').firstChild.remove();
    setTimeout(() => d.classList.add('weg'), 7000); setTimeout(() => d.remove(), 8000);
  }
  function hinweis(text) { const h = $('hinweis'); h.textContent = text; h.hidden = false; clearTimeout(hinweis.t); hinweis.t = setTimeout(() => { h.hidden = true; }, 4500); }
  function blitzRot() { const b = $('rot'); b.classList.remove('an'); void b.offsetWidth; b.classList.add('an'); }
  function grossText(a, b) { const g = $('gross_text'); g.innerHTML = `<b>${esc(a)}</b><small>${esc(b || '')}</small>`; g.classList.remove('an'); void g.offsetWidth; g.classList.add('an'); }

  /* ================= Menüs ================= */
  function zeigeNur(id) {
    for (const s of ['menu', 'lobby', 'hud', 'ende']) $(s).hidden = s !== id;
    document.body.classList.toggle('imSpiel', id === 'hud');
  }
  function zeigeMenu() {
    modus = 'menu'; zeigeNur('menu');
    if (welt) spielAufraeumen();
    TON.sirene(false);
    setTimeout(menuHintergrund, 60);
  }
  function tierWahl() {
    $('tiere').innerHTML = L.TIERE.map(t => `<button class="tier${t === einst.tier ? ' an' : ''}" data-t="${t}" title="${L.TIER_NAMEN[t]}"><span>${TIER_ICON[t]}</span><small>${L.TIER_NAMEN[t]}</small></button>`).join('');
  }
  $('tiere').addEventListener('click', e => {
    const b = e.target.closest('.tier'); if (!b) return;
    einst.tier = b.dataset.t; merken(); tierWahl();
    if (netz && !netz.lokal) senden({ t:'ich', tier:einst.tier });
  });
  $('name').value = einst.name;
  $('name').addEventListener('input', () => { einst.name = $('name').value.trim().slice(0, 16); merken(); });
  for (const [id, k, zahl] of [['modus', 'modus'], ['dauer', 'dauer', true], ['grafik', 'grafik']]) {
    $(id).value = String(einst[k]);
    $(id).addEventListener('change', () => { einst[k] = zahl ? +$(id).value : $(id).value; merken(); if (id === 'grafik') hinweis('Grafik gilt nach dem Neuladen.'); });
  }
  $('schwer').value = einst.schwer; $('schwer').addEventListener('change', () => { einst.schwer = $('schwer').value; merken(); });
  $('laut').value = Math.round(einst.laut * 100); $('laut').addEventListener('input', () => { einst.laut = $('laut').value / 100; TON.laut(einst.laut); merken(); });
  $('laut').addEventListener('change', () => { TON.start(); TON.piep(); });
  $('empf').value = Math.round(einst.empf * 100); $('empf').addEventListener('input', () => { einst.empf = $('empf').value / 100; merken(); });
  $('tippsAn').checked = einst.tipps; $('tippsAn').addEventListener('change', () => { einst.tipps = $('tippsAn').checked; merken(); });
  $('tipp').addEventListener('click', tippUmschalten);
  $('tonAn').checked = einst.ton; $('tonAn').addEventListener('change', () => { einst.ton = $('tonAn').checked; TON.an(einst.ton); merken(); });
  const nameOk = () => { if (!einst.name) { einst.name = $('name').value.trim() || ('Häftling ' + (100 + Math.floor(Math.random() * 900))); $('name').value = einst.name; merken(); } };
  $('solo').addEventListener('click', () => {
    nameOk(); TON.start();
    if (netz) netz.schliessen();
    netz = lokal();
    raum = null;
    spielStart();
  });
  $('erstellen').addEventListener('click', () => {
    nameOk(); TON.start();
    try { sessionStorage.removeItem(SITZUNG); } catch (_) { /* egal */ }
    if (netz) netz.schliessen();
    netz = online(() => senden({ t:'neu', einst:{ modus:einst.modus, dauer:einst.dauer } }));
  });
  function beitreten(code) {
    nameOk(); TON.start();
    try { sessionStorage.removeItem(SITZUNG); } catch (_) { /* egal */ }
    if (netz) netz.schliessen();
    netz = online(() => senden({ t:'beitreten', code }));
  }
  $('beitreten').addEventListener('click', () => { const c = $('code').value.trim().toUpperCase(); if (c.length === 4) beitreten(c); else hinweis('Der Code hat 4 Zeichen.'); });
  $('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('beitreten').click(); });
  $('hilfeKnopf').addEventListener('click', () => { $('hilfe').hidden = !$('hilfe').hidden; });

  function zeigeLobby() {
    modus = 'lobby'; zeigeNur('lobby');
    const host = raum.host === du;
    $('lCode').textContent = raum.code;
    const link = location.origin + '/?raum=' + raum.code;
    $('lLink').value = link;
    $('lLeute').innerHTML = raum.mitglieder.map(m => `<li class="${m.online ? '' : 'off'}">${TIER_ICON[m.tier] || ''} ${esc(m.name)}${m.id === raum.host ? ' <em>Host</em>' : ''}${m.id === du ? ' <em>du</em>' : ''}</li>`).join('');
    $('lModus').value = raum.einst.modus; $('lDauer').value = String(raum.einst.dauer);
    $('lModus').disabled = $('lDauer').disabled = !host;
    $('lStart').hidden = !host; $('lWarten').hidden = host;
    $('lAnzahl').textContent = raum.mitglieder.length + ' / ' + L.MAX_SPIELER;
  }
  function zeigeLobbyKurz() { if (modus === 'lobby') zeigeLobby(); }
  const einstSenden = () => senden({ t:'einst', einst:{ modus:$('lModus').value, dauer:+$('lDauer').value } });
  $('lModus').addEventListener('change', einstSenden); $('lDauer').addEventListener('change', einstSenden);
  $('lStart').addEventListener('click', () => senden({ t:'start' }));
  $('lRaus').addEventListener('click', () => { senden({ t:'verlassen' }); });
  $('lKopie').addEventListener('click', () => { $('lLink').select(); try { navigator.clipboard.writeText($('lLink').value); hinweis('Link kopiert'); } catch (_) { document.execCommand('copy'); } });

  function zeigeEnde() {
    modus = 'ende'; spielEnde();
    zeigeNur('ende');
    const liste = Z.ergebnis || [];
    const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    const frei = liste.filter(e => e.frei != null).length;
    $('eTitel').textContent = frei === liste.length ? 'Alle sind ausgebrochen!' : frei ? frei + ' von ' + liste.length + ' sind entkommen' : 'Niemand ist entkommen …';
    $('eListe').innerHTML = liste.map((e, i) => `<tr class="${e.id === du ? 'ich' : ''}"><td>${e.frei != null ? (i + 1) + '.' : '–'}</td><td>${TIER_ICON[e.tier] || ''} ${esc(e.name)}</td><td>${e.frei != null ? '✅ ' + fmt(e.frei) : '🔒 drin'}</td><td>${esc(e.wege.join(' + ') || '')}</td><td>${e.gefasst}× gefasst</td></tr>`).join('');
    const m = liste.find(e => e.id === du);
    const karten = [];
    if (m) {
      const draussen = m.frei != null;
      karten.push([draussen ? fmt(m.frei) : '—', 'Deine Zeit', draussen ? 'gut' : 'schlecht']);
      karten.push([draussen ? (m.wege.join(' + ') || 'zu Fuß') : 'drin', 'Dein Weg', draussen ? 'gut' : 'schlecht']);
      karten.push([m.gefasst, 'Mal gefasst', m.gefasst ? 'schlecht' : 'gut']);
      karten.push([m.kos, 'Wärter k.o.', '']);
      if (draussen && liste.length > 1) karten.push([(liste.filter(e => e.frei != null).indexOf(m) + 1) + '.', 'Platz', '']);
      if (netz && netz.lokal && Z.dauer && draussen) karten.push([Math.max(0, Math.round(100 - m.frei / Z.dauer * 60 - m.gefasst * 10)), 'Punkte', 'gut']);
    }
    $('eStat').innerHTML = karten.map(([w, b, k], i) => `<div class="stat ${k}" style="animation-delay:${i * 70}ms"><b>${esc(w)}</b><small>${b}</small></div>`).join('');
    const host = netz && (netz.lokal || (raum && raum.host === du));
    $('eNochmal').hidden = !host;
  }
  $('eNochmal').addEventListener('click', () => {
    if (netz && netz.lokal) { netz.schliessen(); netz = lokal(); spielStart(); }
    else senden({ t:'nochmal' });
  });
  $('eMenu').addEventListener('click', () => {
    if (netz) { if (!netz.lokal) senden({ t:'verlassen' }); netz.schliessen(); netz = null; }
    try { sessionStorage.removeItem(SITZUNG); } catch (_) { /* egal */ }
    zeigeMenu();
  });
  $('aufgeben').addEventListener('click', () => { if (confirm('Runde verlassen?')) $('eMenu').click(); });
  $('aufgeben2').addEventListener('click', () => { if (confirm('Runde verlassen?')) $('eMenu').click(); });
  $('mini').addEventListener('pointerdown', e => { e.stopPropagation(); grosseKarte(true); });

  /* ================= Los ================= */
  tierWahl();
  zeigeMenu();
  // Einladungslink oder Wiederverbinden nach Neuladen
  const ladeRaum = new URLSearchParams(location.search).get('raum');
  let sitz = null; try { sitz = JSON.parse(sessionStorage.getItem(SITZUNG) || 'null'); } catch (_) { /* egal */ }
  if (sitz && sitz.raum && sitz.token) netz = online();
  else if (ladeRaum) { $('code').value = ladeRaum.toUpperCase(); if (einst.name) beitreten(ladeRaum.toUpperCase()); else hinweis('Name eingeben und „Beitreten“ drücken.'); }
  history.replaceState(null, '', location.pathname + (new URLSearchParams(location.search).get('touch') === '1' ? '?touch=1' : ''));
  requestAnimationFrame(bild);

  // Debug
  window.knastknacker = Object.assign(window.knastknacker || {}, {
    // Bilder von Hand (das eingebettete Browserfenster liefert im Hintergrund kein requestAnimationFrame)
    tick:n => { for (let i = 0; i < n; i++) { alt = performance.now() - 33; bildSchritt(); if (netz && netz.lokal && i % 3 < 2) netz.pumpe(1); } },
    blick:(y, p) => { yaw = y; if (p != null) pitch = p; },
    info:() => ({ modus, tasten:[...tasten], yaw, pitch, ausdauer }),
    me:() => me, S:() => S, Z:() => Z, welt:() => welt, kamera, renderer,
    szene:() => szene, bild:() => { if (szene) renderer.render(szene, kamera); },
    setze:(x, z, e = 0) => { me.x = x; me.z = z; me.e = e; },
    // Solo: Spieler über das Spiel versetzen bzw. etwas in die Tasche stecken
    tp:(x, z, e = 0, r) => { const sp = netz && netz.lokal && netz.spiel.spieler.get('ich'); if (sp) netz.spiel.tele(sp, x, z, e, r); },
    gib:art => { const sp = netz && netz.lokal && netz.spiel.spieler.get('ich'); if (sp) { netz.spiel.gib(sp, art); netz.spiel.geaendert(); } }
  });
})();
