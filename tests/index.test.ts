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

	it("berechnet die Kennzahlen aus M2+M3 für deutschen Text mit Sätzen", () => {
		const text =
			"Die Universität Halle hat heute eine neue Studie zur Landwirtschaft veröffentlicht. Die Ergebnisse überraschen viele Fachleute in der Region.";
		const ergebnis = analysiere(text);

		const ids = ergebnis.kennzahlen.map((k) => k.id);
		expect(ids).toEqual(
			expect.arrayContaining([
				"schulstufe", "lix", "satzlaenge-mittel", "lange-saetze", "rhythmus",
				"fachbegriffe", "fuellwoerter", "nominalstil", "perfekt",
			])
		);
		for (const k of ergebnis.kennzahlen) {
			expect(k.status).toBe("neutral"); // Zielprofile kommen erst mit M7
			expect(typeof k.anzeige).toBe("string");
		}
	});

	it("liefert Stilmarker-Befunde (Füllwörter, Perfekt, Nominalstil, Streckverben) mit Fundstelle", () => {
		const text =
			"Die Untersuchung hat eigentlich gezeigt, dass die Methode zur Anwendung kommen sollte.";
		const ergebnis = analysiere(text);

		const kategorien = new Set(ergebnis.befunde.map((b) => b.kategorie));
		expect(kategorien.has("fuellwort")).toBe(true);
		expect(kategorien.has("perfekt")).toBe(true);
		expect(kategorien.has("nominalstil")).toBe(true);
		expect(kategorien.has("streckverb")).toBe(true);
		for (const b of ergebnis.befunde) {
			expect(text.slice(b.von, b.bis)).toBe(b.text);
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

	describe("Cursor-Satz-Ausschluss (Konzept 2.2)", () => {
		it("nimmt den Satz unter dem Cursor aus Satzlängen und Kennzahlen aus", () => {
			const fertig = "Ein fertiger Satz mit genug Wörtern für die Analyse.";
			const unfertig = " Und hier tippt gerade noch j";
			const text = fertig + unfertig;
			const cursorOffset = text.length; // Cursor am Ende, mitten im unfertigen Satz.

			const ohneCursor = analysiere(text);
			const mitCursor = analysiere(text, { cursorOffset });

			expect(ohneCursor.aktuellerSatzAusgenommen).toBe(false);
			expect(mitCursor.aktuellerSatzAusgenommen).toBe(true);
			expect(mitCursor.satzlaengen.length).toBeLessThan(ohneCursor.satzlaengen.length);
			expect(mitCursor.woerter.some((w) => w.text === "tippt")).toBe(false);
		});

		it("lässt fertige Sätze vor dem Cursor unangetastet", () => {
			const text = "Erster fertiger Satz. Zweiter fertiger Satz. Und hier tippt jemand w";
			const cursorOffset = text.length;
			const ergebnis = analysiere(text, { cursorOffset });
			expect(ergebnis.woerter.some((w) => w.text === "Erster")).toBe(true);
			expect(ergebnis.woerter.some((w) => w.text === "Zweiter")).toBe(true);
			expect(ergebnis.woerter.some((w) => w.text === "tippt")).toBe(false);
		});

		it("setzt aktuellerSatzAusgenommen nicht, wenn der Cursor außerhalb aller Sätze liegt (z. B. in einer Leerzeile)", () => {
			const text = "Ein Satz.\n\n";
			const ergebnis = analysiere(text, { cursorOffset: text.length });
			expect(ergebnis.aktuellerSatzAusgenommen).toBe(false);
		});

		it("erhöht woerterMaskiert um die Wörter des ausgenommenen Satzes", () => {
			const text = "Ein fertiger Satz. Und hier tippt jemand noch w";
			const ohneCursor = analysiere(text);
			const mitCursor = analysiere(text, { cursorOffset: text.length });
			expect(mitCursor.woerterMaskiert).toBeGreaterThan(ohneCursor.woerterMaskiert);
		});
	});
});
