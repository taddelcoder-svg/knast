'use strict';
// Knastknacker – Räume ohne echten WebSocket
const test = require('node:test');
const assert = require('node:assert');
const { raeume } = require('../raeume');

function klient(R) {
  const k = { post:[], letzte:{} };
  k.v = R.verbinden({ send:t => { const d = JSON.parse(t); k.post.push(d); k.letzte[d.t] = d; }, close:() => {} });
  k.schick = d => k.v.nachricht(JSON.stringify(d));
  return k;
}

test('Raum erstellen, beitreten, starten, bewegen, Ereignisse', () => {
  const R = raeume({ seed:() => 42 });
  const a = klient(R), b = klient(R);
  a.schick({ t:'hallo', name:'Ana', tier:'fuchs' });
  b.schick({ t:'hallo', name:'Ben', tier:'fuchs' });
  a.schick({ t:'neu', einst:{ modus:'banden', dauer:600 } });
  const code = a.letzte.raum.code;
  b.schick({ t:'beitreten', code });
  assert.strictEqual(b.letzte.raum.mitglieder.length, 2);
  assert.notStrictEqual(b.letzte.raum.mitglieder[0].tier, b.letzte.raum.mitglieder[1].tier, 'Tiere doppelt');
  b.schick({ t:'start' });                       // nur der Host darf
  assert.strictEqual(a.letzte.raum.phase, 'lobby');
  a.schick({ t:'start' });
  assert.strictEqual(a.letzte.raum.phase, 'spiel');
  assert.strictEqual(a.letzte.z.z.modus, 'banden');
  assert.strictEqual(a.letzte.z.z.dauer, 600);
  for (let i = 0; i < 3; i++) R.takt();
  assert.ok(a.letzte.pos.p.s.length === 2);
  // eigene Startposition kommt als tele-Ereignis nur an mich
  const teles = a.post.filter(d => d.t === 'ev').flatMap(d => d.e).filter(e => e.art === 'tele');
  assert.ok(teles.length >= 1 && teles.every(e => e.an === a.letzte.du.id));
  const ich = a.letzte.z.z.sp.find(s => s.id === a.letzte.du.id);
  const t0 = teles[0];
  a.schick({ t:'p', x:t0.x, z:t0.z + 0.1, r:0, tp:ich.tp, a:1 });
  R.takt();
  const p = a.letzte.pos.p.s.find(s => s[0] === a.letzte.du.id);
  assert.ok(Math.abs(p[2] - (t0.z + 0.1)) < 0.02);
  // Chat geht an alle
  a.schick({ t:'a', b:{ a:'chat', text:'Los gehts <b>' } });
  R.takt();
  const chat = b.post.filter(d => d.t === 'ev').flatMap(d => d.e).find(e => e.art === 'chat');
  assert.strictEqual(chat.text, 'Los gehts b');
});
