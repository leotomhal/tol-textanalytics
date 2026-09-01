import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { analysiere, STANDARD_SCHLUSSTEIL_AUSLOESER } from "../src/analyse/index";

/**
 * Testkorpus (Konzept 7). Jede `.md`-Datei in tests/korpus/ mit
 * gleichnamiger `.expected.json` wird analysiert; die in der JSON
 * angegebenen Felder werden gegen das tatsächliche Ergebnis geprüft
 * (nicht per Snapshot — erwartete Werte stehen explizit in der JSON).
 * Die Schlussteil-Auslöserliste ist immer die Standardliste, wie sie auch
 * main.ts standardmäßig verwendet (Konzept 8.4).
 *
 * Abgedeckte Fälle (siehe Konzept 7 für die vollständige Liste):
 * - Maskierungsmix (Frontmatter, Wikilinks, Links, Fußnoten, Listen, Code)
 * - Callouts (Sonderfall der Blockquote-Maskierung)
 * - englischer Text (Sprachprüfung)
 * - PM-artiger Text mit Zwischenüberschriften und Standardschluss
 * - Fachtext mit hoher Fachwortdichte
 * - bewusst schlechter Stil (Nominalstil, Passiv, Schachtelsätze)
 * - Text aus überwiegend Überschriften und Listen (fast nichts zu analysieren)
 *
 * Nicht als Korpus-Datei, weil dafür `cursorOffset` nötig ist (vom
 * generischen Runner hier nicht unterstützt) bzw. schon ausführlich als
 * Unit-Tests abgedeckt: Cursor-Satz-Ausschluss (siehe index.test.ts) und
 * Kantenfälle der Satztrennung (siehe tokenize.test.ts).
 */

const KORPUS_DIR = join(__dirname, "korpus");

function findeFaelle(): string[] {
	return readdirSync(KORPUS_DIR)
		.filter((datei) => datei.endsWith(".md"))
		.map((datei) => datei.replace(/\.md$/, ""));
}

describe("Testkorpus", () => {
	for (const fall of findeFaelle()) {
		it(`${fall}: entspricht den erwarteten Werten`, () => {
			const text = readFileSync(join(KORPUS_DIR, `${fall}.md`), "utf-8");
			const erwartet = JSON.parse(readFileSync(join(KORPUS_DIR, `${fall}.expected.json`), "utf-8"));
			const ergebnis = analysiere(text, { schlussteilAusloeser: STANDARD_SCHLUSSTEIL_AUSLOESER });

			if ("istDeutsch" in erwartet) {
				expect(ergebnis.istDeutsch).toBe(erwartet.istDeutsch);
			}
			if ("satzlaengen" in erwartet) {
				expect(ergebnis.satzlaengen).toEqual(erwartet.satzlaengen);
			}
			if ("woerterGesamt" in erwartet) {
				expect(ergebnis.woerterGesamt).toBe(erwartet.woerterGesamt);
			}
			if ("woerterMaskiert" in erwartet) {
				expect(ergebnis.woerterMaskiert).toBe(erwartet.woerterMaskiert);
			}
			if ("schlussteilAbZeile" in erwartet) {
				expect(ergebnis.schlussteilAbZeile).toBe(erwartet.schlussteilAbZeile);
			}
			if ("enthaeltKategorien" in erwartet) {
				const kategorien = new Set(ergebnis.befunde.map((b) => b.kategorie));
				for (const k of erwartet.enthaeltKategorien as string[]) {
					expect(kategorien.has(k as never), `erwartete Kategorie "${k}" fehlt`).toBe(true);
				}
			}
			if ("enthaeltKeineKategorien" in erwartet) {
				const kategorien = new Set(ergebnis.befunde.map((b) => b.kategorie));
				for (const k of erwartet.enthaeltKeineKategorien as string[]) {
					expect(kategorien.has(k as never), `unerwartete Kategorie "${k}" gefunden`).toBe(false);
				}
			}
			if ("maxBefunde" in erwartet) {
				expect(ergebnis.befunde.length).toBeLessThanOrEqual(erwartet.maxBefunde as number);
			}

			// Offset-Test (Konzept 7): für jeden Befund muss rohtext.slice(von,bis) === befund.text gelten.
			for (const b of ergebnis.befunde) {
				expect(text.slice(b.von, b.bis)).toBe(b.text);
			}
		});
	}
});
