# tol_textanalytics

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
ohne Build-Schritt, ohne TypeScript, ohne Tests. Die Text-Markierungen
laufen über ein CodeMirror-6-`ViewPlugin`, das sich bei jeder
Dokumentänderung selbst neu berechnet (statt über von außen dispatchte
StateEffects wie in der vorherigen Fassung) — das war vermutlich auch die
Ursache des Problems.

`konzept-textanalyse-plugin.md` bleibt als Referenz für die ursprüngliche,
umfangreichere Zielvision im Repo, beschreibt aber **nicht** mehr den
aktuellen Funktionsumfang.

## Entwicklung

Kein Build-Schritt. `main.js`, `manifest.json` und `styles.css` direkt
bearbeiten und zum Testen nach `<Vault>/.obsidian/plugins/tol-textanalyse/`
kopieren (oder das Repo dorthin symlinken), dann das Plugin in Obsidian
neu laden.

## Funktionsumfang

- Aktivierung nur bei Notizen mit `typ: draft` im Frontmatter.
- Markierungen im Editor: lange Sätze (>25 Wörter, >35 Wörter zusätzlich
  hervorgehoben), Passiv-Konstruktionen (inkl. invertiertes Passiv),
  Füllwörter, monotone Satzlängen pro Absatz ("Sprachmelodie").
- Sidebar-Panel mit zwei Tabs: Statistik (Composite-Score, Flesch-Index,
  Wörter/Zeichen/Sätze/Lesezeit, Kategorien-Zähler mit Klick zum
  Ein-/Ausblenden, Zielzeichenzahl mit Statusanzeige) und Issues (Liste
  aller Fundstellen mit Kontext-Snippet, Klick springt zur Stelle im
  Editor).
- Tooltip beim Hover über eine Markierung im Editor.
