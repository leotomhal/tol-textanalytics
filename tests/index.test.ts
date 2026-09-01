import { describe, expect, it } from "vitest";
import { analysiere } from "../src/analyse/index";
import { ladeDerewoFrequenzquelle } from "../src/analyse/wortschatz";

describe("analysiere (Fundament M1 + Kennzahlen M2)", () => {
	it("liefert ein vollständiges Ergebnis-Objekt für einen einfachen deutschen Text", () => {
		const text =
			"# Überschrift\n\nDie Universität Halle hat eine Studie veröffentlicht. Sie zeigt neue Ergebnisse.";
		const ergebnis = analysiere(text);

		expect(ergebnis.istDeutsch).toBe(true);
		expect(ergebnis.satzlaengen).toHaveLength(2);
		expect(ergebnis.woerterMaskiert).toBeGreaterThan(0); // "Überschrift" zählt nicht mit
		expect(ergebnis.woerterGesamt).toBeGreaterThan(0);
		expect(ergebnis.dauerMs).toBeGreaterThanOrEqual(0);
	});

	it("berechnet die Kennzahlen aus M2 für deutschen Text mit Sätzen", () => {
		const text =
			"Die Universität Halle hat heute eine neue Studie zur Landwirtschaft veröffentlicht. Die Ergebnisse überraschen viele Fachleute in der Region.";
		const ergebnis = analysiere(text);

		const ids = ergebnis.kennzahlen.map((k) => k.id);
		expect(ids).toEqual(
			expect.arrayContaining(["schulstufe", "lix", "satzlaenge-mittel", "lange-saetze", "rhythmus", "fachbegriffe"])
		);
		for (const k of ergebnis.kennzahlen) {
			expect(k.status).toBe("neutral"); // Zielprofile kommen erst mit M7
			expect(typeof k.anzeige).toBe("string");
		}
	});

	it("lässt kennzahlen und befunde leer, wenn kein deutscher Text erkannt wird", () => {
		const ergebnis = analysiere(
			"The university published a new study today showing interesting results for the region."
		);
		expect(ergebnis.istDeutsch).toBe(false);
		expect(ergebnis.kennzahlen).toEqual([]);
	});

	it("lässt kennzahlen leer, wenn es keine analysierbaren Sätze gibt", () => {
		const ergebnis = analysiere("# Nur eine Überschrift\n- Nur ein Listenpunkt");
		expect(ergebnis.kennzahlen).toEqual([]);
		expect(ergebnis.satzlaengen).toEqual([]);
	});

	it("liefert Befunde für gleichförmige Passagen", () => {
		const text =
			"Der Hund lief schnell. Die Katze schlief lang. Der Vogel sang laut. Das Kind spielte froh.";
		const ergebnis = analysiere(text);
		expect(ergebnis.befunde.some((b) => b.kategorie === "gleichfoermige-passage")).toBe(true);
	});

	it("wendet den Schlussteil-Auslöser an und liefert die Zeilennummer", () => {
		const text = "Erster Absatz.\n\nZur Studie:\nJournal XY, 2026.";
		const ergebnis = analysiere(text, { schlussteilAusloeser: ["Zur Studie:"] });
		expect(ergebnis.schlussteilAbZeile).toBe(2);
		expect(ergebnis.satzlaengen).toHaveLength(1);
	});

	it("bleibt performant genug für einen kurzen Text (grober Rauchtest, kein harter Grenzwert)", () => {
		const text = "Ein kurzer deutscher Testsatz mit ausreichend Wörtern. ".repeat(50);
		const ergebnis = analysiere(text);
		expect(ergebnis.dauerMs).toBeLessThan(1000);
	});

	it("ohne übergebene Frequenzquelle: Fachbegriffe-Kennzahl bleibt bei 0 % (alleBekanntQuelle-Fallback)", () => {
		const text = "Die Interdependenztheorie beschreibt komplexe Wechselwirkungsstrukturen zwischen Organisationen.";
		const ergebnis = analysiere(text);
		const fachbegriffe = ergebnis.kennzahlen.find((k) => k.id === "fachbegriffe");
		expect(fachbegriffe?.wert).toBe(0);
	});

	it("mit echter DeReWo-Wortliste: Fachbegriffe werden erkannt und wirken auf die WSTF-Korrektur", async () => {
		const quelle = await ladeDerewoFrequenzquelle();
		const text =
			"Ein internationales Forscherteam hat mithilfe hochauflösender Massenspektrometrie die Interaktion zwischen Photosyntheseproteinen und Thylakoidmembranen untersucht.";
		const ergebnis = analysiere(text, { frequenzquelle: quelle });
		const fachbegriffe = ergebnis.kennzahlen.find((k) => k.id === "fachbegriffe");
		const schulstufe = ergebnis.kennzahlen.find((k) => k.id === "schulstufe");
		expect(fachbegriffe?.wert).toBeGreaterThan(0);
		expect(schulstufe?.nebenwert).toBeDefined();
	});
});
