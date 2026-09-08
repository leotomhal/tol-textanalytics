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
- Einstellungen (Zielzeichenzahlen, abgeschaltete Kategorien) werden im
  Vault gespeichert und überleben einen Neustart.
- Tooltip beim Hover über eine Markierung im Editor.
