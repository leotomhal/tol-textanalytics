# tol-textanalytics

Obsidian-Plugin „TOL Textanalyse" — Lesbarkeitsanalyse für deutsche Texte:
Highlighting im Editor (lange Sätze, Passiv, Füllwörter, monotone
Satzlängen), Flesch-Index, Composite-Score und Zielzeichenzahl. Aktiv nur
bei Notizen mit `typ: draft` im Frontmatter.

## Stand

Frühere Fassung dieses Repos war ein deutlich umfangreicheres TypeScript-
Projekt (WSTF/LIX, Nominalstil, Wortschatz-Abgleich gegen eine DeReWo-Liste,
Profile, ausführliche Testsuite — dokumentiert in
[`konzept-textanalyse-plugin.md`](./konzept-textanalyse-plugin.md)). Die
Text-Markierungen im Editor liefen dort aber trotz vollständiger Testsuite
in der echten Obsidian-Instanz nicht zuverlässig.

Das Repo wurde daher auf ein früher schon einmal funktionierendes, deutlich
einfacheres Plugin zurückgesetzt: eine einzelne handgeschriebene `main.js`
ohne Build-Schritt und ohne TypeScript. Die Text-Markierungen
laufen über ein CodeMirror-6-`ViewPlugin`, das sich bei jeder
Dokumentänderung selbst neu berechnet (statt über von außen dispatchte
StateEffects wie in der vorherigen Fassung) — das war vermutlich auch die
Ursache des Problems.

Inzwischen sind die zentralen Metriken des Konzepts wieder eingebaut
(WSTF, LIX, Satzbau-Kennzahlen, Nominalstil, Perfekt, Abkürzungen) — nicht
enthalten ist der Wortschatz-Abgleich, weil er die DeReWo-Frequenzliste
voraussetzt, die nicht im Repo liegt. `konzept-textanalyse-plugin.md`
bleibt die Referenz für die vollständige Zielvision und beschreibt damit
weiterhin mehr, als das Plugin kann.

## Entwicklung

Kein Build-Schritt. `main.js`, `manifest.json` und `styles.css` direkt
bearbeiten und zum Testen nach `<Vault>/.obsidian/plugins/tol-textanalyse/`
kopieren (oder das Repo dorthin symlinken), dann das Plugin in Obsidian
neu laden.

## Tests

Die Analyse-Engine hat einen abhängigkeitsfreien Testlauf (Node, kein
Framework, kein `npm install`):

```
node tests/analyse.test.js
```

Der Test kompiliert `main.js` mit einem Stub für das `obsidian`-Modul und
prüft `analysiereText()` gegen Beispieltexte. Exit-Code 1 bei Fehlern.
Vor jeder Änderung an der Engine laufen lassen.

## Wortschatz-Listen

Die Prüfung auf seltene Wörter und die Fachwort-Korrektur der Wiener
Sachtextformel brauchen zwei Häufigkeitslisten im Plugin-Ordner. Beide
erzeugt `tools/frequenzliste.js`, beide sind optional — fehlen sie, ruht
nur diese eine Prüfung.

**`frequenz-allgemein.json`** — allgemeinsprachliches Korpus. Was hier
fehlt, gilt für die Leserschaft als Fachbegriff. Eine fertige, frei
lizenzierte Häufigkeitsliste (Format `wort anzahl` pro Zeile) umwandeln:

```
node tools/frequenzliste.js --konvertiere de_full.txt --out frequenz-allgemein.json
```

**`frequenz-eigene.json`** — das eigene Pressemeldungs-Archiv. Was hier
häufig vorkommt, ist Hausvokabular und wird nicht bei jeder Meldung neu
angemahnt (für die Fachwort-Korrektur zählt es trotzdem, denn der Leser
kennt ein Wort nicht, nur weil es in jeder Meldung steht):

```
node tools/frequenzliste.js /pfad/zum/archiv --out frequenz-eigene.json
```

Optionen: `--min` (Mindesthäufigkeit, Standard 3 — filtert Tippfehler und
einzeln auftauchende Personennamen heraus), `--top` (Anzahl behaltener
Wörter, Standard 8000), `--quelle` (Notiz für die Metadaten). Die
Bereinigung und Wortzerlegung kommen aus `main.js` selbst, damit das
Korpus genauso tokenisiert wird wie die Texte im Editor.

Ein eigenes Archiv als *alleinige* Grundlage taugt übrigens nicht: Es misst
"ungewöhnlich für mich" statt "schwer für den Leser" — die eigenen
Standard-Fachbegriffe fielen dann nie auf. Deshalb die zweite Liste.

## Funktionsumfang

- Aktivierung nur bei Notizen mit `typ: draft` im Frontmatter.
- Markierungen im Editor: lange Sätze (>25 Wörter, >35 Wörter zusätzlich
  hervorgehoben), Passiv-Konstruktionen (inkl. invertiertes Passiv),
  Füllwörter, Wortwiederholungen (ab dem dritten Vorkommen im Fenster
  werden alle Vorkommen markiert), monotone Satzlängen pro Absatz
  ("Sprachmelodie"), Nominalstil samt Streckverben, Perfekt und nicht
  aufgelöste Abkürzungen.
- Längenprüfung für H1-Überschrift (Ampel: grün bis 60, gelb bis 80, rot
  darüber) und für den gefetteten Teaser-Absatz direkt darunter
  (Zielwert 480 oder 700 Zeichen), beides auch im Editor markiert.
- Sidebar-Panel mit zwei Tabs: Statistik (Längenblock, Composite-Score,
  Flesch, Wiener Sachtextformel und LIX, Satzbau mit Median/Mittelwert/
  Maximum, Satzlängen-Histogramm und separater Bewertung des ersten
  Satzes, Wörter/Zeichen/Sätze/Lesezeit, Kategorien-Zähler mit Klick zum
  Ein-/Ausblenden) und Issues (Liste aller Fundstellen mit
  Kontext-Snippet, Klick springt zur Stelle im Editor).
- Wortschatz: seltene Wörter als eigene Kategorie und die Wiener
  Sachtextformel zusätzlich ohne Fachbegriffe gerechnet — beides nur, wenn
  die Häufigkeitslisten vorliegen (siehe oben).
- Einstellungen (Zielzeichenzahlen, abgeschaltete Kategorien) werden im
  Vault gespeichert und überleben einen Neustart.
- Tooltip beim Hover über eine Markierung im Editor.
