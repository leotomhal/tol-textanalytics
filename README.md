# tol_textanalytics

Obsidian-Plugin „Textanalyse" — prüft den aktiven Text auf Lesbarkeit, Satzbau, Wortschatz und Stil und markiert Befunde an der Fundstelle im Text.

Konzept: [`konzept-textanalyse-plugin.md`](./konzept-textanalyse-plugin.md).
Umsetzung erfolgt in Milestones (M0–M9), einzeln freigegeben.

## Entwicklung

```bash
npm install
npm run dev      # esbuild --watch
npm run build    # Typecheck + Production-Build
npm test         # Vitest
npm run lint
```

Der Ordner `src/analyse/` darf keine `obsidian`-Abhängigkeit importieren (siehe Konzept 2.1) — er ist der isoliert testbare Analysekern.

## Offene Punkte aus Konzept Abschnitt 8 (M8-Entscheidungen)

1. **Performance.** Zielwert < 50 ms für 5.000 Wörter (Konzept 8.1). Gemessen: Median ~15–25 ms, auch bei realistischer Markdown-Struktur. Ein Ineffizienz-Bug in `vorbereitung.ts` (kompletter Text wurde bei jedem der ~20 Maskierungsdurchläufe neu zusammengesetzt, auch wenn nichts zu maskieren war) wurde dabei gefunden und mit einem Dirty-Flag-Cache behoben — davor lag der Median bei ~40 ms, teils über der Zielmarke. Ein Web Worker ist damit nicht nötig. `tests/perf.test.ts` bewacht das als Regressionstest (großzügige 200-ms-Schwelle, kein exakter Zielwert — CI-Maschinen streuen stärker).
2. **Mobile.** Entscheidung (mit Auftraggeber abgestimmt): `isDesktopOnly: true`. Die CodeMirror-Decorations und insbesondere der inoffizielle `.cm`-Zugriff auf die EditorView (siehe `main.ts`) sind auf Obsidian Mobile nicht getestet — Desktop-only ist der ehrlichere Default, bis jemand es auf einem echten Gerät geprüft hat.
3. **Stemmer-Konsistenz.** Gegenstandslos: Die verfügbare DeReWo-Datenbasis ist eine Wortformenliste ohne Häufigkeitsrang (Abweichung aus M2, siehe `scripts/derewo-aufbereiten.ts`), der Abgleich läuft per exaktem Wortformvergleich ohne Stemmer — es gibt keine zwei Normalisierungspfade, die auseinanderlaufen könnten.
4. **Schlussteil-Auslöser.** Startliste (`STANDARD_SCHLUSSTEIL_AUSLOESER` in `src/analyse/vorbereitung.ts`) ist **nicht** aus echten Pressemitteilungen abgeleitet, wie es das Konzept eigentlich verlangt — es lagen keine solchen Dateien vor. Stattdessen eine aus allgemein üblichen PM-Konventionen zusammengestellte Liste, in den Settings editierbar. Vor Produktivnutzung gegen echte Formulierungen prüfen und anpassen.

## Bekannte Restrisiken (ungetestet in dieser Sandbox)

`main.ts`, `AnalyseView.ts` und `Settings.ts` sind gegen die echten Obsidian-Typdefinitionen typgeprüft, konnten aber nie gegen eine laufende Obsidian-Instanz getestet werden (diese Entwicklungsumgebung hat keinen Zugriff darauf). Besonders relevant: `main.ts` liest die CodeMirror-6-EditorView über `(editor as any).cm` aus — keine offizielle, dokumentierte Obsidian-API, sondern der in der Community verbreitete De-facto-Weg für eigene Editor-Decorations. Vor Produktivnutzung einmal in einem echten Vault laden und prüfen: Panel-Updates beim Tippen, Markierungen im Editor, Checklisten-Navigation, Settings-Tab.
