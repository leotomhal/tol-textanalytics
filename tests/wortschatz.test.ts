import { describe, expect, it } from "vitest";
import { analysiereWortschatz, derewoFrequenzquelle } from "../src/analyse/wortschatz";
import type { Frequenzquelle } from "../src/analyse/wortschatz";
import { tokenisiereWoerter } from "../src/analyse/tokenize";

describe("derewoFrequenzquelle", () => {
	it("erkennt gängige deutsche Wörter als bekannt", () => {
		for (const wort of ["Hund", "Universität", "schnell", "Forschung"]) {
			expect(derewoFrequenzquelle.istBekannt(wort)).toBe(true);
		}
	});

	it("ist unabhängig von Groß-/Kleinschreibung", () => {
		expect(derewoFrequenzquelle.istBekannt("HUND")).toBe(derewoFrequenzquelle.istBekannt("hund"));
	});

	it("erkennt einen erfundenen Kunstbegriff nicht als bekannt", () => {
		expect(derewoFrequenzquelle.istBekannt("Xylophonquetschwabbeligkeit")).toBe(false);
	});
});

function testQuelle(bekannt: string[]): Frequenzquelle {
	const set = new Set(bekannt.map((w) => w.toLowerCase()));
	return { istBekannt: (wort) => set.has(wort.toLowerCase()) };
}

describe("analysiereWortschatz", () => {
	it("liefert 0 % für einen Text ohne unbekannte Wörter", () => {
		const woerter = tokenisiereWoerter("Der Hund läuft schnell.");
		const ergebnis = analysiereWortschatz(woerter, testQuelle(["Der", "Hund", "läuft", "schnell"]));
		expect(ergebnis.anteilUnbekannt).toBe(0);
		expect(ergebnis.seltensteWoerter).toHaveLength(0);
	});

	it("berechnet den Anteil unbekannter Wörter korrekt", () => {
		const woerter = tokenisiereWoerter("Ein zwei drei vier"); // 4 Wörter
		const ergebnis = analysiereWortschatz(woerter, testQuelle(["Ein", "zwei"]));
		expect(ergebnis.anteilUnbekannt).toBe(50);
	});

	it("dedupliziert die Beispielliste seltener Wörter", () => {
		const woerter = tokenisiereWoerter("Fachbegriff und noch ein Fachbegriff im Text.");
		const ergebnis = analysiereWortschatz(woerter, testQuelle(["und", "noch", "ein", "im"]));
		const texte = ergebnis.seltensteWoerter.map((w) => w.text);
		expect(new Set(texte).size).toBe(texte.length);
	});

	it("liefert 0 für eine leere Wortliste, ohne zu werfen", () => {
		expect(analysiereWortschatz([], testQuelle([]))).toEqual({ anteilUnbekannt: 0, seltensteWoerter: [] });
	});
});
