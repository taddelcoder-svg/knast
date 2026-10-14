# Knastknacker

Gefängnisausbruch im Browser (Prinzip wie Cuffbust, eigener Name und eigene Figuren): Tiere im orangen Overall, Bulldoggen als Wärter. Solo oder online mit bis zu 10 Leuten, am PC, Handy und iPad.

## Ausbruchswege

- **Tunnel**: Löffel oder Schaufel, Loch graben, unter Mauer und Zaun durch, dahinter hochgraben
- **Lüftung**: Schraubenzieher, Gitter abschrauben, durch die Schächte aufs Dach, in die Wachstube oder ins Direktorbüro
- **Lakenseil**: zwei Bettlaken knoten, vom Dach in den Todesstreifen abseilen
- **Strom**: Generator mit dem Hammer zertrümmern: Zaun tot, Kartentüren offen, Scheinwerfer aus (ein Wärter repariert nach 20 s)
- **Zaun**: Drahtschere, nur ohne Strom
- **Sprengstoff**: Dünger + Reiniger an der Werkbank, sprengt Mauer, Zaun, Türen, Tore, Generator
- **Van**: Schlüssel aus der Wachstube, Rolltor und Haupttor rammen, bis zu 4 Leute
- **Heli**: Schlüssel im Direktorbüro (rote Tür), Start auf dem Dach, bis zu 4 Leute
- **Tore**: roter Knopf in der Wachstube öffnet beide Tore 15 s

Extras: Tipp-Anzeige „Nächster Schritt“ (Taste `T`, Ziel auf der Minikarte), Schwierigkeit der Wärter (Solo), Lautstärke und Empfindlichkeit, Statistik am Rundenende, 3D-Hintergrund im Menü.

Modi: jeder für sich, Banden (2er), alle zusammen (kein Prügeln untereinander). Rundenzeit 10/15/20 Minuten.

## Technik

- `js/karte.js`: Raster 100 × 84 m, Ebenen Boden/Tunnel/Lüftung/Dach, Zonen, Spawns, Wärterrouten (Server + Browser)
- `js/logik.js`: Spielregeln mit 20 Takten/s: Wärter (Sichtkegel, Verdacht, A*), Gegenstände, Aktionen, Alarm, Fahrzeuge. `moeglich()` ist geteilt: Der Server prüft, der Browser zeigt den Hinweis
- `raeume.js` + `server.js`: Online-Räume (ws auf `/ws`, Code mit 4 Zeichen, Einladungslink `/?raum=CODE`, Wiederverbinden per Token)
- `js/welt.js`, `js/figuren.js`, `js/spiel.js`, `js/ton.js`: Browser (three.js r128 lokal ausgeliefert, keine CDNs)
- Spieler bewegen sich im Browser, der Server prüft Tempo und Kollision

```bash
npm install
npm start          # http://localhost:11200 (ohne ZUGANG_PASSWORT lokal offen)
npm test
```

Touch-Steuerung kommt automatisch auf Handys und iPads; `/?touch=1` erzwingt sie. Die Grafik schaltet bei wenig FPS selbst herunter.

Debug in der Konsole (solo): `knastknacker.tp(x, z, ebene)`, `knastknacker.gib('sprengstoff')`, `knastknacker.spiel()`, `knastknacker.tick(n)` (Bilder von Hand, wenn der Tab im Hintergrund ist).

Render: Docker-Dienst per `render.yaml`, Umgebungsvariable `ZUGANG_PASSWORT` (dasselbe Passwort wie bei den anderen Spielen).
