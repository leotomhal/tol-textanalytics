import { beforeAll, describe, expect, it } from "vitest";
import {
	analysiereWortschatz,
	ladeDerewoFrequenzquelle,
	alleBekanntQuelle,
	mitUeberschreibungen,
	findeSeltenesWortBefunde,
} from "../src/analyse/wortschatz";
import type { Frequenzquelle } from "../src/analyse/wortschatz";
import { tokenisiereWoerter } from "../src/analyse/tokenize";

describe("ladeDerewoFrequenzquelle", () => {
	let quelle: Frequenzquelle;

	beforeAll(async () => {
		quelle = await ladeDerewoFrequenzquelle();
	});

	it("erkennt gängige deutsche Wörter als bekannt", () => {
		for (const wort of ["Hund", "Universität", "schnell", "Forschung"]) {
			expect(quelle.istBekannt(wort)).toBe(true);
		}
	});

	it("ist unabhängig von Groß-/Kleinschreibung", () => {
		expect(quelle.istBekannt("HUND")).toBe(quelle.istBekannt("hund"));
	});

	it("erkennt einen erfundenen Kunstbegriff nicht als bekannt", () => {
		expect(quelle.istBekannt("Xylophonquetschwabbeligkeit")).toBe(false);
	});

	it("liefert bei zweitem Aufruf dieselbe (gecachte) Instanz", async () => {
		const zweiterAufruf = await ladeDerewoFrequenzquelle();
		expect(zweiterAufruf).toBe(quelle);
	});
});

describe("alleBekanntQuelle", () => {
	it("meldet jedes Wort als bekannt (Fallback ohne geladene Wortliste)", () => {
		expect(alleBekanntQuelle.istBekannt("Xylophonquetschwabbeligkeit")).toBe(true);
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

describe("mitUeberschreibungen", () => {
	it("behandelt ignorierte Wörter als bekannt, auch wenn die Basisquelle sie nicht kennt", () => {
		const basis = testQuelle([]);
		const quelle = mitUeberschreibungen(basis, new Set(["fachbegriff"]), new Set());
		expect(quelle.istBekannt("Fachbegriff")).toBe(true);
	});

	it("behandelt 'immer markieren'-Wörter als unbekannt, auch wenn die Basisquelle sie kennt", () => {
		const basis = testQuelle(["Hund"]);
		const quelle = mitUeberschreibungen(basis, new Set(), new Set(["hund"]));
		expect(quelle.istBekannt("Hund")).toBe(false);
	});

	it("lässt unbeteiligte Wörter unverändert an die Basisquelle durchreichen", () => {
		const basis = testQuelle(["Hund"]);
		const quelle = mitUeberschreibungen(basis, new Set(), new Set());
		expect(quelle.istBekannt("Hund")).toBe(true);
		expect(quelle.istBekannt("Katze")).toBe(false);
	});

	it("Ignorieren gewinnt, falls ein Wort in beiden Listen steht", () => {
		const basis = testQuelle([]);
		const quelle = mitUeberschreibungen(basis, new Set(["wort"]), new Set(["wort"]));
		expect(quelle.istBekannt("Wort")).toBe(true);
	});
});

describe("findeSeltenesWortBefunde", () => {
	it("erzeugt für jedes unbekannte Wort einen ignorierbaren Befund mit Fundstelle", () => {
		const text = "Ein Fachbegriff steht hier.";
		const woerter = tokenisiereWoerter(text);
		const befunde = findeSeltenesWortBefunde(woerter, testQuelle(["Ein", "steht", "hier"]), text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0]).toMatchObject({ kategorie: "seltenes-wort", text: "Fachbegriff", ignorierbar: true });
		expect(text.slice(befunde[0].von, befunde[0].bis)).toBe(befunde[0].text);
	});

	it("erzeugt einen Befund pro Vorkommen, nicht nur einmal pro Wort", () => {
		const text = "Fachbegriff und noch ein Fachbegriff.";
		const woerter = tokenisiereWoerter(text);
		const befunde = findeSeltenesWortBefunde(woerter, testQuelle(["und", "noch", "ein"]), text);
		expect(befunde).toHaveLength(2);
	});

	it("liefert keine Befunde, wenn alle Wörter bekannt sind", () => {
		const text = "Der Hund läuft.";
		const woerter = tokenisiereWoerter(text);
		const befunde = findeSeltenesWortBefunde(woerter, alleBekanntQuelle, text);
		expect(befunde).toHaveLength(0);
	});
});
