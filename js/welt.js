/* Knastknacker – die 3D-Welt (three.js r128): Gefängnis aus dem Raster in js/karte.js, Möbel, Türme mit Scheinwerfern,
   Tunnel, Lüftung, Dach, Van, Heli, Gegenstände, Effekte. Abendstimmung, Strom und Alarm verändern das Licht. */
(function () {
  'use strict';
  const T = THREE, KA = KK_KARTE, W = KA.W, H = KA.H;
  const F = window.KKF;
  const stoff = F.stoff;

  /* ---------- Prozedurale Texturen ---------- */
  function leinwand(n, mal) { const c = document.createElement('canvas'); c.width = c.height = n; mal(c.getContext('2d'), n); return c; }
  function rauschen(x, n, basis, streu, punkte, groesse) {
    x.fillStyle = basis; x.fillRect(0, 0, n, n);
    for (let i = 0; i < punkte; i++) {
      const v = (Math.random() - 0.5) * streu;
      x.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      const g = Math.random() * groesse + 1;
      x.fillRect(Math.random() * n, Math.random() * n, g, g);
    }
  }
  function tex(c, rx = 1, ry = 1) { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; }
  const TEX = {};
  function texturen() {
    TEX.gras = tex(leinwand(256, (x, n) => { rauschen(x, n, '#3d5a2a', 0.25, 4000, 2); for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${90 + Math.random() * 60},${120 + Math.random() * 60},60,0.5)`; const a = Math.random() * n, b = Math.random() * n; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.random() * 3 - 1.5, b - 4 - Math.random() * 4); x.stroke(); } }));
    TEX.kies = tex(leinwand(256, (x, n) => { rauschen(x, n, '#8a8476', 0.4, 6000, 3); }));
    TEX.erde = tex(leinwand(256, (x, n) => { rauschen(x, n, '#7a6448', 0.3, 5000, 3); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(60,45,30,${Math.random() * 0.3})`; x.beginPath(); x.arc(Math.random() * n, Math.random() * n, 4 + Math.random() * 14, 0, 7); x.fill(); } }));
    TEX.asphalt = tex(leinwand(256, (x, n) => { rauschen(x, n, '#3a3c40', 0.25, 7000, 2); }));
    TEX.beton = tex(leinwand(256, (x, n) => { rauschen(x, n, '#9a978f', 0.18, 5000, 3); x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2; x.strokeRect(0, 0, n, n); }));
    TEX.fliesen = tex(leinwand(256, (x, n) => { rauschen(x, n, '#b9b4a6', 0.12, 2500, 2); x.strokeStyle = 'rgba(60,55,50,0.35)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * n / 4, 0); x.lineTo(i * n / 4, n); x.stroke(); x.beginPath(); x.moveTo(0, i * n / 4); x.lineTo(n, i * n / 4); x.stroke(); } }));
    TEX.mauer = tex(leinwand(256, (x, n) => { rauschen(x, n, '#8f8c85', 0.2, 6000, 3); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, n / 2); x.lineTo(n, n / 2); x.stroke(); x.beginPath(); x.moveTo(n / 2, 0); x.lineTo(n / 2, n); x.stroke(); for (let i = 0; i < 20; i++) { x.fillStyle = 'rgba(40,40,30,0.12)'; x.fillRect(Math.random() * n, Math.random() * n * 0.2 + n * 0.8, 2 + Math.random() * 4, 30); } }));
    // Innenwand: unten grün gestrichen, oben weiß (v = Höhe/4)
    const innen = leinwand(256, (x, n) => {
      rauschen(x, n, '#d9d4c7', 0.1, 3000, 2);
      x.fillStyle = '#4f7564'; x.fillRect(0, n * 0.7, n, n * 0.3);
      x.fillStyle = '#2f4a3e'; x.fillRect(0, n * 0.69, n, 4);
      for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * n, Math.random() * n, 3, 3); }
    });
    TEX.innen = tex(innen); TEX.innen.wrapT = T.ClampToEdgeWrapping;
    TEX.aussen = tex(leinwand(256, (x, n) => { rauschen(x, n, '#a8a397', 0.16, 5000, 3); x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 8; i++) x.fillRect(0, i * n / 8, n, 2); }));
    TEX.dach = tex(leinwand(256, (x, n) => { rauschen(x, n, '#4a4c50', 0.25, 6000, 2); }));
    TEX.draht = (() => {
      const c = leinwand(64, (x, n) => { x.clearRect(0, 0, n, n); x.strokeStyle = '#c9ced4'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, n / 2); x.lineTo(n / 2, 0); x.lineTo(n, n / 2); x.lineTo(n / 2, n); x.closePath(); x.stroke(); });
      const t = tex(c); return t;
    })();
    TEX.rolltor = tex(leinwand(128, (x, n) => { rauschen(x, n, '#7d8590', 0.15, 1500, 2); for (let i = 0; i < n; i += 8) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, i, n, 2); x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(0, i + 2, n, 1); } }));
    TEX.lueftung = tex(leinwand(128, (x, n) => { rauschen(x, n, '#9aa1a8', 0.12, 1500, 2); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, n, 4); x.fillRect(0, n / 2, n, 3); }));
    TEX.gitter = (() => { const c = leinwand(64, (x, n) => { x.clearRect(0, 0, n, n); x.fillStyle = '#cfd4da'; for (let i = 0; i < n; i += 8) { x.fillRect(i, 0, 3, n); } x.fillRect(0, 0, n, 4); x.fillRect(0, n - 4, n, 4); x.fillRect(0, 0, 4, n); x.fillRect(n - 4, 0, 4, n); }); return tex(c); })();
    TEX.tunnel = tex(leinwand(256, (x, n) => { rauschen(x, n, '#5a4430', 0.35, 7000, 4); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(150,140,120,${Math.random() * 0.4})`; x.beginPath(); x.arc(Math.random() * n, Math.random() * n, 2 + Math.random() * 5, 0, 7); x.fill(); } }));
    TEX.helipad = (() => { const c = leinwand(256, (x, n) => { x.fillStyle = '#3c3f44'; x.fillRect(0, 0, n, n); x.strokeStyle = '#f2c14e'; x.lineWidth = 10; x.beginPath(); x.arc(n / 2, n / 2, n * 0.44, 0, 7); x.stroke(); x.fillStyle = '#f4f4f4'; x.font = 'bold 150px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', n / 2, n / 2 + 8); }); const t = new T.CanvasTexture(c); return t; })();
    TEX.glanz = (() => { const c = leinwand(64, (x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); }); return new T.CanvasTexture(c); })();
    TEX.himmel = (() => { const c = leinwand(512, (x, n) => { const g = x.createLinearGradient(0, 0, 0, n); g.addColorStop(0, '#060a18'); g.addColorStop(0.45, '#17234a'); g.addColorStop(0.62, '#4a3c5c'); g.addColorStop(0.7, '#8a5a4a'); g.addColorStop(1, '#20160f'); x.fillStyle = g; x.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; x.fillRect(Math.random() * n, Math.random() * n * 0.45, 1.2, 1.2); } }); return new T.CanvasTexture(c); })();
    TEX.korb = (() => { const c = leinwand(256, (x, n) => { x.fillStyle = '#5b6b55'; x.fillRect(0, 0, n, n); x.strokeStyle = '#eee'; x.lineWidth = 4; x.strokeRect(6, 6, n - 12, n - 12); x.beginPath(); x.moveTo(n / 2, 6); x.lineTo(n / 2, n - 6); x.stroke(); x.beginPath(); x.arc(n / 2, n / 2, 30, 0, 7); x.stroke(); x.beginPath(); x.arc(6, n / 2, 60, -1.57, 1.57); x.stroke(); x.beginPath(); x.arc(n - 6, n / 2, 60, 1.57, 4.71); x.stroke(); }); return new T.CanvasTexture(c); })();
  }

  /* ---------- Geometrie-Bauer ---------- */
  class Bauer {
    constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
    quad(a, b, c, d, n, uv) {
      const k = this.p.length / 3;
      for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
      for (let j = 0; j < 4; j++) this.n.push(n[0], n[1], n[2]);
      for (const t of uv) this.u.push(t[0], t[1]);
      this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
    geo() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
      g.setIndex(this.i);
      return g;
    }
  }
  // Wand-Seitenfläche an einer Zellkante. dir: 0 +x, 1 -x, 2 +z, 3 -z
  function seite(b, x, z, dir, y0, y1, uvSkala) {
    const s = uvSkala;
    if (dir === 0) b.quad([x + 1, y0, z + 1], [x + 1, y0, z], [x + 1, y1, z], [x + 1, y1, z + 1], [1, 0, 0], [[z * s.u, y0 * s.v], [(z + 1) * s.u, y0 * s.v], [(z + 1) * s.u, y1 * s.v], [z * s.u, y1 * s.v]]);
    if (dir === 1) b.quad([x, y0, z], [x, y0, z + 1], [x, y1, z + 1], [x, y1, z], [-1, 0, 0], [[z * s.u, y0 * s.v], [(z + 1) * s.u, y0 * s.v], [(z + 1) * s.u, y1 * s.v], [z * s.u, y1 * s.v]]);
    if (dir === 2) b.quad([x, y0, z + 1], [x + 1, y0, z + 1], [x + 1, y1, z + 1], [x, y1, z + 1], [0, 0, 1], [[x * s.u, y0 * s.v], [(x + 1) * s.u, y0 * s.v], [(x + 1) * s.u, y1 * s.v], [x * s.u, y1 * s.v]]);
    if (dir === 3) b.quad([x + 1, y0, z], [x, y0, z], [x, y1, z], [x + 1, y1, z], [0, 0, -1], [[x * s.u, y0 * s.v], [(x + 1) * s.u, y0 * s.v], [(x + 1) * s.u, y1 * s.v], [x * s.u, y1 * s.v]]);
  }
  function deckel(b, x, z, y, s, unten) {
    if (unten) b.quad([x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1], [0, -1, 0], [[x * s, z * s], [(x + 1) * s, z * s], [(x + 1) * s, (z + 1) * s], [x * s, (z + 1) * s]]);
    else b.quad([x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z], [0, 1, 0], [[x * s, (z + 1) * s], [(x + 1) * s, (z + 1) * s], [(x + 1) * s, z * s], [x * s, z * s]]);
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* ---------- Gebäude ---------- */
  const GEBAEUDE = [
    { id:'zellen', r:[12, 12, 58, 32], h:6.2, rand:0.6 },
    { id:'kantine', r:[58, 12, 87, 30], h:4, rand:0.4 },
    { id:'waescherei', r:[60, 33, 87, 44], h:4, rand:0.4 },
    { id:'werkstatt', r:[60, 47, 87, 58], h:4, rand:0.4 },
    { id:'garage', r:[62, 61, 87, 71], h:4, rand:0.4 },
    { id:'generator', r:[34, 62, 44, 70], h:4, rand:0.4 },
    { id:'verwaltung', r:[12, 35, 33, 60], h:4, rand:0.4 },
    { id:'schuppen', r:[34, 54, 38, 58], h:2.8, rand:0.3 }
  ];
  const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
  const amRand = (r, x, z) => inRect(r, x, z) && (x === r[0] || x === r[2] || z === r[1] || z === r[3]);
  const DRAUSSEN_ZONEN = new Set(['hof', 'streifen', 'frei', 'tor']);

  function bauen(szene, K, opt = {}) {
    if (!TEX.gras) texturen();
    const welt = { szene, K, gruppen:{} };
    const root = new T.Group(); szene.add(root);
    const stufe = opt.grafik || 'hoch', hoch = stufe !== 'niedrig';

    /* Höhe einer Wandzelle: Gebäuderand mit Brüstung, innen niedrig */
    function wandHoehe(x, z) {
      const c = K.code(x, z);
      for (const g of GEBAEUDE) if (amRand(g.r, x, z)) return Math.max(g.h + g.rand, c === 'M' ? 5 : 0);
      if (c === 'M') return 5;
      if (inRect(GEBAEUDE[0].r, x, z)) return 3.2;
      for (const g of GEBAEUDE) if (inRect(g.r, x, z)) return g.h;
      return 4;
    }
    function wandBereich(x, z) {
      if (!K.drin(x, z)) return null;
      const c = K.code(x, z);
      if (c === '#' || c === 'M') return [0, wandHoehe(x, z)];
      if (c === 'D' || c === 'B' || c === 'R') return [2.35, wandHoehe(x, z)];
      if (c === 'G') return [3.6, wandHoehe(x, z)];
      return null;
    }
    // Wandspannen einer Zelle; wo ein Lüftungsschacht durchgeht, bleibt ein Durchbruch
    const SCHACHT = [3.1, 3.85];
    function wandSpannen(x, z) {
      const w = wandBereich(x, z); if (!w) return [];
      if (!K.lueft[z * W + x] || w[1] <= SCHACHT[0] || w[0] >= SCHACHT[1]) return [w];
      const r = [];
      if (w[0] < SCHACHT[0]) r.push([w[0], SCHACHT[0]]);
      if (w[1] > SCHACHT[1]) r.push([SCHACHT[1], w[1]]);
      return r;
    }
    function abziehen(spanne, andere) {
      let teile = [spanne];
      for (const [a, b] of andere) {
        const neu = [];
        for (const [c, d] of teile) { if (b <= c || a >= d) { neu.push([c, d]); continue; } if (a > c) neu.push([c, a]); if (b < d) neu.push([b, d]); }
        teile = neu;
      }
      return teile;
    }
    const draussenZelle = (x, z) => !K.drin(x, z) || DRAUSSEN_ZONEN.has(K.zoneBei(x + 0.5, z + 0.5).id) && !GEBAEUDE.some(g => inRect(g.r, x, z));

    /* ---------- Materialien ---------- */
    const MAT = {
      gras:new T.MeshStandardMaterial({ map:TEX.gras, roughness:1 }),
      kies:new T.MeshStandardMaterial({ map:TEX.kies, roughness:1 }),
      erde:new T.MeshStandardMaterial({ map:TEX.erde, roughness:1 }),
      asphalt:new T.MeshStandardMaterial({ map:TEX.asphalt, roughness:0.95 }),
      beton:new T.MeshStandardMaterial({ map:TEX.beton, roughness:0.95 }),
      fliesen:new T.MeshStandardMaterial({ map:TEX.fliesen, roughness:0.6 }),
      mauer:new T.MeshStandardMaterial({ map:TEX.mauer, roughness:0.95 }),
      innen:new T.MeshStandardMaterial({ map:TEX.innen, roughness:0.85 }),
      aussen:new T.MeshStandardMaterial({ map:TEX.aussen, roughness:0.95 }),
      dach:new T.MeshStandardMaterial({ map:TEX.dach, roughness:1 }),
      draht:new T.MeshStandardMaterial({ map:TEX.draht, transparent:true, alphaTest:0.4, side:T.DoubleSide, roughness:0.5, metalness:0.3 }),
      rolltor:new T.MeshStandardMaterial({ map:TEX.rolltor, roughness:0.6, metalness:0.25 }),
      lueftung:new T.MeshStandardMaterial({ map:TEX.lueftung, roughness:0.45, metalness:0.3, side:T.DoubleSide }),
      tunnel:new T.MeshStandardMaterial({ map:TEX.tunnel, roughness:1, side:T.DoubleSide }),
      gitter:new T.MeshStandardMaterial({ map:TEX.gitter, transparent:true, alphaTest:0.4, side:T.DoubleSide, metalness:0.3, roughness:0.4 })
    };
    TEX.innen.repeat.set(0.5, 1); TEX.aussen.repeat.set(0.5, 0.5);
    welt.MAT = MAT;

    /* ---------- Himmel, Umland ---------- */
    const himmel = new T.Mesh(new T.SphereGeometry(400, 24, 16), new T.MeshBasicMaterial({ map:TEX.himmel, side:T.BackSide, fog:false, depthWrite:false }));
    himmel.position.set(W / 2, 0, H / 2); himmel.rotation.y = 0.8; szene.add(himmel); welt.himmel = himmel;
    const mond = new T.Sprite(new T.SpriteMaterial({ map:TEX.glanz, color:0xdfe8ff, fog:false, depthWrite:false }));
    mond.position.set(W / 2 - 180, 140, H / 2 - 220); mond.scale.set(40, 40, 1); szene.add(mond);
    const umland = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshStandardMaterial({ map:TEX.gras, roughness:1 }));
    TEX.gras.repeat.set(1, 1);
    umland.material.map = TEX.gras.clone(); umland.material.map.repeat.set(220, 220); umland.material.map.needsUpdate = true;
    umland.rotation.x = -Math.PI / 2; umland.position.set(W / 2, -0.02, H / 2); umland.receiveShadow = true; root.add(umland);
    // Wald ringsum
    {
      const n = stufe === 'hoch' ? 700 : stufe === 'mittel' ? 300 : 120;
      const stamm = new T.InstancedMesh(new T.CylinderGeometry(0.15, 0.22, 2, 6), stoff(0x4a3524, 0.9), n);
      const krone = new T.InstancedMesh(new T.ConeGeometry(1.6, 5, 7), stoff(0x1f3a26, 0.95), n);
      const m = new T.Matrix4(), q = new T.Quaternion(), sk = new T.Vector3();
      let k = 0;
      while (k < n) {
        const w = Math.random() * Math.PI * 2, r = 70 + Math.random() * 110;
        const x = W / 2 + Math.cos(w) * r * 1.1, z = H / 2 + Math.sin(w) * r;
        if (Math.abs(x - 49.5) < 6 && z > H) continue;   // Straße frei
        const s = 0.8 + Math.random() * 0.9;
        sk.set(s, s, s); m.compose(new T.Vector3(x, s, z), q, sk); stamm.setMatrixAt(k, m);
        m.compose(new T.Vector3(x, s * 4.2, z), q, sk); krone.setMatrixAt(k, m);
        k++;
      }
      stamm.castShadow = krone.castShadow = false; root.add(stamm); root.add(krone);
    }
    // Straße nach draußen
    { const s = new T.Mesh(new T.PlaneGeometry(8, 300), MAT.asphalt); s.rotation.x = -Math.PI / 2; s.position.set(50, -0.01, H + 150); root.add(s); }

    /* ---------- Boden ---------- */
    let bodenGruppe = null;
    function bodenArt(x, z) {
      const c = K.code(x, z), zone = K.zoneBei(x + 0.5, z + 0.5).id;
      const innen = GEBAEUDE.some(g => inRect(g.r, x, z) && !amRand(g.r, x, z));
      switch (c) {
        case ',': return 'gras';
        case '_': return 'kies';
        case '=': case 'T': return 'asphalt';
        case ':': return 'erde';
        case 'O': return null;
        case '#': case 'M': return null;
        case 'Z': case 'l': return zone === 'frei' ? 'gras' : 'kies';
        case 'L': return innen ? 'fliesen' : zone === 'streifen' ? 'kies' : 'beton';
        default: return innen || c === 'D' || c === 'B' || c === 'R' || c === 'G' ? 'fliesen' : 'beton';
      }
    }
    function bodenBauen() {
      if (bodenGruppe) { root.remove(bodenGruppe); bodenGruppe.children.forEach(m => m.geometry.dispose()); }
      bodenGruppe = new T.Group();
      const b = {};
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        const a = bodenArt(x, z); if (!a) continue;
        const s = a === 'fliesen' ? 0.5 : 0.25;
        (b[a] = b[a] || new Bauer());
        deckel(b[a], x, z, 0, s);
      }
      for (const a in b) { const m = new T.Mesh(b[a].geo(), MAT[a]); m.receiveShadow = true; bodenGruppe.add(m); }
      // Basketballfeld
      const feld = new T.Mesh(new T.PlaneGeometry(10.6, 9.6), new T.MeshStandardMaterial({ map:TEX.korb, roughness:0.8 }));
      feld.rotation.x = -Math.PI / 2; feld.rotation.z = Math.PI / 2; feld.position.set(41.5, 0.012, 41); feld.receiveShadow = true; bodenGruppe.add(feld);
      root.add(bodenGruppe);
    }

    /* ---------- Wände ---------- */
    let wandGruppe = null;
    function waendeBauen() {
      if (wandGruppe) { root.remove(wandGruppe); wandGruppe.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
      wandGruppe = new T.Group();
      const bI = new Bauer(), bA = new Bauer(), bM = new Bauer();
      const sI = { u:0.5, v:0.25 }, sA = { u:0.5, v:0.5 };
      const nato = [];
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        const spannen = wandSpannen(x, z); if (!spannen.length) continue;
        const c = K.code(x, z), mauer = c === 'M';
        for (const w of spannen) {
          deckel(mauer ? bM : bA, x, z, w[1], 0.5);
          if (w[0] > 0) deckel(bI, x, z, w[0], 0.5, true);
          for (let d = 0; d < 4; d++) {
            const nx = x + DIRS[d][0], nz = z + DIRS[d][1];
            // sichtbare Teile = eigene Spanne minus Spannen des Nachbarn
            const teile = abziehen(w, wandSpannen(nx, nz));
            const raus = draussenZelle(nx, nz);
            for (const [y0, y1] of teile) if (y1 - y0 > 0.01) seite(mauer ? bM : raus ? bA : bI, x, z, d, y0, y1, mauer ? sA : raus ? sA : sI);
          }
        }
        if (mauer && hoch) nato.push([x + 0.5, spannen[spannen.length - 1][1], z + 0.5]);
      }
      for (const [b, m] of [[bI, MAT.innen], [bA, MAT.aussen], [bM, MAT.mauer]]) { const me = new T.Mesh(b.geo(), m); me.castShadow = me.receiveShadow = true; wandGruppe.add(me); }
      // NATO-Draht auf der Außenmauer
      if (nato.length) {
        const im = new T.InstancedMesh(new T.TorusGeometry(0.28, 0.018, 4, 10), stoff(0xb8bcc2, 0.4, 0.8), nato.length * 2);
        const m = new T.Matrix4(), q = new T.Quaternion();
        let k = 0;
        for (const [x, y, z] of nato) for (let s = 0; s < 2; s++) {
          const quer = K.code(Math.floor(x) + 1, Math.floor(z)) === 'M' || K.code(Math.floor(x) - 1, Math.floor(z)) === 'M';
          q.setFromEuler(new T.Euler(0, quer ? Math.PI / 2 : 0, 0));
          m.compose(new T.Vector3(x + (quer ? s * 0.5 - 0.25 : 0), y + 0.28, z + (quer ? 0 : s * 0.5 - 0.25)), q, new T.Vector3(1, 1, 1));
          im.setMatrixAt(k++, m);
        }
        wandGruppe.add(im);
      }
      // Rolltor der Garage
      const g = [];
      for (let z = 0; z < H; z++) if (K.code(62, z) === 'G') g.push(z);
      if (g.length) {
        const tor = new T.Mesh(new T.BoxGeometry(0.15, 3.6, g.length), MAT.rolltor);
        tor.position.set(62.5, 1.8, (g[0] + g[g.length - 1] + 1) / 2); tor.castShadow = true;
        wandGruppe.add(tor); welt.rolltor = tor;
      } else welt.rolltor = null;
      // Trümmer bei Sprenglöchern
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (K.code(x, z) === 'L') {
        for (let i = 0; i < 4; i++) {
          const t = new T.Mesh(new T.DodecahedronGeometry(0.12 + Math.random() * 0.2, 0), MAT.mauer);
          t.position.set(x + Math.random(), 0.1, z + Math.random()); t.rotation.set(Math.random() * 3, Math.random() * 3, 0); t.castShadow = true;
          wandGruppe.add(t);
        }
      }
      if (welt.rolltor) welt.rolltor.userData.bleibt = true;
      F.verschmelzen(wandGruppe);
      root.add(wandGruppe);
    }

    /* ---------- Zaun ---------- */
    let zaunGruppe = null;
    function zaunBauen() {
      if (zaunGruppe) { root.remove(zaunGruppe); zaunGruppe.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
      zaunGruppe = new T.Group();
      const b = new Bauer(), pf = [];
      const Z0 = KA.ZAUN;
      for (let z = Z0.z0; z <= Z0.z1; z++) for (let x = Z0.x0; x <= Z0.x1; x++) {
        const c = K.code(x, z);
        if (c !== 'Z') { if (c === 'l') pf.push([x + 0.5, z + 0.5, 'riss']); continue; }
        const quer = z === Z0.z0 || z === Z0.z1;    // Zaun läuft in x-Richtung
        const y1 = 3.6;
        if (quer) b.quad([x, 0, z + 0.5], [x + 1, 0, z + 0.5], [x + 1, y1, z + 0.5], [x, y1, z + 0.5], [0, 0, 1], [[0, 0], [2, 0], [2, y1 * 2], [0, y1 * 2]]);
        else b.quad([x + 0.5, 0, z + 1], [x + 0.5, 0, z], [x + 0.5, y1, z], [x + 0.5, y1, z + 1], [1, 0, 0], [[0, 0], [2, 0], [2, y1 * 2], [0, y1 * 2]]);
        if ((x + z) % 3 === 0) pf.push([quer ? x : x + 0.5, quer ? z + 0.5 : z, quer ? 'q' : 'l']);
      }
      const netz = new T.Mesh(b.geo(), MAT.draht); zaunGruppe.add(netz);
      const pfMat = stoff(0x6f757c, 0.5, 0.7);
      for (const [x, z, a] of pf) {
        if (a === 'riss') { for (let i = 0; i < 3; i++) { const d = new T.Mesh(new T.TorusGeometry(0.25, 0.012, 3, 8, 3), pfMat); d.position.set(x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 2.5, z + (Math.random() - 0.5) * 0.6); d.rotation.set(Math.random() * 3, Math.random() * 3, 0); zaunGruppe.add(d); } continue; }
        const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 4.1, 6), pfMat); p.position.set(x, 2.05, z); p.castShadow = true; zaunGruppe.add(p);
        // Isolatoren und Ausleger
        const arm = new T.Mesh(new T.BoxGeometry(0.05, 0.7, 0.05), pfMat); arm.position.set(x, 4.3, z); arm.rotation[a === 'q' ? 'x' : 'z'] = 0.6; zaunGruppe.add(arm);
        for (let i = 0; i < 3; i++) { const iso = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.08, 6), stoff(0xffffff, 0.3)); iso.position.set(x, 1 + i * 1.2, z); zaunGruppe.add(iso); }
      }
      // Stacheldraht oben
      for (const [a0, a1, fest, quer] of [[Z0.x0, Z0.x1, Z0.z0, true], [Z0.x0, Z0.x1, Z0.z1, true], [Z0.z0, Z0.z1, Z0.x0, false], [Z0.z0, Z0.z1, Z0.x1, false]]) {
        let s = null;
        const zuMachen = e => { if (s == null) return; const l = e - s; for (const h of [3.7, 3.95, 4.2]) { const d = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, l, 3), pfMat); d.rotation[quer ? 'z' : 'x'] = Math.PI / 2; if (quer) d.position.set(s + l / 2, h, fest + 0.5 + (h - 3.7) * 0.6); else d.position.set(fest + 0.5 + (h - 3.7) * 0.6, h, s + l / 2); zaunGruppe.add(d); } s = null; };
        for (let k = a0; k <= a1 + 1; k++) {
          const c = k > a1 ? '' : quer ? K.code(k, fest) : K.code(fest, k);
          if (c === 'Z') { if (s == null) s = k; } else zuMachen(k);
        }
      }
      F.verschmelzen(zaunGruppe);
      root.add(zaunGruppe);
      welt.zaunNetz = netz;
    }

    /* ---------- Dächer ---------- */
    welt.daecher = [];
    for (const g of GEBAEUDE) {
      const [x0, z0, x1, z1] = g.r;
      const grp = new T.Group();
      const d = new T.Mesh(new T.BoxGeometry(x1 - x0 - 1, 0.25, z1 - z0 - 1), MAT.dach);
      d.position.set((x0 + x1 + 1) / 2, g.h - 0.125, (z0 + z1 + 1) / 2); d.receiveShadow = true; d.castShadow = true;
      grp.add(d);
      // Lüftungsaufsätze auf flachen Dächern
      if (g.id !== 'zellen' && g.id !== 'schuppen') for (let i = 0; i < 2; i++) { const a = new T.Mesh(new T.BoxGeometry(1.2, 0.8, 1.2), stoff(0x9aa0a6, 0.5, 0.5)); a.position.set(x0 + 3 + i * (x1 - x0 - 6), g.h + 0.4, z0 + 3); a.castShadow = true; grp.add(a); }
      root.add(grp);
      welt.daecher.push({ ...g, grp });
    }
    const zDach = welt.daecher[0].grp;
    {
      // Hubschrauberlandeplatz, Klimageräte, Treppenhaus-Aufbau, Luke, Haken
      const hp = new T.Mesh(new T.PlaneGeometry(8, 8), new T.MeshStandardMaterial({ map:TEX.helipad, roughness:0.8 }));
      hp.rotation.x = -Math.PI / 2; hp.position.set(KA.OBJ.heli.x, 6.21, KA.OBJ.heli.z); hp.receiveShadow = true; zDach.add(hp);
      for (const [x, z] of [[40, 15], [45, 28], [20, 28]]) {
        const k = new T.Mesh(new T.BoxGeometry(2, 1.3, 2), stoff(0xb0b5ba, 0.5, 0.5)); k.position.set(x + 1, 6.85, z + 1); k.castShadow = true; zDach.add(k);
        const lf = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 0.1, 16), stoff(0x333333, 0.6)); lf.position.set(x + 1, 7.52, z + 1); zDach.add(lf);
      }
      const th = new T.Mesh(new T.BoxGeometry(5, 2.6, 5), MAT.aussen); th.position.set(55.5, 7.5, 15.5); th.castShadow = true; zDach.add(th);
      const tt = new T.Mesh(new T.BoxGeometry(1.2, 2.1, 0.08), stoff(0x5d6b78, 0.5, 0.4)); tt.position.set(55.5, 7.25, 18.03); zDach.add(tt);
      const lk = new T.Mesh(new T.BoxGeometry(0.9, 0.25, 0.9), stoff(0x7d858d, 0.4, 0.7)); lk.position.set(KA.OBJ.luke.x, 6.33, KA.OBJ.luke.z); zDach.add(lk);
      welt.haken = KA.OBJ.haken.map(h => { const m = new T.Mesh(new T.TorusGeometry(0.12, 0.03, 6, 12), stoff(0x888888, 0.4, 0.8)); m.position.set(h.x, 6.9, h.z); zDach.add(m); return m; });
    }

    /* ---------- Möbel und Ausstattung ---------- */
    const deko = new T.Group(); root.add(deko);
    const box = (w, h, d, f, x, y, z, ry = 0) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), typeof f === 'number' ? stoff(f, 0.7) : f); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; deko.add(m); return m; };
    const zyl = (r, h, f, x, y, z, s = 12) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, h, s), typeof f === 'number' ? stoff(f, 0.6) : f); m.position.set(x, y, z); m.castShadow = true; deko.add(m); return m; };
    const stahl = stoff(0x9aa2aa, 0.35, 0.8), dunkelStahl = stoff(0x4a5058, 0.4, 0.7), holz = stoff(0x8a5a32, 0.75);
    // Zellen: Pritsche, Klo + Waschbecken, Regal
    for (let k = 0; k < 8; k++) {
      const x0 = 13 + 5 * k;
      for (const [zb, zk, dz] of [[13, 13, 1], [30, 31, -1]]) {
        const zm = zb + 1;
        box(0.9, 0.08, 1.95, dunkelStahl, x0 + 0.5, 0.45, zm, 0);
        for (const sx of [-0.4, 0.4]) for (const sz of [-0.9, 0.9]) box(0.06, 1.8, 0.06, dunkelStahl, x0 + 0.5 + sx, 0.9, zm + sz);
        box(0.85, 0.14, 1.85, stoff(0xe9e3d4, 0.9), x0 + 0.5, 0.56, zm);
        box(0.86, 0.06, 1.2, stoff(0xc8622a, 0.9), x0 + 0.5, 0.64, zm + 0.3 * dz);
        box(0.5, 0.1, 0.3, stoff(0xffffff, 0.9), x0 + 0.5, 0.67, zm - 0.7 * dz);
        box(0.9, 0.08, 1.95, dunkelStahl, x0 + 0.5, 1.65, zm);
        box(0.85, 0.14, 1.85, stoff(0xe9e3d4, 0.9), x0 + 0.5, 1.76, zm);
        // Klo
        const kx = x0 + 3.5, kz = zk + 0.5;
        box(0.45, 0.45, 0.5, stahl, kx, 0.23, kz);
        box(0.42, 0.25, 0.25, stahl, kx, 0.95, kz - 0.3 * dz);
        // Poster
        const p = box(0.6, 0.8, 0.02, stoff([0xf2c14e, 0x4fa3d9, 0xe57373, 0x81c784][k % 4], 0.8), x0 + 2, 1.7, dz > 0 ? 13.03 : 31.97);
        p.receiveShadow = false;
      }
    }
    // Duschen
    for (let i = 0; i < 4; i++) { zyl(0.03, 0.4, stahl, 53.6 + i * 1.2, 2.1, 31.7); zyl(0.1, 0.05, stahl, 53.6 + i * 1.2, 1.9, 31.5); }
    // Treppe im Treppenhaus
    for (let i = 0; i < 8; i++) box(2, 0.25, 0.4, stoff(0x8e9196, 0.8), 55.5, 0.12 + i * 0.3, 13.2 + i * 0.35 * 0, 0).position.set(55.5, 0.12 + i * 0.3, 14.9 - i * 0.22);
    // Kantine
    for (const tz of [15, 19, 26]) for (const tx of [61, 67, 72]) {
      box(3, 0.08, 0.9, stahl, tx + 1.5, 0.78, tz + 0.5);
      box(0.1, 0.75, 0.1, dunkelStahl, tx + 1.5, 0.38, tz + 0.5);
      for (const sz of [-0.8, 0.8]) box(3, 0.06, 0.32, stahl, tx + 1.5, 0.45, tz + 0.5 + sz);
      for (let i = 0; i < 3; i++) box(0.36, 0.03, 0.26, stoff(0x8fa4b8, 0.5), tx + 0.6 + i, 0.84, tz + 0.5 + (i % 2 ? 0.2 : -0.2));
    }
    // Essensausgabe und Küche
    box(7, 0.95, 0.9, stahl, 82.5, 0.48, 13.5); box(2, 0.95, 3, stahl, 86, 0.48, 17.5);
    for (let i = 0; i < 3; i++) zyl(0.25, 0.35, stoff(0x777d84, 0.3, 0.9), 85.6 + (i % 2) * 0.6, 1.15, 16.6 + i * 0.9);
    box(4, 0.95, 0.9, stahl, 82, 0.48, 25.5);
    // Wäscherei
    for (let x = 64; x <= 84; x += 3) { box(1.9, 1.1, 0.9, stoff(0xe8e8e8, 0.4, 0.2), x + 1, 0.55, 34.5); const tr = zyl(0.33, 0.04, stoff(0x223040, 0.2, 0.5), x + 1, 0.6, 34.96, 16); tr.rotation.x = Math.PI / 2; }
    box(15, 0.9, 0.95, stoff(0xd8d2c0, 0.8), 73.5, 0.45, 40.5);
    for (let i = 0; i < 6; i++) box(0.5, 0.12, 0.4, stoff([0xf3f1ea, 0xff7a1a, 0x22314f][i % 3], 0.9), 67 + i * 2.2, 0.96, 40.5);
    // Werkstatt
    box(23, 2, 0.8, stoff(0x55606b, 0.6, 0.4), 74.5, 1, 48.5);
    for (let i = 0; i < 18; i++) box(0.5, 0.35, 0.5, stoff([0x8a5a32, 0x3a6ea5, 0xc0392b, 0x7f8c8d][i % 4], 0.7), 64 + i * 1.2, 2.2, 48.5);
    box(4, 0.9, 2, holz, 72, 0.45, 53);
    box(0.4, 0.3, 0.3, dunkelStahl, 70.4, 1.05, 52.3);
    box(5, 1.2, 2, stoff(0x37474f, 0.5, 0.5), 80.5, 0.6, 56); box(1.2, 0.6, 1.2, stoff(0x263238, 0.5, 0.6), 80, 1.5, 56);
    // Garage
    box(4, 2.2, 2, stoff(0x55606b, 0.6, 0.4), 84, 1.1, 64);
    for (let i = 0; i < 3; i++) zyl(0.3, 0.9, stoff(0x1565c0, 0.5, 0.3), 86 - i * 0.7, 0.45, 69.5);
    // Generator
    {
      const gen = new T.Group(); deko.add(gen); gen.position.set(39.5, 0, 66.5);
      const kor = new T.Mesh(new T.BoxGeometry(5, 2.2, 3), stoff(0x3d6b4f, 0.5, 0.4)); kor.position.y = 1.1; kor.castShadow = true; gen.add(kor);
      const tank = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 4.6, 16), stoff(0xd0a030, 0.5, 0.4)); tank.rotation.z = Math.PI / 2; tank.position.set(0, 2.6, 0); gen.add(tank);
      for (let i = 0; i < 3; i++) { const r = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 2, 8), dunkelStahl); r.position.set(-1.8 + i * 1.8, 3.2, -1); gen.add(r); }
      const lampe = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), new T.MeshBasicMaterial({ color:0x40ff60 })); lampe.position.set(1.8, 1.9, 1.52); gen.add(lampe);
      const schild = new T.Mesh(new T.PlaneGeometry(0.8, 0.6), new T.MeshBasicMaterial({ color:0xf2c14e })); schild.position.set(0, 1.4, 1.52); gen.add(schild);
      welt.generator = { gen, lampe, kor };
    }
    // Verwaltung: Wachstube
    box(4, 0.8, 2, holz, 18, 0.4, 40);
    for (let i = 0; i < 3; i++) { const mo = box(0.7, 0.45, 0.06, stoff(0x111111, 0.3), 16.8 + i * 1.2, 1.1, 39.3); const bild = new T.Mesh(new T.PlaneGeometry(0.62, 0.38), new T.MeshBasicMaterial({ color:0x3a7a5a })); bild.position.set(16.8 + i * 1.2, 1.1, 39.34); deko.add(bild); }
    for (let i = 0; i < 7; i++) { box(0.9, 2, 0.6, stoff(0x6f7f8f, 0.4, 0.6), 14.5 + i, 1, 36.4); box(0.02, 0.3, 0.02, 0x222222, 14.8 + i, 1.2, 36.72); }
    box(3, 0.75, 2, holz, 24, 0.38, 45);
    zyl(0.05, 0.12, 0xffffff, 23.5, 0.82, 44.7);
    {
      // Torschalter: Schaltkasten mit großem roten Knopf
      const s = KA.OBJ.torschalter;
      box(1, 1.2, 0.25, stoff(0xd8d8d8, 0.5, 0.3), s.x, 1.4, 36.12);
      zyl(0.14, 0.1, 0xd32f2f, s.x, 1.5, 36.3).rotation.x = Math.PI / 2;
      const schild = box(0.9, 0.2, 0.02, 0xf2c14e, s.x, 2.15, 36.26);
      schild.castShadow = false;
    }
    // Direktorbüro
    box(3, 0.8, 1.8, stoff(0x5d3a1e, 0.5), 16, 0.4, 55.9);
    box(0.7, 1.1, 0.7, stoff(0x3d2a20, 0.6), 16, 0.55, 57.4);
    box(3, 2.2, 0.5, stoff(0x5d3a1e, 0.6), 17, 1.1, 48.4);
    for (let i = 0; i < 12; i++) box(0.12, 0.35, 0.3, stoff([0x8e2a2a, 0x2a4f8e, 0x2a8e4f, 0xd4af37][i % 4], 0.8), 15.8 + i * 0.22, 1.6, 48.5);
    zyl(0.3, 0.5, 0x8a5a32, 13.8, 0.25, 58.6); { const p = new T.Mesh(new T.SphereGeometry(0.55, 10, 8), stoff(0x2e7d32, 0.9)); p.position.set(13.8, 0.95, 58.6); deko.add(p); }
    box(1.6, 1, 0.04, stoff(0xc0a060, 0.6), 17, 2, 59.95);
    // Einzelhaft: nur Pritschen
    for (const iz of [50.5, 56.5]) box(0.9, 0.5, 2, dunkelStahl, 31.4, 0.25, iz);
    // Hof: Körbe, Bänke, Hanteln, Beete
    for (const [kz, dz] of [[36.5, 1], [45.5, -1]]) {
      zyl(0.08, 3.4, stahl, 41.5, 1.7, kz);
      box(1.8, 1.1, 0.06, stoff(0xffffff, 0.4), 41.5, 3.3, kz + 0.25 * dz);
      const r = new T.Mesh(new T.TorusGeometry(0.23, 0.02, 6, 16), stoff(0xff5722, 0.5, 0.5)); r.rotation.x = Math.PI / 2; r.position.set(41.5, 3.05, kz + 0.55 * dz); deko.add(r);
    }
    for (const [x0, z0, n] of [[25, 34, 3], [34, 33, 3]]) { box(n, 0.08, 0.5, holz, x0 + n / 2, 0.45, z0 + 0.5); for (const sx of [0.2, n - 0.2]) box(0.1, 0.45, 0.4, dunkelStahl, x0 + sx, 0.22, z0 + 0.5); }
    box(1.8, 0.5, 0.6, stoff(0x222222, 0.6), 56.5, 0.25, 36.8); zyl(0.02, 2, stahl, 56.5, 1.1, 36.8).rotation.z = Math.PI / 2;
    for (const sx of [-0.95, 0.95]) { const s = zyl(0.25, 0.05, 0x111111, 56.5 + sx, 1.1, 36.8, 14); s.rotation.z = Math.PI / 2; }
    for (const z0 of [50, 54]) { box(4, 0.45, 2, holz, 42, 0.22, z0 + 1); for (let i = 0; i < 8; i++) { const p = new T.Mesh(new T.SphereGeometry(0.22, 6, 5), stoff(0x4caf50, 0.9)); p.position.set(40.4 + (i % 4), 0.6, z0 + 0.5 + Math.floor(i / 4)); deko.add(p); } }
    // Wachtürme
    welt.tuerme = KA.OBJ.tuerme.map(t => {
      const g = new T.Group(); g.position.set(t.x, 0, t.z); deko.add(g);
      for (const [sx, sz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) { const b = new T.Mesh(new T.BoxGeometry(0.2, 8, 0.2), dunkelStahl); b.position.set(sx, 4, sz); b.castShadow = true; g.add(b); }
      const kab = new T.Mesh(new T.BoxGeometry(2.6, 2, 2.6), stoff(0x5a6470, 0.6, 0.3)); kab.position.y = 9; kab.castShadow = true; g.add(kab);
      const dach = new T.Mesh(new T.ConeGeometry(2.2, 1, 4), stoff(0x2f363d, 0.6)); dach.position.y = 10.5; dach.rotation.y = Math.PI / 4; g.add(dach);
      const fe = new T.Mesh(new T.BoxGeometry(2.62, 0.7, 2.62), new T.MeshBasicMaterial({ color:0xffe6a0 })); fe.position.y = 9.3; g.add(fe);
      const kopf = new T.Mesh(new T.CylinderGeometry(0.3, 0.4, 0.6, 12), stoff(0x222222, 0.4, 0.6)); kopf.position.y = 10.3; kopf.userData.bleibt = true; g.add(kopf);
      return { g, kopf, fe };
    });
    // Laternen
    const LATERNEN = [[35, 48], [57, 48], [45, 60], [30, 61], [57, 60], [20, 62], [59, 45], [50, 34], [60, 31], [24, 33], [48, 69], [33, 47]];
    welt.laternen = LATERNEN.map(([x, z]) => {
      zyl(0.07, 5, dunkelStahl, x + 0.5, 2.5, z + 0.5, 8);
      const k = box(0.6, 0.15, 0.3, dunkelStahl, x + 0.5, 5, z + 0.5);
      const gl = new T.Sprite(new T.SpriteMaterial({ map:TEX.glanz, color:0xffd9a0, blending:T.AdditiveBlending, depthWrite:false, transparent:true }));
      gl.position.set(x + 0.5, 4.85, z + 0.5); gl.scale.set(1.6, 1.6, 1); deko.add(gl);
      const pfuetze = new T.Mesh(new T.CircleGeometry(4.2, 24), new T.MeshBasicMaterial({ map:TEX.glanz, color:0x5a4220, blending:T.AdditiveBlending, depthWrite:false, transparent:true }));
      pfuetze.rotation.x = -Math.PI / 2; pfuetze.position.set(x + 0.5, 0.03, z + 0.5); pfuetze.userData.bleibt = true; deko.add(pfuetze);
      return { gl, pfuetze, k };
    });
    // Deckenlampen in Gebäuden (nur Glühen)
    welt.deckenlampen = [];
    for (const [x, z, y] of [[25, 22, 3.15], [45, 22, 3.15], [67, 21, 3.9], [82, 20, 3.9], [73, 38, 3.9], [73, 52, 3.9], [74, 66, 3.9], [22, 41, 3.9], [17, 53, 3.9], [39, 66, 3.9], [28, 56, 3.9], [36, 56, 2.7]]) {
      const l = box(1.4, 0.06, 0.25, new T.MeshBasicMaterial({ color:0xfff2d0 }), x, y, z); l.castShadow = false;
      const p = new T.Mesh(new T.CircleGeometry(3.2, 20), new T.MeshBasicMaterial({ map:TEX.glanz, color:0x3a3428, blending:T.AdditiveBlending, depthWrite:false, transparent:true }));
      p.rotation.x = -Math.PI / 2; p.position.set(x, 0.025, z); p.userData.bleibt = true; deko.add(p);
      welt.deckenlampen.push({ l, p });
    }

    // Alles Feste zu wenigen Meshes zusammenfassen
    F.verschmelzen(deko, true);

    /* ---------- Türen (schieben auf, wenn jemand davor steht) ---------- */
    welt.tueren = [];
    function tuerenBauen() {
      for (const t of welt.tueren) deko.remove(t.g);
      welt.tueren = [];
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        const c = K.code(x, z);
        if (c !== 'D' && c !== 'B' && c !== 'R') continue;
        const wandX = /[#MDBR]/.test(K.code(x - 1, z)) || /[#MDBR]/.test(K.code(x + 1, z));   // Wand verläuft in x
        const g = new T.Group(); g.position.set(x + 0.5, 0, z + 0.5); if (!wandX) g.rotation.y = Math.PI / 2;
        const zelle = c === 'D' && (z === 18 || z === 26) && x < 53;
        let blatt;
        if (zelle) {
          blatt = new T.Group();
          for (let i = 0; i < 6; i++) { const s = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 2.3, 6), stahl); s.position.set(-0.4 + i * 0.16, 1.15, 0); blatt.add(s); }
          for (const y of [0.1, 1.1, 2.25]) { const q = new T.Mesh(new T.BoxGeometry(0.95, 0.06, 0.05), stahl); q.position.y = y; blatt.add(q); }
        } else {
          blatt = new T.Mesh(new T.BoxGeometry(0.95, 2.3, 0.08), stoff(c === 'B' ? 0x35567a : c === 'R' ? 0x7a3535 : 0x6d747c, 0.5, 0.4));
          blatt.position.y = 1.15; blatt.castShadow = true;
          const fe = new T.Mesh(new T.PlaneGeometry(0.4, 0.3), stoff(0x9fc3e7, 0.1, 0.3)); fe.position.set(0, 0.5, 0.045); blatt.add(fe);
          const fe2 = fe.clone(); fe2.position.z = -0.045; fe2.rotation.y = Math.PI; blatt.add(fe2);
        }
        const halter = new T.Group(); halter.add(blatt); g.add(halter);
        let leser = null;
        if (c === 'B' || c === 'R') {
          leser = new T.Mesh(new T.BoxGeometry(0.12, 0.18, 0.04), new T.MeshBasicMaterial({ color:0xff3030 }));
          leser.position.set(0.62, 1.3, 0.1); g.add(leser);
          const l2 = leser.clone(); l2.position.z = -0.1; g.add(l2); leser.zwei = l2;
          const streifen = new T.Mesh(new T.BoxGeometry(1, 0.08, 0.3), new T.MeshBasicMaterial({ color:c === 'B' ? 0x2196f3 : 0xe53935 })); streifen.position.y = 2.4; g.add(streifen);
        }
        deko.add(g);
        welt.tueren.push({ g, halter, x:x + 0.5, z:z + 0.5, c, leser, auf:0 });
      }
    }

    /* ---------- Tore ---------- */
    function torBauen(zz, art) {
      const g = new T.Group(); deko.add(g);
      const fl = [];
      for (const s of [-1, 1]) {
        const fluegel = new T.Group(); fluegel.position.set(49.5 + s * 1.5, 0, zz + 0.5); g.add(fluegel);
        if (art === 'mauer') {
          const p = new T.Mesh(new T.BoxGeometry(3, 4.6, 0.25), stoff(0x4e5a66, 0.45, 0.6)); p.position.y = 2.3; p.castShadow = true; fluegel.add(p);
          for (let i = 0; i < 5; i++) { const r = new T.Mesh(new T.BoxGeometry(3, 0.12, 0.3), stoff(0xf2c14e, 0.5)); r.position.y = 0.4 + i * 0.95; r.rotation.z = (i % 2 ? 0.35 : -0.35); fluegel.add(r); }
        } else {
          const p = new T.Mesh(new T.PlaneGeometry(3, 3.4), MAT.draht); p.position.y = 1.7; fluegel.add(p);
          const rahmen = new T.Mesh(new T.BoxGeometry(3, 0.08, 0.08), stahl); rahmen.position.y = 3.4; fluegel.add(rahmen);
        }
        fl.push({ fluegel, s });
      }
      // Torpfosten mit Warnlicht
      const lichter = [];
      for (const s of [-1, 1]) { const p = new T.Mesh(new T.BoxGeometry(0.5, 5.4, 0.5), MAT.mauer); p.position.set(49.5 + s * 3.25, 2.7, zz + 0.5); g.add(p); const l = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), new T.MeshBasicMaterial({ color:0x553300 })); l.position.set(49.5 + s * 3.25, 5.55, zz + 0.5); g.add(l); lichter.push(l); }
      return { g, fl, z:zz, auf:0, lichter };
    }
    welt.tore = [torBauen(KA.MAUER.z1, 'mauer'), torBauen(KA.ZAUN.z1, 'zaun')];

    /* ---------- Lüftung ---------- */
    let lueftGruppe = null;
    welt.gitterMesh = [];
    function lueftungBauen() {
      if (lueftGruppe) root.remove(lueftGruppe);
      lueftGruppe = new T.Group();
      const b = new Bauer(), y0 = 3.1, y1 = 3.85;
      const gIdx = new Set(K.gitter.map(g => g.z * W + g.x));
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        if (!K.lueft[z * W + x]) continue;
        if (!gIdx.has(z * W + x)) deckel(b, x, z, y0, 0.5, true);
        if (!(x === KA.LUKE.x && z === KA.LUKE.z)) deckel(b, x, z, y1, 0.5);
        for (let d = 0; d < 4; d++) { const nx = x + DIRS[d][0], nz = z + DIRS[d][1]; if (!K.drin(nx, nz) || !K.lueft[nz * W + nx]) seite(b, x, z, d, y0, y1, { u:1, v:1 }); }
      }
      const m = new T.Mesh(b.geo(), MAT.lueftung); m.castShadow = true; lueftGruppe.add(m);
      welt.gitterMesh = K.gitter.map(g => {
        const p = new T.Mesh(new T.PlaneGeometry(1, 1), MAT.gitter); p.rotation.x = Math.PI / 2; p.position.set(g.x + 0.5, y0 - 0.01, g.z + 0.5); lueftGruppe.add(p);
        const loch = new T.Mesh(new T.PlaneGeometry(0.98, 0.98), new T.MeshBasicMaterial({ color:0x050505, side:T.DoubleSide })); loch.rotation.x = Math.PI / 2; loch.position.set(g.x + 0.5, y0 + 0.02, g.z + 0.5); lueftGruppe.add(loch); loch.visible = false;
        return { p, loch };
      });
      root.add(lueftGruppe);
    }

    /* ---------- Tunnel ---------- */
    let tunnelGruppe = null;
    function tunnelBauen() {
      if (tunnelGruppe) { root.remove(tunnelGruppe); tunnelGruppe.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
      tunnelGruppe = new T.Group();
      const b = new Bauer(), y0 = -2.4, y1 = -1.0;
      let n = 0;
      const balken = [];
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
        if (!K.tunnel[z * W + x]) continue;
        n++;
        const loch = K.code(x, z) === 'O';
        deckel(b, x, z, y0, 0.5);
        if (!loch) deckel(b, x, z, y1, 0.5, true);
        for (let d = 0; d < 4; d++) { const nx = x + DIRS[d][0], nz = z + DIRS[d][1]; if (!K.drin(nx, nz) || !K.tunnel[nz * W + nx]) seite(b, x, z, d, y0, loch ? 0 : y1, { u:0.5, v:0.5 }); else if (loch && K.code(nx, nz) !== 'O') seite(b, x, z, d, y1, 0, { u:0.5, v:0.5 }); }
        if ((x + z) % 2 === 0 && !loch) balken.push([x, z]);
      }
      if (n) {
        const m = new T.Mesh(b.geo(), MAT.tunnel); m.receiveShadow = true; tunnelGruppe.add(m);
        for (const [x, z] of balken) {
          const q = new T.Mesh(new T.BoxGeometry(1, 0.12, 0.14), holz); q.position.set(x + 0.5, y1 - 0.07, z + 0.5); tunnelGruppe.add(q);
        }
        // Funzeln im Tunnel
        for (const [x, z] of balken.filter((_, i) => i % 4 === 0)) { const l = new T.Mesh(new T.SphereGeometry(0.06, 6, 4), new T.MeshBasicMaterial({ color:0xffd27a })); l.position.set(x + 0.5, y1 - 0.2, z + 0.5); tunnelGruppe.add(l); }
      }
      // Löcher an der Oberfläche: dunkle Öffnung mit Erdhaufen und Leiter
      for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (K.code(x, z) === 'O') {
        const h = new T.Mesh(new T.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stoff(0x5a4430, 1)); h.scale.set(1, 0.4, 0.7); h.position.set(x + 1.15, 0, z + 0.5); h.castShadow = true; tunnelGruppe.add(h);
        for (const sx of [-0.25, 0.25]) { const l = new T.Mesh(new T.BoxGeometry(0.05, 2.6, 0.05), holz); l.position.set(x + 0.5 + sx, -1.1, z + 0.2); tunnelGruppe.add(l); }
        for (let i = 0; i < 7; i++) { const s = new T.Mesh(new T.BoxGeometry(0.5, 0.04, 0.04), holz); s.position.set(x + 0.5, -2.2 + i * 0.36, z + 0.2); tunnelGruppe.add(s); }
      }
      F.verschmelzen(tunnelGruppe);
      root.add(tunnelGruppe);
    }

    /* ---------- Fahrzeuge ---------- */
    {
      const v = new T.Group(); root.add(v);
      const weiss = stoff(0xeeeeec, 0.35, 0.3), glas = stoff(0x1c2a36, 0.1, 0.6), schwarz = stoff(0x18191b, 0.6);
      const kor = new T.Mesh(new T.BoxGeometry(2, 1.7, 4.4), weiss); kor.position.y = 1.35; kor.castShadow = true; v.add(kor);
      const front = new T.Mesh(new T.BoxGeometry(1.96, 0.9, 0.8), weiss); front.position.set(0, 0.9, 2.5); front.castShadow = true; v.add(front);
      const scheibe = new T.Mesh(new T.BoxGeometry(1.8, 0.7, 0.05), glas); scheibe.position.set(0, 1.75, 2.21); scheibe.rotation.x = -0.25; v.add(scheibe);
      for (const s of [-1, 1]) { const f = new T.Mesh(new T.BoxGeometry(0.05, 0.6, 0.9), glas); f.position.set(s * 1.01, 1.75, 1.6); v.add(f); }
      const streifen = new T.Mesh(new T.BoxGeometry(2.02, 0.3, 4.42), stoff(0x1e5aa8, 0.5)); streifen.position.y = 1.1; v.add(streifen);
      for (const [sx, sz] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.5], [0.95, -1.5]]) { const r = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.3, 14), schwarz); r.rotation.z = Math.PI / 2; r.position.set(sx, 0.4, sz); r.castShadow = true; v.add(r); }
      for (const s of [-1, 1]) { const l = new T.Mesh(new T.BoxGeometry(0.3, 0.15, 0.05), new T.MeshBasicMaterial({ color:0xfff4d0 })); l.position.set(s * 0.7, 1.05, 2.92); v.add(l); const r = new T.Mesh(new T.BoxGeometry(0.25, 0.2, 0.05), new T.MeshBasicMaterial({ color:0xb01010 })); r.position.set(s * 0.8, 1.1, -2.22); v.add(r); }
      const bl = new T.Mesh(new T.BoxGeometry(0.8, 0.15, 0.3), new T.MeshBasicMaterial({ color:0x1e40ff })); bl.position.set(0, 2.25, 1.4); v.add(bl);
      welt.van = { g:v, blau:bl };
    }
    {
      const h = new T.Group(); root.add(h);
      const lack = stoff(0x2a3a4a, 0.35, 0.5), glas = stoff(0x8fc3e7, 0.05, 0.3, { transparent:true, opacity:0.6 });
      const kor = new T.Mesh(new T.SphereGeometry(1.3, 18, 12), lack); kor.scale.set(1, 0.85, 1.6); kor.position.y = 1.4; kor.castShadow = true; h.add(kor);
      const cockpit = new T.Mesh(new T.SphereGeometry(1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glas); cockpit.rotation.x = Math.PI / 2; cockpit.position.set(0, 1.5, 1.2); h.add(cockpit);
      const schwanz = new T.Mesh(new T.CylinderGeometry(0.15, 0.35, 4, 10), lack); schwanz.rotation.x = Math.PI / 2; schwanz.position.set(0, 1.7, -3.6); h.add(schwanz);
      const finne = new T.Mesh(new T.BoxGeometry(0.08, 1, 0.6), lack); finne.position.set(0, 2.1, -5.4); h.add(finne);
      for (const s of [-1, 1]) { const k = new T.Mesh(new T.BoxGeometry(0.08, 0.08, 3), stoff(0x222222, 0.5)); k.position.set(s * 0.9, 0.08, 0.2); h.add(k); }
      const rotor = new T.Group(); rotor.position.y = 2.75; h.add(rotor);
      for (let i = 0; i < 4; i++) { const bl = new T.Mesh(new T.BoxGeometry(0.25, 0.04, 5.2), stoff(0x1a1a1a, 0.5)); bl.position.z = 2.6; const arm = new T.Group(); arm.rotation.y = i * Math.PI / 2; arm.add(bl); rotor.add(arm); }
      rotor.add(new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.4, 10), stoff(0x333333, 0.4)));
      const hr = new T.Mesh(new T.BoxGeometry(0.05, 1.2, 0.12), stoff(0x1a1a1a, 0.5)); hr.position.set(0.12, 2.1, -5.4); h.add(hr);
      h.position.set(KA.OBJ.heli.x, 6.2, KA.OBJ.heli.z); h.rotation.y = -0.4;
      welt.heli = { g:h, rotor, hr, dreh:0, weg:0 };
    }

    /* ---------- Licht ---------- */
    const hemi = new T.HemisphereLight(0x8094c4, 0x2a2219, 0.62); szene.add(hemi);
    const mondLicht = new T.DirectionalLight(0xc4d4ff, 0.5);
    mondLicht.position.set(-60, 90, -50); mondLicht.castShadow = stufe === 'hoch';
    mondLicht.shadow.mapSize.set(2048, 2048);
    const sc = mondLicht.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 10; sc.far = 220;
    mondLicht.shadow.bias = -0.0008;
    szene.add(mondLicht); szene.add(mondLicht.target);
    const spielerLicht = new T.PointLight(0xffd9a8, 0.9, 13, 1.6); szene.add(spielerLicht);
    welt.licht = { hemi, mondLicht, spielerLicht };
    // Scheinwerfer
    const kegelMat = new T.MeshBasicMaterial({ color:0xfff3c8, transparent:true, opacity:0.07, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide });
    const fleckMat = new T.MeshBasicMaterial({ map:TEX.glanz, color:0xfff1c0, transparent:true, opacity:0.85, blending:T.AdditiveBlending, depthWrite:false });
    welt.scheinwerfer = welt.tuerme.map((t, i) => {
      const s = new T.SpotLight(0xfff1d0, 2.6, 70, 0.11, 0.5, 1.2);
      s.position.set(KA.OBJ.tuerme[i].x, 10.3, KA.OBJ.tuerme[i].z); szene.add(s.target);
      if (stufe !== 'niedrig') szene.add(s);
      const kegel = new T.Mesh(new T.ConeGeometry(1, 1, 20, 1, true), kegelMat); szene.add(kegel);
      const fleck = new T.Mesh(new T.CircleGeometry(3.2, 24), fleckMat); fleck.rotation.x = -Math.PI / 2; szene.add(fleck);
      return { s, kegel, fleck };
    });

    /* ---------- Dynamik: Gegenstände, Bomben, Seile, Effekte ---------- */
    welt.items = new Map();
    const itemRing = new T.MeshBasicMaterial({ map:TEX.glanz, color:0xffc060, transparent:true, opacity:0.55, blending:T.AdditiveBlending, depthWrite:false });
    welt.itemsSetzen = (liste, e) => {
      const da = new Set();
      for (const [id, art, x, z, ie] of liste) {
        da.add(id);
        let o = welt.items.get(id);
        if (!o) {
          const g = new T.Group(); const m = F.item(art); g.add(m);
          const ring = new T.Mesh(new T.CircleGeometry(0.45, 16), itemRing); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
          root.add(g); o = { g, m, art }; welt.items.set(id, o);
        }
        const y = ie === 1 ? -2.4 : ie === 2 ? 3.1 : ie === 3 ? 6.2 : 0;
        // Auf Möbeln liegen Dinge etwas höher
        const xi = Math.floor(x), zi = Math.floor(z);
        const aufMoebel = ie === 0 && K.code(xi, zi) === 'x' ? 0.9 : 0;
        o.g.position.set(x, y + aufMoebel, z); o.basisY = y + aufMoebel;
      }
      for (const [id, o] of welt.items) if (!da.has(id)) { root.remove(o.g); welt.items.delete(id); }
    };
    welt.bomben = [];
    welt.bombenSetzen = liste => {
      while (welt.bomben.length > liste.length) root.remove(welt.bomben.pop().g);
      while (welt.bomben.length < liste.length) { const g = F.item('sprengstoff'); root.add(g); welt.bomben.push({ g }); }
      liste.forEach(([x, z, rest], i) => { const b = welt.bomben[i]; b.g.position.set(x, 0.5, z); b.rest = rest; });
    };
    welt.seilMesh = KA.OBJ.haken.map(h => {
      const g = new T.Group();
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = i / n, y = 6.8 * (1 - a);
        const x = h.x + (h.unten.x - h.x) * Math.min(1, a * 3) * 0.35, z = h.z + (h.unten.z - h.z) * Math.min(1, a * 3) * 0.35;
        const s = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.8, 6), stoff(0xf0ece2, 0.9)); s.position.set(x + (h.unten.x - h.x) * 0.3, y - 0.4, z + (h.unten.z - h.z) * 0.3); g.add(s);
        const k = new T.Mesh(new T.SphereGeometry(0.1, 6, 5), stoff(0xe2dccd, 0.9)); k.position.copy(s.position); k.position.y -= 0.4; g.add(k);
      }
      g.visible = false; root.add(g); return g;
    });

    // Partikel (Explosion, Funken, Staub)
    const partikel = [];
    const pMat = c => new T.MeshBasicMaterial({ color:c, transparent:true, blending:T.AdditiveBlending, depthWrite:false });
    const pGeo = new T.SphereGeometry(1, 6, 4);
    function partikelNeu(x, y, z, vx, vy, vz, farbe, groesse, leben, schwer = 1) {
      const m = new T.Mesh(pGeo, pMat(farbe)); m.position.set(x, y, z); m.scale.setScalar(groesse); root.add(m);
      partikel.push({ m, vx, vy, vz, leben, max:leben, schwer, g:groesse });
    }
    const blitz = new T.PointLight(0xffa040, 0, 30, 2); szene.add(blitz);
    welt.explosion = (x, z) => {
      blitz.position.set(x, 2, z); blitz.intensity = 8;
      for (let i = 0; i < 40; i++) { const w = Math.random() * 6.28, v = 3 + Math.random() * 8; partikelNeu(x, 1, z, Math.cos(w) * v, 2 + Math.random() * 8, Math.sin(w) * v, i % 3 ? 0xff8a20 : 0xffe080, 0.15 + Math.random() * 0.3, 0.6 + Math.random() * 0.6); }
      for (let i = 0; i < 25; i++) { const w = Math.random() * 6.28, v = 1 + Math.random() * 3; const m = new T.Mesh(pGeo, new T.MeshStandardMaterial({ color:0x555555, transparent:true, opacity:0.6, depthWrite:false })); m.position.set(x, 1, z); m.scale.setScalar(0.6); root.add(m); partikel.push({ m, vx:Math.cos(w) * v, vy:1 + Math.random() * 2, vz:Math.sin(w) * v, leben:2.5, max:2.5, schwer:-0.1, g:0.6, rauch:true }); }
    };
    welt.funken = (x, y, z, n = 10, farbe = 0x9fe0ff) => { for (let i = 0; i < n; i++) partikelNeu(x, y, z, (Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4, farbe, 0.03 + Math.random() * 0.04, 0.3 + Math.random() * 0.3); };
    welt.staub = (x, y, z) => { for (let i = 0; i < 6; i++) partikelNeu(x, y, z, (Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 0x8a6a48, 0.06 + Math.random() * 0.06, 0.5); };

    /* ---------- Aufbau und Aktualisieren ---------- */
    bodenBauen(); waendeBauen(); zaunBauen(); tuerenBauen(); lueftungBauen(); tunnelBauen();
    welt.karteGeaendert = () => { bodenBauen(); waendeBauen(); zaunBauen(); tuerenBauen(); tunnelBauen(); };
    welt.tunnelGeaendert = tunnelBauen;
    welt.gitterSetzen = () => K.gitter.forEach((g, i) => { welt.gitterMesh[i].p.visible = !g.offen; welt.gitterMesh[i].loch.visible = g.offen; });

    let strom = true, alarm = 0;
    welt.setStrom = an => {
      strom = an;
      for (const l of welt.laternen) { l.gl.visible = an; l.pfuetze.visible = an; }
      for (const d of welt.deckenlampen) { d.l.material.color.setHex(an ? 0xfff2d0 : 0x333333); d.p.visible = an; }
      for (const t of welt.tuerme) t.fe.material.color.setHex(an ? 0xffe6a0 : 0x222222);
      for (const s of welt.scheinwerfer) { s.s.visible = an; s.kegel.visible = an; s.fleck.visible = an; }
      welt.generator.lampe.material.color.setHex(an ? 0x40ff60 : 0xff2020);
      hemi.intensity = an ? 0.62 : 0.36;
    };
    welt.setAlarm = a => { alarm = a; };
    welt.setGrafik = g => {
      mondLicht.castShadow = g === 'hoch';
      for (const s of welt.scheinwerfer) { if (g === 'niedrig') szene.remove(s.s); else if (!s.s.parent) szene.add(s.s); }
    };

    // Dächer und Innenleben: Dach ausblenden, wenn Spieler oder Kamera drin sind
    welt.sicht = (sp, kamera) => {
      for (const d of welt.daecher) {
        const drin = inRect(d.r, Math.floor(sp.x), Math.floor(sp.z)) && sp.e !== 3 && sp.e !== 1;
        const kDrin = inRect(d.r, Math.floor(kamera.position.x), Math.floor(kamera.position.z)) && kamera.position.y < d.h + 0.5;
        d.grp.visible = !(drin || kDrin) || (sp.e === 3 && d.id === 'zellen');
      }
      if (tunnelGruppe) tunnelGruppe.visible = true;
    };

    welt.update = (dt, t, info) => {
      // info: { S (Spiegel), ents: [{x,z,wache,ich,zugang}], ich:{x,z,e}, toreOffen }
      // Scheinwerfer
      welt.scheinwerfer.forEach((s, i) => {
        const p = KK_LOGIK.scheinwerfer(i, t);
        s.s.target.position.set(p.x, 0, p.z);
        const top = s.s.position, dx = p.x - top.x, dz = p.z - top.z, dy = -top.y, l = Math.hypot(dx, dy, dz);
        s.kegel.scale.set(3.1, l, 3.1);
        s.kegel.position.set(top.x + dx / 2, top.y + dy / 2, top.z + dz / 2);
        s.kegel.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), new T.Vector3(dx / l, dy / l, dz / l));
        s.fleck.position.set(p.x, 0.04, p.z);
        welt.tuerme[i].kopf.lookAt(p.x, 0, p.z);
      });
      // Türen
      for (const d of welt.tueren) {
        let soll = 0;
        for (const e of info.ents) {
          if (Math.abs(e.x - d.x) > 1.6 || Math.abs(e.z - d.z) > 1.6) continue;
          if (d.c === 'D' || !strom || e.wache || !e.ich || (d.c === 'B' ? e.blau || e.rot : e.rot)) { soll = 1; break; }
        }
        d.auf += (soll - d.auf) * Math.min(1, dt * 6);
        d.halter.position.x = d.auf * 0.9;
        if (d.leser) { const ok = !strom || (d.c === 'B' ? info.blau || info.rot : info.rot); d.leser.material.color.setHex(ok ? 0x30ff60 : 0xff3030); }
      }
      // Tore
      for (const tor of welt.tore) {
        const kaputt = K.code(48, tor.z) === 'L';
        tor.g.visible = !kaputt;
        tor.auf += ((info.toreOffen ? 1 : 0) - tor.auf) * Math.min(1, dt * 1.5);
        for (const f of tor.fl) f.fluegel.position.x = 49.5 + f.s * (1.5 + tor.auf * 2.9);
        const blink = info.toreOffen && Math.sin(t * 10) > 0;
        for (const l of tor.lichter) l.material.color.setHex(blink ? 0xffa000 : 0x553300);
      }
      if (welt.rolltor) welt.rolltor.position.y = 1.8 + (info.toreOffen ? 3 : 0) * 0.5;
      // Gegenstände wippen
      for (const o of welt.items.values()) { o.m.rotation.y += dt * 1.2; o.m.position.y = 0.06 + Math.sin(t * 2.5 + o.g.position.x) * 0.04; }
      for (const b of welt.bomben) if (b.g.led) b.g.led.visible = Math.sin(t * (b.rest < 2 ? 30 : 10)) > 0;
      // Strom: Funken am Zaun
      if (strom && Math.random() < dt * 1.5) {
        const Z0 = KA.ZAUN, s = Math.floor(Math.random() * 4), a = Math.random();
        const x = s < 2 ? Z0.x0 + a * (Z0.x1 - Z0.x0) : (s === 2 ? Z0.x0 : Z0.x1) + 0.5;
        const z = s >= 2 ? Z0.z0 + a * (Z0.z1 - Z0.z0) : (s === 0 ? Z0.z0 : Z0.z1) + 0.5;
        if (Math.hypot(x - info.ich.x, z - info.ich.z) < 40) welt.funken(x, 1 + Math.random() * 2.5, z, 6);
      }
      if (!strom && welt.generator && Math.random() < dt * 3) welt.funken(39.5 + (Math.random() - 0.5) * 3, 2.3, 66.5 + 1.4, 3, 0xffc040);
      // Van-Blaulicht bei Alarm
      welt.van.blau.material.color.setHex(alarm >= 2 && Math.sin(t * 12) > 0 ? 0x4060ff : 0x10184a);
      // Heli
      const h = welt.heli;
      if (info.heli) {
        if (info.heli.startBis) h.dreh = Math.min(30, h.dreh + dt * 10);
        h.rotor.rotation.y += h.dreh * dt; h.hr.rotation.x += h.dreh * dt * 1.4;
        if (info.heli.weg) {
          h.weg += dt;
          h.g.position.set(KA.OBJ.heli.x + h.weg * h.weg * 2, 6.2 + h.weg * 6, KA.OBJ.heli.z - h.weg * h.weg * 3);
          h.g.rotation.x = -0.25;
          if (h.weg > 20) h.g.visible = false;
        }
      }
      // Partikel
      for (let i = partikel.length - 1; i >= 0; i--) {
        const p = partikel[i];
        p.leben -= dt;
        if (p.leben <= 0) { root.remove(p.m); p.m.material.dispose(); partikel.splice(i, 1); continue; }
        p.vy -= 9.8 * p.schwer * dt;
        p.m.position.x += p.vx * dt; p.m.position.y = Math.max(0.03, p.m.position.y + p.vy * dt); p.m.position.z += p.vz * dt;
        const a = p.leben / p.max;
        p.m.material.opacity = p.rauch ? a * 0.6 : a;
        if (p.rauch) p.m.scale.setScalar(p.g * (1 + (1 - a) * 3));
      }
      blitz.intensity *= Math.max(0, 1 - dt * 6);
    };
    return welt;
  }

  window.KKW = { bauen, GEBAEUDE };
})();
