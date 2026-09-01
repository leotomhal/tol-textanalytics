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
