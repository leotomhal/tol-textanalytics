import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { analysiere } from "../src/analyse/index";

/**
 * Testkorpus-Grundgerüst (Konzept 7). Jede `.md`-Datei in tests/korpus/ mit
 * gleichnamiger `.expected.json` wird analysiert; die in der JSON
 * angegebenen Felder werden gegen das tatsächliche Ergebnis geprüft
 * (nicht per Snapshot — erwartete Werte stehen explizit in der JSON).
 *
 * Aktuell abgedeckte Fälle (weitere folgen mit M2–M8, siehe Konzept 7):
 * - Maskierungsmix (Frontmatter, Wikilinks, Links, Fußnoten, Listen, Code)
 * - englischer Text (Sprachprüfung)
 */

const KORPUS_DIR = join(__dirname, "korpus");

function findeFaelle(): string[] {
	return readdirSync(KORPUS_DIR)
		.filter((datei) => datei.endsWith(".md"))
		.map((datei) => datei.replace(/\.md$/, ""));
}

describe("Testkorpus (Fundament M1)", () => {
	for (const fall of findeFaelle()) {
		it(`${fall}: entspricht den erwarteten Werten`, () => {
			const text = readFileSync(join(KORPUS_DIR, `${fall}.md`), "utf-8");
			const erwartet = JSON.parse(readFileSync(join(KORPUS_DIR, `${fall}.expected.json`), "utf-8"));
			const ergebnis = analysiere(text);

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
		});
	}
});
