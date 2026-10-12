/* Knastknacker – Figuren und Gegenstände aus Grundformen (three.js r128).
   Häftlinge: Tiere im orangen Overall. Wärter: Bulldoggen in Uniform mit Mütze. Modelle schauen nach +z. */
(function () {
  'use strict';
  const T = THREE;
  const mats = new Map(), geos = new Map();
  function stoff(farbe, rau = 0.8, metall = 0, extra) {
    metall = Math.min(metall, 0.35);   // ohne Umgebungsbild wirkt echtes Metall schwarz
    const k = farbe + ':' + rau + ':' + metall + (extra ? JSON.stringify(extra) : '');
    if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ color:farbe, roughness:rau, metalness:metall, ...extra }));
    return mats.get(k);
  }
  function geo(art, ...a) { const k = art + a.join(','); if (!geos.has(k)) geos.set(k, new T[art](...a)); return geos.get(k); }
  const M = (g, m, x = 0, y = 0, z = 0) => { const t = new T.Mesh(g, typeof m === 'number' ? stoff(m) : m); t.position.set(x, y, z); t.castShadow = true; return t; };
  const K = (r, m, x, y, z, s = 18) => M(geo('SphereGeometry', r, s, Math.round(s * 0.7)), m, x, y, z);
  const Z = (r1, r2, h, m, x, y, z, s = 14) => M(geo('CylinderGeometry', r1, r2, h, s), m, x, y, z);
  const B = (w, h, d, m, x, y, z) => M(geo('BoxGeometry', w, h, d), m, x, y, z);
  const hell = (f, a) => new T.Color(f).lerp(new T.Color(0xffffff), a).getHex();
  const dunkel = (f, a) => new T.Color(f).multiplyScalar(1 - a).getHex();

  const ARTEN = {
    loewe:{ fell:0xe8a03c, bauch:0xf6d08a, ohren:'rund', maul:'kurz', extra:'maehne', mfarbe:0xa8561a },
    fuchs:{ fell:0xe0702a, bauch:0xfaf3ea, ohren:'spitz', maul:'spitz', extra:'schwanz' },
    waschbaer:{ fell:0x8d8f93, bauch:0xd8d8d8, ohren:'spitz', maul:'kurz', extra:'maske' },
    pinguin:{ fell:0x2a2d35, bauch:0xf4f4f4, ohren:'keine', maul:'schnabel', schnabel:0xf29a2e },
    hase:{ fell:0xf2efe9, bauch:0xffffff, ohren:'lang', maul:'kurz' },
    baer:{ fell:0x7b5233, bauch:0xc49a6c, ohren:'rund', maul:'kurz' },
    affe:{ fell:0x6e4a2c, bauch:0xe8c9a0, ohren:'affe', maul:'kurz' },
    panda:{ fell:0xf4f4f4, bauch:0xffffff, ohren:'rund', ohrfarbe:0x1c1c1e, maul:'kurz', extra:'panda' },
    krokodil:{ fell:0x4f8a3a, bauch:0xc9d98a, ohren:'keine', maul:'lang' },
    schwein:{ fell:0xf2a7b5, bauch:0xf7c6cf, ohren:'spitz', maul:'ruessel' },
    hund:{ fell:0xc9955c, bauch:0xf2dcc0, ohren:'schlapp', maul:'kurz' },
    katze:{ fell:0x9a9a9a, bauch:0xeeeeee, ohren:'spitz', maul:'kurz' },
    ziege:{ fell:0xece6da, bauch:0xffffff, ohren:'schlapp', maul:'spitz', extra:'hoerner' },
    maus:{ fell:0x8c8580, bauch:0xd6ccc8, ohren:'gross', maul:'spitz' },
    otter:{ fell:0x6d4c33, bauch:0xc8a986, ohren:'rund', maul:'kurz' },
    bulldogge:{ fell:0xc8a27a, bauch:0xf0dcc0, ohren:'schlapp', maul:'bull' }
  };
  const OVERALL = 0xff7a1a, UNIFORM = 0x22314f;

  /* ---------- Meshes einer Gruppe nach Material zusammenfassen (weniger Zeichenaufrufe) ----------
     Nur direkte Mesh-Kinder; mit tief=true auch in Untergruppen. userData.bleibt schützt einzelne Meshes. */
  const _m = new T.Matrix4();
  function verschmelzen(gruppe, tief) {
    if (tief) for (const c of [...gruppe.children]) {
      if (c.isMesh || c.isSprite || !c.children.length) continue;
      verschmelzen(c, true);
      if (c.userData.bewegt) continue;
      // Unbewegliche Untergruppe auflösen: Kinder mit eingerechneter Lage in die Gruppe hängen
      c.updateMatrix();
      for (const k of [...c.children]) { k.updateMatrix(); _m.multiplyMatrices(c.matrix, k.matrix); _m.decompose(k.position, k.quaternion, k.scale); gruppe.add(k); }
      gruppe.remove(c);
    }
    const nachMat = new Map();
    for (const m of [...gruppe.children]) {
      if (!m.isMesh || m.userData.bleibt || m.isInstancedMesh || m.children.length) continue;
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      if (!nachMat.has(m.material)) nachMat.set(m.material, { geos:[], schatten:m.castShadow });
      nachMat.get(m.material).geos.push(g);
      gruppe.remove(m);
    }
    for (const [mat, { geos, schatten }] of nachMat) {
      let n = 0; for (const g of geos) n += g.attributes.position.count;
      const p = new Float32Array(n * 3), no = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const g of geos) {
        p.set(g.attributes.position.array, o * 3);
        if (g.attributes.normal) no.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += g.attributes.position.count; g.dispose();
      }
      const bg = new T.BufferGeometry();
      bg.setAttribute('position', new T.BufferAttribute(p, 3)); bg.setAttribute('normal', new T.BufferAttribute(no, 3)); bg.setAttribute('uv', new T.BufferAttribute(uv, 2));
      const me = new T.Mesh(bg, mat); me.castShadow = schatten; me.receiveShadow = true;
      gruppe.add(me);
    }
  }

  /* ---------- Rückennummer als Textur ---------- */
  const nummern = new Map();
  function nummer(text, farbe) {
    const k = text + farbe;
    if (nummern.has(k)) return nummern.get(k);
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#f6f1e6'; x.fillRect(0, 0, 128, 64);
    x.fillStyle = farbe; x.font = 'bold 40px "Barlow Semi Condensed", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 64, 34);
    const t = new T.CanvasTexture(c); nummern.set(k, t); return t;
  }

  /* ---------- Kopf ---------- */
  function kopfBauen(art, A) {
    const kopf = new T.Group();
    const mFell = stoff(A.fell, 0.85), mBauch = stoff(A.bauch, 0.85);
    const s = K(0.225, mFell, 0, 0, 0, 28); s.scale.set(1, 0.94, 0.96); kopf.add(s);
    if (A.extra === 'maehne') {
      const mM = stoff(A.mfarbe, 0.9), mM2 = stoff(hell(A.mfarbe, 0.15), 0.9);
      for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 12; i++) {
        const w = i / 12 * Math.PI * 2 + ring * 0.26, r = ring ? 0.25 : 0.215;
        const t = M(geo('ConeGeometry', ring ? 0.085 : 0.075, ring ? 0.2 : 0.17, 8), ring ? mM : mM2, Math.cos(w) * r, Math.sin(w) * r * 0.95, -0.07 - ring * 0.04);
        t.rotation.z = w - Math.PI / 2; t.rotation.x = -0.35; kopf.add(t);
      }
      const h = K(0.24, mM, 0, 0, -0.09, 20); h.scale.set(1, 1, 0.6); kopf.add(h);
    }
    // Augen
    const weiss = stoff(0xffffff, 0.2), pu = stoff(0x111111, 0.2), glanz = new T.MeshBasicMaterial({ color:0xffffff });
    const augenY = art === 'krokodil' ? 0.12 : 0.035;
    const lider = [];
    for (const sx of [-1, 1]) {
      const a = new T.Group(); a.position.set(sx * 0.083, augenY, art === 'krokodil' ? 0.12 : 0.178); a.rotation.y = sx * 0.28;
      const ap = K(0.05, weiss, 0, 0, 0, 16); ap.scale.set(0.9, 1, 0.55); a.add(ap);
      const p = K(0.026, pu, 0, -0.003, 0.025, 12); p.scale.z = 0.5; a.add(p);
      a.add(M(geo('SphereGeometry', 0.008, 6, 4), glanz, -sx * 0.01 + 0.005, 0.01, 0.038));
      const lid = K(0.054, mFell, 0, 0.05, 0.002, 14); lid.scale.set(0.95, 0.001, 0.6); lid.userData.bleibt = true; a.add(lid); lider.push(lid);
      const braue = B(0.055, 0.012, 0.012, stoff(dunkel(art === 'pinguin' || art === 'panda' ? 0x777777 : A.fell, 0.55), 0.6), sx * 0.004, 0.066, 0.02);
      braue.rotation.z = -sx * 0.15; a.add(braue); a.braue = braue;
      kopf.add(a);
    }
    if (A.extra === 'maske') { const mk = K(0.1, stoff(0x2d2d30, 0.8), 0, 0.03, 0.15, 16); mk.scale.set(1.95, 0.55, 0.5); kopf.add(mk); kopf.children.forEach(c => { if (c.type === 'Group') c.position.z += 0.012; }); }
    if (A.extra === 'panda') for (const sx of [-1, 1]) { const f = K(0.06, stoff(0x1c1c1e, 0.8), sx * 0.085, 0.03, 0.165, 14); f.scale.set(0.9, 1.15, 0.45); f.rotation.z = sx * 0.4; kopf.add(f); kopf.children.forEach(c => { if (c.type === 'Group') c.position.z = Math.max(c.position.z, 0.19); }); }
    if (art !== 'pinguin' && art !== 'krokodil') for (const sx of [-1, 1]) { const w = K(0.034, stoff(0xff8fa3, 0.8, 0, { transparent:true, opacity:0.45 }), sx * 0.13, -0.05, 0.165, 10); w.scale.set(1, 0.6, 0.3); kopf.add(w); }
    const nase = stoff(0x2a1712, 0.3);
    switch (A.maul) {
      case 'kurz': {
        const m = K(0.09, mBauch, 0, -0.075, 0.155, 16); m.scale.set(1.25, 0.82, 0.85); kopf.add(m);
        const n = K(0.034, nase, 0, -0.04, 0.23, 12); n.scale.set(1.25, 0.85, 0.8); kopf.add(n);
        break;
      }
      case 'spitz': {
        const m = M(geo('ConeGeometry', 0.085, 0.2, 14), mBauch, 0, -0.06, 0.24); m.rotation.x = Math.PI / 2; kopf.add(m);
        kopf.add(K(0.026, stoff(0x151515, 0.3), 0, -0.06, 0.34, 10));
        break;
      }
      case 'schnabel': {
        const ob = M(geo('ConeGeometry', 0.06, 0.15, 14), stoff(A.schnabel, 0.4), 0, -0.04, 0.26); ob.rotation.x = Math.PI / 2; ob.scale.set(1.4, 1, 0.6); kopf.add(ob);
        const ges = K(0.16, mBauch, 0, -0.01, 0.105, 18); ges.scale.set(1.15, 1, 0.75); kopf.add(ges);
        kopf.children.forEach(c => { if (c.type === 'Group') c.position.z += 0.035; });
        break;
      }
      case 'lang': {
        const m = B(0.2, 0.09, 0.32, mFell, 0, -0.07, 0.3); kopf.add(m);
        const u = B(0.19, 0.05, 0.3, mBauch, 0, -0.12, 0.29); kopf.add(u);
        for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) { const z = M(geo('ConeGeometry', 0.012, 0.03, 4), 0xffffff, sx * 0.09, -0.1, 0.18 + i * 0.06); z.rotation.x = Math.PI; kopf.add(z); }
        for (const sx of [-1, 1]) kopf.add(K(0.012, nase, sx * 0.04, -0.02, 0.45, 8));
        break;
      }
      case 'ruessel': {
        const r = Z(0.075, 0.08, 0.1, stoff(dunkel(A.fell, 0.08), 0.7), 0, -0.05, 0.22, 18); r.rotation.x = Math.PI / 2; kopf.add(r);
        for (const sx of [-1, 1]) kopf.add(K(0.016, stoff(0x8a4a55, 0.6), sx * 0.025, -0.05, 0.272, 8));
        break;
      }
      case 'bull': {
        const m = K(0.12, mBauch, 0, -0.08, 0.14, 18); m.scale.set(1.45, 0.85, 0.75); kopf.add(m);
        for (const sx of [-1, 1]) { const b = K(0.07, mBauch, sx * 0.08, -0.12, 0.13, 12); b.scale.set(1, 1.2, 0.9); kopf.add(b); }
        const n = K(0.045, nase, 0, -0.03, 0.225, 12); n.scale.set(1.4, 0.85, 0.8); kopf.add(n);
        for (const sx of [-1, 1]) { const z = M(geo('ConeGeometry', 0.014, 0.04, 5), 0xfafafa, sx * 0.05, -0.12, 0.215); kopf.add(z); }
        break;
      }
    }
    const innen = stoff(0xf2a7b5, 0.8), mOhr = A.ohrfarbe ? stoff(A.ohrfarbe, 0.85) : mFell;
    for (const sx of [-1, 1]) {
      const g = new T.Group();
      switch (A.ohren) {
        case 'rund': { const a = K(0.075, mOhr, 0, 0, 0, 14); a.scale.z = 0.55; g.add(a); if (!A.ohrfarbe) { const b = K(0.048, innen, 0, 0, 0.02, 12); b.scale.z = 0.4; g.add(b); } g.position.set(sx * 0.15, 0.17, -0.02); break; }
        case 'gross': { const a = K(0.12, mFell, 0, 0, 0, 14); a.scale.z = 0.3; g.add(a); const b = K(0.085, innen, 0, 0, 0.018, 12); b.scale.z = 0.25; g.add(b); g.position.set(sx * 0.19, 0.17, -0.02); break; }
        case 'affe': { const a = K(0.07, mFell, 0, 0, 0, 12); a.scale.set(0.5, 1, 1); g.add(a); const b = K(0.05, stoff(A.bauch, 0.8), sx * 0.015, 0, 0, 10); b.scale.set(0.4, 0.9, 0.9); g.add(b); g.position.set(sx * 0.22, 0.0, 0); break; }
        case 'spitz': { const a = M(geo('ConeGeometry', 0.075, 0.18, 10), mFell, 0, 0.06, 0); a.scale.z = 0.5; g.add(a); const b = M(geo('ConeGeometry', 0.045, 0.12, 8), innen, 0, 0.045, 0.02); b.scale.z = 0.35; g.add(b); g.position.set(sx * 0.14, 0.15, -0.02); g.rotation.z = -sx * 0.32; break; }
        case 'lang': { const a = K(0.06, mFell, 0, 0.17, 0, 12); a.scale.set(0.8, 3, 0.55); g.add(a); const b = K(0.04, innen, 0, 0.17, 0.02, 10); b.scale.set(0.7, 2.7, 0.35); g.add(b); g.position.set(sx * 0.085, 0.13, -0.02); g.rotation.z = -sx * 0.16; break; }
        case 'schlapp': { const a = K(0.08, stoff(dunkel(A.fell, 0.3), 0.85), 0, -0.1, 0, 12); a.scale.set(0.6, 1.6, 0.8); g.add(a); g.position.set(sx * 0.2, 0.08, -0.02); g.rotation.z = sx * 0.25; break; }
        default: continue;
      }
      kopf.add(g);
    }
    if (A.extra === 'hoerner') for (const sx of [-1, 1]) { const h = M(geo('ConeGeometry', 0.03, 0.16, 8), 0x8d7b62, sx * 0.08, 0.24, -0.04); h.rotation.set(-0.5, 0, -sx * 0.25); kopf.add(h); }
    kopf.lider = lider;
    return kopf;
  }

  /* ---------- Ganze Figur ---------- */
  // o: { wache, nummer, team (Farbe), skala }
  function figur(art, o = {}) {
    const A = ARTEN[art] || ARTEN.loewe;
    const g = new T.Group();
    const k = new T.Group(); g.add(k); k.userData.bewegt = true;
    const wache = !!o.wache;
    const kleid = wache ? UNIFORM : OVERALL;
    const mKleid = stoff(kleid, 0.72), mFell = stoff(A.fell, 0.85);
    const mSchuh = stoff(wache ? 0x111114 : 0xf2f2f2, 0.45), mSohle = stoff(0x222222, 0.6);
    // Beine
    const beine = [];
    for (const sx of [-1, 1]) {
      const b = new T.Group(); b.position.set(sx * 0.085, 0.32, 0); b.userData.bewegt = true;
      b.add(Z(0.068, 0.06, 0.28, mKleid, 0, -0.13, 0));
      const sch = K(0.07, mSchuh, 0, -0.285, 0.035, 12); sch.scale.set(1, 0.6, 1.55); b.add(sch);
      b.add(B(0.13, 0.02, 0.21, mSohle, 0, -0.31, 0.035));
      g.add(b); beine.push(b);
    }
    // Rumpf (Overall/Uniformjacke)
    const rumpf = M(geo('CylinderGeometry', 0.17, 0.2, 0.42, 20), mKleid, 0, 0.5, 0); k.add(rumpf);
    const schulter = K(0.2, mKleid, 0, 0.66, 0, 20); schulter.scale.set(1.05, 0.45, 0.9); k.add(schulter);
    if (art === 'pinguin') { const bb = K(0.14, stoff(A.bauch), 0, 0.5, 0.11, 16); bb.scale.set(1, 1.3, 0.5); k.add(bb); }
    if (wache) {
      // Hemdkragen, Krawatte, Gürtel mit Schlagstock, Abzeichen
      const kr = M(geo('ConeGeometry', 0.08, 0.16, 3), 0x9fc3e7, 0, 0.63, 0.15); kr.rotation.x = Math.PI; kr.scale.z = 0.35; k.add(kr);
      k.add(B(0.03, 0.14, 0.02, 0x101828, 0, 0.58, 0.19));
      k.add(Z(0.205, 0.205, 0.05, 0x1a1a1a, 0, 0.32, 0, 20));
      k.add(B(0.05, 0.035, 0.02, stoff(0xd4af37, 0.3, 0.9), 0, 0.32, 0.205));
      const st = Z(0.018, 0.018, 0.42, 0x111111, 0.2, 0.3, 0.05, 8); st.rotation.x = 0.2; k.add(st); g.stock = st;
      k.add(B(0.06, 0.07, 0.015, stoff(0xd4af37, 0.3, 0.9), -0.09, 0.6, 0.175));
    } else {
      // Kragen, Knopfleiste, Brusttasche mit Nummer, Rückennummer
      k.add(Z(0.1, 0.13, 0.05, stoff(dunkel(OVERALL, 0.12), 0.7), 0, 0.71, 0, 16));
      k.add(B(0.012, 0.36, 0.01, stoff(dunkel(OVERALL, 0.25), 0.6), 0, 0.5, 0.2));
      const nr = String(o.nummer || 100 + Math.floor(Math.random() * 899));
      const brust = new T.Mesh(geo('PlaneGeometry', 0.11, 0.055), new T.MeshStandardMaterial({ map:nummer(nr, '#222'), roughness:0.8 }));
      brust.position.set(0.085, 0.6, 0.197); brust.rotation.y = 0.18; k.add(brust);
      const ruecken = new T.Mesh(geo('PlaneGeometry', 0.24, 0.12), new T.MeshStandardMaterial({ map:nummer(nr, '#222'), roughness:0.8 }));
      ruecken.position.set(0, 0.56, -0.2); ruecken.rotation.y = Math.PI; k.add(ruecken);
      k.add(Z(0.205, 0.205, 0.04, stoff(dunkel(OVERALL, 0.2), 0.7), 0, 0.34, 0, 20));
    }
    // Arme
    const arme = [];
    for (const sx of [-1, 1]) {
      const a = new T.Group(); a.position.set(sx * 0.215, 0.64, 0); a.userData.bewegt = true;
      a.add(K(0.06, mKleid, 0, 0, 0, 12));
      a.add(Z(0.055, 0.048, 0.26, mKleid, 0, -0.13, 0.01, 12));
      const pf = K(0.052, mFell, 0, -0.31, 0.015, 12); a.add(pf);
      a.rotation.x = -0.1; a.rotation.z = sx * 0.1;
      k.add(a); arme.push(a);
    }
    // Teamband am linken Arm
    const band = Z(0.058, 0.058, 0.05, stoff(0xffffff, 0.5), 0, -0.07, 0.01, 12); arme[0].add(band); band.visible = false;
    // Kopf
    const kopf = kopfBauen(art, A); kopf.position.y = 0.92; kopf.userData.bewegt = true; k.add(kopf);
    // Wärtermütze (für Wärter und Häftlinge in Uniform)
    const muetze = new T.Group(); muetze.position.set(0, 0.17, -0.01);
    muetze.add(Z(0.2, 0.21, 0.09, UNIFORM, 0, 0.04, 0, 20));
    const deckel = Z(0.24, 0.24, 0.035, UNIFORM, 0, 0.1, 0.015, 20); deckel.scale.z = 1.05; muetze.add(deckel);
    const schirm = Z(0.17, 0.17, 0.015, 0x0d0d0f, 0, 0.01, 0.12, 16); schirm.scale.set(1, 1, 0.6); muetze.add(schirm);
    muetze.add(B(0.05, 0.04, 0.01, stoff(0xd4af37, 0.3, 0.9), 0, 0.06, 0.205));
    muetze.rotation.x = -0.08; muetze.userData.bewegt = true; kopf.add(muetze); muetze.visible = wache;
    // Schwänze
    if (A.extra === 'schwanz') { const sw = K(0.1, mFell, 0, 0.36, -0.27, 12); sw.scale.set(0.85, 0.85, 2.1); sw.rotation.x = 0.4; g.add(sw); g.add(K(0.07, stoff(A.bauch), 0, 0.45, -0.46, 10)); }
    if (art === 'waschbaer') for (let i = 0; i < 4; i++) g.add(K(0.07 - i * 0.004, i % 2 ? stoff(0x2d2d30, 0.85) : mFell, 0, 0.33 + i * 0.03, -0.24 - i * 0.085, 10));
    if (art === 'hase') g.add(K(0.06, stoff(A.bauch), 0, 0.36, -0.2, 10));
    if (art === 'krokodil') { const sw = M(geo('ConeGeometry', 0.12, 0.6, 10), mFell, 0, 0.25, -0.4); sw.rotation.x = -1.35; g.add(sw); }
    if (art === 'affe') { const sw = Z(0.025, 0.02, 0.5, mFell, 0, 0.4, -0.3, 8); sw.rotation.x = 0.9; g.add(sw); }
    if (art === 'schwein') { const sw = M(geo('TorusGeometry', 0.04, 0.012, 6, 12), mFell, 0, 0.36, -0.21); g.add(sw); }

    band.userData.bleibt = true;
    verschmelzen(g, true);
    g.skala = o.skala || 1.45;
    g.scale.setScalar(g.skala);
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    g.arme = arme; g.beine = beine; g.kopf = kopf; g.koerper = k;
    g.setTeam = farbe => { if (farbe == null) { band.visible = false; return; } band.visible = true; band.material = stoff(farbe, 0.5); };
    let uni = wache;
    g.setUniform = an => {
      if (wache || an === uni) return; uni = an;
      const m = stoff(an ? UNIFORM : OVERALL, 0.72);
      g.traverse(c => { if (c.isMesh && (c.material === mKleid || c.material === stoff(UNIFORM, 0.72) || c.material === stoff(OVERALL, 0.72))) c.material = m; });
      muetze.visible = an;
    };
    // Gegenstand in der rechten Hand
    let haltArt = null, anker = null;
    g.halte = art2 => {
      if (art2 === haltArt) return; haltArt = art2;
      if (anker) { arme[1].remove(anker); anker = null; }
      if (!art2) return;
      anker = new T.Group(); anker.position.set(0, -0.33, 0.04);
      const m = item(art2); m.scale.multiplyScalar(0.62); m.rotation.x = Math.PI / 2; anker.add(m);
      arme[1].add(anker);
    };
    // Animation: anim 0 steht, 1 geht, 2 rennt, 3 schlägt, 4 k.o., 5 arbeitet, 6 sitzt
    let schritt = 0, zeit = Math.random() * 10, blinzel = 2 + Math.random() * 3, schlag = 0, liegt = 0;
    g.schlag = () => { schlag = 0.32; };
    g.animieren = (dt, anim) => {
      zeit += dt;
      const tempo = anim === 2 ? 1.8 : anim === 1 ? 1 : 0;
      schritt += dt * tempo * 7.5;
      const sw = tempo ? Math.sin(schritt) : 0;
      const amp = anim === 2 ? 0.8 : 0.55;
      beine[0].rotation.x = sw * amp; beine[1].rotation.x = -sw * amp;
      k.position.y = Math.abs(sw) * 0.03;
      k.rotation.x = anim === 2 ? 0.18 : 0;
      let a0 = -0.1 - sw * amp * 0.9, a1 = -0.1 + sw * amp * 0.9;
      if (haltArt) a1 = -0.55 + sw * 0.15;
      if (anim === 5) { a0 = -1.1 + Math.sin(zeit * 9) * 0.35; a1 = -1.1 - Math.sin(zeit * 9) * 0.35; }
      if (anim === 3 && schlag <= 0) schlag = 0.32;
      if (schlag > 0) { schlag -= dt; a1 = -1.55; k.rotation.y = -0.25; } else k.rotation.y = 0;
      if (anim === 6) { beine[0].rotation.x = beine[1].rotation.x = -1.4; a0 = a1 = -0.5; }
      arme[0].rotation.x += (a0 - arme[0].rotation.x) * Math.min(1, dt * 14);
      arme[1].rotation.x += (a1 - arme[1].rotation.x) * Math.min(1, dt * 18);
      // k.o.: umfallen
      liegt += ((anim === 4 ? 1 : 0) - liegt) * Math.min(1, dt * 6);
      g.koerper.rotation.x = k.rotation.x - liegt * 1.45;
      g.koerper.position.y = k.position.y + liegt * 0.12;
      for (const b of beine) { b.rotation.x = b.rotation.x * (1 - liegt) - liegt * 1.4; b.position.y = 0.32 - liegt * 0.22; }
      kopf.rotation.y = anim === 0 ? Math.sin(zeit * 0.6) * 0.25 : 0;
      blinzel -= dt;
      const zu = liegt > 0.5 ? 1 : blinzel < 0 ? Math.max(0, 1 - Math.abs(blinzel + 0.07) / 0.07) : 0;
      if (blinzel < -0.14) blinzel = 2 + Math.random() * 4;
      for (const l of kopf.lider) l.scale.y = Math.max(0.001, zu * 1.05);
    };
    return g;
  }

  /* ---------- Gegenstände (Länge ~0.5 m, liegen auf y=0) ---------- */
  function item(art) {
    const g = new T.Group();
    const metall = stoff(0xc9ced6, 0.3, 0.9), holz = stoff(0x8a5a32, 0.7), gummi = stoff(0x1d1d1f, 0.6);
    const rot = stoff(0xd32f2f, 0.5), gelb = stoff(0xf2c14e, 0.5);
    switch (art) {
      case 'loeffel': { const s = Z(0.012, 0.012, 0.3, metall, 0, 0.02, 0, 8); s.rotation.x = Math.PI / 2; g.add(s); const l = K(0.045, metall, 0, 0.02, 0.18, 12); l.scale.set(1, 0.3, 1.4); g.add(l); break; }
      case 'schaufel': { const s = Z(0.02, 0.02, 0.7, holz, 0, 0.03, 0, 8); s.rotation.x = Math.PI / 2; g.add(s); const b = B(0.2, 0.02, 0.24, metall, 0, 0.03, 0.45); g.add(b); const gr = B(0.14, 0.03, 0.03, holz, 0, 0.03, -0.35); g.add(gr); break; }
      case 'schraubenzieher': { const gr = Z(0.03, 0.03, 0.12, gelb, 0, 0.03, 0, 10); gr.rotation.x = Math.PI / 2; g.add(gr); const k2 = Z(0.008, 0.008, 0.18, metall, 0, 0.03, 0.15, 6); k2.rotation.x = Math.PI / 2; g.add(k2); break; }
      case 'drahtschere': for (const sx of [-1, 1]) { const h = B(0.025, 0.025, 0.32, rot, sx * 0.04, 0.03, -0.08); h.rotation.y = sx * 0.12; g.add(h); const k2 = B(0.03, 0.03, 0.12, metall, sx * 0.012, 0.03, 0.15); k2.rotation.y = -sx * 0.1; g.add(k2); } break;
      case 'hammer': { const s = Z(0.018, 0.018, 0.36, holz, 0, 0.03, 0, 8); s.rotation.x = Math.PI / 2; g.add(s); g.add(B(0.16, 0.06, 0.06, stoff(0x444a52, 0.4, 0.8), 0, 0.03, 0.18)); break; }
      case 'schlagstock': { const s = Z(0.022, 0.026, 0.55, gummi, 0, 0.03, 0, 10); s.rotation.x = Math.PI / 2; g.add(s); const q = Z(0.015, 0.015, 0.12, gummi, 0.06, 0.03, -0.17, 6); q.rotation.z = Math.PI / 2; g.add(q); break; }
      case 'laken': { g.add(B(0.32, 0.06, 0.24, stoff(0xf3f1ea, 0.9), 0, 0.03, 0)); g.add(B(0.32, 0.012, 0.03, stoff(0x8fb3d9, 0.9), 0, 0.062, 0.06)); break; }
      case 'seil': for (let i = 0; i < 3; i++) { const r = M(geo('TorusGeometry', 0.14 - i * 0.03, 0.03, 6, 16), stoff(0xece7da, 0.9), 0, 0.03 + i * 0.03, 0); r.rotation.x = Math.PI / 2; g.add(r); } break;
      case 'duenger': { const s = B(0.26, 0.12, 0.36, stoff(0x4f7a2a, 0.9), 0, 0.06, 0); g.add(s); g.add(B(0.18, 0.005, 0.12, stoff(0xf2e9c9, 0.8), 0, 0.123, 0)); break; }
      case 'reiniger': { g.add(Z(0.06, 0.07, 0.24, stoff(0x2aa3c9, 0.3), 0, 0.12, 0, 12)); g.add(Z(0.03, 0.03, 0.06, stoff(0xffffff, 0.4), 0, 0.27, 0, 8)); g.add(B(0.1, 0.08, 0.005, stoff(0xffeb3b, 0.6), 0, 0.12, 0.068)); break; }
      case 'sprengstoff': {
        for (let i = 0; i < 3; i++) { const s = Z(0.035, 0.035, 0.3, rot, (i - 1) * 0.07, 0.04, 0, 10); s.rotation.x = Math.PI / 2; g.add(s); }
        g.add(B(0.24, 0.02, 0.04, stoff(0x222222, 0.5), 0, 0.075, 0));
        g.add(B(0.08, 0.04, 0.05, stoff(0x111111, 0.4), 0, 0.09, 0.06));
        const led = K(0.012, new T.MeshBasicMaterial({ color:0xff2020 }), 0.02, 0.115, 0.06, 6); g.add(led); g.led = led;
        break;
      }
      case 'uniform': { g.add(B(0.32, 0.07, 0.26, stoff(UNIFORM, 0.8), 0, 0.035, 0)); g.add(B(0.05, 0.02, 0.06, stoff(0xd4af37, 0.3, 0.9), 0.08, 0.075, 0.05)); const m = Z(0.1, 0.1, 0.05, stoff(UNIFORM, 0.8), -0.06, 0.1, -0.04, 12); g.add(m); break; }
      case 'keyblau': case 'keyrot': { g.add(B(0.16, 0.012, 0.1, stoff(art === 'keyblau' ? 0x1e88e5 : 0xe53935, 0.35), 0, 0.01, 0)); g.add(B(0.04, 0.014, 0.03, stoff(0xd4af37, 0.3, 0.9), -0.04, 0.012, 0)); break; }
      case 'vanschluessel': case 'helischluessel': {
        const r = M(geo('TorusGeometry', 0.05, 0.012, 6, 14), stoff(0xd4af37, 0.3, 0.9), 0, 0.012, -0.08); r.rotation.x = Math.PI / 2; g.add(r);
        g.add(B(0.025, 0.01, 0.14, metall, 0, 0.012, 0.03));
        g.add(B(0.07, 0.03, 0.05, stoff(art === 'vanschluessel' ? 0x37474f : 0xffb300, 0.5), 0, 0.02, -0.17));
        break;
      }
      default: g.add(B(0.2, 0.2, 0.2, 0xff00ff));
    }
    g.traverse(c => { if (c.isMesh) c.castShadow = true; });
    return g;
  }

  window.KKF = { figur, item, stoff, verschmelzen, ARTEN, OVERALL, UNIFORM };
})();
